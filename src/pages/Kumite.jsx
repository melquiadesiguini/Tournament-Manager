import { useRef, useState } from 'react'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import Timer from '../components/Timer/Timer'
import Marcador from '../components/Marcador/Marcador'
import useCountUp from '../hooks/useCountUp'
import useFullscreen from '../hooks/useFullscreen'
import '../pages/Kumite.css'

function Kumite() {
  const containerRef = useRef(null)
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef)

  const [categoria, setCategoria] = useState('')
  const [duration, setDuration] = useState(180)
  const [timerActive, setTimerActive] = useState(false)

  const [nombres, setNombres] = useState({ shiro: '', aka: '' })
  const cambiarNombre = (competidor, valor) => {
    setNombres((prev) => ({ ...prev, [competidor]: valor }))
  }
  const nombreDe = (competidor) =>
    nombres[competidor].trim() ||
    (competidor === 'shiro' ? 'SHIRO (BLANCO)' : 'AKA (ROJO)')

  const estadoVacio = () => ({ ippon: 0, nibon: 0, sanbon: 0, penalizacion: 0 })
  const [estado, setEstado] = useState({
    shiro: estadoVacio(),
    aka: estadoVacio(),
  })

  const faltasVacias = () => ({ chukoku: [], mubobi: [], jogai: [] })
  const [faltas, setFaltas] = useState({
    shiro: faltasVacias(),
    aka: faltasVacias(),
  })

  // null | 'shiro' | 'aka' | 'empate'
  const [ganador, setGanador] = useState(null)
  const [enchoSen, setEnchoSen] = useState(false)
  const [resultadoVisible, setResultadoVisible] = useState(true)

  const oponenteDe = (competidor) => (competidor === 'shiro' ? 'aka' : 'shiro')

  // Puntos que se le suman al RIVAL al marcar cada falta
  const PUNTOS_POR_FALTA = { KEIK: 1, 'H-CH': 2, HANS: 3, J2: 1, J3: 2, J4: 3 }
  const esFaltaGanadora = (columna) => columna === 'HANS' || columna === 'J4'

  // Calcular el total a partir de un objeto de estado de competidor
  const calcularTotalDesde = (estadoCompetidor) =>
    estadoCompetidor.ippon * 1 +
    estadoCompetidor.nibon * 2 +
    estadoCompetidor.sanbon * 3 +
    estadoCompetidor.penalizacion

  // Calcular totales
  const calcularTotal = (competidor) => calcularTotalDesde(estado[competidor])

  // Puntaje animado que se muestra en el cartel de ganador
  const puntajeGanadorAnimado = useCountUp(
    ganador && ganador !== 'empate' ? calcularTotal(ganador) : 0
  )

  // Si el competidor llegó a 9 puntos, queda como ganador
  const verificarGanadorPorPuntos = (competidor, estadoCompetidor) => {
    if (!ganador && calcularTotalDesde(estadoCompetidor) >= 9) {
      setGanador(competidor)
      setResultadoVisible(true)
    }
  }

  // Modificar puntos
  const modificarPunto = (competidor, tipo, valor) => {
    const nuevoValor = estado[competidor][tipo] + valor
    if (nuevoValor < 0) return

    const nuevoEstadoCompetidor = { ...estado[competidor], [tipo]: nuevoValor }
    setEstado((prev) => ({
      ...prev,
      [competidor]: nuevoEstadoCompetidor,
    }))
    verificarGanadorPorPuntos(competidor, nuevoEstadoCompetidor)
  }

  // Marcar/desmarcar una falta (permite seleccionar varias columnas por fila)
  const modificarFalta = (competidor, fila, columna) => {
    const oponente = oponenteDe(competidor)
    const yaMarcada = faltas[competidor][fila].includes(columna)
    const nuevasColumnas = yaMarcada
      ? faltas[competidor][fila].filter((c) => c !== columna)
      : [...faltas[competidor][fila], columna]

    setFaltas((prev) => ({
      ...prev,
      [competidor]: {
        ...prev[competidor],
        [fila]: nuevasColumnas,
      },
    }))

    const puntos = PUNTOS_POR_FALTA[columna] || 0
    if (puntos > 0) {
      const nuevoEstadoOponente = {
        ...estado[oponente],
        penalizacion: Math.max(
          0,
          estado[oponente].penalizacion + (yaMarcada ? -puntos : puntos)
        ),
      }
      setEstado((prev) => ({
        ...prev,
        [oponente]: nuevoEstadoOponente,
      }))
      verificarGanadorPorPuntos(oponente, nuevoEstadoOponente)
    }

    if (esFaltaGanadora(columna)) {
      setGanador(yaMarcada ? null : oponente)
      if (!yaMarcada) setResultadoVisible(true)
    }
  }

  // Al agotarse el tiempo: gana quien tenga más puntos, o empate (Encho-Sen)
  const handleTimeUp = () => {
    if (ganador) return
    const totalShiro = calcularTotal('shiro')
    const totalAka = calcularTotal('aka')
    if (totalShiro > totalAka) setGanador('shiro')
    else if (totalAka > totalShiro) setGanador('aka')
    else setGanador('empate')
    setResultadoVisible(true)
  }

  // Iniciar el combate extra en caso de empate
  const iniciarEnchoSen = () => {
    setEstado({
      shiro: estadoVacio(),
      aka: estadoVacio(),
    })
    setFaltas({
      shiro: faltasVacias(),
      aka: faltasVacias(),
    })
    setGanador(null)
    setEnchoSen(true)
    setTimerActive(false)
    setDuration(60)
  }

  // Control de cronómetro
  const controlTimer = (accion) => {
    if (accion === 'start') {
      setTimerActive(true)
    } else if (accion === 'pause') {
      setTimerActive(false)
    } else if (accion === 'reset') {
      setTimerActive(false)
      setDuration(enchoSen ? 60 : 180)
    }
  }

  const nombreResultado = (valor) => {
    if (valor === 'shiro') return nombreDe('shiro')
    if (valor === 'aka') return nombreDe('aka')
    return 'EMPATE'
  }

  // Deja el combate listo para uno nuevo (puntajes, faltas, nombres, timer y resultado)
  const resetCombate = () => {
    setEstado({
      shiro: estadoVacio(),
      aka: estadoVacio(),
    })
    setFaltas({
      shiro: faltasVacias(),
      aka: faltasVacias(),
    })
    setNombres({ shiro: '', aka: '' })
    setGanador(null)
    setEnchoSen(false)
    setResultadoVisible(true)
    setTimerActive(false)
    setDuration(180)
  }

  // Guardar el resultado del combate en el historial (sin reiniciar)
  const guardarEnHistorial = () => {
    const shiroTotal = calcularTotal('shiro')
    const akaTotal = calcularTotal('aka')
    const resultado = nombreResultado(ganador)

    const payload = {
      categoria,
      nombreShiro: nombreDe('shiro'),
      nombreAka: nombreDe('aka'),
      shiroTotal,
      akaTotal,
      ganador: resultado,
    }

    console.log('Combate guardado:', payload)
    alert(
      `¡Combate Guardado!\n\nGanador: ${resultado}\nResultado: ${nombreDe('shiro')} ${shiroTotal} - ${nombreDe('aka')} ${akaTotal}\nCategoría: ${categoria}`
    )
  }

  // Reiniciar combate (botón CANCELAR, con confirmación)
  const reiniciarCombateCompleto = () => {
    if (confirm('¿Seguro que querés reiniciar el combate actual?')) {
      resetCombate()
    }
  }

  return (
    <>
      <Header />
      <main className="kumite-container" ref={containerRef}>
        <button
          type="button"
          className="btn-fullscreen"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Ampliar a pantalla completa'}
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          {isFullscreen ? '✕' : '⛶'}
        </button>

        <div className="kumite-wrapper">
          {/* Header del Kumite */}
          <div className="kumite-header">

            <Timer
              duration={duration}
              setDuration={setDuration}
              timerActive={timerActive}
              controlTimer={controlTimer}
              onTimeUp={handleTimeUp}
            />
          </div>

          {/* Sección de Categoría */}
          <div className="kumite-controls">
            <div className="categoria-field">
              <label>CATEGORÍA</label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Nombre de la categoría"
              />
            </div>

            <div className="timer-buttons">
              <button
                onClick={() => controlTimer('start')}
                className="btn-timer btn-start"
              >
                INICIAR
              </button>
              <button
                onClick={() => controlTimer('pause')}
                className="btn-timer btn-pause"
              >
                PAUSAR
              </button>
              <button
                onClick={() => controlTimer('reset')}
                className="btn-timer btn-reset"
              >
                REINICIAR
              </button>
            </div>

            {enchoSen && <div className="encho-sen-badge">ENCHO-SEN</div>}
          </div>

          {/* Empate: se resuelve con un combate extra */}
          {ganador === 'empate' && (
            <div className="resultado-banner resultado-empate">
              <span>¡EMPATE! Se define en un combate extra.</span>
              <button className="btn-encho-sen" onClick={iniciarEnchoSen}>
                INICIAR ENCHO-SEN
              </button>
            </div>
          )}

          {/* Marcadores */}
          <div className="kumite-marcadores">
            <Marcador
              titulo="SHIRO (BLANCO)"
              tipo="shiro"
              puntos={estado.shiro}
              total={calcularTotal('shiro')}
              onModificar={modificarPunto}
              faltas={faltas.shiro}
              onFalta={modificarFalta}
              nombre={nombres.shiro}
              onNombreChange={cambiarNombre}
              color="blue"
            />
            <Marcador
              titulo="AKA (ROJO)"
              tipo="aka"
              puntos={estado.aka}
              total={calcularTotal('aka')}
              onModificar={modificarPunto}
              faltas={faltas.aka}
              onFalta={modificarFalta}
              nombre={nombres.aka}
              onNombreChange={cambiarNombre}
              color="red"
            />
          </div>

          {/* Botones finales */}
          <div className="kumite-footer">
            <button
              onClick={reiniciarCombateCompleto}
              className="btn-cancelar"
            >
              CANCELAR
            </button>
            <button
              onClick={resetCombate}
              className="btn-guardar"
            >
              INICIAR NUEVO COMBATE
            </button>
          </div>
        </div>

        {/* Cartel de ganador */}
        {ganador && ganador !== 'empate' && resultadoVisible && (
          <div
            className="resultado-overlay"
            onClick={() => setResultadoVisible(false)}
          >
            <div
              className={`resultado-board ${ganador === 'shiro' ? 'marcador-blue' : 'marcador-red'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="resultado-close"
                onClick={() => setResultadoVisible(false)}
                aria-label="Cerrar"
              >
                &times;
              </button>

              <div className="resultado-nombre-badge">{nombreDe(ganador)}</div>

              <div className="resultado-cards">
                <div className="resultado-card">
                  <div className="resultado-card-icono">🏆</div>
                  <div className="resultado-card-label">Puntaje Final</div>
                  <div className="resultado-card-valor">{Math.round(puntajeGanadorAnimado)}</div>
                </div>
              </div>

              <p className="resultado-vs">
                vs {nombreDe(oponenteDe(ganador))}: {calcularTotal(oponenteDe(ganador))}
              </p>

              <div className="resultado-acciones">
                <button className="btn-save" onClick={guardarEnHistorial}>
                  💾 Guardar en Historial
                </button>
                <button className="btn-new" onClick={resetCombate}>
                  ➕ Iniciar Nuevo Combate
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}

export default Kumite;