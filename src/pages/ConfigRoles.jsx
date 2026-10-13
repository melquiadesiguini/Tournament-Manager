import { useEffect, useState } from 'react'
import useAuth from '../hooks/useAuth'
import ConfigPagina from './ConfigPagina'
import { PERMISOS } from '../lib/permisos'
import { borrarRol, cambiarPermisoDeRol, crearRol, listarRoles, renombrarRol } from '../lib/roles'

const PERMISO = 'gestionar_roles'
// Permisos de gestión del Admin: la base no deja quitárselos (así la organización nunca queda sin administración)
const BLOQUEADOS_EN_ADMIN = ['gestionar_usuarios', 'gestionar_roles']

const esAdmin = (rol) => rol.de_fabrica && rol.nombre === 'Admin'

// Roles de la organización: qué permisos tiene cada uno. Los de fábrica se pueden editar;
// "Admin" no se borra ni se renombra.
function ConfigRoles() {
  const { user, puede } = useAuth()
  const permitido = puede(PERMISO)
  const [roles, setRoles] = useState([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [nuevo, setNuevo] = useState(null) // nombre del rol que se está creando
  const [renombrando, setRenombrando] = useState(null) // { id, nombre }
  const [porBorrar, setPorBorrar] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')

  const recargar = () => listarRoles().then((r) => setRoles(r.filas))

  useEffect(() => {
    if (!user || !permitido) return undefined
    let activo = true
    listarRoles().then((r) => {
      if (!activo) return
      setRoles(r.filas)
      setCargandoLista(false)
    })
    return () => {
      activo = false
    }
  }, [user, permitido])

  const ejecutar = async (promesa) => {
    setError('')
    setTrabajando(true)
    const r = await promesa
    if (!r.ok) setError(r.mensaje)
    else await recargar()
    setTrabajando(false)
    return r.ok
  }

  const crear = async (e) => {
    e.preventDefault()
    if (await ejecutar(crearRol(nuevo))) setNuevo(null)
  }

  const renombrar = async (e) => {
    e.preventDefault()
    if (await ejecutar(renombrarRol(renombrando.id, renombrando.nombre))) setRenombrando(null)
  }

  return (
    <ConfigPagina titulo="Roles" permiso={PERMISO}>
      <div className="config-barra">
        <button type="button" className="config-btn config-btn-primario" onClick={() => setNuevo('')}>
          + Nuevo rol
        </button>
      </div>
      <p className="config-ayuda">
        Un rol es un conjunto de permisos. Los roles se asignan a cada usuario en Configuración → Usuarios, para toda la
        organización o solo para un torneo y un área. Los cambios se aplican la próxima vez que la persona entra.
      </p>

      {nuevo !== null && (
        <form className="config-previa" onSubmit={crear}>
          <p>
            <strong>Nuevo rol</strong>
          </p>
          <div className="config-formulario">
            <label>
              Nombre
              <input
                className="config-buscador"
                required
                maxLength={60}
                autoFocus
                value={nuevo}
                onChange={(e) => setNuevo(e.target.value)}
              />
            </label>
          </div>
          <p className="config-ayuda">Se crea sin permisos: marcalos después en la lista.</p>
          <div className="config-fila-acciones">
            <button type="submit" className="config-btn config-btn-primario" disabled={trabajando}>
              Crear
            </button>
            <button type="button" className="config-btn" onClick={() => setNuevo(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && <div className="cuenta-error">{error}</div>}

      {cargandoLista ? (
        <p className="cuenta-nota">Cargando…</p>
      ) : (
        roles.map((rol) => (
          <section key={rol.id} className="config-previa roles-tarjeta">
            <div className="roles-cabecera">
              {renombrando?.id === rol.id ? (
                <form className="config-fila-acciones" onSubmit={renombrar}>
                  <input
                    className="config-buscador"
                    required
                    maxLength={60}
                    autoFocus
                    value={renombrando.nombre}
                    onChange={(e) => setRenombrando({ ...renombrando, nombre: e.target.value })}
                  />
                  <button type="submit" className="config-btn config-btn-primario" disabled={trabajando}>
                    Guardar
                  </button>
                  <button type="button" className="config-btn" onClick={() => setRenombrando(null)}>
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  <h3>{rol.nombre}</h3>
                  {rol.de_fabrica && <span className="config-estado pend">De fábrica</span>}
                  {!esAdmin(rol) && (
                    <span className="config-iconos">
                      <button
                        type="button"
                        title="Cambiar nombre"
                        aria-label={`Cambiar el nombre de ${rol.nombre}`}
                        onClick={() => setRenombrando({ id: rol.id, nombre: rol.nombre })}
                      >
                        ✏️
                      </button>
                      {porBorrar === rol.id ? (
                        <>
                          <span className="config-confirmar">¿Borrar? Se quita a quienes lo tengan.</span>
                          <button
                            type="button"
                            className="config-confirmar-si"
                            onClick={() => {
                              setPorBorrar(null)
                              ejecutar(borrarRol(rol.id))
                            }}
                          >
                            Sí
                          </button>
                          <button type="button" onClick={() => setPorBorrar(null)}>
                            No
                          </button>
                        </>
                      ) : (
                        <button type="button" title="Borrar" aria-label={`Borrar ${rol.nombre}`} onClick={() => setPorBorrar(rol.id)}>
                          🗑️
                        </button>
                      )}
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="roles-permisos">
              {Object.entries(PERMISOS).map(([clave, texto]) => {
                const bloqueado = esAdmin(rol) && BLOQUEADOS_EN_ADMIN.includes(clave)
                return (
                  <label key={clave} className="config-check" title={bloqueado ? 'El Admin siempre conserva este permiso.' : undefined}>
                    <input
                      type="checkbox"
                      checked={rol.permisos.includes(clave)}
                      disabled={trabajando || bloqueado}
                      onChange={(e) => ejecutar(cambiarPermisoDeRol(rol.id, clave, e.target.checked))}
                    />
                    {texto}
                  </label>
                )
              })}
            </div>
          </section>
        ))
      )}
    </ConfigPagina>
  )
}

export default ConfigRoles
