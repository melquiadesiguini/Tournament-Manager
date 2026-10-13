// Implementación real del Servicio con Supabase. Es una capa fina: la lógica y los permisos
// están en acciones.ts. La service role vive SOLO acá, en el servidor de Supabase (variable de
// entorno que Supabase inyecta en las Edge Functions); nunca viaja al navegador ni está en el repo.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { ErrorNegocio, type EntradaAuditoria, type Organizacion, type Perfil, type Servicio } from './tipos.ts'

const SIN_SESION = { auth: { persistSession: false, autoRefreshToken: false } }

function variable(nombre: string): string {
  const valor = Deno.env.get(nombre)
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`)
  return valor
}

// Claves de la API. Supabase reemplazó SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY (heredadas,
// marcadas DEPRECATED) por SUPABASE_PUBLISHABLE_KEYS y SUPABASE_SECRET_KEYS: un JSON con las claves
// del proyecto, por ejemplo {"default":"sb_secret_..."}. Se usa la nueva y, si no está, la heredada.
function claveApi(nueva: string, heredada: string): string {
  const json = Deno.env.get(nueva)
  if (json) {
    try {
      const claves = JSON.parse(json) as Record<string, string>
      const clave = claves.default ?? Object.values(claves)[0]
      if (typeof clave === 'string' && clave) return clave
    } catch {
      // formato inesperado: se prueba con la variable heredada
    }
  }
  return variable(heredada)
}

// Errores de la base que el usuario puede entender (el resto se registra como error inesperado)
function traducir(error: { code?: string; message?: string }, duplicado: string): never {
  if (error.code === '23505') throw new ErrorNegocio(409, duplicado)
  if (error.code === '23514' || error.code === '22P02') throw new ErrorNegocio(400, 'Alguno de los datos no es válido.')
  throw new Error(error.message ?? 'Error de base de datos')
}

export async function crearServicio(req: Request): Promise<Servicio> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new ErrorNegocio(401, 'Iniciá sesión para continuar.')

  const url = variable('SUPABASE_URL')
  // Cliente "como el usuario": evalúa los permisos con su propio JWT (igual que RLS)
  const comoUsuario = createClient(url, claveApi('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
    ...SIN_SESION,
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await comoUsuario.auth.getUser(token)
  if (error || !data.user) {
    // el motivo queda en los logs de Supabase (nunca se incluye el token)
    console.error('No se pudo verificar la sesión:', error?.message ?? 'sin usuario')
    throw new ErrorNegocio(401, 'La sesión venció. Volvé a iniciar sesión.')
  }

  // Cliente de servicio: se salta RLS. Solo se usa después de autorizar.
  const admin = createClient(url, claveApi('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), SIN_SESION)

  return {
    usuarioLlamador: data.user.id,

    async tienePermiso(permiso) {
      const { data: r, error: e } = await comoUsuario.rpc('tiene_permiso', { p_torneo: null, p_area: null, p_permiso: permiso })
      if (e) throw new Error(e.message)
      return r === true
    },
    async esSuperadmin() {
      const { data: r, error: e } = await comoUsuario.rpc('es_superadmin')
      if (e) throw new Error(e.message)
      return r === true
    },

    async perfil(usuarioId) {
      const { data: p, error: e } = await admin
        .from('perfiles')
        .select('usuario_id, organizacion_id, nombre_usuario, es_dueno, activo')
        .eq('usuario_id', usuarioId)
        .maybeSingle()
      if (e) throw new Error(e.message)
      return (p as Perfil | null) ?? null
    },
    async organizacion(id) {
      const { data: o, error: e } = await admin
        .from('organizaciones')
        .select('id, slug, nombre, estado, vence_el')
        .eq('id', id)
        .maybeSingle()
      if (e) throw new Error(e.message)
      return (o as Organizacion | null) ?? null
    },

    async crearUsuarioAuth(email, clave) {
      const { data: r, error: e } = await admin.auth.admin.createUser({ email, password: clave, email_confirm: true })
      if (e || !r.user) {
        if (e?.status === 422 || /already|registered|exists/i.test(e?.message ?? '')) {
          throw new ErrorNegocio(409, 'Ya existe una cuenta con ese nombre de usuario o email.')
        }
        throw new Error(e?.message ?? 'No se pudo crear la cuenta')
      }
      return r.user.id
    },
    async invitarUsuarioAuth(email, redirectTo) {
      const { data: r, error: e } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
      if (e || !r.user) {
        if (e?.status === 422 || /already|registered|exists/i.test(e?.message ?? '')) {
          throw new ErrorNegocio(409, 'Ya existe una cuenta con ese email.')
        }
        throw new Error(e?.message ?? 'No se pudo enviar la invitación')
      }
      return r.user.id
    },
    async cambiarClaveAuth(usuarioId, clave) {
      const { error: e } = await admin.auth.admin.updateUserById(usuarioId, { password: clave })
      if (e) throw new Error(e.message)
    },
    async bloquearAuth(usuarioId, bloqueado) {
      const { error: e } = await admin.auth.admin.updateUserById(usuarioId, { ban_duration: bloqueado ? '876000h' : 'none' })
      if (e) throw new Error(e.message)
    },
    async borrarUsuarioAuth(usuarioId) {
      const { error: e } = await admin.auth.admin.deleteUser(usuarioId)
      if (e) throw new Error(e.message)
    },
    async cerrarSesiones(usuarioId) {
      const { error: e } = await admin.rpc('cerrar_sesiones_usuario', { p_usuario: usuarioId })
      if (e) throw new Error(e.message)
    },

    async crearPerfil(datos) {
      const { error: e } = await admin.from('perfiles').insert(datos)
      if (e) traducir(e, 'Ya existe un usuario con ese nombre en tu organización.')
    },
    async actualizarPerfil(usuarioId, cambios) {
      const { error: e } = await admin.from('perfiles').update(cambios).eq('usuario_id', usuarioId)
      if (e) throw new Error(e.message)
    },

    async crearOrganizacion({ slug, nombre, vence_el }) {
      const { data: id, error: e } = await admin.rpc('crear_organizacion_interna', {
        p_slug: slug,
        p_nombre: nombre,
        p_plan: 'estandar',
        p_vence_el: vence_el,
      })
      if (e) traducir(e, 'Ya existe una organización con ese identificador.')
      return id as string
    },
    async registrarDueno(organizacionId, usuarioId) {
      const { error: e } = await admin.rpc('registrar_dueno', { p_organizacion: organizacionId, p_usuario: usuarioId })
      if (e) throw new Error(e.message)
    },
    async borrarOrganizacion(organizacionId) {
      const { error: e } = await admin.from('organizaciones').delete().eq('id', organizacionId)
      if (e) throw new Error(e.message)
    },

    async auditar(entrada: EntradaAuditoria) {
      const { error: e } = await admin.from('auditoria').insert({ ...entrada, detalle: entrada.detalle ?? {} })
      // la auditoría no debe tirar abajo una operación ya hecha, pero queda registrado el fallo
      if (e) console.error('No se pudo registrar la auditoría:', e.message)
    },
    async contarAcciones(actorId, accion, minutos) {
      const desde = new Date(Date.now() - minutos * 60_000).toISOString()
      const { count, error: e } = await admin
        .from('auditoria')
        .select('id', { count: 'exact', head: true })
        .eq('actor_id', actorId)
        .eq('accion', accion)
        .gte('cuando', desde)
      if (e) throw new Error(e.message)
      return count ?? 0
    },
  }
}
