import { createContext } from 'react'

// Estado de la cuenta (sesión de Supabase). Ver AuthProvider.jsx y hooks/useAuth.js
export const AuthContext = createContext({
  configurado: false,
  cargando: false,
  user: null,
  iniciarSesion: async () => ({ ok: false }),
  registrarse: async () => ({ ok: false }),
  cerrarSesion: async () => {},
})
