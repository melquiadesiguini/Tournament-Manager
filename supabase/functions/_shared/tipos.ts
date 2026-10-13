// Tipos compartidos por las Edge Functions de IPPONIA.

// Error "esperable" (entrada inválida, falta de permiso, duplicado…): se devuelve al usuario
// con su mensaje. Cualquier otro error se registra en el servidor y el usuario ve un mensaje genérico.
export class ErrorNegocio extends Error {
  status: number
  constructor(status: number, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorNegocio'
    this.status = status
  }
}

export interface Perfil {
  usuario_id: string
  organizacion_id: string
  nombre_usuario: string | null
  es_dueno: boolean
  activo: boolean
}

export interface Organizacion {
  id: string
  slug: string
  nombre: string
  estado: string
  vence_el: string | null
}

export interface EntradaAuditoria {
  organizacion_id: string | null
  actor_id: string
  accion: string
  detalle?: Record<string, unknown>
}

// Todo lo que las acciones necesitan del mundo exterior. La implementación real (servicio.ts)
// usa Supabase; las pruebas usan una versión en memoria.
// Ojo: las operaciones "de servicio" usan la service role, que se salta RLS. Por eso cada acción
// debe comprobar permisos y organización ANTES de llamarlas.
export interface Servicio {
  // Identidad del que llama (ya verificada por Supabase Auth)
  usuarioLlamador: string
  // Permisos del que llama, evaluados por la base con SU propio JWT (misma regla que RLS)
  tienePermiso(permiso: string): Promise<boolean>
  esSuperadmin(): Promise<boolean>

  perfil(usuarioId: string): Promise<Perfil | null>
  organizacion(id: string): Promise<Organizacion | null>

  crearUsuarioAuth(email: string, clave: string): Promise<string>
  invitarUsuarioAuth(email: string, redirectTo: string): Promise<string>
  cambiarClaveAuth(usuarioId: string, clave: string): Promise<void>
  bloquearAuth(usuarioId: string, bloqueado: boolean): Promise<void>
  borrarUsuarioAuth(usuarioId: string): Promise<void>
  cerrarSesiones(usuarioId: string): Promise<void>

  crearPerfil(datos: {
    usuario_id: string
    organizacion_id: string
    nombre_usuario: string
    nombre_visible: string | null
    debe_cambiar_clave: boolean
    creado_por: string
  }): Promise<void>
  actualizarPerfil(usuarioId: string, cambios: Partial<{ activo: boolean; debe_cambiar_clave: boolean }>): Promise<void>

  crearOrganizacion(datos: { slug: string; nombre: string; vence_el: string | null }): Promise<string>
  registrarDueno(organizacionId: string, usuarioId: string): Promise<void>
  borrarOrganizacion(organizacionId: string): Promise<void>

  auditar(entrada: EntradaAuditoria): Promise<void>
  contarAcciones(actorId: string, accion: string, minutos: number): Promise<number>
}
