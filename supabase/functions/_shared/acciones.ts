// Lógica de las Edge Functions. No depende de Supabase ni de Deno: recibe un `Servicio`
// (ver tipos.ts), así se puede probar en memoria. Reglas de oro:
//   1. La organización SIEMPRE sale del perfil del que llama, nunca de un parámetro.
//   2. Los permisos los decide la base (tiene_permiso con el JWT del que llama).
//   3. Recién después de autorizar se usan las operaciones de servicio (service role).
import { ErrorNegocio, type Organizacion, type Perfil, type Servicio } from './tipos.ts'
import {
  emailInterno, validarClave, validarEmail, validarFechaFutura, validarSlug, validarTexto,
  validarTextoOpcional, validarUsuario, validarUuid,
} from './validar.ts'

// Máximo de acciones de cada tipo por persona en una ventana de tiempo (frena abusos y errores de script)
const LIMITE = { max: 30, minutos: 10 }

type Cuerpo = Record<string, unknown>

async function limitar(srv: Servicio, accion: string) {
  const hechas = await srv.contarAcciones(srv.usuarioLlamador, accion, LIMITE.minutos)
  if (hechas >= LIMITE.max) {
    throw new ErrorNegocio(429, 'Hiciste demasiados cambios seguidos. Esperá unos minutos y volvé a intentar.')
  }
}

// Perfil y organización del que llama; la organización tiene que estar vigente
async function contextoDeOrganizacion(srv: Servicio): Promise<{ perfil: Perfil; org: Organizacion }> {
  const perfil = await srv.perfil(srv.usuarioLlamador)
  if (!perfil || !perfil.activo) throw new ErrorNegocio(403, 'No tenés permiso para esta acción.')
  const org = await srv.organizacion(perfil.organizacion_id)
  if (!org) throw new ErrorNegocio(403, 'No tenés permiso para esta acción.')
  const vencida = org.vence_el !== null && org.vence_el < new Date().toISOString().slice(0, 10)
  if (!['prueba', 'activa'].includes(org.estado) || vencida) {
    throw new ErrorNegocio(403, 'El plan de tu organización está suspendido o vencido.')
  }
  return { perfil, org }
}

// El que llama tiene que poder gestionar usuarios, y el usuario objetivo ser de SU organización
async function autorizarSobreUsuario(srv: Servicio, usuarioId: string) {
  const ctx = await contextoDeOrganizacion(srv)
  if (!(await srv.tienePermiso('gestionar_usuarios'))) throw new ErrorNegocio(403, 'No tenés permiso para gestionar usuarios.')
  const objetivo = await srv.perfil(usuarioId)
  // mismo mensaje si no existe o es de otra organización: no se revela qué usuarios existen
  if (!objetivo || objetivo.organizacion_id !== ctx.perfil.organizacion_id) throw new ErrorNegocio(404, 'No se encontró el usuario.')
  return { ...ctx, objetivo }
}

// ---------------------------------------------------------------- crear-usuario
// Crea un usuario interno (nombre de usuario + contraseña, sin email real). Cuenta ya confirmada.
export async function crearUsuario(srv: Servicio, cuerpo: Cuerpo) {
  const { perfil, org } = await contextoDeOrganizacion(srv)
  if (!(await srv.tienePermiso('gestionar_usuarios'))) throw new ErrorNegocio(403, 'No tenés permiso para gestionar usuarios.')

  const usuario = validarUsuario(cuerpo.nombre_usuario)
  const clave = validarClave(cuerpo.clave, usuario)
  const nombreVisible = validarTextoOpcional(cuerpo.nombre_visible, 'el nombre', 60)
  await limitar(srv, 'crear_usuario')

  const email = emailInterno(usuario, org.slug)
  const id = await srv.crearUsuarioAuth(email, clave) // 409 si ya existe
  try {
    await srv.crearPerfil({
      usuario_id: id,
      organizacion_id: perfil.organizacion_id,
      nombre_usuario: usuario,
      nombre_visible: nombreVisible,
      debe_cambiar_clave: true, // la contraseña inicial la conoce el admin: se cambia en el primer ingreso
      creado_por: srv.usuarioLlamador,
    })
  } catch (error) {
    await srv.borrarUsuarioAuth(id) // deshacer: no puede quedar una cuenta sin perfil
    throw error
  }
  await srv.auditar({
    organizacion_id: perfil.organizacion_id,
    actor_id: srv.usuarioLlamador,
    accion: 'crear_usuario',
    detalle: { usuario_id: id, nombre_usuario: usuario },
  })
  return { usuario: { id, nombre_usuario: usuario, nombre_visible: nombreVisible } }
}

