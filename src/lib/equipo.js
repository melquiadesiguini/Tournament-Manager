import { supabase } from './supabase'

// Miembros de la organización con su email (solo administradores)
export async function listarEquipo() {
  const { data, error } = await supabase.rpc('listar_equipo')
  return error ? [] : data
}

export async function listarInvitaciones() {
  const { data, error } = await supabase
    .from('invitaciones')
    .select('id, email, role')
    .order('created_at', { ascending: false })
  return error ? [] : data
}

export async function invitar(email, role) {
  const { data: orgId } = await supabase.rpc('mi_org_id')
  if (!orgId) return { ok: false, mensaje: 'No se encontró tu organización.' }
  const { error } = await supabase
    .from('invitaciones')
    .upsert({ org_id: orgId, email: email.trim().toLowerCase(), role }, { onConflict: 'org_id,email' })
  return error ? { ok: false, mensaje: 'No se pudo invitar: ' + error.message } : { ok: true }
}

export async function cancelarInvitacion(id) {
  const { error } = await supabase.from('invitaciones').delete().eq('id', id)
  return error ? { ok: false, mensaje: 'No se pudo cancelar la invitación.' } : { ok: true }
}

export async function cambiarRol(userId, role) {
  const { data: orgId } = await supabase.rpc('mi_org_id')
  const { data, error } = await supabase
    .from('members')
    .update({ role })
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .select('user_id')
  return error || !data?.length ? { ok: false, mensaje: 'No se pudo cambiar el rol.' } : { ok: true }
}

export async function cambiarEstado(userId, estado) {
  const { data: orgId } = await supabase.rpc('mi_org_id')
  const { data, error } = await supabase
    .from('members')
    .update({ estado })
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .select('user_id')
  return error || !data?.length ? { ok: false, mensaje: 'No se pudo cambiar el estado.' } : { ok: true }
}

// Elimina al usuario (si pertenece a otra organización, solo lo quita de esta)
export async function eliminarUsuario(userId) {
  const { error } = await supabase.rpc('eliminar_usuario', { objetivo: userId })
  return error ? { ok: false, mensaje: error.message } : { ok: true }
}

// El administrador cambia la contraseña de otro usuario; se cierran sus sesiones abiertas
export async function cambiarClaveUsuario(userId, nueva) {
  const { error } = await supabase.rpc('cambiar_clave_usuario', { objetivo: userId, nueva })
  return error ? { ok: false, mensaje: error.message } : { ok: true }
}

// Cada usuario cambia su propia contraseña
export async function cambiarMiClave(nueva) {
  if (nueva.length < 6) return { ok: false, mensaje: 'La contraseña debe tener al menos 6 caracteres.' }
  const { error } = await supabase.auth.updateUser({ password: nueva })
  return error ? { ok: false, mensaje: error.message } : { ok: true }
}
