import { useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import useAuth from '../hooks/useAuth'
import './Cuenta.css'

// Ingresar, crear cuenta y ver los datos de la cuenta
function Cuenta() {
  const { configurado, cargando, user, iniciarSesion, registrarse, iniciarConGoogle, cerrarSesion } =
    useAuth()

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

  const conGoogle = async () => {
    setError('')
    setAviso('')
    const r = await iniciarConGoogle()
    if (!r.ok) setError(r.mensaje) // si sale bien, el navegador se va a Google
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

        <button type="button" className="cuenta-boton cuenta-google" onClick={conGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
          Continuar con Google
        </button>

        <div className="cuenta-separador">
          <span>o con tu email</span>
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
    <div className="pagina-columna">
      <Header />
      <main className="cuenta-container">
        <section className="cuenta-card">
          <h1>Mi cuenta</h1>
          {contenido}
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default Cuenta
