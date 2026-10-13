import { supabase } from './supabase'
import { mensajeDe } from './errores'

// Roles de la organización y sus permisos. Las reglas (el Admin no se borra ni pierde los permisos
// de gestión, solo se usan permisos del plan) las aplica la base: acá solo se muestran sus mensajes.

export async function listarRoles() {
  const { data, error } = await supabase
    .from('roles')
    .select('id, nombre, de_fabrica, rol_permisos(permiso)')
    .order('de_fabrica', { ascending: false })
    .order('nombre')
  if (error) return { ok: false, filas: [] }
  return { ok: true, filas: data.map((r) => ({ ...r, permisos: r.rol_permisos.map((p) => p.permiso) })) }
}

export async function crearRol(nombre) {
  const { data: org } = await supabase.rpc('mi_organizacion')
  if (!org) return { ok: false, mensaje: 'No se encontró tu organización.' }
  const { error } = await supabase.from('roles').insert({ organizacion_id: org, nombre: nombre.trim() })
  return error ? { ok: false, mensaje: mensajeDe(error, 'Ya existe un rol con ese nombre.') } : { ok: true }
}

export async function renombrarRol(id, nombre) {
  const { data, error } = await supabase.from('roles').update({ nombre: nombre.trim() }).eq('id', id).select('id')
  if (error) return { ok: false, mensaje: mensajeDe(error, 'Ya existe un rol con ese nombre.') }
  return data.length ? { ok: true } : { ok: false, mensaje: 'No se pudo guardar el cambio.' }
}

export async function borrarRol(id) {
  const { data, error } = await supabase.from('roles').delete().eq('id', id).select('id')
  if (error) return { ok: false, mensaje: mensajeDe(error) }
  return data.length ? { ok: true } : { ok: false, mensaje: 'No se pudo borrar el rol.' }
}

// Agrega o quita un permiso de un rol
export async function cambiarPermisoDeRol(rolId, permiso, activo) {
  const { error } = activo
    ? await supabase.from('rol_permisos').insert({ rol_id: rolId, permiso })
    : await supabase.from('rol_permisos').delete().eq('rol_id', rolId).eq('permiso', permiso)
  return error ? { ok: false, mensaje: mensajeDe(error) } : { ok: true }
}

// Asignaciones: qué rol tiene cada usuario, en qué torneo (null = toda la organización) y área (null = todas)
export async function listarAsignaciones() {
  const { data, error } = await supabase.from('asignaciones').select('id, usuario_id, rol_id, torneo_id, area')
  return error ? { ok: false, filas: [] } : { ok: true, filas: data }
}

export async function agregarAsignacion({ usuario_id, rol_id, torneo_id, area }) {
  const { data: org } = await supabase.rpc('mi_organizacion')
  if (!org) return { ok: false, mensaje: 'No se encontró tu organización.' }
  const { error } = await supabase.from('asignaciones').insert({
    organizacion_id: org,
    usuario_id,
    rol_id,
    torneo_id: torneo_id || null,
    area: area?.trim() || null,
  })
  return error ? { ok: false, mensaje: mensajeDe(error, 'Ese usuario ya tiene ese rol en ese torneo y área.') } : { ok: true }
}

export async function borrarAsignacion(id) {
  const { data, error } = await supabase.from('asignaciones').delete().eq('id', id).select('id')
  if (error) return { ok: false, mensaje: mensajeDe(error) }
  return data.length ? { ok: true } : { ok: false, mensaje: 'No se pudo quitar el rol.' }
}
