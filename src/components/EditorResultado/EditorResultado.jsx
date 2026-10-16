import { useState } from 'react'
import { calcularDeValores, cambiosDesdeValores, validar, valoresIniciales } from '../../lib/editarResultado'

// Formulario para corregir un resultado del historial (jurado o kumite). Usa las clases de Configuración.
//   resultado: la fila guardada (con `tabla`)   alGuardar(cambios): async, devuelve { ok, mensaje }   alCancelar()
function EditorResultado({ resultado, torneos = [], alGuardar, alCancelar }) {
  const [v, setV] = useState(() => valoresIniciales(resultado))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cambiar = (campo, valor) => setV((prev) => ({ ...prev, [campo]: valor }))
  const cambiarJuez = (posicion, campo, valor) =>
    setV((prev) => ({ ...prev, jueces: prev.jueces.map((j) => (j.posicion === posicion ? { ...j, [campo]: valor } : j)) }))

  const esKumite = v.tabla === 'kumite'
  const calculo = esKumite ? null : calcularDeValores(v)

  const guardar = async (e) => {
    e.preventDefault()
    const problema = validar(v)
    if (problema) return setError(problema)
    setError('')
    setGuardando(true)
    const r = await alGuardar(cambiosDesdeValores(v))
    setGuardando(false)
    if (!r.ok) setError(r.mensaje)
  }

  const selectorTorneo = torneos.length > 0 && (
    <label>
      Torneo
      <select className="config-buscador" value={v.torneoId} onChange={(e) => cambiar('torneoId', e.target.value)}>
        <option value="">Sin torneo</option>
        {torneos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>
    </label>
  )

  const campo = (etiqueta, valor, alCambiar, extra = {}) => (
    <label>
      {etiqueta}
      <input className="config-buscador" value={valor} onChange={(e) => alCambiar(e.target.value)} {...extra} />
    </label>
  )

  return (
    <form className="config-previa" onSubmit={guardar}>
      <p>
        <strong>Corregir resultado</strong>
      </p>
      <p className="config-ayuda">
        Cada corrección queda registrada con tu nombre y la fecha, junto con cómo era el resultado antes. Lo que se
        cargó originalmente (quién, cuándo, módulo y sistema de jueces) no se puede cambiar.
      </p>

      {esKumite ? (
        <div className="config-formulario">
          {selectorTorneo}
          {campo('Shiro (nombre)', v.nombreShiro, (x) => cambiar('nombreShiro', x), { maxLength: 80 })}
          {campo('Puntaje de Shiro', v.puntajeShiro, (x) => cambiar('puntajeShiro', x), { type: 'number', step: 1, required: true })}
          {campo('Aka (nombre)', v.nombreAka, (x) => cambiar('nombreAka', x), { maxLength: 80 })}
          {campo('Puntaje de Aka', v.puntajeAka, (x) => cambiar('puntajeAka', x), { type: 'number', step: 1, required: true })}
          <label>
            Ganador
            <select className="config-buscador" value={v.lado} onChange={(e) => cambiar('lado', e.target.value)}>
              <option value="shiro">Shiro</option>
              <option value="aka">Aka</option>
              <option value="empate">Empate</option>
            </select>
          </label>
          {campo('Categoría', v.categoria, (x) => cambiar('categoria', x), { maxLength: 80 })}
          {campo('Área', v.area, (x) => cambiar('area', x), { type: 'number', min: 0, max: 999 })}
          {campo('Responsable de mesa', v.responsable, (x) => cambiar('responsable', x), { maxLength: 60 })}
        </div>
      ) : (
        <>
          <div className="config-formulario">
            {selectorTorneo}
            {campo(v.modulo === 'destreza' ? 'Equipo' : 'Competidor', v.competidor, (x) => cambiar('competidor', x), { maxLength: 80, required: true })}
            {v.modulo !== 'destreza' && campo('Kata', v.kata, (x) => cambiar('kata', x), { maxLength: 80 })}
            {campo('Área', v.area, (x) => cambiar('area', x), { type: 'number', min: 0, max: 999 })}
            {campo('Ronda', v.ronda, (x) => cambiar('ronda', x), { type: 'number', min: 1, max: 999 })}
            {campo('Responsable de mesa', v.responsable, (x) => cambiar('responsable', x), { maxLength: 60 })}
          </div>

          <p className="config-ayuda">Jueces ({v.sistema} jueces): nombre y puntaje de cada uno.</p>
          <div className="config-formulario">
            {v.jueces.map((j) => (
              <fieldset key={j.posicion} className="editor-juez">
                <legend>{j.etiqueta}</legend>
                <input
                  className="config-buscador"
                  placeholder="Nombre del juez"
                  aria-label={`Nombre de ${j.etiqueta}`}
                  maxLength={80}
                  value={j.nombre}
                  onChange={(e) => cambiarJuez(j.posicion, 'nombre', e.target.value)}
                />
                <input
                  className="config-buscador"
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  required
                  aria-label={`Puntaje de ${j.etiqueta}`}
                  value={j.puntaje}
                  onChange={(e) => cambiarJuez(j.posicion, 'puntaje', e.target.value)}
                />
                {calculo.descartados.includes(j.posicion) && <span className="config-ayuda">No cuenta para el total</span>}
              </fieldset>
            ))}
          </div>
          <p>
            Puntaje final: <strong>{calculo.final === null ? '—' : calculo.final.toFixed(2)}</strong>{' '}
            <span className="config-ayuda">(se recalcula solo con las mismas reglas que al cargarlo)</span>
          </p>
        </>
      )}

      {error && <div className="cuenta-error">{error}</div>}
      <div className="config-fila-acciones">
        <button type="submit" className="config-btn config-btn-primario" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar corrección'}
        </button>
        <button type="button" className="config-btn" onClick={alCancelar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default EditorResultado
