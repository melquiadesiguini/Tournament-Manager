import { Link } from 'react-router-dom'
import logo from '../../assets/images/LOGO ZOK.PNG'
import useTheme from '../../hooks/useTheme'
import s from './Header.module.css'

function Header() {
  const { theme, toggleTheme } = useTheme()

  return (
    <header>
      <div className={`${s.headerContent}`}>
        <div className={s.brand}>
          <Link to="/">
            <img
              src={logo}
              alt="Logo Ikigai Dojo"
              className={s.logoImg}
            />
          </Link>
          <h1 className={s.logo}>TOURNAMENT MANAGER</h1>
        </div>
        <div className={`${s.headerContent2}`}>
          <nav className={s.containerNav}>
            <div className={s.containerNav2}>
              <Link to="/">Home</Link>
              <Link to="/kata">Kata</Link>
              <Link to="/kumite">Kumite</Link>
              <button
                type="button"
                className={s.themeToggle}
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
                title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}

export default Header