import { useEffect, useMemo, useRef, useState } from 'react'
import useAuth from '../hooks/useAuth'
import ConfigPagina from './ConfigPagina'
import {
  actualizarPersona,
  agregarPersona,
  borrarPersona,
  editarPersona,
  importarPersonas,
  listarPersonas,
} from '../lib/personas'
import { CAMPOS_PERSONAS } from '../lib/camposPersonas'
import { leerPersonasDeArchivo } from '../lib/leerNombres'
import { descargarEjemplo } from '../lib/ejemplos'

const vacio = (campos) => Object.fromEntries(campos.map((c) => [c.clave, c.tipo === 'booleano' ? false : '']))

// Texto con que se muestra un valor en la tabla
const mostrar = (campo, valor) => (campo.tipo === 'booleano' ? (valor ? 'SÍ' : 'NO') : valor || '—')

// Lista administrable de jueces o competidores (tabla: 'jueces' | 'competidores'): buscar,
// filtrar por estado, agregar, editar, activar/desactivar, borrar e importar desde Excel.
function ConfigPersonas({ tabla, titulo, permiso }) {
  const { user, puede } = useAuth()
  const permitido = puede(permiso)
  const config = CAMPOS_PERSONAS[tabla]
  const { campos, singular, plural } = config
  const cantidad = (n) => `${n} ${n === 1 ? singular : plural}`
  const columnas = campos.length + 3 // # + campos + estado + acciones

  const [filas, setFilas] = useState([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [edicion, setEdicion] = useState(null) // { id|null, valores }
  const [previa, setPrevia] = useState(null) // { archivo, personas }
  const [trabajando, setTrabajando] = useState(false)
  const [porBorrar, setPorBorrar] = useState(null) // id de la fila que espera confirmación
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const inputArchivo = useRef(null)

  const recargar = () => listarPersonas(tabla).then((r) => setFilas(r.filas))

  useEffect(() => {
    if (!user || !permitido) return undefined
    let activo = true
    listarPersonas(tabla).then((r) => {
      if (!activo) return
      setFilas(r.filas)
      setCargandoLista(false)
    })
    return () => {
      activo = false
    }
  }, [user, permitido, tabla])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filas.filter((f) => {
      if (filtroEstado === 'activo' && !f.activo) return false
      if (filtroEstado === 'inactivo' && f.activo) return false
      if (!q) return true
      return campos.some((c) => c.tipo === 'texto' && String(f[c.clave] ?? '').toLowerCase().includes(q))
    })
  }, [filas, busqueda, filtroEstado, campos])

  const resultado = async (promesa, ok) => {
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

  const guardarEdicion = async (e) => {
    e.preventDefault()
    setTrabajando(true)
    const ok = await resultado(
      edicion.id ? editarPersona(tabla, edicion.id, edicion.valores) : agregarPersona(tabla, edicion.valores)
    )
    setTrabajando(false)
    if (ok) setEdicion(null)
  }

  const elegirArchivo = async (e) => {
    const f = e.target.files?.[0]
    setError('')
    setAviso('')
    setPrevia(null)
    if (!f) return
    try {
      const personas = await leerPersonasDeArchivo(f, config)
      if (personas.length === 0) {
        setError('No se encontró ninguna fila válida en el archivo.')
        return
      }
      setPrevia({ archivo: f.name, personas })
    } catch (err) {
      setError(err.message || 'No se pudo leer el archivo.')
    }
  }

  const cancelarImportacion = () => {
    setPrevia(null)
    if (inputArchivo.current) inputArchivo.current.value = ''
  }

  const claveDe = (p) => config.claveUnica.map((k) => String(p[k] ?? '').toLowerCase()).join('|')

  const importar = async () => {
    setTrabajando(true)
    setError('')
    const existentes = new Set(filas.map(claveDe))
    const nuevos = previa.personas.filter((p) => !existentes.has(claveDe(p))).length
    const r = await importarPersonas(tabla, previa.personas)
    setTrabajando(false)
    if (!r.ok) {
      setError(r.mensaje)
      return
    }
    const actualizados = previa.personas.length - nuevos
    setAviso(
      `Importación lista: ${nuevos === 1 ? '1 nuevo' : `${nuevos} nuevos`}` +
        (actualizados ? ` y ${actualizados === 1 ? '1 actualizado' : `${actualizados} actualizados`} con los datos del archivo.` : '.')
    )
    cancelarImportacion()
    recargar()
  }

  const borrar = async (f) => {
    setPorBorrar(null)
    await resultado(borrarPersona(tabla, f.id))
  }

  const nombreCompleto = (f) => [f.nombre, f.apellido].filter(Boolean).join(' ')

  return (
    <ConfigPagina titulo={titulo} permiso={permiso}>
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
        <button
          type="button"
          className="config-btn config-btn-primario"
          onClick={() => setEdicion({ id: null, valores: vacio(campos) })}
        >
          + Agregar
        </button>
        <label className="config-btn">
          Importar Excel
          <input ref={inputArchivo} type="file" accept=".xlsx,.csv,.txt" onChange={elegirArchivo} hidden />
        </label>
        <button type="button" className="config-btn" onClick={() => descargarEjemplo(config)}>
          Descargar ejemplo
        </button>
      </div>

      <p className="config-ayuda">
        Columnas del Excel (.xlsx) o .csv: {config.ejemplo.encabezados.join(', ')}. Se detectan por el encabezado de la
        primera fila. Si un {singular} ya existe, se actualizan sus datos con los del archivo.
      </p>

      {previa && (
        <div className="config-previa">
          <p>
            <strong>{previa.archivo}</strong>: {cantidad(previa.personas.length)} para importar
          </p>
          <p className="config-ayuda">
            {previa.personas
              .slice(0, 6)
              .map((p) => nombreCompleto(p))
              .join(' · ')}
            {previa.personas.length > 6 ? ` … y ${previa.personas.length - 6} más` : ''}
          </p>
          <div className="config-fila-acciones">
            <button type="button" className="config-btn config-btn-primario" onClick={importar} disabled={trabajando}>
              {trabajando ? 'Importando…' : 'Importar'}
            </button>
            <button type="button" className="config-btn" onClick={cancelarImportacion} disabled={trabajando}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {edicion && (
        <form className="config-previa" onSubmit={guardarEdicion}>
          <p>
            <strong>{edicion.id ? `Editar ${singular}` : `Agregar ${singular}`}</strong>
          </p>
          <div className="config-formulario">
            {campos.map((c, n) =>
              c.tipo === 'booleano' ? (
                <label key={c.clave} className="config-check">
                  <input
                    type="checkbox"
                    checked={edicion.valores[c.clave]}
                    onChange={(e) => setEdicion({ ...edicion, valores: { ...edicion.valores, [c.clave]: e.target.checked } })}
                  />
                  {c.etiqueta}
                </label>
              ) : (
                <label key={c.clave}>
                  {c.etiqueta}
                  <input
                    className="config-buscador"
                    required={c.requerido}
                    autoFocus={n === 0}
                    value={edicion.valores[c.clave]}
                    onChange={(e) => setEdicion({ ...edicion, valores: { ...edicion.valores, [c.clave]: e.target.value } })}
                  />
                </label>
              )
            )}
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
      {aviso && <div className="cuenta-aviso">{aviso}</div>}

      <div className="config-tabla-wrap">
        <table className="config-tabla">
          <thead>
            <tr>
              <th>#</th>
              {campos.map((c) => (
                <th key={c.clave}>{c.etiqueta}</th>
              ))}
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargandoLista ? (
              <tr>
                <td colSpan={columnas}>Cargando…</td>
              </tr>
            ) : visibles.length === 0 ? (
              <tr>
                <td colSpan={columnas}>
                  {filas.length === 0
                    ? `Todavía no hay ${plural}. Agregá uno o importá un Excel.`
                    : 'Ningún resultado con ese filtro.'}
                </td>
              </tr>
            ) : (
              visibles.map((f, i) => (
                <tr key={f.id} className={f.activo ? '' : 'config-inactivo'}>
                  <td>{i + 1}</td>
                  {campos.map((c) => (
                    <td key={c.clave}>{mostrar(c, f[c.clave])}</td>
                  ))}
                  <td>
                    <span className={`config-estado ${f.activo ? 'ok' : 'off'}`}>{f.activo ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td>
                    <span className="config-iconos">
                      <button
                        type="button"
                        title="Editar"
                        aria-label={`Editar a ${nombreCompleto(f)}`}
                        onClick={() =>
                          setEdicion({
                            id: f.id,
                            valores: Object.fromEntries(
                              campos.map((c) => [c.clave, c.tipo === 'booleano' ? Boolean(f[c.clave]) : (f[c.clave] ?? '')])
                            ),
                          })
                        }
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        title={f.activo ? 'Desactivar' : 'Activar'}
                        aria-label={`${f.activo ? 'Desactivar' : 'Activar'} a ${nombreCompleto(f)}`}
                        onClick={() => resultado(actualizarPersona(tabla, f.id, { activo: !f.activo }))}
                      >
                        {f.activo ? '🚫' : '✅'}
                      </button>
                      {porBorrar === f.id ? (
                        <>
                          <span className="config-confirmar">¿Borrar?</span>
                          <button type="button" className="config-confirmar-si" onClick={() => borrar(f)}>
                            Sí
                          </button>
                          <button type="button" onClick={() => setPorBorrar(null)}>
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          title="Borrar"
                          aria-label={`Borrar a ${nombreCompleto(f)}`}
                          onClick={() => setPorBorrar(f.id)}
                        >
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
      <p className="config-ayuda">
        {visibles.length} de {filas.length}
      </p>
    </ConfigPagina>
  )
}

export default ConfigPersonas
