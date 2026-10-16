import { useEffect, useState } from 'react'
import useAuth from '../hooks/useAuth'
import ConfigPagina from './ConfigPagina'
import { borrarTorneo, cambiarEstadoTorneo, crearTorneo, editarTorneo, ESTADOS_TORNEO, listarTorneos } from '../lib/torneos'

const PERMISO = 'crear_torneos'
const VACIO = { nombre: '', fecha: '', estado: 'borrador' }

const fechaLegible = (f) => (f ? new Date(`${f}T00:00:00`).toLocaleDateString('es-AR') : '—')

// Torneos de la organización: sirven para asignar roles por torneo (Configuración → Usuarios)
function ConfigTorneos() {
  const { user, puede } = useAuth()
  const permitido = puede(PERMISO)
  const [filas, setFilas] = useState([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [edicion, setEdicion] = useState(null) // { id|null, valores }
  const [trabajando, setTrabajando] = useState(false)
  const [porBorrar, setPorBorrar] = useState(null)
  const [porCerrar, setPorCerrar] = useState(null)
  const [error, setError] = useState('')

  const recargar = () => listarTorneos().then((r) => setFilas(r.filas))

  useEffect(() => {
    if (!user || !permitido) return undefined
    let activo = true
    listarTorneos().then((r) => {
      if (!activo) return
      setFilas(r.filas)
      setCargandoLista(false)
    })
    return () => {
      activo = false
    }
  }, [user, permitido])

  const ejecutar = async (promesa) => {
    setError('')
    const r = await promesa
    if (!r.ok) {
      setError(r.mensaje)
      return false
    }
    await recargar()
    return true
  }

  const guardar = async (e) => {
    e.preventDefault()
    setTrabajando(true)
    const ok = await ejecutar(edicion.id ? editarTorneo(edicion.id, edicion.valores) : crearTorneo(edicion.valores))
    setTrabajando(false)
    if (ok) setEdicion(null)
  }

  const cambiar = (campo, valor) => setEdicion({ ...edicion, valores: { ...edicion.valores, [campo]: valor } })

  return (
    <ConfigPagina titulo="Torneos" permiso={PERMISO}>
      <div className="config-barra">
        <button type="button" className="config-btn config-btn-primario" onClick={() => setEdicion({ id: null, valores: VACIO })}>
          + Nuevo torneo
        </button>
      </div>
      <p className="config-ayuda">
        Los resultados se guardan siempre en el torneo <strong>abierto</strong>: hay uno solo por vez. Cuando termina, lo cerrás
        y abrís el siguiente. Sin un torneo abierto no se pueden cargar resultados. También podés asignar a cada usuario un rol
        solo para un torneo (y, si querés, para un área).
      </p>

      {edicion && (
        <form className="config-previa" onSubmit={guardar}>
          <p>
            <strong>{edicion.id ? 'Editar torneo' : 'Nuevo torneo'}</strong>
          </p>
          <div className="config-formulario">
            <label>
              Nombre
              <input
                className="config-buscador"
                required
                maxLength={120}
                autoFocus
                value={edicion.valores.nombre}
                onChange={(e) => cambiar('nombre', e.target.value)}
              />
            </label>
            <label>
              Fecha
              <input
                className="config-buscador"
                type="date"
                value={edicion.valores.fecha}
                onChange={(e) => cambiar('fecha', e.target.value)}
              />
            </label>
            <label>
              Estado
              <select className="config-buscador" value={edicion.valores.estado} onChange={(e) => cambiar('estado', e.target.value)}>
                {Object.entries(ESTADOS_TORNEO).map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="config-fila-acciones">
            <button type="submit" className="config-btn config-btn-primario" disabled={trabajando}>
              Guardar
            </button>
            <button type="button" className="config-btn" onClick={() => setEdicion(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && <div className="cuenta-error">{error}</div>}

      <div className="config-tabla-wrap">
        <table className="config-tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargandoLista ? (
              <tr>
                <td colSpan={4}>Cargando…</td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={4}>Todavía no hay torneos. Creá el primero.</td>
              </tr>
            ) : (
              filas.map((t) => (
                <tr key={t.id}>
                  <td>{t.nombre}</td>
                  <td>{fechaLegible(t.fecha)}</td>
                  <td>
                    <span className={`config-estado ${t.estado === 'activo' ? 'ok' : t.estado === 'borrador' ? 'pend' : 'off'}`}>
                      {ESTADOS_TORNEO[t.estado]}
                    </span>
                  </td>
                  <td>
                    {t.estado === 'activo' ? (
                      porCerrar === t.id ? (
                        <span className="config-iconos">
                          <span className="config-confirmar">¿Cerrar? Ya no se podrá cargar en él.</span>
                          <button
                            type="button"
                            className="config-confirmar-si"
                            onClick={() => {
                              setPorCerrar(null)
                              ejecutar(cambiarEstadoTorneo(t.id, 'finalizado'))
                            }}
                          >
                            Sí
                          </button>
                          <button type="button" onClick={() => setPorCerrar(null)}>
                            No
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="config-btn config-btn-chico" onClick={() => setPorCerrar(t.id)}>
                          Cerrar torneo
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        className="config-btn config-btn-chico config-btn-primario"
                        onClick={() => ejecutar(cambiarEstadoTorneo(t.id, 'activo'))}
                      >
                        {t.estado === 'finalizado' ? 'Reabrir' : 'Abrir'}
                      </button>
                    )}{' '}
                    <span className="config-iconos">
                      <button
                        type="button"
                        title="Editar"
                        aria-label={`Editar ${t.nombre}`}
                        onClick={() => setEdicion({ id: t.id, valores: { nombre: t.nombre, fecha: t.fecha ?? '', estado: t.estado } })}
                      >
                        ✏️
                      </button>
                      {porBorrar === t.id ? (
                        <>
                          <span className="config-confirmar">¿Borrar? Se quitan sus asignaciones.</span>
                          <button
                            type="button"
                            className="config-confirmar-si"
                            onClick={() => {
                              setPorBorrar(null)
                              ejecutar(borrarTorneo(t.id))
                            }}
                          >
                            Sí
                          </button>
                          <button type="button" onClick={() => setPorBorrar(null)}>
                            No
                          </button>
                        </>
                      ) : (
                        <button type="button" title="Borrar" aria-label={`Borrar ${t.nombre}`} onClick={() => setPorBorrar(t.id)}>
                          🗑️
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ConfigPagina>
  )
}

export default ConfigTorneos
