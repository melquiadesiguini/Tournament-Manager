import { useEffect, useMemo, useState } from 'react'
import useAuth from '../hooks/useAuth'
import ConfigPagina from './ConfigPagina'
import { actualizarResultado, borrarResultado, listarResultados } from '../lib/resultados'
import EditorResultado from '../components/EditorResultado/EditorResultado'
import { listarTorneos } from '../lib/torneos'
import { COLUMNAS_JUECES, NOMBRES_MODULO, exportarCsv, exportarXlsx, filaDeResultado } from '../lib/historial'

// Cuántos resultados se cargan como máximo (los más recientes)
const LIMITE = 2000

// Un juez en su columna: puntaje (tachado si no contó para el total) y nombre; vacío si no actuó
function CeldaJuez({ juez }) {
  if (!juez) return <span className="historial-vacio">—</span>
  return (
    <>
      <strong className={juez.incluido === false ? 'historial-descartado' : undefined}>{Number(juez.puntaje).toFixed(1)}</strong>
      {juez.nombre && <div className="historial-nombre-juez">{juez.nombre}</div>}
    </>
  )
}

// Resultados guardados en la nube para la organización del usuario
function ConfigHistorial() {
  const { user, puedeVerHistorial, puede } = useAuth()
  const puedeEditar = puede('editar_historial')
  const [estado, setEstado] = useState({ cargando: true, resultados: [], error: false })
  const [modulo, setModulo] = useState('')
  const [torneoFiltro, setTorneoFiltro] = useState('') // '' = todos, 'ninguno' = sin torneo, o el id de un torneo
  const [torneos, setTorneos] = useState([])
  const [exportando, setExportando] = useState(false)
  const [errorExportar, setErrorExportar] = useState('')
  const [edicion, setEdicion] = useState(null) // fila guardada que se está corrigiendo
  const [porBorrar, setPorBorrar] = useState(null)
  const [aviso, setAviso] = useState('')
  const [errorAccion, setErrorAccion] = useState('')

  useEffect(() => {
    if (!user || !puedeVerHistorial) return undefined
    let activo = true
    listarResultados(LIMITE).then((r) => {
      if (activo) setEstado({ cargando: false, resultados: r.resultados, error: !r.ok })
    })
    listarTorneos().then((r) => {
      if (activo) setTorneos(r.filas)
    })
    return () => {
      activo = false
    }
  }, [user, puedeVerHistorial])

  const filas = useMemo(() => {
    const nombres = Object.fromEntries(torneos.map((t) => [t.id, t.nombre]))
    return estado.resultados
      .map((r) => filaDeResultado(r, nombres))
      .filter((f) => !modulo || f.modulo === modulo)
      .filter((f) => !torneoFiltro || (torneoFiltro === 'ninguno' ? f.torneoId === null : f.torneoId === torneoFiltro))
  }, [estado.resultados, torneos, modulo, torneoFiltro])

  const recargar = () => listarResultados(LIMITE).then((r) => setEstado({ cargando: false, resultados: r.resultados, error: !r.ok }))

  // Guarda la corrección; si sale bien, cierra el formulario y vuelve a leer el historial
  const guardarCorreccion = async (cambios) => {
    const r = await actualizarResultado(edicion.tabla, edicion.id, cambios)
    if (r.ok) {
      setEdicion(null)
      setAviso('Resultado corregido. Quedó anotado en la auditoría.')
      setErrorAccion('')
      await recargar()
    }
    return r
  }

  const borrar = async (f) => {
    setPorBorrar(null)
    setAviso('')
    const r = await borrarResultado(f.tabla, f.id)
    if (r.ok) {
      setErrorAccion('')
      setAviso('Resultado borrado. Quedó una copia en la auditoría.')
      await recargar()
    } else setErrorAccion(r.mensaje)
  }

  const exportar = async (formato) => {
    setErrorExportar('')
    setExportando(true)
    try {
      if (formato === 'xlsx') await exportarXlsx(filas)
      else exportarCsv(filas)
    } catch {
      setErrorExportar('No se pudo generar el archivo. Probá de nuevo.')
    }
    setExportando(false)
  }

  let contenido
  if (estado.cargando) {
    contenido = <p className="cuenta-nota">Cargando resultados…</p>
  } else if (estado.error) {
    contenido = <div className="cuenta-error">No se pudo cargar el historial.</div>
  } else if (estado.resultados.length === 0) {
    contenido = <p className="cuenta-nota">Todavía no hay resultados guardados.</p>
  } else {
    contenido = (
      <>
        <div className="config-barra">
          <select value={torneoFiltro} onChange={(e) => setTorneoFiltro(e.target.value)} aria-label="Torneo">
            <option value="">Todos los torneos</option>
            {torneos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
            <option value="ninguno">Sin torneo</option>
          </select>
          <select value={modulo} onChange={(e) => setModulo(e.target.value)} aria-label="Módulo">
            <option value="">Todos los módulos</option>
            {Object.entries(NOMBRES_MODULO).map(([clave, texto]) => (
              <option key={clave} value={clave}>
                {texto}
              </option>
            ))}
          </select>
          <button type="button" className="config-btn config-btn-primario" disabled={exportando || filas.length === 0} onClick={() => exportar('xlsx')}>
            Exportar Excel (.xlsx)
          </button>
          <button type="button" className="config-btn" disabled={exportando || filas.length === 0} onClick={() => exportar('csv')}>
            Exportar CSV
          </button>
        </div>
        <p className="config-ayuda">
          {filas.length} {filas.length === 1 ? 'resultado' : 'resultados'}
          {estado.resultados.length >= LIMITE ? ` (se muestran los ${LIMITE} más recientes)` : ''}. La exportación incluye lo que ves en
          pantalla. Cuando se usan 3 jueces, las columnas de los jueces que no actuaron quedan vacías.
        </p>
        {errorExportar && <div className="cuenta-error">{errorExportar}</div>}
        {aviso && <div className="cuenta-aviso">{aviso}</div>}
        {errorAccion && <div className="cuenta-error">{errorAccion}</div>}

        {edicion && (
          <EditorResultado
            key={edicion.id}
            resultado={edicion}
            torneos={torneos}
            alGuardar={guardarCorreccion}
            alCancelar={() => setEdicion(null)}
          />
        )}

        <div className="historial-tabla-wrap">
          <table className="historial-tabla">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Torneo</th>
                <th>Módulo</th>
                <th>Área</th>
                <th>Ronda</th>
                <th>Competidor</th>
                <th>Kata / categoría</th>
                <th>Jueces</th>
                {COLUMNAS_JUECES.map((c) => (
                  <th key={c}>{c}</th>
                ))}
                <th>Responsable de mesa</th>
                <th>Resultado</th>
                {puedeEditar && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td>
                    {f.fecha.toLocaleString('es-AR')}
                    {f.editadoEn && (
                      <div className="historial-nombre-juez" title={`Corregido el ${f.editadoEn.toLocaleString('es-AR')}`}>
                        corregido
                      </div>
                    )}
                  </td>
                  <td>{f.torneo || '—'}</td>
                  <td>{f.moduloTexto}</td>
                  <td>{f.area ?? '—'}</td>
                  <td>{f.ronda ?? '—'}</td>
                  <td>{f.competidor || '—'}</td>
                  <td>{f.detalle || '—'}</td>
                  <td>{f.sistema ?? '—'}</td>
                  {f.jueces.map((j, i) => (
                    <td key={COLUMNAS_JUECES[i]}>
                      <CeldaJuez juez={j} />
                    </td>
                  ))}
                  <td>{f.responsable || '—'}</td>
                  <td>{f.puntajeFinal !== null ? f.puntajeFinal.toFixed(2) : f.resultadoKumite || '—'}</td>
                  {puedeEditar && (
                    <td>
                      <span className="config-iconos">
                        <button
                          type="button"
                          title="Corregir"
                          aria-label={`Corregir el resultado de ${f.competidor || 'este competidor'}`}
                          onClick={() => {
                            setAviso('')
                            setErrorAccion('')
                            setEdicion(f.bruto)
                          }}
                        >
                          ✏️
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
                            aria-label={`Borrar el resultado de ${f.competidor || 'este competidor'}`}
                            onClick={() => setPorBorrar(f.id)}
                          >
                            🗑️
                          </button>
                        )}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  return (
    <ConfigPagina titulo="Historial" permiso="ver_historial">
      {contenido}
    </ConfigPagina>
  )
}

export default ConfigHistorial
