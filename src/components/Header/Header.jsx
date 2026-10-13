import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import logoClaro from '../../assets/images/ipponia-logo.png' // cinturón negro (tema claro)
import logoOscuro from '../../assets/images/ipponia-logo-oscuro.png' // cinturón blanco (tema oscuro)
import useTheme from '../../hooks/useTheme'
import useAuth from '../../hooks/useAuth'
import { PERMISOS_MODULO, SECCIONES_CONFIG } from '../../lib/permisos'
import s from './Header.module.css'

function Header() {
  const { theme, toggleTheme } = useTheme()
  const { user, perfil, esSuperAdmin, puede, puedeAlguno } = useAuth()
  const seccionesConfig = SECCIONES_CONFIG.filter((s) => (s.permiso === 'superadmin' ? esSuperAdmin : puede(s.permiso)))
  const hayConfiguracion = seccionesConfig.length > 0
  const nombreCuenta = perfil?.nombre_visible || perfil?.nombre_usuario || user?.email
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
              {puedeAlguno(PERMISOS_MODULO.kata) && <Link to="/kata">Kata</Link>}
              {puedeAlguno(PERMISOS_MODULO.kumite) && <Link to="/kumite">Kumite</Link>}
              {puedeAlguno(PERMISOS_MODULO.kobudo) && <Link to="/kobudo">Kobudo</Link>}
              {puedeAlguno(PERMISOS_MODULO.destreza) && <Link to="/destreza">Destreza</Link>}
              {user ? (
                <div
                  className={s.menuConfig}
                  ref={menuRef}
                  onMouseEnter={() => setMenuAbierto(true)}
                  onMouseLeave={() => setMenuAbierto(false)}
                >
                  <Link to="/cuenta" title={nombreCuenta} aria-haspopup={hayConfiguracion ? 'menu' : undefined}>
                    Mi cuenta
                  </Link>
                  {menuAbierto && hayConfiguracion && (
                    <div className={s.menuConfigLista} role="menu" onClick={() => setMenuAbierto(false)}>
                      <div className={s.menuConfigCaja}>
                        <span className={s.menuConfigTitulo}>Configuración</span>
                        {seccionesConfig.map((sec) => (
                          <Link key={sec.a} to={sec.a} role="menuitem">
                            {sec.texto}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link to="/ingresar" title="Ingresar">
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