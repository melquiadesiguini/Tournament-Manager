// Ayudas para la pantalla de ingreso por organización: /:slugOrg/ingresar

const CLAVE_ULTIMA_ORG = 'ipponia-ultima-org'

// Dominio de los emails internos: nunca se muestran, solo permiten usar Supabase Auth con "usuario + contraseña"
export const DOMINIO_INTERNO = 'ipponia.internal'

export const emailInterno = (usuario, slug) => `${usuario.trim().toLowerCase()}@${slug.trim().toLowerCase()}.${DOMINIO_INTERNO}`

export function recordarOrganizacion(slug) {
  try {
    if (slug) localStorage.setItem(CLAVE_ULTIMA_ORG, slug)
  } catch {
    // sin almacenamiento disponible: simplemente no se recuerda
  }
}

export function ultimaOrganizacion() {
  try {
    return localStorage.getItem(CLAVE_ULTIMA_ORG)
  } catch {
    return null
  }
}

// A dónde mandar a quien no tiene sesión: a la pantalla de su organización si la recordamos
export const rutaIngreso = () => {
  const slug = ultimaOrganizacion()
  return slug ? `/${slug}/ingresar` : '/ingresar'
}
