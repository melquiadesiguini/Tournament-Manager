import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import PantallaIngreso from '../components/PantallaIngreso'
import CampoClave from '../components/CampoClave/CampoClave'
import { supabase } from '../lib/supabase'
import { URL_SOLICITUD } from '../lib/contacto'

// Ingreso. Dos formas:
//   /:slugOrg/ingresar  usuarios de una organización (usuario + contraseña; la organización sale de la dirección)
//   /ingresar           dueños de organización y superadmin (email + contraseña)
function Ingresar() {
  const { slugOrg } = useParams()
  const slug = slugOrg?.toLowerCase() ?? null
  const { configurado, cargando, user, iniciarSesionUsuario, iniciarSesionEmail } = useAuth()
  const navegar = useNavigate()
  const { state } = useLocation()
  const destino = state?.from?.pathname && state.from.pathname !== '/ingresar' ? state.from : '/'

  const [org, setOrg] = useState(null) // { nombre, activa } | 'no-existe' | null (cargando)
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  // Nombre público de la organización (única consulta permitida sin sesión)
  useEffect(() => {
    if (!slug || !supabase) return undefined
    let activo = true
    supabase.rpc('org_publica', { p_slug: slug }).then(({ data, error: e }) => {
      if (!activo) return
      if (e) setOrg('error')
      else setOrg(data?.[0] ?? 'no-existe')
    })
    return () => {
      activo = false
    }
  }, [slug])

  if (!configurado) return <Navigate to="/" replace />
  if (!cargando && user) return <Navigate to={destino} replace />

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const r = slug
      ? await iniciarSesionUsuario(slug, usuario, password)
      : await iniciarSesionEmail(usuario, password)
    setEnviando(false)
    if (!r.ok) return setError(r.mensaje)
    setPassword('')
    navegar(destino, { replace: true })
  }

  const orgInvalida = slug && (org === 'no-existe' || org === 'error')
  const titulo = slug && org && !orgInvalida ? org.nombre : null

  return (
    <PantallaIngreso
      titulo={titulo}
      subtitulo={
        orgInvalida
          ? org === 'error'
            ? 'No se pudo comprobar la organización. Revisá tu conexión e intentá de nuevo.'
            : 'No encontramos esa organización. Revisá la dirección que te dio tu administrador.'
          : null
      }
      pie={
        slug ? (
          <>
            <span>¿Sos el dueño de la organización?</span>
            <Link to="/ingresar">Ingresar con email</Link>
          </>
        ) : (
          <>
            <span>¿Todavía no sos cliente?</span>
            <a href={URL_SOLICITUD} target="_blank" rel="noopener noreferrer">
              Solicitar acceso
            </a>
          </>
        )
      }
    >
      {!orgInvalida && (
        <form className="cuenta-form" onSubmit={enviar}>
          {slug && org && org !== 'no-existe' && org.activa === false && (
            <div className="cuenta-error">El plan de esta organización está suspendido o vencido.</div>
          )}
          <label>
            {slug ? 'Usuario' : 'Email'}
            <input
              type={slug ? 'text' : 'email'}
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete={slug ? 'username' : 'email'}
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
            />
          </label>
          <CampoClave
            etiqueta="Contraseña"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {error && <div className="cuenta-error">{error}</div>}

          <button type="submit" className="cuenta-boton cuenta-boton-primario" disabled={enviando}>
            {enviando ? 'Un momento…' : 'Ingresar'}
          </button>

          {!slug && (
            <Link to="/restablecer" className="login-olvide">
              Olvidé mi contraseña
            </Link>
          )}
          {slug && (
            <p className="cuenta-nota">Si olvidaste tu contraseña, pedile al administrador de tu organización que la restablezca.</p>
          )}
        </form>
      )}
    </PantallaIngreso>
  )
}

export default Ingresar
