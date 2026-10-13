// Roles de una organización (ver supabase/roles.sql)
export const ROLES = ['administrador', 'supervisor', 'mesa', 'juez']

export const ETIQUETA_ROL = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  mesa: 'Mesa',
  juez: 'Juez',
}

export const DESCRIPCION_ROL = {
  administrador: 'Control total de la organización: equipo, listas, resultados e historial.',
  supervisor: 'Solo ve el historial de resultados.',
  mesa: 'Carga resultados y ve el historial.',
  juez: 'Cargará su propio puntaje desde su dispositivo (en desarrollo).',
}
