import { useEffect, useMemo, useState } from 'react'
import { supabase, supabaseConfigurado } from '../lib/supabase'
import { AuthContext } from './auth-context'

// Mensajes de Supabase traducidos para mostrar al usuario
function traducirError(error) {
  const msg = (error?.message || '').toLowerCase()
  if (msg.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (msg.includes('email not confirmed')) return 'Falta confirmar tu email: revisá tu bandeja de entrada.'
  if (msg.includes('already registered')) return 'Ya existe una cuenta con ese email.'
  if (msg.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (msg.includes('rate limit')) return 'Demasiados intentos. Esperá unos minutos y volvé a probar.'
  if (msg.includes('invalid email') || msg.includes('unable to validate email')) return 'El email no es válido.'
  if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) {
    return 'El ingreso con Google todavía no está habilitado en este proyecto.'
  }
  if (msg.includes('failed to fetch')) return 'No se pudo conectar. Revisá tu conexión a internet.'
  return error?.message || 'Ocurrió un error inesperado.'
}

// Mantiene la sesión del usuario (Supabase Auth) disponible para toda la app
function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [cargando, setCargando] = useState(supabaseConfigurado)

  useEffect(() => {
    if (!supabase) return undefined

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCargando(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion)
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = useMemo(
    () => ({
      configurado: supabaseConfigurado,
      cargando,
      user: session?.user ?? null,

      async iniciarSesion(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error ? { ok: false, mensaje: traducirError(error) } : { ok: true }
      },

      // Si el proyecto exige confirmar el email, no hay sesión hasta confirmarlo
      async registrarse(email, password, nombreOrganizacion) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { org_name: nombreOrganizacion || '' } },
        })
        if (error) return { ok: false, mensaje: traducirError(error) }
        return { ok: true, requiereConfirmacion: !data.session }
      },

      // Redirige a Google y vuelve a la página principal de la app con la sesión iniciada.
      // Cada cuenta nueva (también la de Google) recibe su organización automáticamente.
      async iniciarConGoogle() {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
        })
        return error ? { ok: false, mensaje: traducirError(error) } : { ok: true }
      },

      async cerrarSesion() {
        await supabase.auth.signOut()
      },
    }),
    [session, cargando]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
