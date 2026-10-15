-- =====================================================================
-- IPPONIA · Resultados separados por estructura, con columnas reales
-- =====================================================================
-- Hasta ahora todo se guardaba en `resultados` con los datos dentro de un campo JSON (`payload`).
-- Eso no valida tipos, complica las consultas y las exportaciones, y mezcla estructuras distintas.
-- Ahora hay DOS tablas según la forma de los datos:
--
--   resultados_jurado  Kata, Kobudo y Destreza (puntúan jueces; los tres guardan lo mismo)
--   resultados_kumite  Kumite (combate Shiro contra Aka)
--
-- Cada dato tiene su columna y su tipo: números como número, fechas como timestamptz,
-- el área y la ronda como entero, un campo vacío como NULL (nunca 0 ni texto vacío).
-- La tabla vieja NO se borra: queda como `resultados_archivo`, sin acceso desde la API.
-- Requiere: 20261013120000_multiorganizacion.sql

-- ---------------------------------------------------------------------
-- 1. Ayudas temporales para convertir los datos viejos (se borran al final)
-- ---------------------------------------------------------------------
create function public.num_o_null(p text) returns numeric
language sql immutable
as $$ select case when p ~ '^\s*-?\d+(\.\d+)?\s*$' then btrim(p)::numeric end $$;

create function public.entero_o_null(p text) returns integer
language sql immutable
as $$ select case when p ~ '^\s*\d{1,9}\s*$' then btrim(p)::integer end $$;

-- ---------------------------------------------------------------------
-- 2. Tablas nuevas
-- ---------------------------------------------------------------------
create table public.resultados_jurado (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones (id) on delete cascade,
  torneo_id uuid references public.torneos (id) on delete set null,
  creado_por uuid not null default auth.uid() references auth.users (id),
  creado_en timestamptz not null default now(), -- fecha y hora exactas del guardado (hora del servidor)
  modulo text not null check (modulo in ('kata', 'kobudo', 'destreza')),
  area integer check (area between 0 and 999),
  ronda integer check (ronda between 1 and 999),
  competidor text not null check (btrim(competidor) <> ''), -- en Destreza es el equipo
  kata text,                                                -- nombre del kata o kobudo (Destreza no tiene)
  sistema_jueces smallint not null check (sistema_jueces in (3, 5)),
  responsable_mesa text,
  -- Un juez por columna. Con 3 jueces actúan el 1, el 2 y el central; el 3 y el 4 quedan en NULL.
  juez1_nombre text,
  juez1_puntaje numeric(4, 2) check (juez1_puntaje between 0 and 10),
  juez2_nombre text,
  juez2_puntaje numeric(4, 2) check (juez2_puntaje between 0 and 10),
  juez3_nombre text,
  juez3_puntaje numeric(4, 2) check (juez3_puntaje between 0 and 10),
  juez4_nombre text,
  juez4_puntaje numeric(4, 2) check (juez4_puntaje between 0 and 10),
  juez_central_nombre text,
  juez_central_puntaje numeric(4, 2) not null check (juez_central_puntaje between 0 and 10),
  -- Posiciones que no cuentan para el total (con 5 jueces, el mayor y el menor): 1 a 4 y 5 = central
  jueces_descartados smallint[] not null default '{}' check (jueces_descartados <@ array[1, 2, 3, 4, 5]::smallint[]),
  puntaje_final numeric(5, 2) not null check (puntaje_final between 0 and 30),
  constraint jurado_puntajes_segun_sistema check (
    juez1_puntaje is not null
    and juez2_puntaje is not null
    and (
      (sistema_jueces = 3 and juez3_puntaje is null and juez4_puntaje is null)
      or (sistema_jueces = 5 and juez3_puntaje is not null and juez4_puntaje is not null)
    )
  )
);
create index resultados_jurado_org_idx on public.resultados_jurado (organizacion_id, creado_en desc);

create table public.resultados_kumite (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones (id) on delete cascade,
  torneo_id uuid references public.torneos (id) on delete set null,
  creado_por uuid not null default auth.uid() references auth.users (id),
  creado_en timestamptz not null default now(),
  area integer check (area between 0 and 999),
  sistema_jueces smallint check (sistema_jueces in (3, 5)),
  responsable_mesa text,
  categoria text,
  nombre_shiro text not null default '',
  nombre_aka text not null default '',
  puntaje_shiro integer not null,
  puntaje_aka integer not null,
  ganador text not null default '',                       -- nombre del ganador (o EMPATE), tal como se mostró
  lado_ganador text check (lado_ganador in ('shiro', 'aka', 'empate')),
  faltas jsonb not null default '{}'::jsonb,              -- faltas marcadas de cada lado
  salida jsonb,                                           -- quién salió y por qué (null si nadie)
  encho_sen boolean not null default false,
  duracion_restante_ms integer check (duracion_restante_ms >= 0)
);
create index resultados_kumite_org_idx on public.resultados_kumite (organizacion_id, creado_en desc);

