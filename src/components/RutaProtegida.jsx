import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import LoginFondo from './LoginFondo'
import PantallaIngreso from './PantallaIngreso'
import { rutaIngreso } from '../lib/ingreso'
import '../pages/Login.css'

// Todo el servicio exige una sesión iniciada. Sin sesión se va a la pantalla de ingreso de la
// organización (y al ingresar se vuelve a donde se estaba). Además se exige que la cuenta esté
// en condiciones: activa, con la organización vigente y con la contraseña inicial ya cambiada.
function RutaProtegida() {
  const { configurado, cargando, user, perfilCargado, errorCarga, perfil, esSuperAdmin, organizacion, organizacionVigente, recargar, cerrarSesion } =
    useAuth()
  const ubicacion = useLocation()

  // Sin base de datos configurada (desarrollo local sin .env) no hay cuentas que exigir
  if (!configurado) return <Outlet />

  if (cargando || (user && !perfilCargado)) {
    return (
      <div className="login-pantalla">
        <LoginFondo />
        <p className="login-cargando">Cargando…</p>
      </div>
    )
  }

  if (!user) return <Navigate to={rutaIngreso()} replace state={{ from: ubicacion }} />

  const salir = (
    <button type="button" className="login-enlace" onClick={cerrarSesion}>
      Cerrar sesión
    </button>
  )

  if (errorCarga) {
    return (
      <PantallaIngreso titulo="No se pudo cargar tu cuenta" subtitulo="Revisá tu conexión e intentá de nuevo." pie={salir}>
        <button type="button" className="cuenta-boton cuenta-boton-primario" onClick={recargar}>
          Reintentar
        </button>
      </PantallaIngreso>
    )
  }

  // El superadmin no necesita pertenecer a una organización
  if (!perfil) {
    if (esSuperAdmin) return <Outlet />
    return (
      <PantallaIngreso
        titulo="Cuenta sin organización"
        subtitulo="Tu cuenta no está asociada a ninguna organización. Consultá con quien te dio el acceso."
        pie={salir}
      />
    )
  }

  if (!perfil.activo) {
    return (
      <PantallaIngreso
        titulo="Usuario desactivado"
        subtitulo="Tu usuario fue desactivado. Consultá con el administrador de tu organización."
        pie={salir}
      />
    )
  }

  if (!organizacionVigente && !esSuperAdmin) {
    return (
      <PantallaIngreso
        titulo={organizacion?.nombre ?? 'Organización'}
        subtitulo="El plan de tu organización está suspendido o vencido. Consultá con el proveedor del servicio para reactivarlo."
        pie={salir}
      />
    )
  }

  if (perfil.debe_cambiar_clave && ubicacion.pathname !== '/cambiar-clave') {
    return <Navigate to="/cambiar-clave" replace />
  }

  return <Outlet />
}

export default RutaProtegida
