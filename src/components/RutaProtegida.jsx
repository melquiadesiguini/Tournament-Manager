import { Outlet } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import Cuenta from '../pages/Cuenta'
import LoginFondo from './LoginFondo'
import '../pages/Login.css'

// Todo el servicio exige una sesión iniciada: sin sesión se muestra la pantalla de ingreso
// en la misma dirección, y al ingresar el usuario sigue donde estaba.
function RutaProtegida() {
  const { configurado, cargando, user } = useAuth()

  // Sin base de datos configurada (desarrollo local sin .env) no hay cuentas que exigir
  if (!configurado) return <Outlet />

  if (cargando) {
    return (
      <div className="login-pantalla">
        <LoginFondo />
        <p className="login-cargando">Cargando…</p>
      </div>
    )
  }

  return user ? <Outlet /> : <Cuenta />
}

export default RutaProtegida
