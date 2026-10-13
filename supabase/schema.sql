-- =====================================================================
-- IPPONIA: esquema inicial (v1)
-- Pegar completo en Supabase > SQL Editor > New query > Run.
-- Es seguro volver a ejecutarlo: usa "if not exists" / "or replace".
--
-- Modelo multi-cliente (SaaS): cada cliente es una ORGANIZACIÓN y sus datos
-- solo los ven los usuarios que son miembros de esa organización (RLS).
-- =====================================================================

-- ---------- Tablas ----------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- owner: administra | mesa y kansa: cargan resultados | viewer: solo mira
  role text not null default 'owner' check (role in ('owner', 'mesa', 'kansa', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Resultados guardados (historial) de Kata, Kobudo, Destreza y Kumite.
-- "payload" guarda el detalle completo tal como lo genera la app (puntajes,
-- faltas, nombres, ganador...), para poder evolucionar sin migraciones.
create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  modulo text not null check (modulo in ('kata', 'kobudo', 'destreza', 'kumite')),
  area text,
  payload jsonb not null,
  created_by uuid not null default auth.uid () references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists results_org_created_idx
  on public.results (org_id, created_at desc);

-- ---------- Funciones auxiliares ----------
-- security definer: leen "members" sin pasar por RLS (evita recursión infinita).

create or replace function public.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.members where user_id = auth.uid()
$$;

create or replace function public.can_write(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where org_id = target_org
      and user_id = auth.uid()
      and role in ('owner', 'mesa', 'kansa')
  )
$$;

create or replace function public.is_owner(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where org_id = target_org and user_id = auth.uid() and role = 'owner'
  )
$$;

-- ---------- Seguridad por fila (RLS) ----------

alter table public.organizations enable row level security;
alter table public.members enable row level security;
alter table public.results enable row level security;

-- organizations
drop policy if exists "org_select" on public.organizations;
create policy "org_select" on public.organizations
  for select to authenticated
  using (id in (select public.my_org_ids()));

drop policy if exists "org_update" on public.organizations;
create policy "org_update" on public.organizations
  for update to authenticated
  using (public.is_owner(id))
  with check (public.is_owner(id));

-- members: cada uno ve a los miembros de sus organizaciones; solo el owner los administra
drop policy if exists "members_select" on public.members;
create policy "members_select" on public.members
  for select to authenticated
  using (org_id in (select public.my_org_ids()));

drop policy if exists "members_owner_insert" on public.members;
create policy "members_owner_insert" on public.members
  for insert to authenticated
  with check (public.is_owner(org_id));

drop policy if exists "members_owner_update" on public.members;
create policy "members_owner_update" on public.members
  for update to authenticated
  using (public.is_owner(org_id))
  with check (public.is_owner(org_id));

drop policy if exists "members_owner_delete" on public.members;
create policy "members_owner_delete" on public.members
  for delete to authenticated
  using (public.is_owner(org_id));

-- results: leer todos los de la organización; escribir quien tenga rol de carga;
-- borrar solo el owner
drop policy if exists "results_select" on public.results;
create policy "results_select" on public.results
  for select to authenticated
  using (org_id in (select public.my_org_ids()));

drop policy if exists "results_insert" on public.results;
create policy "results_insert" on public.results
  for insert to authenticated
  with check (public.can_write(org_id) and created_by = auth.uid());

drop policy if exists "results_delete" on public.results;
create policy "results_delete" on public.results
  for delete to authenticated
  using (public.is_owner(org_id));

-- ---------- Alta automática de organización ----------
-- Al registrarse un usuario nuevo se crea su organización y queda como owner.
-- El nombre sale del dato "org_name" del registro, o del inicio de su email.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nueva_org uuid;
begin
  insert into public.organizations (name)
  values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'org_name'), ''), split_part(new.email, '@', 1)))
  returning id into nueva_org;

  insert into public.members (org_id, user_id, role)
  values (nueva_org, new.id, 'owner');

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Jueces (v1.1) ----------
-- Lista de jueces de cada organización, para autocompletar sus nombres al cargar puntajes.
create table if not exists public.jueces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  created_at timestamptz not null default now(),
  unique (org_id, nombre)
);

