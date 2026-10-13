import { supabase } from './supabase'

// Alta y administración de clientes (organizaciones). Solo el superadministrador.

export async function listarOrganizaciones() {
  const { data, error } = await supabase.rpc('listar_organizaciones')
  return error ? { ok: false, filas: [], mensaje: error.message } : { ok: true, filas: data }
}

export async function crearOrganizacion({ nombre, emailAdmin, plan, dias }) {
  const { error } = await supabase.rpc('crear_organizacion', {
    nombre,
    email_admin: emailAdmin,
    plan,
    dias,
  })
  return error ? { ok: false, mensaje: error.message } : { ok: true }
}

export async function actualizarOrganizacion(id, { nombre, plan, estado, venceEl, notas }) {
  const { error } = await supabase.rpc('actualizar_organizacion', {
    oid: id,
    nombre,
    plan,
    estado,
    vence_el: venceEl || null,
    notas,
  })
  return error ? { ok: false, mensaje: error.message } : { ok: true }
}
