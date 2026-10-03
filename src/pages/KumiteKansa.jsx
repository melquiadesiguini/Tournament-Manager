import { Link } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import { enviarSalidaKansa, useDisplayState } from '../hooks/usePublicDisplay'
import './Kumite.css'
import './KumiteModo.css'

const SALIDAS = [
  { motivo: 'SHIKAKU', detalle: 'expulsado' },
  { motivo: 'KIKEN', detalle: 'renuncia' },
  { motivo: 'ORDEN MÉDICA', detalle: 'no continúa' },
]

const LADOS = [
  { tipo: 'shiro', titulo: 'SHIRO (BLANCO)', clase: 'marcador-blue' },
  { tipo: 'aka', titulo: 'AKA (ROJO)', clase: 'marcador-red' },
]

// Vista de Kansa: solo puede elegir SHIKAKU, KIKEN u ORDEN MÉDICA para cada
// competidor. La decisión se envía a la ventana de la Mesa, que es la que
// lleva el combate; de ahí recibe los nombres y el estado actual.
function KumiteKansa() {
  const state = useDisplayState()
  const conectada = state?.tipo === 'kumite'

  const ganadorNombre =
    conectada && state.ganador
      ? state[state.ganador].nombre || LADOS.find((l) => l.tipo === state.ganador).titulo
      : null

  return (
    <>
      <Header />
      <main className="modo-container">
        <h1 className="modo-titulo">Kansa</h1>
        <p className="modo-subtitulo">
          La decisión se aplica en el tablero de la Mesa. El competidor elegido pierde y gana el otro.
        </p>

        {!conectada && (
          <div className="kansa-aviso">
            Esperando a la Mesa: abrí <Link to="/kumite/mesa">Kumite › Mesa</Link> en este navegador
            para poder enviar decisiones.
          </div>
        )}

        {ganadorNombre && <div className="kansa-ganador">🏆 Ganador: {ganadorNombre}</div>}

        <div className="kansa-columnas">
          {LADOS.map(({ tipo, titulo, clase }) => (
            <section key={tipo} className={`marcador kansa-lado ${clase}`}>
              <div className={`marcador-titulo ${clase}`}>{titulo}</div>
              <div className="kansa-nombre">{(conectada && state[tipo].nombre) || ' '}</div>

              <div className={`marcador-salidas kansa-salidas ${clase}`}>
                {SALIDAS.map(({ motivo, detalle }) => {
                  const activa =
                    conectada && state.salida?.competidor === tipo && state.salida.motivo === motivo
                  return (
                    <button
                      key={motivo}
                      type="button"
                      className={`btn-salida ${activa ? 'btn-salida-activa' : ''}`}
                      onClick={() => enviarSalidaKansa(tipo, motivo)}
                      disabled={!conectada}
                      aria-pressed={activa}
                      title={`${motivo} (${detalle}): gana el otro competidor`}
                    >
                      <span className="btn-salida-motivo">{motivo}</span>
                      <span className="btn-salida-detalle">({detalle})</span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  )
}

export default KumiteKansa
