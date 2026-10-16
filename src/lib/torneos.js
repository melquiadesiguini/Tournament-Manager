import { supabase } from './supabase'
import { mensajeDe } from './errores'

// En la base: borrador, activo (= abierto, hay uno solo por organización) y finalizado (= cerrado)
export const ESTADOS_TORNEO = { borrador: 'Borrador', activo: 'Abierto', finalizado: 'Cerrado' }

const YA_HAY_ABIERTO = 'Ya hay un torneo abierto. Cerralo antes de abrir otro.'

// Torneos de la organización. Verlos: cualquier usuario; crear, editar y borrar: permiso crear_torneos.
export async function listarTorneos() {
  const { data, error } = await supabase
    .from('torneos')
    .select('id, nombre, fecha, estado')
    .order('fecha', { ascending: false, nullsFirst: true })
    .order('nombre')
  return error ? { ok: false, filas: [] } : { ok: true, filas: data }
}

const aFila = ({ nombre, fecha, estado }) => ({ nombre: nombre.trim(), fecha: fecha || null, estado })

export async function crearTorneo(valores) {
  const { data: org } = await supabase.rpc('mi_organizacion')
  if (!org) return { ok: false, mensaje: 'No se encontró tu organización.' }
  const { error } = await supabase.from('torneos').insert({ organizacion_id: org, ...aFila(valores) })
  return error ? { ok: false, mensaje: mensajeDe(error, YA_HAY_ABIERTO) } : { ok: true }
}

export async function editarTorneo(id, valores) {
  const { data, error } = await supabase.from('torneos').update(aFila(valores)).eq('id', id).select('id')
  if (error) return { ok: false, mensaje: mensajeDe(error, YA_HAY_ABIERTO) }
  return data.length ? { ok: true } : { ok: false, mensaje: 'No se pudo guardar el cambio.' }
}

export async function borrarTorneo(id) {
  const { data, error } = await supabase.from('torneos').delete().eq('id', id).select('id')
  if (error) return { ok: false, mensaje: mensajeDe(error) }
  return data.length ? { ok: true } : { ok: false, mensaje: 'No se pudo borrar el torneo.' }
}

// Abre un torneo ('activo') o lo cierra ('finalizado'). Solo puede haber uno abierto por organización.
export async function cambiarEstadoTorneo(id, estado) {
  const { data, error } = await supabase.from('torneos').update({ estado }).eq('id', id).select('id')
  if (error) return { ok: false, mensaje: mensajeDe(error, YA_HAY_ABIERTO) }
  return data.length ? { ok: true } : { ok: false, mensaje: 'No se pudo cambiar el estado del torneo.' }
}
