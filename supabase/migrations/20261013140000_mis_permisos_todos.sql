-- =====================================================================
-- IPPONIA · Etapa 3: todos mis permisos de una vez
-- =====================================================================
-- Devuelve cada permiso del usuario conectado con el torneo y el área donde rige
-- (torneo_id null = todos los torneos; area null = todas las áreas).
-- El frontend la pide una vez al iniciar sesión para mostrar solo las pantallas que
-- corresponden. Es solo experiencia de usuario: la seguridad real la aplica RLS.
-- Requiere: 20261013120000_multiorganizacion.sql

create function public.mis_permisos_todos()
returns table (torneo_id uuid, area text, permiso text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct a.torneo_id, a.area, rp.permiso
  from public.perfiles pf
  join public.organizaciones o on o.id = pf.organizacion_id
  join public.asignaciones a on a.usuario_id = pf.usuario_id
  join public.rol_permisos rp on rp.rol_id = a.rol_id
  join public.plan_permisos pp on pp.plan = o.plan and pp.permiso = rp.permiso
  where pf.usuario_id = auth.uid()
    and pf.activo
    and o.estado in ('prueba', 'activa')
    and (o.vence_el is null or o.vence_el >= current_date)
$$;

revoke execute on function public.mis_permisos_todos() from public, anon;
grant execute on function public.mis_permisos_todos() to authenticated;
