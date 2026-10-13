-- =====================================================================
-- IPPONIA · Etapa 1: multi-organización, usuarios, roles y permisos
-- =====================================================================
-- Reemplaza el modelo anterior (members, invitaciones, roles fijos) por:
--   organizaciones -> perfiles (usuarios) -> asignaciones (rol por torneo y área) -> roles -> permisos
-- Se aplica de una sola vez (es atómica: si algo falla, no queda nada a medias).
--
-- Cómo aplicarla: pegar completo en Supabase > SQL Editor > Run
--                 (o `npx supabase db push` cuando el proyecto esté vinculado).
--
-- IMPORTANTE después de aplicarla:
--   * Authentication > Sign In / Providers > desactivar "Allow new users to sign up"
--     (el registro público se cerraba con un trigger que esta migración retira).
--   * Hasta que se publique el frontend de la Etapa 3, las pantallas de nube viejas
--     (Configuración, historial, autocompletado de jueces) dejan de funcionar.
--     Kata, Kumite, Kobudo y Destreza siguen funcionando con localStorage.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Catálogos: planes y permisos (los define el código de la app)
-- ---------------------------------------------------------------------
create table public.planes (
  clave text primary key,
  nombre text not null
);

create table public.permisos (
  clave text primary key,
  descripcion text not null
);

create table public.plan_permisos (
  plan text not null references public.planes (clave) on delete cascade,
  permiso text not null references public.permisos (clave) on delete cascade,
  primary key (plan, permiso)
);

insert into public.planes (clave, nombre) values ('estandar', 'Estándar');

insert into public.permisos (clave, descripcion) values
  ('ver_pantalla_publica', 'Abrir la pantalla pública'),
  ('operar_mesa_kumite', 'Operar la mesa de Kumite'),
  ('operar_kansa_kumite', 'Operar el tablero Kansa de Kumite'),
  ('puntuar_kata', 'Puntuar Kata'),
  ('puntuar_kobudo', 'Puntuar Kobudo'),
  ('puntuar_destreza', 'Puntuar Destreza'),
  ('cargar_competidores', 'Cargar y editar la lista de competidores'),
  ('gestionar_jueces', 'Cargar y editar la lista de jueces'),
  ('ver_historial', 'Ver el historial de resultados'),
  ('crear_torneos', 'Crear y editar torneos'),
  ('gestionar_usuarios', 'Crear usuarios, desactivarlos y resetear contraseñas'),
  ('gestionar_roles', 'Crear y editar roles y asignarlos a usuarios');

-- Un solo plan por ahora: incluye todos los permisos
insert into public.plan_permisos (plan, permiso) select 'estandar', clave from public.permisos;

-- ---------------------------------------------------------------------
-- 2. Organizaciones: se renombra la tabla existente y se completa
-- ---------------------------------------------------------------------
alter table public.organizations rename to organizaciones;
alter table public.organizaciones rename column name to nombre;
alter table public.organizaciones rename column created_at to creada_en;
alter table public.organizaciones add column slug text;

-- Palabras que no pueden ser el nombre de una organización en la URL (/:slug/ingresar)
create function public.slugs_reservados()
returns text[]
language sql
immutable
as $$
  select array[
    'kata', 'kumite', 'kobudo', 'destreza', 'pantalla', 'juez', 'jueces', 'cuenta', 'ingresar',
    'registro', 'restablecer', 'configuracion', 'historial', 'superadmin', 'admin', 'api',
    'assets', 'login', 'logout', 'torneos', 'www', 'ipponia', 'soporte', 'ayuda', 'docs', 'static'
  ]
$$;

-- Los slugs de las organizaciones que ya existen se generan a partir de su nombre
do $$
declare
  o record;
  base text;
  cand text;
  n integer;
