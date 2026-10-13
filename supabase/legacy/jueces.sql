-- Solo la tabla JUECES. Pegar en Supabase > SQL Editor > New query > Run.
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
