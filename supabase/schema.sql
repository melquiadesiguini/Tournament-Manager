-- =====================================================================
-- Tournament Manager: esquema inicial (v1)
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
