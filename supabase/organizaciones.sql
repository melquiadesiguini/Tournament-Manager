-- =====================================================================
-- ORGANIZACIONES COMO CLIENTES (v1.6) — migración.
-- Requiere roles.sql, configuracion.sql y usuarios-acciones.sql.
-- Pegar en Supabase > SQL Editor > New query > Run. Es seguro volver a ejecutarla.
--
--  * Cada organización tiene plan, estado (prueba / activa / suspendida) y vencimiento.
--    Una organización suspendida o vencida pierde el acceso (excepto el superadministrador).
--  * El registro público se cierra: solo pueden crear cuenta quienes recibieron una invitación.
--  * El superadministrador da de alta organizaciones y su primer administrador.
-- =====================================================================

-- ---------- Plan, estado y vencimiento ----------
-- Las organizaciones que ya existen quedan como plan "Interno", activas y sin vencimiento.
alter table public.organizations add column if not exists plan text not null default 'Interno';
alter table public.organizations add column if not exists estado text not null default 'activa';
alter table public.organizations add column if not exists vence_el date;
alter table public.organizations add column if not exists notas text;

alter table public.organizations drop constraint if exists organizations_estado_check;
alter table public.organizations
  add constraint organizations_estado_check check (estado in ('prueba', 'activa', 'suspendida'));

-- Las nuevas parten en prueba
alter table public.organizations alter column plan set default 'Prueba';
alter table public.organizations alter column estado set default 'prueba';

-- Los administradores solo pueden cambiar el nombre de su organización; el plan, el estado y
-- el vencimiento los maneja el superadministrador
revoke update on public.organizations from authenticated;
grant update (name) on public.organizations to authenticated;

-- ---------- Organización activa ----------
create or replace function public.org_activa(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = oid
      and o.estado in ('prueba', 'activa')
      and (o.vence_el is null or o.vence_el >= current_date)
  )
$$;

-- Los miembros de una organización suspendida o vencida dejan de verla y de tener rol
create or replace function public.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.organizations where public.es_superadmin()
  union
  select m.org_id from public.members m
  where m.user_id = auth.uid() and m.estado = 'activo' and public.org_activa(m.org_id)
$$;

create or replace function public.mi_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.members
  where user_id = auth.uid()
    and estado = 'activo'
    and (public.es_superadmin() or public.org_activa(org_id))
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
  where org_id = target_org
    and user_id = auth.uid()
    and estado = 'activo'
    and (public.es_superadmin() or public.org_activa(org_id))
$$;

-- ---------- Registro solo por invitación ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nueva_org uuid;
  filas integer := 0;
  es_super boolean := lower(new.email) = 'melquiades.iguini@gmail.com';
begin
  if new.email_confirmed_at is not null then
    if es_super then
      insert into public.platform_admins (user_id) values (new.id) on conflict do nothing;
    end if;

    insert into public.members (org_id, user_id, role)
    select org_id, new.id, role from public.invitaciones where email = lower(new.email)
    on conflict do nothing;
    get diagnostics filas = row_count;
    delete from public.invitaciones where email = lower(new.email);
    if filas > 0 then
      return new;
    end if;
  elsif exists (select 1 from public.invitaciones where email = lower(new.email)) then
    -- invitado que todavía no confirmó su email: se une al confirmarlo (al_confirmar_email)
    return new;
  end if;

  if not es_super then
    raise exception 'El registro está cerrado: solo pueden crear cuenta quienes recibieron una invitación.';
  end if;

  insert into public.organizations (name, plan, estado)
  values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'org_name'), ''), split_part(new.email, '@', 1)), 'Interno', 'activa')
  returning id into nueva_org;

  insert into public.members (org_id, user_id, role)
  values (nueva_org, new.id, 'administrador');

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------- Panel del superadministrador ----------
create or replace function public.exigir_superadmin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_superadmin() then
    raise exception 'No tenés permiso para esta acción.';
  end if;
end;
$$;

create or replace function public.listar_organizaciones()
returns table (
  id uuid, nombre text, plan text, estado text, vence_el date, notas text,
  creada timestamptz, miembros bigint, administradores text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.exigir_superadmin();
  return query
  select o.id, o.name, o.plan, o.estado, o.vence_el, o.notas, o.created_at,
         (select count(*) from public.members m where m.org_id = o.id),
         coalesce(
           (select string_agg(u.email::text, ', ')
            from public.members m join auth.users u on u.id = m.user_id
            where m.org_id = o.id and m.role = 'administrador'),
           (select string_agg(i.email, ', ') || ' (invitado)'
            from public.invitaciones i where i.org_id = o.id and i.role = 'administrador')
         )
  from public.organizations o
  order by o.created_at desc;
end;
$$;

-- Da de alta un cliente: la organización y su primer administrador.
-- dias > 0: período de prueba con vencimiento; sin días: activa sin vencimiento.
create or replace function public.crear_organizacion(
  nombre text, email_admin text, plan text default 'Prueba', dias integer default 14
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
  uid uuid;
  mail text := lower(btrim(coalesce(email_admin, '')));
begin
  perform public.exigir_superadmin();
  if btrim(coalesce(nombre, '')) = '' or mail !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Revisá el nombre de la organización y el email del administrador.';
  end if;

  insert into public.organizations (name, plan, estado, vence_el)
  values (
    btrim(nombre),
    coalesce(nullif(btrim(plan), ''), 'Prueba'),
    case when coalesce(dias, 0) > 0 then 'prueba' else 'activa' end,
    case when coalesce(dias, 0) > 0 then current_date + dias end
  )
  returning id into oid;

  select id into uid from auth.users where lower(email) = mail and email_confirmed_at is not null;
  if uid is not null then
    insert into public.members (org_id, user_id, role) values (oid, uid, 'administrador') on conflict do nothing;
  else
    insert into public.invitaciones (org_id, email, role) values (oid, mail, 'administrador');
  end if;
  return oid;
end;
$$;

create or replace function public.actualizar_organizacion(
  oid uuid, nombre text, plan text, estado text, vence_el date, notas text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exigir_superadmin();
  if actualizar_organizacion.estado not in ('prueba', 'activa', 'suspendida') then
    raise exception 'Estado no válido.';
  end if;
  update public.organizations o
  set name = coalesce(nullif(btrim(actualizar_organizacion.nombre), ''), o.name),
      plan = coalesce(nullif(btrim(actualizar_organizacion.plan), ''), o.plan),
      estado = actualizar_organizacion.estado,
      vence_el = actualizar_organizacion.vence_el,
      notas = nullif(btrim(coalesce(actualizar_organizacion.notas, '')), '')
  where o.id = actualizar_organizacion.oid;
end;
$$;

revoke execute on function public.org_activa(uuid) from public, anon;
revoke execute on function public.exigir_superadmin() from public, anon;
revoke execute on function public.listar_organizaciones() from public, anon;
revoke execute on function public.crear_organizacion(text, text, text, integer) from public, anon;
revoke execute on function public.actualizar_organizacion(uuid, text, text, text, date, text) from public, anon;
grant execute on function public.org_activa(uuid) to authenticated;
grant execute on function public.listar_organizaciones() to authenticated;
grant execute on function public.crear_organizacion(text, text, text, integer) to authenticated;
grant execute on function public.actualizar_organizacion(uuid, text, text, text, date, text) to authenticated;