-- ---------------------------------------------------------------------
-- 3. Pasar los datos que ya existían
-- ---------------------------------------------------------------------
-- Cada resultado se convierte por separado: si alguno no se puede convertir (datos incompletos),
-- no se pierde, queda en `resultados_archivo`, y se avisa con un NOTICE.
do $$
declare
  r record;
  p jsonb;
  e jsonb;
  sistema int;
  n int;
  idx int;
  nom text[];
  pun numeric[];
  descartados smallint[];
  hay_marca boolean;
  mayor numeric;
  menor numeric;
  pos_mayor int;
  pos_menor int;
  final numeric;
  area_n int;
begin
  for r in select * from public.resultados order by creado_en loop
    begin
      p := r.payload;
      area_n := coalesce(public.entero_o_null(r.area), public.entero_o_null(p ->> 'area'));

      if r.modulo = 'kumite' then
        insert into public.resultados_kumite (
          organizacion_id, torneo_id, creado_por, creado_en, area, sistema_jueces, responsable_mesa, categoria,
          nombre_shiro, nombre_aka, puntaje_shiro, puntaje_aka, ganador, lado_ganador,
          faltas, salida, encho_sen, duracion_restante_ms
        ) values (
          r.organizacion_id, r.torneo_id, r.creado_por, r.creado_en,
          area_n,
          case when p ->> 'sistemaJueces' in ('3', '5') then (p ->> 'sistemaJueces')::smallint end,
          nullif(btrim(coalesce(p ->> 'responsableMesa', '')), ''),
          nullif(btrim(coalesce(p ->> 'categoria', '')), ''),
          coalesce(btrim(p ->> 'nombreShiro'), ''),
          coalesce(btrim(p ->> 'nombreAka'), ''),
          public.entero_o_null(p ->> 'shiroTotal'),
          public.entero_o_null(p ->> 'akaTotal'),
          coalesce(btrim(p ->> 'ganador'), ''),
          case
            when upper(btrim(coalesce(p ->> 'ganador', ''))) = 'EMPATE' then 'empate'
            when p ->> 'ganador' is not null and p ->> 'ganador' = p ->> 'nombreShiro' then 'shiro'
            when p ->> 'ganador' is not null and p ->> 'ganador' = p ->> 'nombreAka' then 'aka'
          end,
          coalesce(case when jsonb_typeof(p -> 'faltas') = 'object' then p -> 'faltas' end, '{}'::jsonb),
          case when jsonb_typeof(p -> 'salida') = 'object' then p -> 'salida' end,
          coalesce((p ->> 'enchoSen') = 'true', false),
          public.entero_o_null(p ->> 'duracionRestanteMs')
        );
      else
        sistema := case when p ->> 'judgeSystem' = '5' then 5 else 3 end;
        nom := array[null, null, null, null, null]::text[];
        pun := array[null, null, null, null, null]::numeric[];
        descartados := '{}';
        hay_marca := false;

        for n in 1..sistema loop
          idx := case when n = sistema then 5 else n end; -- el último juez del sistema es el central
          e := null;
          if jsonb_typeof(p -> 'jueces') = 'array' then
            select x into e from jsonb_array_elements(p -> 'jueces') x where public.num_o_null(x ->> 'numero') = n limit 1;
          end if;
          nom[idx] := nullif(btrim(coalesce(e ->> 'nombre', p -> 'judgeNames' ->> ('judge' || n), '')), '');
          pun[idx] := coalesce(public.num_o_null(e ->> 'puntaje'), public.num_o_null(p -> 'scores' ->> ('judge' || n)));
          if e ->> 'incluido' is not null then
            hay_marca := true;
            if e ->> 'incluido' = 'false' then descartados := descartados || idx::smallint; end if;
          end if;
        end loop;

        -- Resultados sin la marca de descartados: con 5 jueces se descartan el mayor (el primero) y el menor (el último)
        if not hay_marca and sistema = 5 and pun[1] is not null and pun[2] is not null and pun[3] is not null and pun[4] is not null and pun[5] is not null then
          mayor := (select max(v) from unnest(pun) v);
          menor := (select min(v) from unnest(pun) v);
          for n in 1..5 loop
            if pos_mayor is null and pun[n] = mayor then pos_mayor := n; end if;
            if pun[n] = menor then pos_menor := n; end if;
          end loop;
          descartados := array[pos_mayor, pos_menor]::smallint[];
        end if;

        final := public.num_o_null(p ->> 'finalScore');
        if final is null then raise exception 'sin puntaje final'; end if;

        insert into public.resultados_jurado (
          organizacion_id, torneo_id, creado_por, creado_en, modulo, area, ronda, competidor, kata, sistema_jueces, responsable_mesa,
          juez1_nombre, juez1_puntaje, juez2_nombre, juez2_puntaje, juez3_nombre, juez3_puntaje, juez4_nombre, juez4_puntaje,
          juez_central_nombre, juez_central_puntaje, jueces_descartados, puntaje_final
        ) values (
          r.organizacion_id, r.torneo_id, r.creado_por, r.creado_en, r.modulo, area_n,
          nullif(public.entero_o_null(p ->> 'ronda'), 0),
          coalesce(nullif(btrim(coalesce(p ->> 'competitor', '')), ''), 'Sin nombre'),
          nullif(btrim(coalesce(p ->> 'kata', '')), ''),
          sistema,
          nullif(btrim(coalesce(p ->> 'responsableMesa', '')), ''),
          nom[1], pun[1], nom[2], pun[2], nom[3], pun[3], nom[4], pun[4], nom[5], pun[5],
          descartados, final
        );
        pos_mayor := null;
        pos_menor := null;
      end if;
    exception when others then
      pos_mayor := null;
      pos_menor := null;
      raise notice 'El resultado % no se pudo convertir y queda en resultados_archivo: %', r.id, sqlerrm;
    end;
  end loop;