alter table public.jueces enable row level security;

drop policy if exists "jueces_select" on public.jueces;
create policy "jueces_select" on public.jueces
  for select to authenticated
  using (org_id in (select public.my_org_ids()));

drop policy if exists "jueces_insert" on public.jueces;
create policy "jueces_insert" on public.jueces
  for insert to authenticated
  with check (public.can_write(org_id));

drop policy if exists "jueces_update" on public.jueces;
create policy "jueces_update" on public.jueces
  for update to authenticated
  using (public.can_write(org_id))
  with check (public.can_write(org_id));

drop policy if exists "jueces_delete" on public.jueces;
create policy "jueces_delete" on public.jueces
  for delete to authenticated
  using (public.is_owner(org_id));

-- =====================================================================
-- ROLES (v1.2) — migración. Pegar en Supabase > SQL Editor > New query > Run.
-- Es seguro volver a ejecutarla.
--
-- Roles por organización (tabla members.role):
--   administrador  control total de su organización: equipo, listas (jueces,
--                  competidores), cargar resultados, ver y borrar el historial
--   supervisor     solo ve el historial de resultados (auditoría)
--   mesa           carga resultados; ve historial; recibe sugerencias de jueces
--   juez           (en desarrollo) cargará su propio puntaje desde su dispositivo
-- Rol de plataforma (tabla platform_admins):
--   superadministrador  dueño del SaaS: acceso total a todas las organizaciones
-- =====================================================================

-- ---------- Superadministradores de la plataforma ----------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- Cada uno puede ver solo su propia fila. Nadie puede agregar ni quitar superadministradores
-- desde la app: solo desde este SQL Editor.
drop policy if exists "platform_admins_select_propio" on public.platform_admins;
create policy "platform_admins_select_propio" on public.platform_admins
  for select to authenticated
  using (user_id = auth.uid());

-- Tu cuenta (si ya existe y tiene el email confirmado)
insert into public.platform_admins (user_id)
select id from auth.users
where lower(email) = 'melquiades.iguini@gmail.com' and email_confirmed_at is not null
on conflict do nothing;

-- ---------- Nuevos roles de organización ----------
alter table public.members drop constraint if exists members_role_check;

update public.members
set role = case role
  when 'owner' then 'administrador'
  when 'kansa' then 'mesa'
  when 'viewer' then 'supervisor'
  else role
end;

alter table public.members
  add constraint members_role_check
  check (role in ('administrador', 'supervisor', 'juez', 'mesa'));

alter table public.members alter column role set default 'mesa';

-- ---------- Funciones auxiliares ----------
create or replace function public.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

-- Organizaciones visibles: las propias (y todas, para el superadministrador)
create or replace function public.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.organizations where public.es_superadmin()
  union
  select org_id from public.members where user_id = auth.uid()
$$;

-- Organización "activa" del usuario: la última a la que se unió
create or replace function public.mi_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.members
  where user_id = auth.uid()
  order by created_at desc
  limit 1
$$;

