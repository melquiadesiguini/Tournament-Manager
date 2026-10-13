import { Link, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import PantallaIngreso from '../components/PantallaIngreso'
import FormNuevaClave from '../components/FormNuevaClave'
import '../pages/Cuenta.css'

// Cambio de contraseña. Es obligatorio la primera vez que entra un usuario con contraseña inicial
// (RutaProtegida lo manda acá) y voluntario desde "Mi cuenta".
function CambiarClave() {
  const { perfil, cerrarSesion } = useAuth()
  const navegar = useNavigate()
  const obligatorio = Boolean(perfil?.debe_cambiar_clave)
  const terminar = () => navegar('/', { replace: true })

  if (obligatorio) {
    return (
      <PantallaIngreso
        titulo="Elegí tu contraseña"
        subtitulo="Tu administrador te dio una contraseña inicial. Por seguridad, cambiala ahora por una que solo conozcas vos."
        pie={
          <button type="button" className="login-enlace" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        }
      >
        <FormNuevaClave alTerminar={terminar} textoBoton="Guardar y entrar" />
      </PantallaIngreso>
    )
  }

  return (
    <div className="pagina-columna">
      <Header />
      <main className="cuenta-container">
        <section className="cuenta-card">
          <h1>Cambiar contraseña</h1>
          <FormNuevaClave alTerminar={terminar} />
          <div className="cuenta-acciones">
            <Link to="/cuenta" className="cuenta-boton">
              Cancelar
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default CambiarClave
