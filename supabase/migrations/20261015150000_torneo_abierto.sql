-- =====================================================================
-- IPPONIA · Un solo torneo abierto por vez, y los resultados van a ese torneo
-- =====================================================================
-- Reglas:
--   * Cada organización tiene como máximo UN torneo abierto (estado 'activo'). Los demás están en borrador
--     o cerrados ('finalizado'). Para abrir otro hay que cerrar antes el que está abierto.
--   * Todo resultado nuevo (jurado o kumite) se guarda automáticamente en el torneo abierto: no hace falta
--     elegirlo, y lo que mande la aplicación se ignora.
--   * Si no hay un torneo abierto, no se puede guardar ningún resultado nuevo.
-- Los resultados que ya estaban guardados no cambian (los que no tienen torneo se pueden asignar a uno al corregirlos).
-- Requiere: 20261015120000_resultados_por_estructura.sql

-- Si alguna organización ya tenía más de un torneo abierto, queda abierto el más reciente y los otros se cierran
update public.torneos t
set estado = 'finalizado'
where t.estado = 'activo'
  and exists (
    select 1 from public.torneos o
    where o.organizacion_id = t.organizacion_id
      and o.estado = 'activo'
      and (o.creado_en, o.id) > (t.creado_en, t.id)
  );

create unique index torneos_uno_abierto on public.torneos (organizacion_id) where estado = 'activo';

-- Asigna el torneo abierto a cada resultado nuevo (o lo rechaza si no hay ninguno)
create function public.asignar_torneo_abierto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  abierto uuid;
begin
  select id into abierto from public.torneos where organizacion_id = new.organizacion_id and estado = 'activo';
  if abierto is null then
    raise exception 'No hay un torneo abierto. Abrí uno en Configuración → Torneos para poder cargar resultados.';
  end if;
  new.torneo_id := abierto;
  return new;
end;
$$;

create trigger jurado_torneo_abierto before insert on public.resultados_jurado
  for each row execute function public.asignar_torneo_abierto();
create trigger kumite_torneo_abierto before insert on public.resultados_kumite
  for each row execute function public.asignar_torneo_abierto();

revoke execute on function public.asignar_torneo_abierto() from public, anon, authenticated;
