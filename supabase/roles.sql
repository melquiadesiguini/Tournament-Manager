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
