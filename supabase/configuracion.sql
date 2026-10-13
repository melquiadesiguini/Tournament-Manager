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
