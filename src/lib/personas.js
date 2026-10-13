import { supabase } from './supabase'
import { CAMPOS_PERSONAS } from './camposPersonas'

// Altas, bajas y cambios de las listas que administra el administrador:
// tabla 'jueces' o 'competidores' (estructura en camposPersonas.js).

async function organizacionActiva() {
  const { data } = await supabase.rpc('mi_org_id')
  return data ?? null
}

// Pasa lo escrito en un formulario o leído del Excel a las columnas de la tabla
function aFila(tabla, valores) {
  const fila = {}
  for (const campo of CAMPOS_PERSONAS[tabla].campos) {
    const v = valores[campo.clave]
    if (campo.tipo === 'booleano') fila[campo.clave] = Boolean(v)
    else if (campo.clave === 'apellido') fila[campo.clave] = String(v ?? '').trim()
    else fila[campo.clave] = String(v ?? '').trim() || null
  }
  return fila
}

const mensajeDe = (error) =>
  error.code === '23505' ? 'Ya existe uno con ese nombre.' : 'No se pudo guardar: ' + error.message

export async function listarPersonas(tabla) {
  let consulta = supabase.from(tabla).select('*')
  for (const col of CAMPOS_PERSONAS[tabla].orden) consulta = consulta.order(col)
  const { data, error } = await consulta.limit(5000)
  return error ? { ok: false, filas: [] } : { ok: true, filas: data }
}

export async function agregarPersona(tabla, valores) {
  const org = await organizacionActiva()
  if (!org) return { ok: false, mensaje: 'No se encontró tu organización.' }
  const { error } = await supabase.from(tabla).insert({ org_id: org, ...aFila(tabla, valores) })
  return error ? { ok: false, mensaje: mensajeDe(error) } : { ok: true }
}

export async function actualizarPersona(tabla, id, cambios) {
  const { data, error } = await supabase.from(tabla).update(cambios).eq('id', id).select('id')
  if (error) return { ok: false, mensaje: mensajeDe(error) }
  return data.length ? { ok: true } : { ok: false, mensaje: 'No se pudo guardar el cambio.' }
}

// Edición desde el formulario (convierte los valores igual que el alta)
export function editarPersona(tabla, id, valores) {
  return actualizarPersona(tabla, id, aFila(tabla, valores))
}

export async function borrarPersona(tabla, id) {
  const { data, error } = await supabase.from(tabla).delete().eq('id', id).select('id')
  return error || !data.length ? { ok: false, mensaje: 'No se pudo borrar.' } : { ok: true }
}

// Importa las filas leídas del Excel. Si ya existe una con la misma clave se actualizan
// sus datos con los del archivo (el estado activo/inactivo no se toca).
export async function importarPersonas(tabla, personas) {
  const org = await organizacionActiva()
  if (!org) return { ok: false, mensaje: 'Iniciá sesión para importar.' }
  const filas = personas.map((p) => ({ org_id: org, ...aFila(tabla, p) }))
  const { error } = await supabase.from(tabla).upsert(filas, { onConflict: CAMPOS_PERSONAS[tabla].conflicto })
  if (error) return { ok: false, mensaje: 'No se pudo importar: ' + error.message }
  return { ok: true }
}
