import { createContext } from 'react'

// Estado de la cuenta (sesión de Supabase + perfil + permisos). Ver AuthProvider.jsx y hooks/useAuth.js
export const AuthContext = createContext({
  configurado: false,
  cargando: false,
  user: null,
  perfil: null, // { nombre_usuario, nombre_visible, es_dueno, activo, debe_cambiar_clave }
  organizacion: null, // { id, slug, nombre, plan, estado, vence_el }
  organizacionVigente: false, // la organización está en prueba o activa y no venció
  esSuperAdmin: false,
  permisos: [], // [{ torneo_id, area, permiso }]
  perfilCargado: false,
  errorCarga: false,
  puede: () => false, // puede('puntuar_kata'): tiene el permiso en algún torneo o área
  puedeAlguno: () => false,
  puedeVerHistorial: false,
  esAdmin: false, // puede gestionar usuarios
  recargar: async () => {},
  iniciarSesionUsuario: async () => ({ ok: false }),
  iniciarSesionEmail: async () => ({ ok: false }),
  pedirRecuperacion: async () => ({ ok: false }),
  cambiarClave: async () => ({ ok: false }),
  cerrarSesion: async () => {},
})