end;
$$;

drop function public.num_o_null(text);
drop function public.entero_o_null(text);

-- ---------------------------------------------------------------------
-- 4. La tabla vieja queda archivada (sin acceso desde la API)
-- ---------------------------------------------------------------------
drop policy resultados_leer on public.resultados;
drop policy resultados_insertar on public.resultados;
alter table public.resultados rename to resultados_archivo;
revoke all on public.resultados_archivo from anon, authenticated;
comment on table public.resultados_archivo is 'Resultados anteriores al 15/10/2026, cuando todo se guardaba en un JSON. Copia de seguridad: la app ya no la usa.';

-- ---------------------------------------------------------------------
-- 5. Seguridad por fila (RLS): igual que antes, tabla por tabla
-- ---------------------------------------------------------------------
alter table public.resultados_jurado enable row level security;
alter table public.resultados_kumite enable row level security;
revoke all on public.resultados_jurado, public.resultados_kumite from anon, authenticated;
grant select, insert on public.resultados_jurado, public.resultados_kumite to authenticated; -- no se editan ni se borran

-- Leer: quien puede ver el historial. Guardar: quien puntúa u opera ese módulo, firmando con su propio usuario,
-- y con un torneo (si lo hay) de su misma organización.
create policy jurado_leer on public.resultados_jurado
  for select to authenticated
  using (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso_en_algun_ambito('ver_historial'));

create policy jurado_insertar on public.resultados_jurado
  for insert to authenticated
  with check (
    organizacion_id = public.mi_organizacion_activa()
    and creado_por = auth.uid()
    and (
      (modulo = 'kata' and public.tiene_permiso_en_algun_ambito('puntuar_kata'))
      or (modulo = 'kobudo' and public.tiene_permiso_en_algun_ambito('puntuar_kobudo'))
      or (modulo = 'destreza' and public.tiene_permiso_en_algun_ambito('puntuar_destreza'))
    )
    and (torneo_id is null or exists (
      select 1 from public.torneos t where t.id = resultados_jurado.torneo_id and t.organizacion_id = resultados_jurado.organizacion_id
    ))
  );

create policy kumite_leer on public.resultados_kumite
  for select to authenticated
  using (organizacion_id = public.mi_organizacion_activa() and public.tiene_permiso_en_algun_ambito('ver_historial'));

create policy kumite_insertar on public.resultados_kumite
  for insert to authenticated
  with check (
    organizacion_id = public.mi_organizacion_activa()
    and creado_por = auth.uid()
    and (public.tiene_permiso_en_algun_ambito('operar_mesa_kumite') or public.tiene_permiso_en_algun_ambito('operar_kansa_kumite'))
    and (torneo_id is null or exists (
      select 1 from public.torneos t where t.id = resultados_kumite.torneo_id and t.organizacion_id = resultados_kumite.organizacion_id
    ))
  );
