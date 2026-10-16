-- =====================================================================
-- IPPONIA · Corregir o borrar resultados del historial
-- =====================================================================
-- Hasta ahora los resultados solo se podían guardar y leer. Si alguien se equivocaba al cargar un puntaje
-- o un nombre, no había forma de arreglarlo. Ahora hay un permiso nuevo, `editar_historial`, que trae el rol
-- Admin de cada organización (y se le puede dar a cualquier otro rol).
--
-- Cuidados para que el historial siga siendo confiable:
--   * Qué se puede cambiar: los datos cargados (nombres, puntajes, área, ronda...). No se puede cambiar de qué
--     organización es el resultado, quién lo cargó, cuándo se cargó, ni (en jurado) el módulo y el sistema de jueces.
--   * Cada cambio deja marcado quién lo hizo y cuándo (`editado_por`, `editado_en`).
--   * Cada cambio y cada borrado se anotan en la auditoría con cómo era el resultado antes y cómo quedó.
-- Requiere: 20261015120000_resultados_por_estructura.sql

-- ---------------------------------------------------------------------
-- 1. Permiso nuevo, en el plan y en el rol Admin
-- ---------------------------------------------------------------------
insert into public.permisos (clave, descripcion) values ('editar_historial', 'Corregir o borrar resultados del historial');
insert into public.plan_permisos (plan, permiso) select clave, 'editar_historial' from public.planes;

-- El Admin de cada organización existente
insert into public.rol_permisos (rol_id, permiso)
select id, 'editar_historial' from public.roles where nombre = 'Admin' and de_fabrica
on conflict do nothing;

-- Y el de las organizaciones nuevas: los roles de fábrica ahora incluyen el permiso en el Admin
create or replace function public.crear_roles_de_fabrica(p_organizacion uuid)
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
      ('Admin',     array['ver_pantalla_publica','operar_mesa_kumite','operar_kansa_kumite','puntuar_kata','puntuar_kobudo','puntuar_destreza','cargar_competidores','gestionar_jueces','ver_historial','editar_historial','crear_torneos','gestionar_usuarios','gestionar_roles']),
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

-- ---------------------------------------------------------------------
-- 2. Quién editó y cuándo
-- ---------------------------------------------------------------------
alter table public.resultados_jurado add column editado_por uuid references auth.users (id) on delete set null;
alter table public.resultados_jurado add column editado_en timestamptz;
alter table public.resultados_kumite add column editado_por uuid references auth.users (id) on delete set null;
alter table public.resultados_kumite add column editado_en timestamptz;

-- ---------------------------------------------------------------------
-- 3. Candados al editar y registro en la auditoría
-- ---------------------------------------------------------------------
create function public.jurado_antes_de_editar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.organizacion_id is distinct from old.organizacion_id
     or new.creado_por is distinct from old.creado_por
     or new.creado_en is distinct from old.creado_en
     or new.modulo is distinct from old.modulo
     or new.sistema_jueces is distinct from old.sistema_jueces then
    raise exception 'No se puede cambiar de qué organización, módulo o sistema de jueces es un resultado, ni quién ni cuándo lo cargó.';
  end if;
  new.editado_por := auth.uid();
  new.editado_en := now();
  return new;
end;
$$;

create function public.kumite_antes_de_editar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.organizacion_id is distinct from old.organizacion_id
     or new.creado_por is distinct from old.creado_por
     or new.creado_en is distinct from old.creado_en then
    raise exception 'No se puede cambiar de qué organización es un resultado, ni quién ni cuándo lo cargó.';
  end if;
  new.editado_por := auth.uid();
  new.editado_en := now();
  return new;
end;
$$;

-- Anota en la auditoría cómo era el resultado antes y cómo quedó (o que se borró)
create function public.resultados_auditar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- si se está borrando la organización entera, no hay a quién auditar
  if not exists (select 1 from public.organizaciones where id = old.organizacion_id) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  insert into public.auditoria (organizacion_id, actor_id, accion, detalle)
  values (
    old.organizacion_id,
    auth.uid(),
    case when tg_op = 'DELETE' then 'borrar_resultado' else 'editar_resultado' end,
    jsonb_build_object('tabla', tg_table_name, 'resultado_id', old.id, 'antes', to_jsonb(old))
      || case when tg_op = 'UPDATE' then jsonb_build_object('despues', to_jsonb(new)) else '{}'::jsonb end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger jurado_editar before update on public.resultados_jurado
  for each row execute function public.jurado_antes_de_editar();
create trigger kumite_editar before update on public.resultados_kumite
  for each row execute function public.kumite_antes_de_editar();
create trigger jurado_auditar after update or delete on public.resultados_jurado
  for each row execute function public.resultados_auditar();
create trigger kumite_auditar after update or delete on public.resultados_kumite
  for each row execute function public.resultados_auditar();

-- ---------------------------------------------------------------------
-- 4. Seguridad por fila: editar y borrar solo con el permiso nuevo
-- ---------------------------------------------------------------------
grant update, delete on public.resultados_jurado, public.resultados_kumite to authenticated;

create policy jurado_actualizar on public.resultados_jurado
  for update to authenticated
  using (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso_en_algun_ambito('editar_historial'))
  with check (
    organizacion_id = public.mi_organizacion_activa()
    and public.tiene_permiso_en_algun_ambito('editar_historial')
    and (torneo_id is null or exists (
      select 1 from public.torneos t where t.id = resultados_jurado.torneo_id and t.organizacion_id = resultados_jurado.organizacion_id
    ))
  );
create policy jurado_borrar on public.resultados_jurado
  for delete to authenticated
  using (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso_en_algun_ambito('editar_historial'));

create policy kumite_actualizar on public.resultados_kumite
  for update to authenticated
  using (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso_en_algun_ambito('editar_historial'))
  with check (
    organizacion_id = public.mi_organizacion_activa()
    and public.tiene_permiso_en_algun_ambito('editar_historial')
    and (torneo_id is null or exists (
      select 1 from public.torneos t where t.id = resultados_kumite.torneo_id and t.organizacion_id = resultados_kumite.organizacion_id
    ))
  );
create policy kumite_borrar on public.resultados_kumite
  for delete to authenticated
  using (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso_en_algun_ambito('editar_historial'));

-- Las funciones de los triggers no se llaman a mano
revoke execute on function public.jurado_antes_de_editar(), public.kumite_antes_de_editar(), public.resultados_auditar() from public, anon, authenticated;
