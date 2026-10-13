import { Link, NavLink } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import useAuth from '../hooks/useAuth'
import './Cuenta.css'
import './Configuracion.css'

// permiso: 'admin' (solo administradores) o 'historial' (quienes pueden ver resultados)
const SECCIONES = [
  { a: '/configuracion/usuarios', texto: 'Usuarios', permiso: 'admin' },
  { a: '/configuracion/jueces', texto: 'Jueces', permiso: 'admin' },
  { a: '/configuracion/competidores', texto: 'Competidores', permiso: 'admin' },
  { a: '/configuracion/historial', texto: 'Historial', permiso: 'historial' },
]

// Marco común de la sección Configuración (dentro de Mi cuenta). Cada pantalla pide un permiso;
// las pestañas muestran solo lo que el rol del usuario puede ver.
// Muestra el contenido (children) cuando corresponde, o el aviso que haga falta.
function ConfigPagina({ titulo, permiso = 'admin', children }) {
  const { configurado, cargando, user, esAdmin, perfilCargado, puedeVerHistorial } = useAuth()
  const permitido = permiso === 'admin' ? esAdmin : puedeVerHistorial
  const visibles = SECCIONES.filter((s) => (s.permiso === 'admin' ? esAdmin : puedeVerHistorial))

  let contenido
  if (!configurado) {
    contenido = <p className="cuenta-nota">La base de datos no está configurada en esta versión.</p>
  } else if (cargando || (user && !perfilCargado)) {
    contenido = <p className="cuenta-nota">Cargando…</p>
  } else if (!user) {
    contenido = (
      <p className="cuenta-nota">
        Tenés que <Link to="/cuenta">iniciar sesión</Link> para entrar a Configuración.
      </p>
    )
  } else if (!permitido) {
    contenido = (
      <p className="cuenta-nota">
        {permiso === 'admin'
          ? 'Solo el administrador de la organización puede entrar a esta sección.'
          : 'Tu rol no tiene acceso al historial de resultados.'}
      </p>
    )
  } else {
    contenido = children
  }

  return (
    <div className="pagina-columna">
      <Header />
      <main className="config-container">
        <section className="config-card">
          <div className="config-cabecera">
            <h1>Mi cuenta · Configuración</h1>
            <nav className="config-tabs" aria-label="Secciones de configuración">
              {visibles.map((s) => (
                <NavLink key={s.a} to={s.a} className={({ isActive }) => (isActive ? 'activa' : '')}>
                  {s.texto}
                </NavLink>
              ))}
            </nav>
          </div>
          <h2 className="config-titulo">{titulo}</h2>
          {contenido}
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default ConfigPagina
