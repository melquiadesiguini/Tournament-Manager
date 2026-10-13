// Validación de datos de entrada. Funciones puras (sin Supabase ni Deno), fáciles de probar.
// Los límites repiten los de la base de datos (que es la que manda): si cambian allá, cambian acá.
import { ErrorNegocio } from './tipos.ts'

// Palabras que no pueden ser el identificador (slug) de una organización: chocarían con rutas
// de la app. Debe coincidir con public.slugs_reservados() en la migración.
export const SLUGS_RESERVADOS = [
  'kata', 'kumite', 'kobudo', 'destreza', 'pantalla', 'juez', 'jueces', 'cuenta', 'ingresar',
  'registro', 'restablecer', 'configuracion', 'historial', 'superadmin', 'admin', 'api',
  'assets', 'login', 'logout', 'torneos', 'www', 'ipponia', 'soporte', 'ayuda', 'docs', 'static',
]

const RE_USUARIO = /^[a-z0-9._-]{3,30}$/
const RE_SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/
const RE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const CLAVES_OBVIAS = ['12345678', '123456789', '1234567890', '87654321', 'password', 'contrasena', 'qwertyui', '11111111', '00000000']

const comoTexto = (v: unknown): string => (typeof v === 'string' ? v : '')

// Nombre de usuario: minúsculas, números, punto, guion y guion bajo; 3 a 30 caracteres.
export function validarUsuario(v: unknown): string {
  const usuario = comoTexto(v).trim().toLowerCase()
  if (!RE_USUARIO.test(usuario)) {
    throw new ErrorNegocio(400, 'El nombre de usuario debe tener de 3 a 30 caracteres: letras minúsculas, números, punto, guion o guion bajo.')
  }
  return usuario
}

// Contraseña: 8 a 72 caracteres (72 es el máximo que admite bcrypt), distinta del usuario y no obvia.
export function validarClave(v: unknown, usuario?: string): string {
  const clave = comoTexto(v)
  if (clave.length < 8) throw new ErrorNegocio(400, 'La contraseña debe tener al menos 8 caracteres.')
  if (clave.length > 72) throw new ErrorNegocio(400, 'La contraseña no puede superar los 72 caracteres.')
  if (clave !== clave.trim()) throw new ErrorNegocio(400, 'La contraseña no puede empezar ni terminar con espacios.')
  if (usuario && clave.toLowerCase() === usuario.toLowerCase()) {
    throw new ErrorNegocio(400, 'La contraseña no puede ser igual al nombre de usuario.')
  }
  if (CLAVES_OBVIAS.includes(clave.toLowerCase())) {
    throw new ErrorNegocio(400, 'Esa contraseña es demasiado común. Elegí otra.')
  }
  return clave
}

// Identificador de la organización en la URL (/:slug/ingresar).
export function validarSlug(v: unknown): string {
  const slug = comoTexto(v).trim().toLowerCase()
  if (!RE_SLUG.test(slug)) {
    throw new ErrorNegocio(400, 'El identificador debe tener de 3 a 40 caracteres: minúsculas, números y guiones (sin empezar ni terminar con guion).')
  }
  if (SLUGS_RESERVADOS.includes(slug)) {
    throw new ErrorNegocio(400, 'Ese identificador está reservado. Elegí otro.')
  }
  return slug
}

export function validarEmail(v: unknown): string {
  const email = comoTexto(v).trim().toLowerCase()
  if (email.length > 254 || !RE_EMAIL.test(email)) throw new ErrorNegocio(400, 'El email no es válido.')
  return email
}

// Texto libre obligatorio (nombre de una organización, etc.)
export function validarTexto(v: unknown, campo: string, max = 80): string {
  const texto = comoTexto(v).replace(/\s+/g, ' ').trim()
  if (!texto) throw new ErrorNegocio(400, `Falta ${campo}.`)
  if (texto.length > max) throw new ErrorNegocio(400, `${campo[0].toUpperCase()}${campo.slice(1)} es demasiado largo (máximo ${max} caracteres).`)
  return texto
}

// Texto libre opcional: devuelve null si viene vacío
export function validarTextoOpcional(v: unknown, campo: string, max = 80): string | null {
  if (v === undefined || v === null || comoTexto(v).trim() === '') return null
  return validarTexto(v, campo, max)
}

export function validarUuid(v: unknown, campo: string): string {
  const id = comoTexto(v).trim().toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    throw new ErrorNegocio(400, `El dato "${campo}" no es válido.`)
  }
  return id
}

// Fecha AAAA-MM-DD opcional (vencimiento). Debe ser hoy o futura.
export function validarFechaFutura(v: unknown, hoy = new Date()): string | null {
  if (v === undefined || v === null || comoTexto(v).trim() === '') return null
  const texto = comoTexto(v).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(Date.parse(texto))) {
    throw new ErrorNegocio(400, 'La fecha de vencimiento debe tener el formato AAAA-MM-DD.')
  }
  if (texto < hoy.toISOString().slice(0, 10)) throw new ErrorNegocio(400, 'La fecha de vencimiento no puede estar en el pasado.')
  return texto
}

// Email interno de un usuario (nunca se muestra). Igual que public.email_interno() en SQL.
export const emailInterno = (usuario: string, slug: string) => `${usuario.toLowerCase()}@${slug.toLowerCase()}.ipponia.internal`