create or replace function public.mi_rol(target_org uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.members where org_id = target_org and user_id = auth.uid()
$$;

-- Administrador de la organización (o superadministrador)
create or replace function public.is_owner(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_superadmin() or coalesce(public.mi_rol(target_org) = 'administrador', false)
$$;

-- Puede cargar resultados
create or replace function public.can_write(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_superadmin() or coalesce(public.mi_rol(target_org) in ('administrador', 'mesa'), false)
$$;

-- Puede ver el historial de resultados
create or replace function public.puede_ver_resultados(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_superadmin()
    or coalesce(public.mi_rol(target_org) in ('administrador', 'supervisor', 'mesa'), false)
$$;

-- ---------- Políticas ----------
-- organizations / members: igual que antes, ahora con los roles nuevos
drop policy if exists "org_select" on public.organizations;
create policy "org_select" on public.organizations
  for select to authenticated
  using (id in (select public.my_org_ids()));

drop policy if exists "org_update" on public.organizations;
create policy "org_update" on public.organizations
  for update to authenticated
  using (public.is_owner(id))
  with check (public.is_owner(id));

drop policy if exists "members_select" on public.members;
create policy "members_select" on public.members
  for select to authenticated
  using (org_id in (select public.my_org_ids()));

-- results: el juez no ve el historial
drop policy if exists "results_select" on public.results;
create policy "results_select" on public.results
  for select to authenticated
  using (public.puede_ver_resultados(org_id));

-- jueces: la lista completa solo la ve el administrador; mesa solo puede agregar nombres
-- (los guarda al cargar un resultado) y recibe sugerencias con sugerir_jueces()
drop policy if exists "jueces_select" on public.jueces;
create policy "jueces_select" on public.jueces
  for select to authenticated
  using (public.is_owner(org_id));

drop policy if exists "jueces_update" on public.jueces;
create policy "jueces_update" on public.jueces
  for update to authenticated
  using (public.is_owner(org_id))
  with check (public.is_owner(org_id));

-- Sugerencias al escribir un nombre (mínimo 2 letras, hasta 8 coincidencias):
-- no permite bajar la lista completa
create or replace function public.sugerir_jueces(texto text)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select j.nombre
  from public.jueces j
  where length(trim(texto)) >= 2
    and j.org_id = public.mi_org_id()
    and public.can_write(j.org_id)
    and j.nombre ilike '%' || replace(replace(replace(trim(texto), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by j.nombre
  limit 8
$$;

-- ---------- Equipo e invitaciones ----------
create table if not exists public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('administrador', 'supervisor', 'juez', 'mesa')),
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

alter table public.invitaciones enable row level security;

drop policy if exists "invitaciones_admin" on public.invitaciones;
create policy "invitaciones_admin" on public.invitaciones
  for all to authenticated
  using (public.is_owner(org_id))
  with check (public.is_owner(org_id));

-- Miembros de la organización con su email (solo para administradores)
create or replace function public.listar_equipo()
returns table (user_id uuid, email text, role text, es_yo boolean)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, u.email::text, m.role, m.user_id = auth.uid()
  from public.members m
  join auth.users u on u.id = m.user_id
  where m.org_id = public.mi_org_id()
    and public.is_owner(m.org_id)
  order by u.email
$$;

-- Al registrarse: si hay invitaciones para ese email y el email ya está confirmado
-- (por ejemplo, ingreso con Google), se une a esas organizaciones; si no, crea la suya.
-- El superadministrador se reconoce solo por su email confirmado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nueva_org uuid;
  filas integer := 0;
begin
  if new.email_confirmed_at is not null then
    if lower(new.email) = 'melquiades.iguini@gmail.com' then
      insert into public.platform_admins (user_id) values (new.id) on conflict do nothing;
    end if;

    insert into public.members (org_id, user_id, role)
    select org_id, new.id, role from public.invitaciones where email = lower(new.email)
    on conflict do nothing;
    get diagnostics filas = row_count;
    delete from public.invitaciones where email = lower(new.email);
  end if;

  if filas = 0 then
    insert into public.organizations (name)
    values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'org_name'), ''), split_part(new.email, '@', 1)))
    returning id into nueva_org;

    insert into public.members (org_id, user_id, role)
    values (nueva_org, new.id, 'administrador');
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Al confirmar el email (registro con email y contraseña): superadministrador e invitaciones
create or replace function public.al_confirmar_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    if lower(new.email) = 'melquiades.iguini@gmail.com' then
      insert into public.platform_admins (user_id) values (new.id) on conflict do nothing;
    end if;

    insert into public.members (org_id, user_id, role)
    select org_id, new.id, role from public.invitaciones where email = lower(new.email)
    on conflict do nothing;
    delete from public.invitaciones where email = lower(new.email);
  end if;
  return new;
end;
$$;

revoke execute on function public.al_confirmar_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.al_confirmar_email();

-- ---------- Permisos de ejecución de las funciones nuevas ----------
revoke execute on function public.sugerir_jueces(text) from public, anon;
revoke execute on function public.listar_equipo() from public, anon;
revoke execute on function public.mi_org_id() from public, anon;
grant execute on function public.sugerir_jueces(text) to authenticated;
grant execute on function public.listar_equipo() to authenticated;
grant execute on function public.mi_org_id() to authenticated;

-- =====================================================================
-- CONFIGURACIÓN (v1.3) — migración. Requiere haber ejecutado antes roles.sql.
-- Pegar en Supabase > SQL Editor > New query > Run. Es seguro volver a ejecutarla.
--
--  * Estado de los usuarios: activo / bloqueado (un usuario bloqueado pierde el acceso)
--  * Estado de los jueces: activo / inactivo (los inactivos no se sugieren al cargar puntajes)
--  * Competidores: nueva tabla, con su estado
-- =====================================================================

-- ---------- Estado de los usuarios ----------
alter table public.members
  add column if not exists estado text not null default 'activo';

alter table public.members drop constraint if exists members_estado_check;
alter table public.members
  add constraint members_estado_check check (estado in ('activo', 'bloqueado'));

-- Un usuario bloqueado deja de tener rol y de ver organizaciones
create or replace function public.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.organizations where public.es_superadmin()
  union
  select org_id from public.members where user_id = auth.uid() and estado = 'activo'
$$;

create or replace function public.mi_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.members
  where user_id = auth.uid() and estado = 'activo'
  order by created_at desc
  limit 1
$$;

create or replace function public.mi_rol(target_org uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.members
  where org_id = target_org and user_id = auth.uid() and estado = 'activo'
$$;

-- Equipo con estado (cambia el tipo de resultado, por eso se vuelve a crear)
drop function if exists public.listar_equipo();
create function public.listar_equipo()
returns table (user_id uuid, email text, role text, estado text, es_yo boolean)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, u.email::text, m.role, m.estado, m.user_id = auth.uid()
  from public.members m
  join auth.users u on u.id = m.user_id
  where m.org_id = public.mi_org_id()
    and public.is_owner(m.org_id)
  order by u.email
$$;

revoke execute on function public.listar_equipo() from public, anon;
grant execute on function public.listar_equipo() to authenticated;

-- ---------- Estado de los jueces ----------
alter table public.jueces add column if not exists activo boolean not null default true;

-- Las sugerencias solo incluyen jueces activos
create or replace function public.sugerir_jueces(texto text)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select j.nombre
  from public.jueces j
  where length(trim(texto)) >= 2
    and j.activo
    and j.org_id = public.mi_org_id()
    and public.can_write(j.org_id)
    and j.nombre ilike '%' || replace(replace(replace(trim(texto), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by j.nombre
  limit 8
$$;

-- ---------- Competidores ----------
create table if not exists public.competidores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  escuela text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, nombre)
);

alter table public.competidores enable row level security;

-- La lista completa solo la administra (y ve) el administrador
drop policy if exists "competidores_select" on public.competidores;
create policy "competidores_select" on public.competidores
  for select to authenticated
  using (public.is_owner(org_id));

drop policy if exists "competidores_insert" on public.competidores;
create policy "competidores_insert" on public.competidores
  for insert to authenticated
  with check (public.is_owner(org_id));

drop policy if exists "competidores_update" on public.competidores;
create policy "competidores_update" on public.competidores
  for update to authenticated
  using (public.is_owner(org_id))
  with check (public.is_owner(org_id));

drop policy if exists "competidores_delete" on public.competidores;
create policy "competidores_delete" on public.competidores
  for delete to authenticated
  using (public.is_owner(org_id));

-- =====================================================================
-- JUECES: datos completos (v1.4) — migración. Requiere roles.sql y configuracion.sql.
-- Pegar en Supabase > SQL Editor > New query > Run. Es seguro volver a ejecutarla.
--
-- Columnas del Excel de jueces: apellido, nombre, certificado, grado, organización.
-- =====================================================================

alter table public.jueces add column if not exists apellido text not null default '';
alter table public.jueces add column if not exists certificado boolean not null default false;
alter table public.jueces add column if not exists grado text;
alter table public.jueces add column if not exists organizacion text;

-- Dos jueces pueden llamarse igual de nombre: la identidad es apellido + nombre
alter table public.jueces drop constraint if exists jueces_org_id_nombre_key;
alter table public.jueces drop constraint if exists jueces_org_apellido_nombre_key;
alter table public.jueces
  add constraint jueces_org_apellido_nombre_key unique (org_id, apellido, nombre);

-- Sugerencias al escribir: se busca en "nombre apellido" y "apellido nombre"
-- y se devuelve "Nombre Apellido" (hasta 8, solo jueces activos)
create or replace function public.sugerir_jueces(texto text)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select btrim(j.nombre || ' ' || j.apellido)
  from public.jueces j
  where length(trim(texto)) >= 2
    and j.activo
    and j.org_id = public.mi_org_id()
    and public.can_write(j.org_id)
    and (
      btrim(j.nombre || ' ' || j.apellido) ilike '%' || replace(replace(replace(trim(texto), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or btrim(j.apellido || ' ' || j.nombre) ilike '%' || replace(replace(replace(trim(texto), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by 1
  limit 8
$$;

-- Guarda un nombre escrito a mano al cargar un resultado, salvo que ya exista en la lista
create or replace function public.registrar_juez(texto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid := public.mi_org_id();
  t text := btrim(regexp_replace(coalesce(texto, ''), '\s+', ' ', 'g'));
begin
  if org is null or t = '' or length(t) > 120 or not public.can_write(org) then
    return;
  end if;
  if exists (
    select 1 from public.jueces
    where org_id = org
      and (lower(btrim(nombre || ' ' || apellido)) = lower(t)
        or lower(btrim(apellido || ' ' || nombre)) = lower(t))
  ) then
    return;
  end if;
  insert into public.jueces (org_id, nombre) values (org, t) on conflict do nothing;
end;
$$;

revoke execute on function public.sugerir_jueces(text) from public, anon;
revoke execute on function public.registrar_juez(text) from public, anon;
grant execute on function public.sugerir_jueces(text) to authenticated;
grant execute on function public.registrar_juez(text) to authenticated;

-- =====================================================================
-- USUARIOS: acciones del administrador (v1.5) — migración.
-- Requiere roles.sql y configuracion.sql.
-- Pegar en Supabase > SQL Editor > New query > Run. Es seguro volver a ejecutarla.
--
--  * Cambiar la contraseña de un usuario de la organización
--  * Eliminar un usuario
--  * Un superadministrador no puede ser modificado ni eliminado por un administrador
-- =====================================================================

create or replace function public.es_superadmin_usuario(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = uid)
$$;

-- El administrador solo cambia roles y estados de usuarios que no son superadministradores
drop policy if exists "members_owner_update" on public.members;
create policy "members_owner_update" on public.members
  for update to authenticated
  using (public.is_owner(org_id) and (public.es_superadmin() or not public.es_superadmin_usuario(user_id)))
  with check (public.is_owner(org_id) and (public.es_superadmin() or not public.es_superadmin_usuario(user_id)));

drop policy if exists "members_owner_delete" on public.members;
create policy "members_owner_delete" on public.members
  for delete to authenticated
  using (public.is_owner(org_id) and (public.es_superadmin() or not public.es_superadmin_usuario(user_id)));

-- Valida que quien llama sea administrador y que el objetivo sea de su organización
create or replace function public.validar_gestion_usuario(objetivo uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org uuid := public.mi_org_id();
begin
  if org is null or not public.is_owner(org) then
    raise exception 'No tenés permiso para administrar usuarios.';
  end if;
  if not exists (select 1 from public.members where org_id = org and user_id = objetivo) then
    raise exception 'El usuario no pertenece a tu organización.';
  end if;
  if public.es_superadmin_usuario(objetivo) and not public.es_superadmin() then
    raise exception 'No tenés permiso para modificar a este usuario.';
  end if;
  return org;
end;
$$;

-- Cambia la contraseña de un usuario y cierra sus sesiones abiertas
create or replace function public.cambiar_clave_usuario(objetivo uuid, nueva text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.validar_gestion_usuario(objetivo);
  if length(coalesce(nueva, '')) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres.';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt(nueva, extensions.gen_salt('bf')),
      updated_at = now()
  where id = objetivo;
  delete from auth.sessions where user_id = objetivo;
end;
$$;

-- Elimina un usuario. Si además pertenece a otra organización, solo se lo quita de esta.
create or replace function public.eliminar_usuario(objetivo uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
begin
  org := public.validar_gestion_usuario(objetivo);
  if objetivo = auth.uid() then
    raise exception 'No podés eliminar tu propio usuario.';
  end if;
  if exists (select 1 from public.members where user_id = objetivo and org_id <> org) then
    delete from public.members where org_id = org and user_id = objetivo;
  else
    delete from auth.users where id = objetivo;
  end if;
end;
$$;

revoke execute on function public.es_superadmin_usuario(uuid) from public, anon;
revoke execute on function public.validar_gestion_usuario(uuid) from public, anon;
revoke execute on function public.cambiar_clave_usuario(uuid, text) from public, anon;
revoke execute on function public.eliminar_usuario(uuid) from public, anon;
grant execute on function public.es_superadmin_usuario(uuid) to authenticated;
grant execute on function public.cambiar_clave_usuario(uuid, text) to authenticated;
grant execute on function public.eliminar_usuario(uuid) to authenticated;

-- =====================================================================
-- ORGANIZACIONES COMO CLIENTES (v1.6) — migración.
-- Requiere roles.sql, configuracion.sql y usuarios-acciones.sql.
-- Pegar en Supabase > SQL Editor > New query > Run. Es seguro volver a ejecutarla.
--
--  * Cada organización tiene plan, estado (prueba / activa / suspendida) y vencimiento.
--    Una organización suspendida o vencida pierde el acceso (excepto el superadministrador).
--  * El registro público se cierra: solo pueden crear cuenta quienes recibieron una invitación.
--  * El superadministrador da de alta organizaciones y su primer administrador.
-- =====================================================================

-- ---------- Plan, estado y vencimiento ----------
-- Las organizaciones que ya existen quedan como plan "Interno", activas y sin vencimiento.
alter table public.organizations add column if not exists plan text not null default 'Interno';
alter table public.organizations add column if not exists estado text not null default 'activa';
alter table public.organizations add column if not exists vence_el date;
alter table public.organizations add column if not exists notas text;

alter table public.organizations drop constraint if exists organizations_estado_check;
alter table public.organizations
  add constraint organizations_estado_check check (estado in ('prueba', 'activa', 'suspendida'));

-- Las nuevas parten en prueba
alter table public.organizations alter column plan set default 'Prueba';
alter table public.organizations alter column estado set default 'prueba';

-- Los administradores solo pueden cambiar el nombre de su organización; el plan, el estado y
-- el vencimiento los maneja el superadministrador
revoke update on public.organizations from authenticated;
grant update (name) on public.organizations to authenticated;

-- ---------- Organización activa ----------
create or replace function public.org_activa(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = oid
      and o.estado in ('prueba', 'activa')
      and (o.vence_el is null or o.vence_el >= current_date)
  )
$$;

-- Los miembros de una organización suspendida o vencida dejan de verla y de tener rol
create or replace function public.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.organizations where public.es_superadmin()
  union
  select m.org_id from public.members m
  where m.user_id = auth.uid() and m.estado = 'activo' and public.org_activa(m.org_id)
$$;

create or replace function public.mi_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.members
  where user_id = auth.uid()
    and estado = 'activo'
    and (public.es_superadmin() or public.org_activa(org_id))
  order by created_at desc
  limit 1
$$;

create or replace function public.mi_rol(target_org uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.members
  where org_id = target_org
    and user_id = auth.uid()
    and estado = 'activo'
    and (public.es_superadmin() or public.org_activa(org_id))
$$;

-- ---------- Registro solo por invitación ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nueva_org uuid;
  filas integer := 0;
  es_super boolean := lower(new.email) = 'melquiades.iguini@gmail.com';
begin
  if new.email_confirmed_at is not null then
    if es_super then
      insert into public.platform_admins (user_id) values (new.id) on conflict do nothing;
    end if;

    insert into public.members (org_id, user_id, role)
    select org_id, new.id, role from public.invitaciones where email = lower(new.email)
    on conflict do nothing;
    get diagnostics filas = row_count;
    delete from public.invitaciones where email = lower(new.email);
    if filas > 0 then
      return new;
    end if;
  elsif exists (select 1 from public.invitaciones where email = lower(new.email)) then
    -- invitado que todavía no confirmó su email: se une al confirmarlo (al_confirmar_email)
    return new;
  end if;

  if not es_super then
    raise exception 'El registro está cerrado: solo pueden crear cuenta quienes recibieron una invitación.';
  end if;

  insert into public.organizations (name, plan, estado)
  values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'org_name'), ''), split_part(new.email, '@', 1)), 'Interno', 'activa')
  returning id into nueva_org;

  insert into public.members (org_id, user_id, role)
  values (nueva_org, new.id, 'administrador');

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------- Panel del superadministrador ----------
create or replace function public.exigir_superadmin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'No tenés permiso para esta acción.';
  end if;
end;
$$;

create or replace function public.listar_organizaciones()
returns table (
  id uuid, nombre text, plan text, estado text, vence_el date, notas text,
  creada timestamptz, miembros bigint, administradores text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.exigir_superadmin();
  return query
  select o.id, o.name, o.plan, o.estado, o.vence_el, o.notas, o.created_at,
         (select count(*) from public.members m where m.org_id = o.id),
         coalesce(
           (select string_agg(u.email::text, ', ')
            from public.members m join auth.users u on u.id = m.user_id
            where m.org_id = o.id and m.role = 'administrador'),
           (select string_agg(i.email, ', ') || ' (invitado)'
            from public.invitaciones i where i.org_id = o.id and i.role = 'administrador')
         )
  from public.organizations o
  order by o.created_at desc;
end;
$$;

-- Da de alta un cliente: la organización y su primer administrador.
-- dias > 0: período de prueba con vencimiento; sin días: activa sin vencimiento.
create or replace function public.crear_organizacion(
  nombre text, email_admin text, plan text default 'Prueba', dias integer default 14
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
  uid uuid;
  mail text := lower(btrim(coalesce(email_admin, '')));
begin
  perform public.exigir_superadmin();
  if btrim(coalesce(nombre, '')) = '' or mail !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Revisá el nombre de la organización y el email del administrador.';
  end if;

  insert into public.organizations (name, plan, estado, vence_el)
  values (
    btrim(nombre),
    coalesce(nullif(btrim(plan), ''), 'Prueba'),
    case when coalesce(dias, 0) > 0 then 'prueba' else 'activa' end,
    case when coalesce(dias, 0) > 0 then current_date + dias end
  )
  returning id into oid;

  select id into uid from auth.users where lower(email) = mail and email_confirmed_at is not null;
  if uid is not null then
    insert into public.members (org_id, user_id, role) values (oid, uid, 'administrador') on conflict do nothing;
  else
    insert into public.invitaciones (org_id, email, role) values (oid, mail, 'administrador');
  end if;
  return oid;
end;
$$;

create or replace function public.actualizar_organizacion(
  oid uuid, nombre text, plan text, estado text, vence_el date, notas text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exigir_superadmin();
  if actualizar_organizacion.estado not in ('prueba', 'activa', 'suspendida') then
    raise exception 'Estado no válido.';
  end if;
  update public.organizations o
  set name = coalesce(nullif(btrim(actualizar_organizacion.nombre), ''), o.name),
      plan = coalesce(nullif(btrim(actualizar_organizacion.plan), ''), o.plan),
      estado = actualizar_organizacion.estado,
      vence_el = actualizar_organizacion.vence_el,
      notas = nullif(btrim(coalesce(actualizar_organizacion.notas, '')), '')
  where o.id = actualizar_organizacion.oid;
end;
$$;

revoke execute on function public.org_activa(uuid) from public, anon;
revoke execute on function public.exigir_superadmin() from public, anon;
revoke execute on function public.listar_organizaciones() from public, anon;
revoke execute on function public.crear_organizacion(text, text, text, integer) from public, anon;
revoke execute on function public.actualizar_organizacion(uuid, text, text, text, date, text) from public, anon;
grant execute on function public.org_activa(uuid) to authenticated;
grant execute on function public.listar_organizaciones() to authenticated;
grant execute on function public.crear_organizacion(text, text, text, integer) to authenticated;
grant execute on function public.actualizar_organizacion(uuid, text, text, text, date, text) to authenticated;
