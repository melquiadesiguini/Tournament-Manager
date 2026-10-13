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
  if (msg.includes('database error saving new user') || msg.includes('registro está cerrado')) {
    return 'El registro está cerrado: solo pueden crear cuenta quienes recibieron una invitación. Solicitá acceso.'
  }
  if (msg.includes('failed to fetch')) return 'No se pudo conectar. Revisá tu conexión a internet.'
  return error?.message || 'Ocurrió un error inesperado.'
}

// Roles de organización. Los nombres viejos (owner, kansa, viewer) se tratan como los nuevos
// por si la base todavía no tiene aplicada la migración supabase/roles.sql.
const ROL_EQUIVALENTE = { owner: 'administrador', kansa: 'mesa', viewer: 'supervisor' }

async function cargarPerfil(userId) {
  const [{ data: orgId }, { data: superadmin }] = await Promise.all([
    supabase.rpc('mi_org_id'),
    supabase.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle(),
  ])
  let rol = null
  let organizacion = null
  if (orgId) {
    const { data: o } = await supabase.from('organizations').select('name, plan, estado, vence_el').eq('id', orgId).maybeSingle()
    if (o) organizacion = { nombre: o.name, plan: o.plan, estado: o.estado, vence_el: o.vence_el }
    const { data: miembro } = await supabase
      .from('members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle()
    rol = miembro ? (ROL_EQUIVALENTE[miembro.role] ?? miembro.role) : null
  }
  return { rol, esSuperAdmin: Boolean(superadmin), organizacion }
}

// Mantiene la sesión del usuario (Supabase Auth) disponible para toda la app
function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [cargando, setCargando] = useState(supabaseConfigurado)
  const [perfil, setPerfil] = useState({ rol: null, esSuperAdmin: false, organizacion: null, userId: null })

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

  const userId = session?.user?.id ?? null
  useEffect(() => {
    if (!supabase || !userId) return undefined
    let activo = true
    cargarPerfil(userId).then((p) => activo && setPerfil({ ...p, userId }))
    return () => {
      activo = false
    }
  }, [userId])

  const value = useMemo(() => {
    // El perfil solo vale si corresponde al usuario actual (evita mostrar el de una sesión anterior)
    const vigente = userId && perfil.userId === userId
    const rol = vigente ? perfil.rol : null
    const esSuperAdmin = vigente ? perfil.esSuperAdmin : false
    const organizacion = vigente ? perfil.organizacion : null
    const esAdmin = esSuperAdmin || rol === 'administrador'
    return {
      configurado: supabaseConfigurado,
      cargando,
      user: session?.user ?? null,
      rol,
      organizacion,
      esSuperAdmin,
      esAdmin,
      perfilCargado: Boolean(vigente),
      puedeVerHistorial: esSuperAdmin || ['administrador', 'supervisor', 'mesa'].includes(rol),

      async iniciarSesion(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error ? { ok: false, mensaje: traducirError(error) } : { ok: true }
      },

      // Si el proyecto exige confirmar el email, no hay sesión hasta confirmarlo
      async registrarse(email, password) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) return { ok: false, mensaje: traducirError(error) }
        return { ok: true, requiereConfirmacion: !data.session }
      },

      async cerrarSesion() {
        await supabase.auth.signOut()
      },
    }
  }, [session, cargando, perfil, userId])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
