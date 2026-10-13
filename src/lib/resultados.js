import { supabase } from './supabase'

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

  const area = localStorage.getItem('tm-area') || null
  const { error } = await supabase
    .from('resultados')
    .insert({ organizacion_id: orgId, creado_por: session.user.id, modulo, area, payload })
  return error ? { ok: false, motivo: 'error', error } : { ok: true }
}

// Resultados de la organización del usuario, del más reciente al más antiguo
export async function listarResultados(limite = 200) {
  if (!supabase) return { ok: false, resultados: [] }
  const { data, error } = await supabase
    .from('resultados')
    .select('id, modulo, area, payload, creado_en')
    .order('creado_en', { ascending: false })
    .limit(limite)
  return error ? { ok: false, resultados: [], error } : { ok: true, resultados: data }
}

// Texto corto para avisar al usuario cómo terminó el guardado en la nube
export function mensajeGuardado(r) {
  if (r.ok) return '☁️ Guardado también en la nube.'
  if (r.motivo === 'sin-sesion') return 'Guardado solo en este navegador (iniciá sesión para guardarlo en la nube).'
  if (r.motivo === 'sin-configurar') return 'Guardado solo en este navegador.'
  return 'No se pudo guardar en la nube; quedó solo en este navegador.'
}
