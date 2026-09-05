import { useState } from 'react'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import Timer from '../components/Timer/Timer'
import Marcador from '../components/Marcador/Marcador'
import '../pages/Kumite.css'

function Kumite() {
  const [categoria, setCategoria] = useState('')
  const [combateNum, setCombateNum] = useState(12)
  const [duration, setDuration] = useState(180)
  const [timerActive, setTimerActive] = useState(false)

  const [estado, setEstado] = useState({
    shiro: { ippon: 0, nibon: 0, sanbon: 0 },
    aka: { ippon: 0, nibon: 0, sanbon: 0 },
  })

  // Calcular totales
  const calcularTotal = (competidor) => {
    return (
      estado[competidor].ippon * 1 +
      estado[competidor].nibon * 2 +
      estado[competidor].sanbon * 3
    )
  }

  // Modificar puntos
  const modificarPunto = (competidor, tipo, valor) => {
    setEstado((prev) => {
      const nuevoValor = prev[competidor][tipo] + valor
      if (nuevoValor >= 0) {
        return {
          ...prev,
          [competidor]: {
            ...prev[competidor],
            [tipo]: nuevoValor,
          },
        }
      }
      return prev
    })
  }

  // Control de cronómetro
  const controlTimer = (accion) => {
    if (accion === 'start') {
      setTimerActive(true)
    } else if (accion === 'pause') {
      setTimerActive(false)
    } else if (accion === 'reset') {
      setTimerActive(false)
      setDuration(180)
    }
  }

  // Guardar combate
  const guardarSimulacion = () => {
    const shiroTotal = calcularTotal('shiro')
    const akaTotal = calcularTotal('aka')
    let ganador = 'EMPATE'
    if (shiroTotal > akaTotal) ganador = 'SHIRO (BLANCO)'
    if (akaTotal > shiroTotal) ganador = 'AKA (ROJO)'

    const payload = {
      categoria,
      combateNum,
      shiroTotal,
      akaTotal,
      ganador,
    }

    console.log('Combate guardado:', payload)
    alert(
      `¡Combate Guardado!\n\nGanador: ${ganador}\nResultado: Shiro ${shiroTotal} - Aka ${akaTotal}\nCategoría: ${categoria}`
    )
  }

  // Reiniciar combate
  const reiniciarCombateCompleto = () => {
    if (confirm('¿Seguro que querés reiniciar el combate actual?')) {
      setEstado({
        shiro: { ippon: 0, nibon: 0, sanbon: 0 },
        aka: { ippon: 0, nibon: 0, sanbon: 0 },
      })
      controlTimer('reset')
    }
  }

  return (
    <>
      <Header />
      <main className="kumite-container">
        <div className="kumite-wrapper">
          {/* Header del Kumite */}
          <div className="kumite-header">

            <Timer
              duration={duration}
              setDuration={setDuration}
              timerActive={timerActive}
              controlTimer={controlTimer}
              categoria={categoria}
              setCategoria={setCategoria}
            />
          </div>

          {/* Sección de Categoría y Combate */}
          <div className="kumite-controls">
            <div>
              <label>CATEGORÍA</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                <option>Senior Masculino -75kg</option>
                <option>Senior Femenino -61kg</option>
                <option>Junior Masculino</option>
              </select>
            </div>
            <div>
              <label>COMBATE Nº</label>
              <input
                type="number"
                value={combateNum}
                onChange={(e) => setCombateNum(e.target.value)}
              />
            </div>
          </div>

          {/* Marcadores */}
          <div className="kumite-marcadores">
            <Marcador
              titulo="SHIRO (BLANCO)"
              tipo="shiro"
              puntos={estado.shiro}
              total={calcularTotal('shiro')}
              onModificar={modificarPunto}
              color="blue"
            />
            <Marcador
              titulo="AKA (ROJO)"
              tipo="aka"
              puntos={estado.aka}
              total={calcularTotal('aka')}
              onModificar={modificarPunto}
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
              onClick={guardarSimulacion}
              className="btn-guardar"
            >
              FINALIZAR Y GUARDAR
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default Kumite;