begin
  for o in select id, nombre from public.organizaciones order by creada_en loop
    base := lower(translate(o.nombre, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'));
    base := trim(both '-' from regexp_replace(base, '[^a-z0-9]+', '-', 'g'));
    if base = '' then base := 'org'; end if;
    if length(base) < 3 then base := base || '-org'; end if;
    base := left(base, 34);
    cand := base;
    n := 1;
    while cand = any (public.slugs_reservados())
          or exists (select 1 from public.organizaciones x where x.slug = cand) loop
      n := n + 1;
      cand := base || '-' || n;
    end loop;
    update public.organizaciones set slug = cand where id = o.id;
  end loop;
end;
$$;

alter table public.organizaciones alter column slug set not null;
alter table public.organizaciones
  add constraint organizaciones_slug_unico unique (slug),
  add constraint organizaciones_slug_formato check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  add constraint organizaciones_slug_no_reservado check (not (slug = any (public.slugs_reservados())));

-- Todas las organizaciones existentes pasan al plan único
update public.organizaciones set plan = 'estandar';
alter table public.organizaciones
  alter column plan set default 'estandar',
  add constraint organizaciones_plan_fk foreign key (plan) references public.planes (clave);

-- El slug va dentro del email sintético de los usuarios: no se puede cambiar desde la API
create function public.proteger_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is distinct from old.slug and current_user in ('anon', 'authenticated') then
    raise exception 'El identificador (slug) de la organización no se puede cambiar.';
  end if;
  return new;
end;
$$;

create trigger organizaciones_slug_inmutable
  before update on public.organizaciones
  for each row execute function public.proteger_slug();

-- ---------------------------------------------------------------------
-- 3. Tablas nuevas
-- ---------------------------------------------------------------------
-- Una cuenta de Auth pertenece a UNA organización. El dueño entra con su email real;
-- los usuarios internos tienen nombre_usuario y un email sintético que nunca se muestra.
create table public.perfiles (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  organizacion_id uuid not null references public.organizaciones (id) on delete cascade,
  nombre_usuario text check (nombre_usuario ~ '^[a-z0-9._-]{3,30}$'),
  nombre_visible text,
  es_dueno boolean not null default false,
  activo boolean not null default true,
  debe_cambiar_clave boolean not null default false,
  creado_por uuid references auth.users (id) on delete set null,
  creado_en timestamptz not null default now(),
  unique (organizacion_id, nombre_usuario)
);
create unique index perfiles_un_dueno_por_organizacion on public.perfiles (organizacion_id) where es_dueno;

create table public.torneos (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones (id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  fecha date,
  estado text not null default 'borrador' check (estado in ('borrador', 'activo', 'finalizado')),
  creado_en timestamptz not null default now()
);
create index torneos_organizacion_idx on public.torneos (organizacion_id);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones (id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  de_fabrica boolean not null default false,
  creado_en timestamptz not null default now(),
  unique (organizacion_id, nombre)
);

create table public.rol_permisos (
  rol_id uuid not null references public.roles (id) on delete cascade,
  permiso text not null references public.permisos (clave) on delete cascade,
  primary key (rol_id, permiso)
);

-- Rol de un usuario, por torneo y opcionalmente por área.
--   torneo_id null = a nivel organización (ej. el Admin permanente)
--   area null      = todas las áreas
create table public.asignaciones (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (usuario_id) on delete cascade,
  torneo_id uuid references public.torneos (id) on delete cascade,
  area text check (area is null or length(btrim(area)) > 0),
  rol_id uuid not null references public.roles (id) on delete cascade,
  creado_en timestamptz not null default now()
);
create unique index asignaciones_unica_idx
  on public.asignaciones (usuario_id, coalesce(torneo_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(area, ''), rol_id);
create index asignaciones_usuario_idx on public.asignaciones (usuario_id);

-- Dueños de la plataforma (se agregan solo desde el SQL Editor, nunca desde la app)
create table public.superadmins (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);

create table public.auditoria (
  id bigint generated always as identity primary key,
  cuando timestamptz not null default now(),
  organizacion_id uuid references public.organizaciones (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  accion text not null,
  detalle jsonb not null default '{}'::jsonb
);
create index auditoria_organizacion_idx on public.auditoria (organizacion_id, cuando desc);

-- Tablas de datos que ya existían: se renombran las columnas al nuevo idioma
alter table public.results rename to resultados;
alter table public.resultados rename column org_id to organizacion_id;
alter table public.resultados rename column created_by to creado_por;
alter table public.resultados rename column created_at to creado_en;
alter table public.resultados add column torneo_id uuid references public.torneos (id) on delete set null;

alter table public.jueces rename column org_id to organizacion_id;
alter table public.competidores rename column org_id to organizacion_id;

-- ---------------------------------------------------------------------
-- 4. Funciones de permisos (una sola fuente de verdad, usada por RLS y por el frontend)
-- ---------------------------------------------------------------------
create or replace function public.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.superadmins where usuario_id = auth.uid())
$$;

-- Organización del usuario conectado (null si no tiene perfil activo)
create function public.mi_organizacion()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organizacion_id from public.perfiles where usuario_id = auth.uid() and activo
$$;

-- Igual, pero null si la organización está suspendida o vencida: así deja de ver sus datos
create function public.mi_organizacion_activa()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.organizacion_id
  from public.perfiles p
  join public.organizaciones o on o.id = p.organizacion_id
  where p.usuario_id = auth.uid()
    and p.activo
    and o.estado in ('prueba', 'activa')
    and (o.vence_el is null or o.vence_el >= current_date)
$$;

create function public.organizacion_activa(p_organizacion uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organizaciones o
    where o.id = p_organizacion
      and o.estado in ('prueba', 'activa')
      and (o.vence_el is null or o.vence_el >= current_date)
  )
$$;

-- ¿El usuario conectado tiene el permiso en ese torneo y área?
--   Un permiso rige solo si el ROL lo incluye Y el PLAN de la organización también.
--   p_torneo null: pregunta "a nivel organización" (cuentan solo asignaciones sin torneo).
--   p_area null:   cuentan solo asignaciones sin área (válidas para todas).
create function public.tiene_permiso(p_torneo uuid, p_area text, p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfiles pf
    join public.organizaciones o on o.id = pf.organizacion_id
    join public.plan_permisos pp on pp.plan = o.plan and pp.permiso = p_permiso
    join public.asignaciones a on a.usuario_id = pf.usuario_id
    join public.rol_permisos rp on rp.rol_id = a.rol_id and rp.permiso = p_permiso
    where pf.usuario_id = auth.uid()
      and pf.activo
      and o.estado in ('prueba', 'activa')
      and (o.vence_el is null or o.vence_el >= current_date)
      and (a.torneo_id is null or (p_torneo is not null and a.torneo_id = p_torneo))
      and (a.area is null or (p_area is not null and a.area = p_area))
  )
$$;

-- Igual, pero sin mirar torneo ni área: "¿tiene este permiso en algún lado?"
-- (para listas y autocompletados; la regla fina sigue en tiene_permiso)
create function public.tiene_permiso_en_algun_ambito(p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfiles pf
    join public.organizaciones o on o.id = pf.organizacion_id
    join public.plan_permisos pp on pp.plan = o.plan and pp.permiso = p_permiso
    join public.asignaciones a on a.usuario_id = pf.usuario_id
    join public.rol_permisos rp on rp.rol_id = a.rol_id and rp.permiso = p_permiso
    where pf.usuario_id = auth.uid()
      and pf.activo
      and o.estado in ('prueba', 'activa')
      and (o.vence_el is null or o.vence_el >= current_date)
  )
$$;

-- Permisos del usuario en un torneo: una fila por permiso y área (area null = todas)
create function public.mis_permisos(p_torneo uuid default null)
returns table (permiso text, area text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct rp.permiso, a.area
  from public.perfiles pf
  join public.organizaciones o on o.id = pf.organizacion_id
  join public.asignaciones a on a.usuario_id = pf.usuario_id
  join public.rol_permisos rp on rp.rol_id = a.rol_id
  join public.plan_permisos pp on pp.plan = o.plan and pp.permiso = rp.permiso
  where pf.usuario_id = auth.uid()
    and pf.activo
    and o.estado in ('prueba', 'activa')
    and (o.vence_el is null or o.vence_el >= current_date)
    and (a.torneo_id is null or (p_torneo is not null and a.torneo_id = p_torneo))
$$;

-- Email interno de un usuario (nunca se muestra)
create function public.email_interno(p_usuario text, p_slug text)
returns text
language sql
immutable
as $$
  select lower(p_usuario) || '@' || lower(p_slug) || '.ipponia.internal'
$$;

-- Datos mínimos de una organización para su pantalla de ingreso (la única función pública)
create function public.org_publica(p_slug text)
returns table (nombre text, activa boolean)
language sql
stable
security definer
set search_path = public
as $$
  select o.nombre, public.organizacion_activa(o.id)
  from public.organizaciones o
  where o.slug = lower(p_slug)
$$;

-- Después de cambiar su contraseña inicial, el usuario apaga la obligación de cambiarla
create function public.marcar_clave_cambiada()
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfiles set debe_cambiar_clave = false where usuario_id = auth.uid()
$$;

-- Roles de fábrica de una organización (los usa el alta de organizaciones)
create function public.crear_roles_de_fabrica(p_organizacion uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  rid uuid;
begin
  for r in
    select * from (values
      ('Admin',     array['ver_pantalla_publica','operar_mesa_kumite','operar_kansa_kumite','puntuar_kata','puntuar_kobudo','puntuar_destreza','cargar_competidores','gestionar_jueces','ver_historial','crear_torneos','gestionar_usuarios','gestionar_roles']),
      ('Juez',      array['puntuar_kata','puntuar_kobudo','puntuar_destreza']),
      ('Kansa',     array['operar_kansa_kumite']),
      ('Fukushin',  array['puntuar_kata','puntuar_kobudo','puntuar_destreza','ver_pantalla_publica']),
      ('Mesa',      array['operar_mesa_kumite','puntuar_kata','puntuar_kobudo','puntuar_destreza','ver_pantalla_publica','cargar_competidores','gestionar_jueces','ver_historial'])
    ) as t(nombre, permisos)
  loop
    rid := null;
    insert into public.roles (organizacion_id, nombre, de_fabrica)
    values (p_organizacion, r.nombre, true)
    on conflict (organizacion_id, nombre) do nothing
    returning id into rid;
    if rid is not null then
      insert into public.rol_permisos (rol_id, permiso) select rid, unnest(r.permisos);
    end if;
  end loop;
end;
$$;

-- Alta de una organización (solo la usa la Edge Function con service_role)
create function public.crear_organizacion_interna(
  p_slug text, p_nombre text, p_plan text default 'estandar', p_vence_el date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
begin
  insert into public.organizaciones (slug, nombre, plan, estado, vence_el)
  values (lower(btrim(p_slug)), btrim(p_nombre), p_plan, case when p_vence_el is null then 'activa' else 'prueba' end, p_vence_el)
  returning id into oid;
  perform public.crear_roles_de_fabrica(oid);
  return oid;
end;
$$;

-- Registra al dueño de una organización: su perfil y el rol Admin permanente
create function public.registrar_dueno(p_organizacion uuid, p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid;
begin
  select id into admin_id from public.roles where organizacion_id = p_organizacion and nombre = 'Admin' and de_fabrica;
  insert into public.perfiles (usuario_id, organizacion_id, es_dueno, nombre_visible)
  values (p_usuario, p_organizacion, true, 'Dueño');
  insert into public.asignaciones (organizacion_id, usuario_id, rol_id) values (p_organizacion, p_usuario, admin_id);
end;
$$;

-- Panel del superadmin: SOLO datos agregados, nunca datos deportivos de los clientes
create function public.superadmin_resumen()
returns table (
  id uuid, slug text, nombre text, plan text, estado text, vence_el date, notas text,
  creada_en timestamptz, usuarios bigint, torneos bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'No tenés permiso para esta acción.';
  end if;
  return query
  select o.id, o.slug, o.nombre, o.plan, o.estado, o.vence_el, o.notas, o.creada_en,
         (select count(*) from public.perfiles p where p.organizacion_id = o.id),
         (select count(*) from public.torneos t where t.organizacion_id = o.id)
  from public.organizaciones o
  order by o.creada_en desc;
end;
$$;

create function public.superadmin_actualizar_organizacion(
  p_organizacion uuid, p_nombre text, p_plan text, p_estado text, p_vence_el date, p_notas text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'No tenés permiso para esta acción.';
  end if;
  update public.organizaciones o
  set nombre = coalesce(nullif(btrim(p_nombre), ''), o.nombre),
      plan = coalesce(nullif(btrim(p_plan), ''), o.plan),
      estado = p_estado,
      vence_el = p_vence_el,
      notas = nullif(btrim(coalesce(p_notas, '')), '')
  where o.id = p_organizacion;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Reglas de integridad (triggers)
-- ---------------------------------------------------------------------
-- Una asignación solo puede unir cosas de la misma organización
create function public.validar_asignacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.perfiles where usuario_id = new.usuario_id and organizacion_id = new.organizacion_id) then
    raise exception 'El usuario no pertenece a esta organización.';
  end if;
  if not exists (select 1 from public.roles where id = new.rol_id and organizacion_id = new.organizacion_id) then
    raise exception 'El rol no pertenece a esta organización.';
  end if;
  if new.torneo_id is not null
     and not exists (select 1 from public.torneos where id = new.torneo_id and organizacion_id = new.organizacion_id) then
    raise exception 'El torneo no pertenece a esta organización.';
  end if;
  return new;
end;
$$;

create trigger asignaciones_validar
  before insert or update on public.asignaciones
  for each row execute function public.validar_asignacion();

-- El dueño siempre conserva su rol Admin permanente (para que nadie deje a una organización sin administración)
create function public.proteger_admin_del_dueno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- si la organización se está borrando completa, se permite
  if not exists (select 1 from public.organizaciones where id = old.organizacion_id) then
    return old;
  end if;
  if old.torneo_id is null and old.area is null
     and exists (select 1 from public.perfiles p where p.usuario_id = old.usuario_id and p.es_dueno)
     and exists (select 1 from public.roles r where r.id = old.rol_id and r.nombre = 'Admin' and r.de_fabrica) then
    raise exception 'No se puede quitar el rol Admin permanente del dueño de la organización.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger asignaciones_proteger_admin
  before delete or update on public.asignaciones
  for each row execute function public.proteger_admin_del_dueno();

-- El rol Admin de fábrica no se borra, no cambia de nombre y conserva los permisos de gestión
create function public.proteger_rol_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.organizaciones where id = old.organizacion_id) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.organizacion_id is distinct from old.organizacion_id or new.de_fabrica is distinct from old.de_fabrica then
      raise exception 'No se puede cambiar la organización ni el origen de un rol.';
    end if;
    if old.de_fabrica and old.nombre = 'Admin' and new.nombre is distinct from old.nombre then
      raise exception 'El rol Admin no se puede renombrar.';
    end if;
    return new;
  end if;
  if old.de_fabrica and old.nombre = 'Admin' then
    raise exception 'El rol Admin no se puede borrar.';
  end if;
  return old;
end;
$$;

create trigger roles_proteger_admin
  before update or delete on public.roles
  for each row execute function public.proteger_rol_admin();

create function public.proteger_permisos_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.permiso in ('gestionar_usuarios', 'gestionar_roles')
     and exists (select 1 from public.roles r where r.id = old.rol_id and r.nombre = 'Admin' and r.de_fabrica) then
    raise exception 'Al rol Admin no se le pueden quitar los permisos de gestión de usuarios y roles.';
  end if;
  return old;
end;
$$;

create trigger rol_permisos_proteger_admin
  before delete on public.rol_permisos
  for each row execute function public.proteger_permisos_admin();

-- El dueño no se puede desactivar ni dejar de ser dueño desde la API
create function public.proteger_dueno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.es_dueno and (new.activo is false or new.es_dueno is false or new.organizacion_id is distinct from old.organizacion_id) then
    raise exception 'El dueño de la organización no se puede desactivar ni cambiar.';
  end if;
  return new;
end;
$$;

create trigger perfiles_proteger_dueno
  before update on public.perfiles
  for each row execute function public.proteger_dueno();

-- ---------------------------------------------------------------------
-- 6. Migración de los datos existentes
-- ---------------------------------------------------------------------
-- Superadmins
insert into public.superadmins (usuario_id) select user_id from public.platform_admins on conflict do nothing;

-- Roles de fábrica para cada organización
do $$
declare
  o record;
begin
  for o in select id from public.organizaciones loop
    perform public.crear_roles_de_fabrica(o.id);
  end loop;
end;
$$;

-- Los supervisores del modelo anterior pasan a un rol propio "Supervisor" (solo ve el historial)
with nuevos as (
  insert into public.roles (organizacion_id, nombre, de_fabrica)
  select distinct org_id, 'Supervisor', false from public.members where role = 'supervisor'
  on conflict (organizacion_id, nombre) do nothing
  returning id
)
insert into public.rol_permisos (rol_id, permiso) select id, 'ver_historial' from nuevos;

-- Perfiles: una cuenta pertenece a una sola organización (la membresía más reciente)
insert into public.perfiles (usuario_id, organizacion_id, activo, creado_en)
select distinct on (m.user_id) m.user_id, m.org_id, (m.estado = 'activo'), m.created_at
from public.members m
order by m.user_id, m.created_at desc;

-- Dueño: el primer administrador de cada organización
update public.perfiles p
set es_dueno = true
from (
  select distinct on (org_id) org_id, user_id
  from public.members
  where role = 'administrador'
  order by org_id, created_at
) d
where d.org_id = p.organizacion_id and d.user_id = p.usuario_id;

-- Rol permanente (a nivel organización) según el rol anterior
insert into public.asignaciones (organizacion_id, usuario_id, rol_id)
select p.organizacion_id, p.usuario_id, r.id
from public.perfiles p
join public.members m on m.user_id = p.usuario_id and m.org_id = p.organizacion_id
join public.roles r
  on r.organizacion_id = p.organizacion_id
 and r.nombre = case m.role
       when 'administrador' then 'Admin'
       when 'mesa' then 'Mesa'
       when 'juez' then 'Juez'
       when 'supervisor' then 'Supervisor'
     end;

-- ---------------------------------------------------------------------
-- 7. Se retira el modelo anterior
-- ---------------------------------------------------------------------
-- Políticas viejas de las tablas que se conservan (las nuevas se crean abajo)
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('organizaciones', 'resultados', 'jueces', 'competidores')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end;
$$;

-- Registro público: el trigger que lo cerraba ya no corresponde (ahora se controla en
-- Authentication > "Allow new users to sign up" y las cuentas las crean las Edge Functions)
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_confirmed on auth.users;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.al_confirmar_email() cascade;
drop function if exists public.my_org_ids() cascade;
drop function if exists public.mi_org_id() cascade;
drop function if exists public.mi_rol(uuid) cascade;
drop function if exists public.is_owner(uuid) cascade;
drop function if exists public.can_write(uuid) cascade;
drop function if exists public.puede_ver_resultados(uuid) cascade;
drop function if exists public.org_activa(uuid) cascade;
drop function if exists public.exigir_superadmin() cascade;
drop function if exists public.listar_organizaciones() cascade;
drop function if exists public.crear_organizacion(text, text, text, integer) cascade;
drop function if exists public.actualizar_organizacion(uuid, text, text, text, date, text) cascade;
drop function if exists public.listar_equipo() cascade;
drop function if exists public.es_superadmin_usuario(uuid) cascade;
drop function if exists public.validar_gestion_usuario(uuid) cascade;
drop function if exists public.cambiar_clave_usuario(uuid, text) cascade;
drop function if exists public.eliminar_usuario(uuid) cascade;
drop function if exists public.sugerir_jueces(text) cascade;
drop function if exists public.registrar_juez(text) cascade;

-- Restos de la prueba de "jueces conectados" (rondas y puntajes), si llegaron a crearse
drop function if exists public.puede_participar_en_ronda(uuid) cascade;
drop function if exists public.abrir_ronda(text, text, text, text, integer) cascade;
drop function if exists public.cerrar_ronda(uuid) cascade;
drop function if exists public.ronda_abierta(text) cascade;
drop function if exists public.enviar_puntaje(uuid, integer, numeric) cascade;
drop function if exists public.puntajes_ronda(uuid) cascade;
drop table if exists public.puntajes;
drop table if exists public.rondas;

drop table public.invitaciones;
drop table public.members;
drop table public.platform_admins;

-- ---------------------------------------------------------------------
-- 8. Funciones de jueces (versión nueva, con permisos)
-- ---------------------------------------------------------------------
-- Sugerencias al escribir el nombre de un juez: máximo 8, mínimo 2 letras, solo activos.
-- Las pide quien puntúa u opera; no permite bajar la lista completa.
create function public.sugerir_jueces(texto text)
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
    and j.organizacion_id = public.mi_organizacion()
    and (
      public.tiene_permiso_en_algun_ambito('puntuar_kata')
      or public.tiene_permiso_en_algun_ambito('puntuar_kobudo')
      or public.tiene_permiso_en_algun_ambito('puntuar_destreza')
      or public.tiene_permiso_en_algun_ambito('operar_mesa_kumite')
      or public.tiene_permiso_en_algun_ambito('gestionar_jueces')
    )
    and (
      btrim(j.nombre || ' ' || j.apellido) ilike '%' || replace(replace(replace(trim(texto), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or btrim(j.apellido || ' ' || j.nombre) ilike '%' || replace(replace(replace(trim(texto), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by 1
  limit 8
$$;

-- Guarda un nombre escrito a mano al cargar un resultado, salvo que ya exista
create function public.registrar_juez(texto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid := public.mi_organizacion();
  t text := btrim(regexp_replace(coalesce(texto, ''), '\s+', ' ', 'g'));
begin
  if org is null or t = '' or length(t) > 120 then
    return;
  end if;
  if not (public.tiene_permiso_en_algun_ambito('puntuar_kata')
          or public.tiene_permiso_en_algun_ambito('puntuar_kobudo')
          or public.tiene_permiso_en_algun_ambito('puntuar_destreza')
          or public.tiene_permiso_en_algun_ambito('operar_mesa_kumite')) then
    return;
  end if;
  if exists (
    select 1 from public.jueces
    where organizacion_id = org
      and (lower(btrim(nombre || ' ' || apellido)) = lower(t)
        or lower(btrim(apellido || ' ' || nombre)) = lower(t))
  ) then
    return;
  end if;
  insert into public.jueces (organizacion_id, nombre) values (org, t) on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Seguridad por fila (RLS) y permisos de tabla
-- ---------------------------------------------------------------------
alter table public.planes enable row level security;
alter table public.permisos enable row level security;
alter table public.plan_permisos enable row level security;
alter table public.organizaciones enable row level security;
alter table public.perfiles enable row level security;
alter table public.torneos enable row level security;
alter table public.roles enable row level security;
alter table public.rol_permisos enable row level security;
alter table public.asignaciones enable row level security;
alter table public.superadmins enable row level security;
alter table public.auditoria enable row level security;
alter table public.resultados enable row level security;
alter table public.jueces enable row level security;
alter table public.competidores enable row level security;

-- Privilegios mínimos: nadie anónimo toca tablas; los usuarios solo lo que las políticas permiten
revoke all on all tables in schema public from anon, authenticated;
grant select on public.planes, public.permisos, public.plan_permisos to authenticated;
grant select on public.organizaciones, public.perfiles, public.superadmins, public.auditoria to authenticated;
grant select, insert, update, delete on public.torneos, public.roles, public.rol_permisos,
  public.asignaciones, public.jueces, public.competidores to authenticated;
grant select, insert on public.resultados to authenticated;

-- Catálogos: lectura para cualquier usuario conectado
create policy planes_leer on public.planes for select to authenticated using (true);
create policy permisos_leer on public.permisos for select to authenticated using (true);
create policy plan_permisos_leer on public.plan_permisos for select to authenticated using (true);

-- Organización: cada usuario ve solo la suya (plan, estado y vencimiento los cambia el superadmin)
create policy organizaciones_leer on public.organizaciones
  for select to authenticated using (id = public.mi_organizacion());

-- Perfiles: ver los de mi organización (las altas y bajas las hacen las Edge Functions)
create policy perfiles_leer on public.perfiles
  for select to authenticated using (organizacion_id = public.mi_organizacion());

-- Superadmins: cada uno solo puede ver su propia fila (para saber si lo es)
create policy superadmins_leer on public.superadmins
  for select to authenticated using (usuario_id = auth.uid());

-- Auditoría: la ve quien gestiona usuarios, solo de su organización
create policy auditoria_leer on public.auditoria
  for select to authenticated
  using (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso(null, null, 'gestionar_usuarios'));

-- Torneos
create policy torneos_leer on public.torneos
  for select to authenticated using (organizacion_id = public.mi_organizacion_activa());
create policy torneos_escribir on public.torneos
  for all to authenticated
  using (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso(null, null, 'crear_torneos'))
  with check (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso(null, null, 'crear_torneos'));

-- Roles y sus permisos
create policy roles_leer on public.roles
  for select to authenticated using (organizacion_id = public.mi_organizacion_activa());
create policy roles_insertar on public.roles
  for insert to authenticated
  with check (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso(null, null, 'gestionar_roles') and not de_fabrica);
create policy roles_editar on public.roles
  for update to authenticated
  using (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso(null, null, 'gestionar_roles'))
  with check (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso(null, null, 'gestionar_roles'));
create policy roles_borrar on public.roles
  for delete to authenticated
  using (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso(null, null, 'gestionar_roles'));

create policy rol_permisos_leer on public.rol_permisos
  for select to authenticated
  using (exists (select 1 from public.roles r where r.id = rol_id and r.organizacion_id = public.mi_organizacion_activa()));
create policy rol_permisos_escribir on public.rol_permisos
  for all to authenticated
  using (
    public.tiene_permiso(null, null, 'gestionar_roles')
    and exists (select 1 from public.roles r where r.id = rol_id and r.organizacion_id = public.mi_organizacion_activa())
  )
  with check (
    public.tiene_permiso(null, null, 'gestionar_roles')
    and exists (select 1 from public.roles r where r.id = rol_id and r.organizacion_id = public.mi_organizacion_activa())
    -- un rol solo puede incluir permisos que el plan de la organización ofrece
    and exists (
      select 1 from public.organizaciones o join public.plan_permisos pp on pp.plan = o.plan
      where o.id = public.mi_organizacion_activa() and pp.permiso = rol_permisos.permiso
    )
  );

-- Asignaciones: cada uno ve las suyas; quien gestiona roles o usuarios ve y edita todas las de su organización
create policy asignaciones_leer on public.asignaciones
  for select to authenticated
  using (
    organizacion_id = public.mi_organizacion_activa()
    and (usuario_id = auth.uid()
         or public.tiene_permiso(null, null, 'gestionar_roles')
         or public.tiene_permiso(null, null, 'gestionar_usuarios'))
  );
create policy asignaciones_escribir on public.asignaciones
  for all to authenticated
  using (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso(null, null, 'gestionar_roles'))
  with check (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso(null, null, 'gestionar_roles'));

-- Listas de la organización
create policy jueces_todo on public.jueces
  for all to authenticated
  using (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso(null, null, 'gestionar_jueces'))
  with check (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso(null, null, 'gestionar_jueces'));
create policy competidores_todo on public.competidores
  for all to authenticated
  using (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso(null, null, 'cargar_competidores'))
  with check (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso(null, null, 'cargar_competidores'));

-- Resultados: leer con ver_historial; guardar con el permiso del módulo
create policy resultados_leer on public.resultados
  for select to authenticated
  using (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso_en_algun_ambito('ver_historial'));
create policy resultados_insertar on public.resultados
  for insert to authenticated
  with check (
    organizacion_id = public.mi_organizacion_activa()
    and creado_por = auth.uid()
    and (
      (modulo = 'kata' and public.tiene_permiso_en_algun_ambito('puntuar_kata'))
      or (modulo = 'kobudo' and public.tiene_permiso_en_algun_ambito('puntuar_kobudo'))
      or (modulo = 'destreza' and public.tiene_permiso_en_algun_ambito('puntuar_destreza'))
      or (modulo = 'kumite' and (public.tiene_permiso_en_algun_ambito('operar_mesa_kumite')
                                 or public.tiene_permiso_en_algun_ambito('operar_kansa_kumite')))
    )
  );

-- ---------------------------------------------------------------------
-- 10. Quién puede ejecutar cada función
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Las usan las políticas y el frontend (usuario conectado)
grant execute on function
  public.es_superadmin(), public.mi_organizacion(), public.mi_organizacion_activa(), public.organizacion_activa(uuid),
  public.tiene_permiso(uuid, text, text), public.tiene_permiso_en_algun_ambito(text),
  public.mis_permisos(uuid), public.marcar_clave_cambiada(),
  public.sugerir_jueces(text), public.registrar_juez(text),
  public.superadmin_resumen(), public.superadmin_actualizar_organizacion(uuid, text, text, text, date, text),
  public.email_interno(text, text), public.slugs_reservados()
  to authenticated;

-- Pantalla de ingreso de una organización (sin sesión)
grant execute on function public.org_publica(text) to anon, authenticated;
grant execute on function public.email_interno(text, text), public.slugs_reservados() to anon;

-- Solo las Edge Functions (service_role)
grant execute on function
  public.crear_roles_de_fabrica(uuid), public.crear_organizacion_interna(text, text, text, date),
  public.registrar_dueno(uuid, uuid)
  to service_role;
