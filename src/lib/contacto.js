// Contacto comercial de IPPONIA: a dónde llegan las solicitudes de acceso.
// Para cambiarlo (por ejemplo a WhatsApp) alcanza con modificar este archivo.
export const CONTACTO_EMAIL = 'melquiades.iguini@gmail.com'

const ASUNTO = 'Solicitud de acceso a IPPONIA'
const CUERPO = [
  'Hola, quiero usar IPPONIA.',
  '',
  'Nombre de la organización (dojo, club, federación):',
  'Nombre y apellido de contacto:',
  'Teléfono:',
  'Módulos que necesitan (Kata, Kumite, Kobudo, Destreza):',
  'Fecha estimada del primer torneo:',
].join('\n')

export const URL_SOLICITUD = `mailto:${CONTACTO_EMAIL}?subject=${encodeURIComponent(ASUNTO)}&body=${encodeURIComponent(CUERPO)}`

// Enlace para que una persona invitada cree su cuenta (no aparece en la pantalla de ingreso)
export const urlRegistro = () => `${window.location.origin}${import.meta.env.BASE_URL}registro`