// ---------------------------------------------------------------- resetear-clave
// Un admin pone una contraseña nueva a un usuario interno; se le cierran las sesiones y debe cambiarla.
export async function resetearClave(srv: Servicio, cuerpo: Cuerpo) {
  const usuarioId = validarUuid(cuerpo.usuario_id, 'usuario_id')
  const { perfil, objetivo } = await autorizarSobreUsuario(srv, usuarioId)
  if (objetivo.usuario_id === perfil.usuario_id) throw new ErrorNegocio(400, 'Para cambiar tu propia contraseña usá la opción de tu cuenta.')
  if (objetivo.es_dueno) throw new ErrorNegocio(403, 'El dueño de la organización cambia su contraseña desde su cuenta (recuperación por email).')
  if (!objetivo.nombre_usuario) throw new ErrorNegocio(400, 'Este usuario no es un usuario interno.')

  const clave = validarClave(cuerpo.clave, objetivo.nombre_usuario)
  await limitar(srv, 'resetear_clave')
  await srv.cambiarClaveAuth(objetivo.usuario_id, clave)
  await srv.actualizarPerfil(objetivo.usuario_id, { debe_cambiar_clave: true })
  await srv.cerrarSesiones(objetivo.usuario_id)
  await srv.auditar({
    organizacion_id: perfil.organizacion_id,
    actor_id: srv.usuarioLlamador,
    accion: 'resetear_clave',
    detalle: { usuario_id: objetivo.usuario_id },
  })
  return {}
}

// ---------------------------------------------------------------- desactivar-usuario
// Desactiva (o reactiva) un usuario. No se borra: se conserva su historial.
export async function desactivarUsuario(srv: Servicio, cuerpo: Cuerpo) {
  const usuarioId = validarUuid(cuerpo.usuario_id, 'usuario_id')
  if (typeof cuerpo.activo !== 'boolean') throw new ErrorNegocio(400, 'Falta indicar si el usuario queda activo o no.')
  const activo = cuerpo.activo

  const { perfil, objetivo } = await autorizarSobreUsuario(srv, usuarioId)
  if (objetivo.usuario_id === perfil.usuario_id) throw new ErrorNegocio(400, 'No podés desactivar tu propio usuario.')
  if (objetivo.es_dueno) throw new ErrorNegocio(403, 'El dueño de la organización no se puede desactivar.')

  await limitar(srv, activo ? 'reactivar_usuario' : 'desactivar_usuario')
  await srv.actualizarPerfil(objetivo.usuario_id, { activo })
  await srv.bloquearAuth(objetivo.usuario_id, !activo)
  if (!activo) await srv.cerrarSesiones(objetivo.usuario_id)
  await srv.auditar({
    organizacion_id: perfil.organizacion_id,
    actor_id: srv.usuarioLlamador,
    accion: activo ? 'reactivar_usuario' : 'desactivar_usuario',
    detalle: { usuario_id: objetivo.usuario_id },
  })
  return {}
}

// ---------------------------------------------------------------- crear-organizacion
// Alta de un cliente (solo el superadmin): organización con sus roles de fábrica y su dueño.
//   Con `clave`: el dueño se crea con esa contraseña (debe cambiarla al entrar).
//   Sin `clave`: se le envía una invitación por email para que elija la suya.
export async function crearOrganizacion(srv: Servicio, cuerpo: Cuerpo, sitioUrl: string) {
  if (!(await srv.esSuperadmin())) throw new ErrorNegocio(403, 'No tenés permiso para esta acción.')

  const slug = validarSlug(cuerpo.slug)
  const nombre = validarTexto(cuerpo.nombre, 'el nombre de la organización', 80)
  const email = validarEmail(cuerpo.email_dueno)
  const clave = cuerpo.clave === undefined || cuerpo.clave === '' ? null : validarClave(cuerpo.clave)
  const venceEl = validarFechaFutura(cuerpo.vence_el)
  await limitar(srv, 'crear_organizacion')

  const organizacionId = await srv.crearOrganizacion({ slug, nombre, vence_el: venceEl }) // 409 si el slug existe
  let duenoId: string | null = null
  try {
    duenoId = clave ? await srv.crearUsuarioAuth(email, clave) : await srv.invitarUsuarioAuth(email, `${sitioUrl}/restablecer`)
    await srv.registrarDueno(organizacionId, duenoId)
    if (clave) await srv.actualizarPerfil(duenoId, { debe_cambiar_clave: true })
  } catch (error) {
    // deshacer todo: ni la organización ni la cuenta pueden quedar a medias
    if (duenoId) await srv.borrarUsuarioAuth(duenoId).catch(() => {})
    await srv.borrarOrganizacion(organizacionId).catch(() => {})
    throw error
  }
  await srv.auditar({
    organizacion_id: organizacionId,
    actor_id: srv.usuarioLlamador,
    accion: 'crear_organizacion',
    detalle: { slug, email_dueno: email, modo: clave ? 'clave_inicial' : 'invitacion' },
  })
  return { organizacion: { id: organizacionId, slug, nombre }, modo: clave ? 'clave_inicial' : 'invitacion' }
}
