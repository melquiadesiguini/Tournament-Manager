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
