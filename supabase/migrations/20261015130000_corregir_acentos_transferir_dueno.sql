-- =====================================================================
-- IPPONIA · Corrige la codificación de "Dueño" en transferir_dueno
-- =====================================================================
-- Al aplicar 20261013150000 en Supabase, la ñ de 'Dueño' se pegó con la codificación equivocada ('DueÃ±o').
-- Esta migración vuelve a definir la función con el texto correcto y arregla el nombre que quedó mal.
-- Es segura de repetir: no cambia nada si ya está bien.

create or replace function public.transferir_dueno(p_slug text, p_email text, p_quitar_anterior boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
  nuevo uuid;
  anterior uuid;
  admin_id uuid;
begin
  select id into org from public.organizaciones where slug = lower(btrim(p_slug));
  if org is null then
    raise exception 'No existe la organización "%".', p_slug;
  end if;

  select id into nuevo from auth.users where lower(email) = lower(btrim(p_email));
  if nuevo is null then
    raise exception 'No existe una cuenta con el email "%". Creala primero en Authentication > Users.', p_email;
  end if;
  if exists (select 1 from public.perfiles where usuario_id = nuevo) then
    raise exception 'Esa cuenta ya pertenece a una organización.';
  end if;

  select usuario_id into anterior from public.perfiles where organizacion_id = org and es_dueno;
  select id into admin_id from public.roles where organizacion_id = org and nombre = 'Admin' and de_fabrica;

  alter table public.perfiles disable trigger perfiles_proteger_dueno;
  alter table public.asignaciones disable trigger asignaciones_proteger_admin;

  if anterior is not null then
    update public.perfiles
    set es_dueno = false, nombre_visible = case when nombre_visible = 'Dueño' then null else nombre_visible end
    where usuario_id = anterior;
  end if;

  insert into public.perfiles (usuario_id, organizacion_id, es_dueno, nombre_visible, debe_cambiar_clave)
  values (nuevo, org, true, 'Dueño', true);
  insert into public.asignaciones (organizacion_id, usuario_id, rol_id) values (org, nuevo, admin_id);

  if anterior is not null and p_quitar_anterior then
    delete from public.perfiles where usuario_id = anterior;
  end if;

  alter table public.perfiles enable trigger perfiles_proteger_dueno;
  alter table public.asignaciones enable trigger asignaciones_proteger_admin;

  insert into public.auditoria (organizacion_id, actor_id, accion, detalle)
  values (org, null, 'transferir_dueno', jsonb_build_object('de', anterior, 'a', nuevo));
end;
$$;

-- El nombre del dueño que había quedado con la codificación rota
update public.perfiles set nombre_visible = 'Dueño' where es_dueno and nombre_visible like '%Ã%';
