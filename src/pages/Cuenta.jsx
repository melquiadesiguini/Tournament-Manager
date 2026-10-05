import { useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import useAuth from '../hooks/useAuth'
import './Cuenta.css'

// Ingresar, crear cuenta y ver los datos de la cuenta
function Cuenta() {
  const { configurado, cargando, user, iniciarSesion, registrarse, cerrarSesion } = useAuth()

  const [modo, setModo] = useState('ingresar') // 'ingresar' | 'registrar'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizacion, setOrganizacion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setAviso('')
    setEnviando(true)
    const r =
      modo === 'ingresar'
        ? await iniciarSesion(email.trim(), password)
        : await registrarse(email.trim(), password, organizacion.trim())
    setEnviando(false)

    if (!r.ok) {
      setError(r.mensaje)
      return
    }
    if (r.requiereConfirmacion) {
      setAviso('Te enviamos un email para confirmar la cuenta. Después de confirmarlo, ingresá acá.')
      setModo('ingresar')
    }
    setPassword('')
  }

  let contenido
  if (!configurado) {
    contenido = (
      <p className="cuenta-nota">
        La conexión con la base de datos no está configurada en esta versión, por eso las cuentas no están
        disponibles. Los resultados se guardan solo en este navegador.
      </p>
    )
  } else if (cargando) {
    contenido = <p className="cuenta-nota">Cargando…</p>
  } else if (user) {
    contenido = (
      <>
        <p className="cuenta-dato">
          Sesión iniciada como <strong>{user.email}</strong>
        </p>
        <p className="cuenta-nota">Los resultados que guardes se almacenan en la nube, en tu organización.</p>
        <div className="cuenta-acciones">
          <Link to="/historial" className="cuenta-boton cuenta-boton-primario">
            Ver historial
          </Link>
          <button type="button" className="cuenta-boton" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </>
    )
  } else {
    contenido = (
      <>
        <div className="cuenta-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'ingresar'}
            className={modo === 'ingresar' ? 'activa' : ''}
            onClick={() => {
              setModo('ingresar')
              setError('')
            }}
          >
            Ingresar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'registrar'}
            className={modo === 'registrar' ? 'activa' : ''}
            onClick={() => {
              setModo('registrar')
              setError('')
              setAviso('')
            }}
          >
            Crear cuenta
          </button>
        </div>

        <form className="cuenta-form" onSubmit={enviar}>
          {modo === 'registrar' && (
            <label>
              Nombre de tu organización (dojo, club o federación)
              <input
                type="text"
                value={organizacion}
                onChange={(e) => setOrganizacion(e.target.value)}
                placeholder="Ej.: Ikigai Dojo"
                autoComplete="organization"
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={modo === 'ingresar' ? 'current-password' : 'new-password'}
            />
          </label>

          {error && <div className="cuenta-error">{error}</div>}
          {aviso && <div className="cuenta-aviso">{aviso}</div>}

          <button type="submit" className="cuenta-boton cuenta-boton-primario" disabled={enviando}>
            {enviando ? 'Un momento…' : modo === 'ingresar' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="cuenta-container">
        <section className="cuenta-card">
          <h1>Mi cuenta</h1>
          {contenido}
        </section>
      </main>
      <Footer />
    </>
  )
}

export default Cuenta
