import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import PantallaIngreso from '../components/PantallaIngreso'
import FormNuevaClave from '../components/FormNuevaClave'

// Recuperar la contraseña (solo cuentas con email real: dueños de organización y superadmin).
//   Sin sesión: se pide el email y se envía un enlace.
//   Con sesión (se llega desde el enlace del email, que inicia sesión): se elige la contraseña nueva.
// Los usuarios internos no tienen email: su administrador les restablece la contraseña.
function Restablecer() {
  const { configurado, cargando, user, pedirRecuperacion } = useAuth()
  const navegar = useNavigate()
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(false)

  if (!configurado) return null
  if (cargando) return <PantallaIngreso subtitulo="Cargando…" />

  if (user) {
    return (
      <PantallaIngreso titulo="Elegí tu contraseña" subtitulo="Escribí la contraseña nueva para tu cuenta.">
        <FormNuevaClave alTerminar={() => navegar('/', { replace: true })} />
      </PantallaIngreso>
    )
  }

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const r = await pedirRecuperacion(email)
    setEnviando(false)
    if (!r.ok) return setError(r.mensaje)
    setEnviado(true)
  }

  return (
    <PantallaIngreso
      titulo="Recuperar contraseña"
      pie={<Link to="/ingresar">Volver a ingresar</Link>}
      subtitulo={
        enviado
          ? 'Si el email corresponde a una cuenta, te enviamos un enlace para elegir una contraseña nueva. Revisá también la carpeta de spam.'
          : 'Escribí el email de tu cuenta y te enviamos un enlace. Si ingresás con un nombre de usuario, pedile a tu administrador que restablezca tu contraseña.'
      }
    >
      {!enviado && (
        <form className="cuenta-form" onSubmit={enviar}>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
          </label>
          {error && <div className="cuenta-error">{error}</div>}
          <button type="submit" className="cuenta-boton cuenta-boton-primario" disabled={enviando}>
            {enviando ? 'Un momento…' : 'Enviar enlace'}
          </button>
        </form>
      )}
    </PantallaIngreso>
  )
}

export default Restablecer
