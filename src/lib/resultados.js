import { supabase } from './supabase'
import { readArea } from '../hooks/useArea'
import { numeroONull } from './jurado'
import { filaJurado, filaKumite } from './filasResultados'

// Los resultados se guardan en dos tablas según su estructura (ver la migración 20261015120000):
//   resultados_jurado  Kata, Kobudo y Destreza: un juez por columna
//   resultados_kumite  Kumite: marcador, faltas y ganador
// Las pantallas siguen entregando un "payload" con los datos del resultado; acá se reparte en columnas.

// Guarda un resultado (Kata, Kobudo, Destreza o Kumite) en la base de datos, en la
// organización del usuario. Devuelve { ok: true } o { ok: false, motivo, error }.
// motivo: 'sin-configurar' | 'sin-sesion' | 'sin-organizacion' | 'error'
export async function guardarResultado({ modulo, payload }) {
  if (!supabase) return { ok: false, motivo: 'sin-configurar' }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { ok: false, motivo: 'sin-sesion' }

  const { data: orgId, error: errorMiembro } = await supabase.rpc('mi_organizacion')
  if (errorMiembro || !orgId) {
    return { ok: false, motivo: 'sin-organizacion', error: errorMiembro }
  }

  const area = numeroONull(readArea())
  const esKumite = modulo === 'kumite'
  const { error } = await supabase
    .from(esKumite ? 'resultados_kumite' : 'resultados_jurado')
    .insert({ organizacion_id: orgId, creado_por: session.user.id, ...(esKumite ? filaKumite(payload, area) : filaJurado(modulo, payload, area)) })
  return error ? { ok: false, motivo: 'error', error } : { ok: true }
}

// Resultados de la organización del usuario (las dos tablas juntas), del más reciente al más antiguo.
// Cada fila trae `tabla`: 'jurado' o 'kumite'.
export async function listarResultados(limite = 200) {
  if (!supabase) return { ok: false, resultados: [] }
  const pedir = (tabla) => supabase.from(tabla).select('*').order('creado_en', { ascending: false }).limit(limite)
  const [jurado, kumite] = await Promise.all([pedir('resultados_jurado'), pedir('resultados_kumite')])
  if (jurado.error || kumite.error) return { ok: false, resultados: [], error: jurado.error || kumite.error }

  const resultados = [
    ...jurado.data.map((r) => ({ ...r, tabla: 'jurado' })),
    ...kumite.data.map((r) => ({ ...r, tabla: 'kumite' })),
  ]
    .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))
    .slice(0, limite)
  return { ok: true, resultados }
}

// Texto corto para avisar al usuario cómo terminó el guardado en la nube
export function mensajeGuardado(r) {
  if (r.ok) return '☁️ Guardado también en la nube.'
  if (r.motivo === 'sin-sesion') return 'Guardado solo en este navegador (iniciá sesión para guardarlo en la nube).'
  if (r.motivo === 'sin-configurar') return 'Guardado solo en este navegador.'
  return 'No se pudo guardar en la nube; quedó solo en este navegador.'
}
