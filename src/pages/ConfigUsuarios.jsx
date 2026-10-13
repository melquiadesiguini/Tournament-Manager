import { useEffect, useMemo, useState } from 'react'
import useAuth from '../hooks/useAuth'
import ConfigPagina from './ConfigPagina'
import { ROLES, ETIQUETA_ROL, DESCRIPCION_ROL } from '../lib/roles'
import { urlRegistro } from '../lib/contacto'
import {
  cambiarClaveUsuario,
  cambiarEstado,
  cambiarMiClave,
  cambiarRol,
  cancelarInvitacion,
  eliminarUsuario,
  invitar,
  listarEquipo,
  listarInvitaciones,
} from '../lib/equipo'

// Usuarios de la organización: roles, contraseñas, estado (activo / bloqueado) e invitaciones
function ConfigUsuarios() {
  const { user, esAdmin } = useAuth()
  const [miembros, setMiembros] = useState([])
  const [invitaciones, setInvitaciones] = useState([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroRol, setFiltroRol] = useState('')
  const [invitando, setInvitando] = useState(false)
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState('mesa')
  const [trabajando, setTrabajando] = useState(false)
  const [panel, setPanel] = useState(null) // { tipo: 'rol' | 'clave', fila, valor }
  const [porEliminar, setPorEliminar] = useState(null) // clave de la fila que espera confirmación
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const recargar = async () => {
    const [m, i] = await Promise.all([listarEquipo(), listarInvitaciones()])
    setMiembros(m)
    setInvitaciones(i)
  }

  useEffect(() => {
    if (!user || !esAdmin) return undefined
    let activo = true
    Promise.all([listarEquipo(), listarInvitaciones()]).then(([m, i]) => {
      if (!activo) return
      setMiembros(m)
      setInvitaciones(i)
      setCargandoLista(false)
    })
    return () => {
      activo = false
    }
  }, [user, esAdmin])

  // Miembros e invitaciones pendientes en una sola lista
  const filas = useMemo(
    () => [
      ...miembros.map((m) => ({ clave: m.user_id, tipo: 'miembro', ...m })),
      ...invitaciones.map((i) => ({ clave: i.id, tipo: 'invitacion', estado: 'pendiente', ...i })),
    ],
    [miembros, invitaciones]
  )

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filas.filter(
      (f) =>
        (!q || f.email.toLowerCase().includes(q)) &&
        (!filtroEstado || f.estado === filtroEstado) &&
        (!filtroRol || f.role === filtroRol)
    )
  }, [filas, busqueda, filtroEstado, filtroRol])

  const aplicar = async (promesa, ok) => {
    setError('')
    setAviso('')
    const r = await promesa
    if (!r.ok) {
      setError(r.mensaje)
      return false
    }
    if (ok) setAviso(ok)
    await recargar()
    return true
  }

  const enviarInvitacion = async (e) => {
    e.preventDefault()
    setTrabajando(true)
    const destino = email.trim().toLowerCase()
    const ok = await aplicar(
      invitar(email, rol),
      `Invitación creada. Pasale a ${destino} este enlace para que cree su cuenta con ese email: ${urlRegistro()} (quedará en tu equipo como ${ETIQUETA_ROL[rol]}).`
    )
    setTrabajando(false)
    if (ok) {
      setEmail('')
      setInvitando(false)
    }
  }

  const abrirPanel = (tipo, fila) => {
    setError('')
    setAviso('')
    setInvitando(false)
    setPanel({ tipo, fila, valor: tipo === 'rol' ? fila.role : '' })
  }

  const guardarPanel = async (e) => {
    e.preventDefault()
    const { tipo, fila, valor } = panel
    setTrabajando(true)
    let ok
    if (tipo === 'rol') {
      ok = await aplicar(cambiarRol(fila.user_id, valor), `Rol de ${fila.email} actualizado: ${ETIQUETA_ROL[valor]}.`)
    } else if (fila.es_yo) {
      ok = await aplicar(cambiarMiClave(valor), 'Tu contraseña se actualizó.')
    } else {
      ok = await aplicar(
        cambiarClaveUsuario(fila.user_id, valor),
        `Contraseña de ${fila.email} actualizada. Sus sesiones abiertas se cerraron.`
      )
    }
    setTrabajando(false)
    if (ok) setPanel(null)
  }

  const eliminar = async (f) => {
    setPorEliminar(null)
    await aplicar(eliminarUsuario(f.user_id), `${f.email} fue eliminado.`)
  }

  const selectorRol = (valor, onChange, etiqueta) => (
    <select className="config-select-chico" value={valor} onChange={onChange} aria-label={etiqueta}>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ETIQUETA_ROL[r]}
        </option>
      ))}
    </select>
  )

  return (
    <ConfigPagina titulo="Usuarios">
      <div className="config-barra">
        <input
          type="search"
          className="config-buscador"
          placeholder="Buscador por email…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar"
        />
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Estado">
          <option value="">Estado</option>
          <option value="activo">Activos</option>
          <option value="bloqueado">Bloqueados</option>
          <option value="pendiente">Invitaciones pendientes</option>
        </select>
        <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)} aria-label="Rol">
          <option value="">Seleccione un rol</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ETIQUETA_ROL[r]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="config-btn config-btn-primario"
          onClick={() => {
            setPanel(null)
            setInvitando((v) => !v)
          }}
        >
          + Invitar
        </button>
      </div>

      {invitando && (
        <form className="config-previa" onSubmit={enviarInvitacion}>
          <p>
            <strong>Invitar a una persona</strong>
          </p>
          <input
            className="config-buscador"
            type="email"
            required
            autoFocus
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {selectorRol(rol, (e) => setRol(e.target.value), 'Rol de la invitación')}
          <p className="config-ayuda">{DESCRIPCION_ROL[rol]}</p>
          <div className="config-fila-acciones">
            <button type="submit" className="config-btn config-btn-primario" disabled={trabajando}>
              {trabajando ? 'Un momento…' : 'Invitar'}
            </button>
            <button type="button" className="config-btn" onClick={() => setInvitando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {panel && (
        <form className="config-previa" onSubmit={guardarPanel}>
          <p>
            <strong>
              {panel.tipo === 'rol' ? 'Cambiar el rol de ' : 'Cambiar la contraseña de '}
              {panel.fila.email}
              {panel.fila.es_yo ? ' (vos)' : ''}
            </strong>
          </p>
          {panel.tipo === 'rol' ? (
            <>
              {selectorRol(panel.valor, (e) => setPanel({ ...panel, valor: e.target.value }), 'Nuevo rol')}
              <p className="config-ayuda">{DESCRIPCION_ROL[panel.valor]}</p>
            </>
          ) : (
            <>
              <input
                className="config-buscador"
                type="password"
                required
                minLength={6}
                autoFocus
                autoComplete="new-password"
                placeholder="Nueva contraseña (mínimo 6 caracteres)"
                value={panel.valor}
                onChange={(e) => setPanel({ ...panel, valor: e.target.value })}
              />
              {!panel.fila.es_yo && (
                <p className="config-ayuda">Se cerrarán las sesiones que esa persona tenga abiertas.</p>
              )}
            </>
          )}
          <div className="config-fila-acciones">
            <button type="submit" className="config-btn config-btn-primario" disabled={trabajando}>
              {trabajando ? 'Un momento…' : 'Guardar'}
            </button>
            <button type="button" className="config-btn" onClick={() => setPanel(null)}>
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
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargandoLista ? (
              <tr>
                <td colSpan={4}>Cargando…</td>
              </tr>
            ) : visibles.length === 0 ? (
              <tr>
                <td colSpan={4}>Ningún resultado con ese filtro.</td>
              </tr>
            ) : (
              visibles.map((f) => (
                <tr key={f.clave} className={f.estado === 'bloqueado' ? 'config-inactivo' : ''}>
                  <td>
                    {f.email}
                    {f.es_yo ? ' (vos)' : ''}
                  </td>
                  <td>{ETIQUETA_ROL[f.role] ?? f.role}</td>
                  <td>
                    <span
                      className={`config-estado ${f.estado === 'activo' ? 'ok' : f.estado === 'pendiente' ? 'pend' : 'off'}`}
                    >
                      {f.estado === 'activo' ? 'Activo' : f.estado === 'pendiente' ? 'Invitado' : 'Bloqueado'}
                    </span>
                  </td>
                  <td>
                    {f.tipo === 'invitacion' ? (
                      <span className="config-iconos">
                        <button
                          type="button"
                          title="Cancelar invitación"
                          aria-label={`Cancelar la invitación a ${f.email}`}
                          onClick={() => aplicar(cancelarInvitacion(f.clave))}
                        >
                          🗑️
                        </button>
                      </span>
                    ) : (
                      <span className="config-iconos">
                        {!f.es_yo && (
                          <button
                            type="button"
                            title="Cambiar rol"
                            aria-label={`Cambiar el rol de ${f.email}`}
                            onClick={() => abrirPanel('rol', f)}
                          >
                            ✏️
                          </button>
                        )}
                        <button
                          type="button"
                          title="Cambiar contraseña"
                          aria-label={`Cambiar la contraseña de ${f.email}`}
                          onClick={() => abrirPanel('clave', f)}
                        >
                          🔑
                        </button>
                        {!f.es_yo && (
                          <button
                            type="button"
                            title={f.estado === 'activo' ? 'Bloquear' : 'Desbloquear'}
                            aria-label={`${f.estado === 'activo' ? 'Bloquear' : 'Desbloquear'} a ${f.email}`}
                            onClick={() => aplicar(cambiarEstado(f.user_id, f.estado === 'activo' ? 'bloqueado' : 'activo'))}
                          >
                            {f.estado === 'activo' ? '🚫' : '✅'}
                          </button>
                        )}
                        {!f.es_yo &&
                          (porEliminar === f.clave ? (
                            <>
                              <span className="config-confirmar">¿Eliminar?</span>
                              <button type="button" className="config-confirmar-si" onClick={() => eliminar(f)}>
                                Sí
                              </button>
                              <button type="button" onClick={() => setPorEliminar(null)}>
                                No
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              title="Eliminar usuario"
                              aria-label={`Eliminar a ${f.email}`}
                              onClick={() => setPorEliminar(f.clave)}
                            >
                              🗑️
                            </button>
                          ))}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="config-ayuda">
        {visibles.length} de {filas.length}
      </p>
    </ConfigPagina>
  )
}

export default ConfigUsuarios
