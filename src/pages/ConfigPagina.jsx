import { Link, NavLink } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import useAuth from '../hooks/useAuth'
import { SECCIONES_CONFIG } from '../lib/permisos'
import './Cuenta.css'
import './Configuracion.css'

// Marco común de la sección Configuración (dentro de Mi cuenta). Cada pantalla pide un permiso
// (el nombre de un permiso de la base, o 'superadmin'); las pestañas muestran solo lo que el usuario
// puede ver. Muestra el contenido (children) cuando corresponde, o el aviso que haga falta.
function ConfigPagina({ titulo, permiso, children }) {
  const { configurado, cargando, user, esSuperAdmin, perfilCargado, puede } = useAuth()
  const tiene = (p) => (p === 'superadmin' ? esSuperAdmin : puede(p))
  const permitido = tiene(permiso)
  const visibles = SECCIONES_CONFIG.filter((s) => tiene(s.permiso))

  let contenido
  if (!configurado) {
    contenido = <p className="cuenta-nota">La base de datos no está configurada en esta versión.</p>
  } else if (cargando || (user && !perfilCargado)) {
    contenido = <p className="cuenta-nota">Cargando…</p>
  } else if (!user) {
    contenido = (
      <p className="cuenta-nota">
        Tenés que <Link to="/ingresar">iniciar sesión</Link> para entrar a Configuración.
      </p>
    )
  } else if (!permitido) {
    contenido = (
      <p className="cuenta-nota">
        {permiso === 'superadmin'
          ? 'Esta sección es solo para el superadministrador de la plataforma.'
          : 'Tu usuario no tiene permiso para entrar a esta sección. Pedíselo al administrador.'}
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
