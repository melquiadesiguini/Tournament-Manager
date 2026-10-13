import { useEffect, useMemo, useState } from 'react'
import useAuth from '../hooks/useAuth'
import ConfigPagina from './ConfigPagina'
import { urlRegistro } from '../lib/contacto'
import { actualizarOrganizacion, crearOrganizacion, listarOrganizaciones } from '../lib/organizaciones'

const PLANES = ['Prueba', 'Básico', 'Profesional', 'Federación', 'Interno']
const ESTADOS = { prueba: 'Prueba', activa: 'Activa', suspendida: 'Suspendida' }

const hoy = () => new Date().toISOString().slice(0, 10)

// Estado real: una organización activa o en prueba con el vencimiento pasado figura como vencida
function estadoEfectivo(o) {
  if (o.estado !== 'suspendida' && o.vence_el && o.vence_el < hoy()) return 'vencida'
  return o.estado
}

const formatoFecha = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('es-AR') : '—')

// Clientes de la plataforma: alta de organizaciones, plan, estado y vencimiento (solo superadministrador)
function ConfigOrganizaciones() {
  const { user, esSuperAdmin } = useAuth()
  const [filas, setFilas] = useState([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [alta, setAlta] = useState(null) // { nombre, emailAdmin, plan, dias }
  const [edicion, setEdicion] = useState(null) // { id, nombre, plan, estado, venceEl, notas }
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const recargar = async () => {
    const r = await listarOrganizaciones()
    if (r.ok) setFilas(r.filas)
    else setError(r.mensaje)
  }

  useEffect(() => {
    if (!user || !esSuperAdmin) return undefined
    let activo = true
    listarOrganizaciones().then((r) => {
      if (!activo) return
      setFilas(r.filas)
      setCargandoLista(false)
    })
    return () => {
      activo = false
    }
  }, [user, esSuperAdmin])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filas.filter(
      (o) =>
        (!filtroEstado || estadoEfectivo(o) === filtroEstado) &&
        (!q || `${o.nombre} ${o.administradores ?? ''} ${o.plan}`.toLowerCase().includes(q))
    )
  }, [filas, busqueda, filtroEstado])

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

  const guardarAlta = async (e) => {
    e.preventDefault()
    setTrabajando(true)
    const dias = alta.dias === '' ? null : Number(alta.dias)
    const ok = await aplicar(
      crearOrganizacion({ nombre: alta.nombre, emailAdmin: alta.emailAdmin, plan: alta.plan, dias }),
      `Organización creada. Pasale a ${alta.emailAdmin.trim().toLowerCase()} este enlace para que cree su cuenta con ese email y quede como administrador: ${urlRegistro()}`
    )
    setTrabajando(false)
    if (ok) setAlta(null)
  }

  const guardarEdicion = async (e) => {
    e.preventDefault()
    setTrabajando(true)
    const ok = await aplicar(actualizarOrganizacion(edicion.id, edicion), 'Organización actualizada.')
    setTrabajando(false)
    if (ok) setEdicion(null)
  }

  const abrirEdicion = (o) => {
    setError('')
    setAviso('')
    setAlta(null)
    setEdicion({
      id: o.id,
      nombre: o.nombre,
      plan: o.plan,
      estado: o.estado,
      venceEl: o.vence_el ?? '',
      notas: o.notas ?? '',
    })
  }

  const suspender = (o) =>
    aplicar(
      actualizarOrganizacion(o.id, {
        nombre: o.nombre,
        plan: o.plan,
        estado: o.estado === 'suspendida' ? 'activa' : 'suspendida',
        venceEl: o.vence_el,
        notas: o.notas,
      }),
      o.estado === 'suspendida' ? `${o.nombre} fue reactivada.` : `${o.nombre} fue suspendida: sus usuarios no pueden entrar.`
    )

  return (
    <ConfigPagina titulo="Organizaciones (clientes)" permiso="superadmin">
      <div className="config-barra">
        <input
          type="search"
          className="config-buscador"
          placeholder="Buscar por nombre, administrador o plan…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar"
        />
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Estado">
          <option value="">Estado</option>
          <option value="prueba">En prueba</option>
          <option value="activa">Activas</option>
          <option value="suspendida">Suspendidas</option>
          <option value="vencida">Vencidas</option>
        </select>
        <button
          type="button"
          className="config-btn config-btn-primario"
          onClick={() => {
            setEdicion(null)
            setAlta({ nombre: '', emailAdmin: '', plan: 'Prueba', dias: '14' })
          }}
        >
          + Nueva organización
        </button>
      </div>

      {alta && (
        <form className="config-previa" onSubmit={guardarAlta}>
          <p>
            <strong>Alta de un cliente</strong>
          </p>
          <div className="config-formulario">
            <label>
              Nombre de la organización
              <input
                className="config-buscador"
                required
                autoFocus
                value={alta.nombre}
                onChange={(e) => setAlta({ ...alta, nombre: e.target.value })}
                placeholder="Ej.: Federación Argentina de Karate"
              />
            </label>
            <label>
              Email del administrador
              <input
                className="config-buscador"
                type="email"
                required
                value={alta.emailAdmin}
                onChange={(e) => setAlta({ ...alta, emailAdmin: e.target.value })}
              />
            </label>
            <label>
              Plan
              <input
                className="config-buscador"
                list="planes"
                value={alta.plan}
                onChange={(e) => setAlta({ ...alta, plan: e.target.value })}
              />
            </label>
            <label>
              Días de prueba (vacío = activa, sin vencimiento)
              <input
                className="config-buscador"
                type="number"
                min="0"
                value={alta.dias}
                onChange={(e) => setAlta({ ...alta, dias: e.target.value })}
              />
            </label>
          </div>
          <div className="config-fila-acciones">
            <button type="submit" className="config-btn config-btn-primario" disabled={trabajando}>
              {trabajando ? 'Un momento…' : 'Crear organización'}
            </button>
            <button type="button" className="config-btn" onClick={() => setAlta(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {edicion && (
        <form className="config-previa" onSubmit={guardarEdicion}>
          <p>
            <strong>Editar organización</strong>
          </p>
          <div className="config-formulario">
            <label>
              Nombre
              <input
                className="config-buscador"
                required
                value={edicion.nombre}
                onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })}
              />
            </label>
            <label>
              Plan
              <input
                className="config-buscador"
                list="planes"
                value={edicion.plan}
                onChange={(e) => setEdicion({ ...edicion, plan: e.target.value })}
              />
            </label>
            <label>
              Estado
              <select
                className="config-select-chico"
                value={edicion.estado}
                onChange={(e) => setEdicion({ ...edicion, estado: e.target.value })}
              >
                {Object.entries(ESTADOS).map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vence el (vacío = sin vencimiento)
              <input
                className="config-buscador"
                type="date"
                value={edicion.venceEl}
                onChange={(e) => setEdicion({ ...edicion, venceEl: e.target.value })}
              />
            </label>
            <label>
              Notas internas
              <input
                className="config-buscador"
                value={edicion.notas}
                onChange={(e) => setEdicion({ ...edicion, notas: e.target.value })}
                placeholder="Pagos, acuerdos, contacto…"
              />
            </label>
          </div>
          <div className="config-fila-acciones">
            <button type="submit" className="config-btn config-btn-primario" disabled={trabajando}>
              {trabajando ? 'Un momento…' : 'Guardar'}
            </button>
            <button type="button" className="config-btn" onClick={() => setEdicion(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <datalist id="planes">
        {PLANES.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {error && <div className="cuenta-error">{error}</div>}
      {aviso && <div className="cuenta-aviso">{aviso}</div>}

      <div className="config-tabla-wrap">
        <table className="config-tabla">
          <thead>
            <tr>
              <th>Organización</th>
              <th>Administrador</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>Vence</th>
              <th>Usuarios</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargandoLista ? (
              <tr>
                <td colSpan={7}>Cargando…</td>
              </tr>
            ) : visibles.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  {filas.length === 0 ? 'Todavía no hay organizaciones.' : 'Ningún resultado con ese filtro.'}
                </td>
              </tr>
            ) : (
              visibles.map((o) => {
                const estado = estadoEfectivo(o)
                const claseEstado = estado === 'activa' ? 'ok' : estado === 'prueba' ? 'pend' : 'off'
                return (
                  <tr key={o.id} className={estado === 'suspendida' || estado === 'vencida' ? 'config-inactivo' : ''}>
                    <td>
                      {o.nombre}
                      {o.notas ? <div className="config-ayuda">{o.notas}</div> : null}
                    </td>
                    <td>{o.administradores || '—'}</td>
                    <td>{o.plan}</td>
                    <td>
                      <span className={`config-estado ${claseEstado}`}>
                        {estado === 'vencida' ? 'Vencida' : ESTADOS[estado]}
                      </span>
                    </td>
                    <td>{formatoFecha(o.vence_el)}</td>
                    <td>{o.miembros}</td>
                    <td>
                      <span className="config-iconos">
                        <button type="button" title="Editar" aria-label={`Editar ${o.nombre}`} onClick={() => abrirEdicion(o)}>
                          ✏️
                        </button>
                        <button
                          type="button"
                          title={o.estado === 'suspendida' ? 'Reactivar' : 'Suspender'}
                          aria-label={`${o.estado === 'suspendida' ? 'Reactivar' : 'Suspender'} ${o.nombre}`}
                          onClick={() => suspender(o)}
                        >
                          {o.estado === 'suspendida' ? '✅' : '🚫'}
                        </button>
                      </span>
                    </td>
                  </tr>
                )
              })
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

export default ConfigOrganizaciones
