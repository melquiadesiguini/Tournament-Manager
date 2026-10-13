import { supabase } from './supabase'

// Llama a una Edge Function de Supabase (supabase/functions). El navegador manda la sesión del
// usuario; la clave de servicio vive solo en el servidor. Devuelve { ok: true, ...datos } o
// { ok: false, mensaje } (los mensajes de la función ya vienen en español).
export async function llamarFuncion(nombre, cuerpo) {
  if (!supabase) return { ok: false, mensaje: 'La base de datos no está configurada.' }
  const { data, error } = await supabase.functions.invoke(nombre, { body: cuerpo })
  if (error) {
    let mensaje = 'No se pudo completar la acción. Probá de nuevo.'
    try {
      const detalle = await error.context.json()
      if (detalle?.error) mensaje = detalle.error
    } catch {
      // sin detalle legible (por ejemplo, sin conexión): queda el mensaje general
    }
    return { ok: false, mensaje }
  }
  return data?.ok ? data : { ok: false, mensaje: data?.error || 'No se pudo completar la acción.' }
}
