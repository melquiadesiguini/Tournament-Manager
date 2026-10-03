import { useDisplayState } from '../hooks/usePublicDisplay'
import './Kata.css'

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen?.()
}

function Pantalla() {
  const state = useDisplayState()

  if (!state) {
    return (
      <div className="pantalla-espera" onDoubleClick={toggleFullscreen}>
        <div className="pantalla-espera-titulo">TOURNAMENT MANAGER</div>
        <div className="pantalla-espera-texto">Esperando resultado…</div>
        <div className="pantalla-espera-ayuda">Doble clic para pantalla completa</div>
      </div>
    )
  }

  return (
    <div className="results-overlay pantalla-publica" onDoubleClick={toggleFullscreen}>
      <div className="results-board">
        <div className="pantalla-modulo">{state.modulo}</div>

        <div className="system-badge">{state.competitor}</div>

        <div className="results-grid">
          <div className="result-card final">
            <div className="result-icon">🏆</div>
            <div className="result-label">Puntaje Final</div>
            <div className="result-value-final">{state.finalScore}</div>
          </div>
        </div>

        <div className="results-detail">
          <h3>Detalles de Calificaciones</h3>
          <div className="scores-breakdown">
            {state.scores.map((item) => (
              <div
                key={item.label}
                className={`score-item ${item.included ? 'included' : 'discarded'}`}
              >
                <span className="score-position">{item.included ? '✅' : '❌'}</span>
                <span className="score-value">{item.score.toFixed(1)}</span>
                <span className="judge-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Pantalla
