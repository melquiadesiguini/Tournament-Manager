import { useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import useAuth from '../hooks/useAuth'
import LoginFondo from '../components/LoginFondo'
import useTheme from '../hooks/useTheme'
import { ETIQUETA_ROL } from '../lib/roles'
import { URL_SOLICITUD } from '../lib/contacto'
import logoClaro from '../assets/images/ipponia-logo.png' // cinturón negro (tema claro)
import logoOscuro from '../assets/images/ipponia-logo-oscuro.png' // cinturón blanco (tema oscuro)
import './Cuenta.css'
import './Login.css'

// Ingresar, crear cuenta y ver los datos de la cuenta
function Cuenta({ registro = false }) {
  const {
    configurado,
    cargando,
    user,
    rol,
    esSuperAdmin,
    esAdmin,
    puedeVerHistorial,
    perfilCargado,
    organizacion: org,
    iniciarSesion,
    registrarse,
    cerrarSesion,
  } = useAuth()
  const { theme, toggleTheme } = useTheme()

  // 'ingresar' en la pantalla de ingreso; 'registrar' solo en /registro (para quienes recibieron invitación)
  const [modo, setModo] = useState(registro ? 'registrar' : 'ingresar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
        : await registrarse(email.trim(), password)
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
        <p className="cuenta-dato">
          Rol: <strong>{esSuperAdmin ? 'Superadministrador' : (ETIQUETA_ROL[rol] ?? '—')}</strong>
        </p>
        {org && (
          <p className="cuenta-dato">
            Organización: <strong>{org.nombre}</strong> · Plan: <strong>{org.plan}</strong>
            {org.vence_el ? ` · vence el ${new Date(`${org.vence_el}T00:00:00`).toLocaleDateString('es-AR')}` : ''}
          </p>
        )}
        {perfilCargado && !rol && !esSuperAdmin && (
          <div className="cuenta-error">
            Tu usuario no tiene acceso: puede estar bloqueado, o el plan de tu organización está vencido o
            suspendido. Consultá con el administrador o con el proveedor del servicio.
          </div>
        )}
        <p className="cuenta-nota">Los resultados que guardes se almacenan en la nube, en tu organización.</p>
        <div className="cuenta-acciones">
          {(esAdmin || puedeVerHistorial) && (
            <Link to="/configuracion" className="cuenta-boton cuenta-boton-primario">
              Configuración
            </Link>
          )}
          <button type="button" className="cuenta-boton" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </>
    )
  } else {
    contenido = (
      <>
        {modo === 'registrar' && <h2 className="login-subtitulo">Crear mi cuenta</h2>}

        <form className="cuenta-form" onSubmit={enviar}>
          {modo === 'registrar' && (
            <p className="cuenta-nota">
              Registrate con el mismo email al que te invitaron. Si no recibiste una invitación, solicitá acceso.
            </p>
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
            {enviando ? 'Un momento…' : modo === 'ingresar' ? 'Ingresar' : 'Crear mi cuenta'}
          </button>
        </form>
      </>
    )
  }

  // Sin sesión: pantalla de ingreso completa, con el fondo de la marca
  if (configurado && !cargando && !user) {
    return (
      <div className="login-pantalla">
        <LoginFondo />
        <button
          type="button"
          className="login-tema"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <section className="login-card">
          <div className="login-logo">
            <img src={theme === 'dark' ? logoOscuro : logoClaro} alt="" />
            <div className="login-logo-texto">
              <span className="login-logo-nombre">IPPONIA</span>
              <span className="login-logo-lema">TORNEOS EN VIVO</span>
            </div>
          </div>
          {contenido}
          <div className="login-pie">
            {registro ? (
              <Link to="/cuenta">¿Ya tenés cuenta? Ingresar</Link>
            ) : (
              <>
                <span>¿Todavía no sos cliente?</span>
                <a href={URL_SOLICITUD}>Solicitar acceso</a>
              </>
            )}
          </div>
        </section>
      </div>
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
