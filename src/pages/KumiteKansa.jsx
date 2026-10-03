import { useState } from 'react'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import Marcador from '../components/Marcador/Marcador'
import './Kumite.css'
import './KumiteModo.css'

const estadoVacio = () => ({ ippon: 0, nibon: 0, sanbon: 0, penalizacion: 0 })
const faltasVacias = () => ({ chukoku: [], mubobi: [], jogai: [] })

// Puntos que se le suman al RIVAL al marcar cada falta (igual que en la Mesa)
const PUNTOS_POR_FALTA = { KEIK: 1, 'H-CH': 2, HANS: 3, J2: 1, J3: 2, J4: 3 }

const oponenteDe = (competidor) => (competidor === 'shiro' ? 'aka' : 'shiro')

const totalDe = (e) => e.ippon + e.nibon * 2 + e.sanbon * 3 + e.penalizacion

// Vista de Kansa: el mismo tablero de anotación que la Mesa (puntos, faltas y
// SHIKAKU / KIKEN / ORDEN MÉDICA), pero solo para anotar. Es independiente de
// la Mesa: lo que se marca acá no modifica el tablero de la Mesa, no hay
// cronómetro ni cartel de ganador.
function KumiteKansa() {
  const [estado, setEstado] = useState({ shiro: estadoVacio(), aka: estadoVacio() })
  const [faltas, setFaltas] = useState({ shiro: faltasVacias(), aka: faltasVacias() })
  const [nombres, setNombres] = useState({ shiro: '', aka: '' })
  // null | { competidor, motivo }
  const [salida, setSalida] = useState(null)

  const cambiarNombre = (competidor, valor) => {
    setNombres((prev) => ({ ...prev, [competidor]: valor }))
  }

  const modificarPunto = (competidor, tipo, valor) => {
    const nuevoValor = estado[competidor][tipo] + valor
    if (nuevoValor < 0) return
    setEstado((prev) => ({
      ...prev,
      [competidor]: { ...prev[competidor], [tipo]: nuevoValor },
    }))
  }

  // Marcar/desmarcar una falta (varias columnas por fila); la falta le suma al rival
  const modificarFalta = (competidor, fila, columna) => {
    const oponente = oponenteDe(competidor)
    const yaMarcada = faltas[competidor][fila].includes(columna)
    const nuevasColumnas = yaMarcada
      ? faltas[competidor][fila].filter((c) => c !== columna)
      : [...faltas[competidor][fila], columna]

    setFaltas((prev) => ({
      ...prev,
      [competidor]: { ...prev[competidor], [fila]: nuevasColumnas },
    }))

    const puntos = PUNTOS_POR_FALTA[columna] || 0
    if (puntos > 0) {
      setEstado((prev) => ({
        ...prev,
        [oponente]: {
          ...prev[oponente],
          penalizacion: Math.max(0, prev[oponente].penalizacion + (yaMarcada ? -puntos : puntos)),
        },
      }))
    }
  }

  // Solo anota la salida elegida (se desmarca al tocarla de nuevo)
  const modificarSalida = (competidor, motivo) => {
    setSalida((actual) =>
      actual?.competidor === competidor && actual.motivo === motivo ? null : { competidor, motivo }
    )
  }

  // La confirmación va dentro de la página (el cuadro nativo de confirm() puede
  // estar bloqueado por el navegador y entonces el botón parecería no hacer nada)
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)

  const limpiar = () => {
    setConfirmandoBorrado(false)
    setEstado({ shiro: estadoVacio(), aka: estadoVacio() })
    setFaltas({ shiro: faltasVacias(), aka: faltasVacias() })
    setNombres({ shiro: '', aka: '' })
    setSalida(null)
  }

  return (
    <>
      <Header />
      <main className="kumite-container">
        <div className="kumite-wrapper">
          <div className="kumite-header">
            <span className="kansa-titulo">KANSA</span>
          </div>

          <div className="kumite-marcadores">
            <Marcador
              titulo="SHIRO (BLANCO)"
              tipo="shiro"
              puntos={estado.shiro}
              total={totalDe(estado.shiro)}
              onModificar={modificarPunto}
              faltas={faltas.shiro}
              onFalta={modificarFalta}
              nombre={nombres.shiro}
              onNombreChange={cambiarNombre}
              salida={salida?.competidor === 'shiro' ? salida.motivo : null}
              onSalida={modificarSalida}
              color="blue"
            />
            <Marcador
              titulo="AKA (ROJO)"
              tipo="aka"
              puntos={estado.aka}
              total={totalDe(estado.aka)}
              onModificar={modificarPunto}
              faltas={faltas.aka}
              onFalta={modificarFalta}
              nombre={nombres.aka}
              onNombreChange={cambiarNombre}
              salida={salida?.competidor === 'aka' ? salida.motivo : null}
              onSalida={modificarSalida}
              color="red"
            />
          </div>

          <div className="kumite-footer">
            {confirmandoBorrado ? (
              <>
                <span className="kansa-confirmar">¿Borrar todas las anotaciones?</span>
                <button onClick={() => setConfirmandoBorrado(false)} className="btn-cancelar">
                  NO
                </button>
                <button onClick={limpiar} className="btn-guardar">
                  SÍ, BORRAR
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmandoBorrado(true)} className="btn-cancelar">
                BORRAR ANOTACIONES
              </button>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default KumiteKansa
