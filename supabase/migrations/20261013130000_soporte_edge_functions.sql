-- =====================================================================
-- IPPONIA · Etapa 2: soporte para las Edge Functions
-- =====================================================================
-- Cierra todas las sesiones abiertas de un usuario (al resetearle la contraseña o desactivarlo).
-- Solo la pueden ejecutar las Edge Functions (service_role): ni un usuario logueado ni un anónimo.
-- Requiere: 20261013120000_multiorganizacion.sql

create function public.cerrar_sesiones_usuario(p_usuario uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.sessions where user_id = p_usuario
$$;

revoke execute on function public.cerrar_sesiones_usuario(uuid) from public, anon, authenticated;
grant execute on function public.cerrar_sesiones_usuario(uuid) to service_role;
