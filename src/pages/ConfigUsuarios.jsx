import { Fragment, useEffect, useMemo, useState } from 'react'
import useAuth from '../hooks/useAuth'
import ConfigPagina from './ConfigPagina'
import { cambiarEstadoUsuario, crearUsuario, generarClave, listarUsuarios, resetearClave } from '../lib/usuarios'
import { agregarAsignacion, borrarAsignacion, listarAsignaciones, listarRoles } from '../lib/roles'
import { listarTorneos } from '../lib/torneos'

const PERMISO = 'gestionar_usuarios'
const NUEVO_VACIO = { nombre_usuario: '', nombre_visible: '', clave: '' }
const ASIGNACION_VACIA = { rol_id: '', torneo_id: '', area: '' }

// Usuarios de la organización: alta con contraseña inicial, restablecer contraseña, activar/desactivar
// y roles asignados (por torneo y área). Las cuentas se crean con Edge Functions: la clave de servicio nunca llega al navegador.
function ConfigUsuarios() {
  const { user, puede } = useAuth()
  const permitido = puede(PERMISO)
  const puedeRoles = puede('gestionar_roles')

  const [usuarios, setUsuarios] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [roles, setRoles] = useState([])
  const [torneos, setTorneos] = useState([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [panel, setPanel] = useState(null) // { tipo: 'nuevo', valores } | { tipo: 'clave', usuario, clave }
  const [credencial, setCredencial] = useState(null) // { usuario, clave } para entregar a la persona
  const [expandido, setExpandido] = useState(null) // usuario_id con el panel de roles abierto
  const [asignacion, setAsignacion] = useState(ASIGNACION_VACIA)
  const [porDesactivar, setPorDesactivar] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargarTodo = async () => {
    const [u, a, r, t] = await Promise.all([listarUsuarios(), listarAsignaciones(), listarRoles(), listarTorneos()])
    setUsuarios(u.filas)
    setAsignaciones(a.filas)
    setRoles(r.filas)
    setTorneos(t.filas)
  }

  useEffect(() => {
    if (!user || !permitido) return undefined
    let activo = true
    Promise.all([listarUsuarios(), listarAsignaciones(), listarRoles(), listarTorneos()]).then(([u, a, r, t]) => {
      if (!activo) return
      setUsuarios(u.filas)
      setAsignaciones(a.filas)
      setRoles(r.filas)
      setTorneos(t.filas)
      setCargandoLista(false)
    })
    return () => {
      activo = false
    }
  }, [user, permitido])

  const nombreRol = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r.nombre])), [roles])
  const nombreTorneo = useMemo(() => Object.fromEntries(torneos.map((t) => [t.id, t.nombre])), [torneos])
  const textoAsignacion = (a) =>
    `${nombreRol[a.rol_id] ?? 'Rol'} · ${a.torneo_id ? (nombreTorneo[a.torneo_id] ?? 'Torneo') : 'Toda la organización'}${
      a.area ? ` · Área ${a.area}` : ''
    }`

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return usuarios.filter((u) => {
      if (filtroEstado === 'activo' && !u.activo) return false
      if (filtroEstado === 'inactivo' && u.activo) return false
      if (!q) return true
      return [u.nombre_usuario, u.nombre_visible].some((v) => String(v ?? '').toLowerCase().includes(q))
    })
  }, [usuarios, busqueda, filtroEstado])

  const nombreDe = (u) => u.nombre_usuario || u.nombre_visible || 'el dueño'

  const abrirNuevo = () => {
    setError('')
    setAviso('')
    setCredencial(null)
    setPanel({ tipo: 'nuevo', valores: { ...NUEVO_VACIO, clave: generarClave() } })
  }

  const abrirClave = (u) => {
    setError('')
    setAviso('')
    setCredencial(null)
    setPanel({ tipo: 'clave', usuario: u, clave: generarClave() })
  }

  const guardarPanel = async (e) => {
    e.preventDefault()
    setError('')
    setTrabajando(true)
    if (panel.tipo === 'nuevo') {
      const v = panel.valores
      const r = await crearUsuario(v)
      if (r.ok) {
        setCredencial({ usuario: v.nombre_usuario.trim().toLowerCase(), clave: v.clave })
        setPanel(null)
        await cargarTodo()
      } else setError(r.mensaje)
    } else {
      const r = await resetearClave(panel.usuario.usuario_id, panel.clave)
      if (r.ok) {
        setCredencial({ usuario: panel.usuario.nombre_usuario, clave: panel.clave })
        setPanel(null)
        await cargarTodo()
      } else setError(r.mensaje)
    }
    setTrabajando(false)
  }

  const cambiarEstado = async (u) => {
    setPorDesactivar(null)
    setError('')
    setAviso('')
    setTrabajando(true)
    const r = await cambiarEstadoUsuario(u.usuario_id, !u.activo)
    if (r.ok) {
      setAviso(u.activo ? `${nombreDe(u)} quedó desactivado y se le cerraron las sesiones.` : `${nombreDe(u)} quedó activo.`)
      await cargarTodo()
    } else setError(r.mensaje)
    setTrabajando(false)
  }

  const asignar = async (e, usuarioId) => {
    e.preventDefault()
    setError('')
    setTrabajando(true)
    const r = await agregarAsignacion({ usuario_id: usuarioId, ...asignacion })
    if (r.ok) {
      setAsignacion(ASIGNACION_VACIA)
      await cargarTodo()
    } else setError(r.mensaje)
    setTrabajando(false)
  }

  const quitar = async (id) => {
    setError('')
    setTrabajando(true)
    const r = await borrarAsignacion(id)
    if (r.ok) await cargarTodo()
    else setError(r.mensaje)
    setTrabajando(false)
  }

  const alternarRoles = (u) => {
    setExpandido(expandido === u.usuario_id ? null : u.usuario_id)
    setAsignacion(ASIGNACION_VACIA)
    setError('')
  }

  const cambiarNuevo = (campo, valor) => setPanel({ ...panel, valores: { ...panel.valores, [campo]: valor } })

  return (
    <ConfigPagina titulo="Usuarios" permiso={PERMISO}>
      <div className="config-barra">
        <input
          type="search"
          className="config-buscador"
          placeholder="Buscador…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar"
        />
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Estado">
          <option value="">Estado</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
        <button type="button" className="config-btn config-btn-primario" onClick={abrirNuevo}>
          + Nuevo usuario
        </button>
      </div>
      <p className="config-ayuda">
        Cada usuario ingresa con su nombre de usuario y una contraseña inicial que le das vos; la primera vez tiene que
        cambiarla. Después asignale uno o más roles (con el botón 🎭).
      </p>

      {credencial && (
        <div className="cuenta-aviso">
          <p>
            Entregale estos datos a la persona (la contraseña no se vuelve a mostrar):
          </p>
          <p>
            Usuario: <span className="config-credencial">{credencial.usuario}</span> · Contraseña inicial:{' '}
            <span className="config-credencial">{credencial.clave}</span>
          </p>
          <button type="button" className="config-btn" onClick={() => setCredencial(null)}>
            Ya la anoté
          </button>
        </div>
      )}

      {panel && (
        <form className="config-previa" onSubmit={guardarPanel}>
          <p>
            <strong>{panel.tipo === 'nuevo' ? 'Nuevo usuario' : `Restablecer la contraseña de ${panel.usuario.nombre_usuario}`}</strong>
          </p>
          <div className="config-formulario">
            {panel.tipo === 'nuevo' && (
              <>
                <label>
                  Nombre de usuario
                  <input
                    className="config-buscador"
                    required
                    minLength={3}
                    maxLength={30}
                    pattern="[a-zA-Z0-9._\-]{3,30}"
                    title="De 3 a 30 caracteres: letras, números, punto, guion y guion bajo."
                    autoFocus
                    autoCapitalize="none"
                    spellCheck={false}
                    value={panel.valores.nombre_usuario}
                    onChange={(e) => cambiarNuevo('nombre_usuario', e.target.value)}
                  />
                </label>
                <label>
                  Nombre (opcional)
                  <input
                    className="config-buscador"
                    maxLength={60}
                    value={panel.valores.nombre_visible}
                    onChange={(e) => cambiarNuevo('nombre_visible', e.target.value)}
                  />
                </label>
              </>
            )}
            <label>
              Contraseña inicial
              <input
                className="config-buscador"
                required
                minLength={8}
                maxLength={72}
                spellCheck={false}
                value={panel.tipo === 'nuevo' ? panel.valores.clave : panel.clave}
                onChange={(e) => (panel.tipo === 'nuevo' ? cambiarNuevo('clave', e.target.value) : setPanel({ ...panel, clave: e.target.value }))}
              />
            </label>
          </div>
          <div className="config-fila-acciones">
            <button type="submit" className="config-btn config-btn-primario" disabled={trabajando}>
              {trabajando ? 'Guardando…' : panel.tipo === 'nuevo' ? 'Crear usuario' : 'Restablecer'}
            </button>
            <button
              type="button"
              className="config-btn"
              onClick={() => {
                const clave = generarClave()
                if (panel.tipo === 'nuevo') cambiarNuevo('clave', clave)
                else setPanel({ ...panel, clave })
              }}
            >
              Generar otra
            </button>
            <button type="button" className="config-btn" onClick={() => setPanel(null)} disabled={trabajando}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && <div className="cuenta-error">{error}</div>}
      {aviso && <div className="cuenta-aviso">{aviso}</div>}

      <div className="config-tabla-wrap">
        <table className="config-tabla">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Roles</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargandoLista ? (
              <tr>
                <td colSpan={5}>Cargando…</td>
              </tr>
            ) : visibles.length === 0 ? (
              <tr>
                <td colSpan={5}>{usuarios.length === 0 ? 'Todavía no hay usuarios.' : 'Ningún usuario con ese filtro.'}</td>
              </tr>
            ) : (
              visibles.map((u) => {
                const propias = asignaciones.filter((a) => a.usuario_id === u.usuario_id)
                const esYo = u.usuario_id === user.id
                return (
                  <Fragment key={u.usuario_id}>
                    <tr className={u.activo ? '' : 'config-inactivo'}>
                      <td>{u.nombre_usuario ?? (u.es_dueno ? 'Dueño (email)' : '—')}</td>
                      <td>{u.nombre_visible || '—'}</td>
                      <td>
                        <span className="usuarios-roles">
                          {propias.length === 0 ? (
                            <span className="config-ayuda">Sin roles</span>
                          ) : (
                            propias.map((a) => (
                              <span key={a.id} className="usuarios-rol">
                                {textoAsignacion(a)}
                              </span>
                            ))
                          )}
                        </span>
                      </td>
                      <td>
                        <span className={`config-estado ${u.activo ? 'ok' : 'off'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                        {u.debe_cambiar_clave && <span className="config-estado pend"> Clave inicial</span>}
                      </td>
                      <td>
                        <span className="config-iconos">
                          <button
                            type="button"
                            title="Roles"
                            aria-label={`Roles de ${nombreDe(u)}`}
                            onClick={() => alternarRoles(u)}
                          >
                            🎭
                          </button>
                          {!u.es_dueno && !esYo && u.nombre_usuario && (
                            <button
                              type="button"
                              title="Restablecer contraseña"
                              aria-label={`Restablecer la contraseña de ${nombreDe(u)}`}
                              onClick={() => abrirClave(u)}
                            >
                              🔑
                            </button>
                          )}
                          {!u.es_dueno &&
                            !esYo &&
                            (porDesactivar === u.usuario_id ? (
                              <>
                                <span className="config-confirmar">¿Desactivar?</span>
                                <button type="button" className="config-confirmar-si" onClick={() => cambiarEstado(u)}>
                                  Sí
                                </button>
                                <button type="button" onClick={() => setPorDesactivar(null)}>
                                  No
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                title={u.activo ? 'Desactivar' : 'Activar'}
                                aria-label={`${u.activo ? 'Desactivar' : 'Activar'} a ${nombreDe(u)}`}
                                disabled={trabajando}
                                onClick={() => (u.activo ? setPorDesactivar(u.usuario_id) : cambiarEstado(u))}
                              >
                                {u.activo ? '🚫' : '✅'}
                              </button>
                            ))}
                        </span>
                      </td>
                    </tr>

                    {expandido === u.usuario_id && (
                      <tr className="usuarios-panel">
                        <td colSpan={5}>
                          {propias.length === 0 && <p className="config-ayuda">Este usuario no tiene roles: no puede usar ninguna pantalla.</p>}
                          {propias.map((a) => {
                            // el Admin permanente del dueño no se puede quitar (lo impide también la base)
                            const fijo = u.es_dueno && !a.torneo_id && !a.area && nombreRol[a.rol_id] === 'Admin'
                            return (
                              <div key={a.id} className="usuarios-asignacion">
                                <span>{textoAsignacion(a)}</span>
                                {puedeRoles && !fijo && (
                                  <button type="button" className="config-btn" disabled={trabajando} onClick={() => quitar(a.id)}>
                                    Quitar
                                  </button>
                                )}
                              </div>
                            )
                          })}
                          {puedeRoles ? (
                            <form className="config-barra" onSubmit={(e) => asignar(e, u.usuario_id)}>
                              <select
                                required
                                value={asignacion.rol_id}
                                onChange={(e) => setAsignacion({ ...asignacion, rol_id: e.target.value })}
                                aria-label="Rol"
                              >
                                <option value="">Rol…</option>
                                {roles.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.nombre}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={asignacion.torneo_id}
                                onChange={(e) => setAsignacion({ ...asignacion, torneo_id: e.target.value })}
                                aria-label="Torneo"
                              >
                                <option value="">Toda la organización</option>
                                {torneos.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.nombre}
                                  </option>
                                ))}
                              </select>
                              <input
                                className="config-buscador"
                                placeholder="Área (todas si se deja vacío)"
                                maxLength={30}
                                value={asignacion.area}
                                onChange={(e) => setAsignacion({ ...asignacion, area: e.target.value })}
                                aria-label="Área"
                              />
                              <button type="submit" className="config-btn config-btn-primario" disabled={trabajando}>
                                Asignar
                              </button>
                            </form>
                          ) : (
                            <p className="config-ayuda">Para asignar roles se necesita el permiso de administrar roles.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="config-ayuda">
        {visibles.length} de {usuarios.length}
      </p>
    </ConfigPagina>
  )
}

export default ConfigUsuarios
