import useTheme from '../hooks/useTheme'
import LoginFondo from './LoginFondo'
import logoClaro from '../assets/images/ipponia-logo.png' // cinturón negro (tema claro)
import logoOscuro from '../assets/images/ipponia-logo-oscuro.png' // cinturón blanco (tema oscuro)
import '../pages/Cuenta.css'
import '../pages/Login.css'

// Marco de las pantallas sin sesión (ingresar, recuperar, cambiar contraseña): fondo de la marca,
// botón de tema, logo y una tarjeta con el contenido (children) y un pie opcional.
function PantallaIngreso({ titulo, subtitulo, pie, children }) {
  const { theme, toggleTheme } = useTheme()
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
        {titulo && <h2 className="login-subtitulo">{titulo}</h2>}
        {subtitulo && <p className="cuenta-nota">{subtitulo}</p>}
        {children}
        {pie && <div className="login-pie">{pie}</div>}
      </section>
    </div>
  )
}

export default PantallaIngreso
