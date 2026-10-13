import { createContext } from 'react'

// Estado de la cuenta (sesión de Supabase). Ver AuthProvider.jsx y hooks/useAuth.js
export const AuthContext = createContext({
  configurado: false,
  cargando: false,
  user: null,
  rol: null, // administrador | supervisor | juez | mesa
  esSuperAdmin: false,
  esAdmin: false, // administrador de su organización o superadministrador
  perfilCargado: false,
  puedeVerHistorial: false,
  iniciarSesion: async () => ({ ok: false }),
  registrarse: async () => ({ ok: false }),
  iniciarConGoogle: async () => ({ ok: false }),
  cerrarSesion: async () => {},
})
