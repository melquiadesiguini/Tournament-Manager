import { Link, Outlet } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import Header from './Header/Header'
import Footer from './Footer/Footer'
import '../pages/Cuenta.css'

// Deja pasar solo a quien tiene alguno de los permisos pedidos; al resto le muestra un aviso.
// Es experiencia de usuario: lo que realmente se puede leer o guardar lo decide la base (RLS).
function RequierePermiso({ permisos }) {
  const { configurado, puedeAlguno } = useAuth()
  if (!configurado || puedeAlguno(permisos)) return <Outlet />

  return (
    <div className="pagina-columna">
      <Header />
      <main className="cuenta-container">
        <section className="cuenta-card">
          <h1>Sin acceso</h1>
          <p className="cuenta-nota">Tu usuario no tiene permiso para usar esta pantalla. Si lo necesitás, pedíselo al administrador.</p>
          <div className="cuenta-acciones">
            <Link to="/" className="cuenta-boton cuenta-boton-primario">
              Ir al inicio
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default RequierePermiso
