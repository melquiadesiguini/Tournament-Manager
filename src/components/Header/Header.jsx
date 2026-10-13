import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import logoClaro from '../../assets/images/ipponia-logo.png' // cinturón negro (tema claro)
import logoOscuro from '../../assets/images/ipponia-logo-oscuro.png' // cinturón blanco (tema oscuro)
import useTheme from '../../hooks/useTheme'
import useAuth from '../../hooks/useAuth'
import s from './Header.module.css'

function Header() {
  const { theme, toggleTheme } = useTheme()
  const { user, esAdmin, puedeVerHistorial } = useAuth()
  const hayConfiguracion = esAdmin || puedeVerHistorial
  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useRef(null)

  // Cierra el menú al tocar fuera de él o con Escape
  useEffect(() => {
    if (!menuAbierto) return undefined
    const cerrar = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !menuRef.current?.contains(e.target)) setMenuAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('keydown', cerrar)
    return () => {
      document.removeEventListener('mousedown', cerrar)
      document.removeEventListener('keydown', cerrar)
    }
  }, [menuAbierto])

  return (
    <header>
      <div className={`${s.headerContent}`}>
        <div className={s.brand}>
          <Link to="/">
            <img
              src={theme === 'dark' ? logoOscuro : logoClaro}
              alt="Ipponia"
              className={s.logoImg}
            />
          </Link>
          <h1 className={s.logo}>IPPONIA</h1>
        </div>
        <div className={`${s.headerContent2}`}>
          <nav className={s.containerNav}>
            <div className={s.containerNav2}>
              <Link to="/">Home</Link>
              <Link to="/kata">Kata</Link>
              <Link to="/kumite">Kumite</Link>
              <Link to="/kobudo">Kobudo</Link>
              <Link to="/destreza">Destreza</Link>
              {user ? (
                <div
                  className={s.menuConfig}
                  ref={menuRef}
                  onMouseEnter={() => setMenuAbierto(true)}
                  onMouseLeave={() => setMenuAbierto(false)}
                >
                  <Link to="/cuenta" title={user.email} aria-haspopup={hayConfiguracion ? 'menu' : undefined}>
                    Mi cuenta{hayConfiguracion }
                  </Link>
                  {menuAbierto && hayConfiguracion && (
                    <div className={s.menuConfigLista} role="menu" onClick={() => setMenuAbierto(false)}>
                      <div className={s.menuConfigCaja}>
                        <span className={s.menuConfigTitulo}>Configuración</span>
                        {esAdmin && (
                          <>
                            <Link to="/configuracion/usuarios" role="menuitem">
                              Usuarios
                            </Link>
                            <Link to="/configuracion/jueces" role="menuitem">
                              Jueces
                            </Link>
                            <Link to="/configuracion/competidores" role="menuitem">
                              Competidores
                            </Link>
                          </>
                        )}
                        {puedeVerHistorial && (
                          <Link to="/configuracion/historial" role="menuitem">
                            Historial
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link to="/cuenta" title="Ingresar o crear cuenta">
                  Ingresar
                </Link>
              )}
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