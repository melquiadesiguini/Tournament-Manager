import { supabase } from './supabase'
import { llamarFuncion } from './funciones'

// Usuarios de la organización. Ver los perfiles lo permite RLS; crear, cambiar contraseñas y
// desactivar pasan por las Edge Functions (tocan Supabase Auth, que el navegador no puede).

export async function listarUsuarios() {
  const { data, error } = await supabase
    .from('perfiles')
    .select('usuario_id, nombre_usuario, nombre_visible, es_dueno, activo, debe_cambiar_clave')
    .order('es_dueno', { ascending: false })
    .order('nombre_usuario')
  return error ? { ok: false, filas: [] } : { ok: true, filas: data }
}

export const crearUsuario = ({ nombre_usuario, nombre_visible, clave }) =>
  llamarFuncion('crear-usuario', { nombre_usuario: nombre_usuario.trim().toLowerCase(), nombre_visible: nombre_visible.trim(), clave })

export const resetearClave = (usuarioId, clave) => llamarFuncion('resetear-clave', { usuario_id: usuarioId, clave })

export const cambiarEstadoUsuario = (usuarioId, activo) => llamarFuncion('desactivar-usuario', { usuario_id: usuarioId, activo })

// Contraseña inicial al azar, sin caracteres que se confunden (0/O, 1/l/I) para dictarla sin errores
export function generarClave(largo = 10) {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const azar = crypto.getRandomValues(new Uint32Array(largo))
  return Array.from(azar, (n) => letras[n % letras.length]).join('')
}
