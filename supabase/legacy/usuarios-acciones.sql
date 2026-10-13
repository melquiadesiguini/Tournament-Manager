-- =====================================================================
-- USUARIOS: acciones del administrador (v1.5) — migración.
-- Requiere roles.sql y configuracion.sql.
-- Pegar en Supabase > SQL Editor > New query > Run. Es seguro volver a ejecutarla.
--
--  * Cambiar la contraseña de un usuario de la organización
--  * Eliminar un usuario
--  * Un superadministrador no puede ser modificado ni eliminado por un administrador
-- =====================================================================

create or replace function public.es_superadmin_usuario(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = uid)
$$;

-- El administrador solo cambia roles y estados de usuarios que no son superadministradores
drop policy if exists "members_owner_update" on public.members;
create policy "members_owner_update" on public.members
  for update to authenticated
  using (public.is_owner(org_id) and (public.es_superadmin() or not public.es_superadmin_usuario(user_id)))
  with check (public.is_owner(org_id) and (public.es_superadmin() or not public.es_superadmin_usuario(user_id)));

drop policy if exists "members_owner_delete" on public.members;
create policy "members_owner_delete" on public.members
  for delete to authenticated
  using (public.is_owner(org_id) and (public.es_superadmin() or not public.es_superadmin_usuario(user_id)));

-- Valida que quien llama sea administrador y que el objetivo sea de su organización
create or replace function public.validar_gestion_usuario(objetivo uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org uuid := public.mi_org_id();
begin
  if org is null or not public.is_owner(org) then
    raise exception 'No tenés permiso para administrar usuarios.';
  end if;
  if not exists (select 1 from public.members where org_id = org and user_id = objetivo) then
    raise exception 'El usuario no pertenece a tu organización.';
  end if;
  if public.es_superadmin_usuario(objetivo) and not public.es_superadmin() then
    raise exception 'No tenés permiso para modificar a este usuario.';
  end if;
  return org;
end;
$$;

-- Cambia la contraseña de un usuario y cierra sus sesiones abiertas
create or replace function public.cambiar_clave_usuario(objetivo uuid, nueva text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.validar_gestion_usuario(objetivo);
  if length(coalesce(nueva, '')) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres.';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt(nueva, extensions.gen_salt('bf')),
      updated_at = now()
  where id = objetivo;
  delete from auth.sessions where user_id = objetivo;
end;
$$;

-- Elimina un usuario. Si además pertenece a otra organización, solo se lo quita de esta.
create or replace function public.eliminar_usuario(objetivo uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
begin
  org := public.validar_gestion_usuario(objetivo);
  if objetivo = auth.uid() then
    raise exception 'No podés eliminar tu propio usuario.';
  end if;
  if exists (select 1 from public.members where user_id = objetivo and org_id <> org) then
    delete from public.members where org_id = org and user_id = objetivo;
  else
    delete from auth.users where id = objetivo;
  end if;
end;
$$;

revoke execute on function public.es_superadmin_usuario(uuid) from public, anon;
revoke execute on function public.validar_gestion_usuario(uuid) from public, anon;
revoke execute on function public.cambiar_clave_usuario(uuid, text) from public, anon;
revoke execute on function public.eliminar_usuario(uuid) from public, anon;
grant execute on function public.es_superadmin_usuario(uuid) to authenticated;
grant execute on function public.cambiar_clave_usuario(uuid, text) to authenticated;
grant execute on function public.eliminar_usuario(uuid) to authenticated;
