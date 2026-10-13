// Catálogo de permisos tal como los conoce la base (tabla `permisos`) y qué pantalla abre cada uno.
// Sirve para mostrar u ocultar pantallas (experiencia de usuario). La seguridad real la aplica
// la base con RLS: aunque alguien fuerce una pantalla, la base no le devuelve ni guarda nada.
export const PERMISOS = {
  ver_pantalla_publica: 'Ver la pantalla pública',
  operar_mesa_kumite: 'Operar la mesa de Kumite',
  operar_kansa_kumite: 'Operar el tablero Kansa de Kumite',
  puntuar_kata: 'Puntuar Kata',
  puntuar_kobudo: 'Puntuar Kobudo',
  puntuar_destreza: 'Puntuar Destreza',
  cargar_competidores: 'Administrar competidores',
  gestionar_jueces: 'Administrar jueces',
  ver_historial: 'Ver el historial de resultados',
  crear_torneos: 'Crear y editar torneos',
  gestionar_usuarios: 'Administrar usuarios',
  gestionar_roles: 'Administrar roles y asignaciones',
}

// Pantallas de trabajo: alcanza con tener alguno de los permisos de la lista
export const PERMISOS_MODULO = {
  kata: ['puntuar_kata'],
  kumite: ['operar_mesa_kumite', 'operar_kansa_kumite'],
  kumiteMesa: ['operar_mesa_kumite'],
  kumiteKansa: ['operar_kansa_kumite'],
  kobudo: ['puntuar_kobudo'],
  destreza: ['puntuar_destreza'],
}

// Secciones de Configuración: ruta, texto y permiso que pide cada una ('superadmin' = dueño de la plataforma)
export const SECCIONES_CONFIG = [
  { a: '/configuracion/usuarios', texto: 'Usuarios', permiso: 'gestionar_usuarios' },
  { a: '/configuracion/roles', texto: 'Roles', permiso: 'gestionar_roles' },
  { a: '/configuracion/torneos', texto: 'Torneos', permiso: 'crear_torneos' },
  { a: '/configuracion/jueces', texto: 'Jueces', permiso: 'gestionar_jueces' },
  { a: '/configuracion/competidores', texto: 'Competidores', permiso: 'cargar_competidores' },
  { a: '/configuracion/historial', texto: 'Historial', permiso: 'ver_historial' },
  { a: '/configuracion/organizaciones', texto: 'Organizaciones', permiso: 'superadmin' },
]
