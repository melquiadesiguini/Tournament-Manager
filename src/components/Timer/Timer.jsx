import { useEffect } from 'react'

export default function Timer({
  duration,
  setDuration,
  timerActive,
  controlTimer,
  categoria,
  setCategoria,
}) {
  // Hook para el cronómetro
  useEffect(() => {
    let interval

    if (timerActive && duration > 0) {
      interval = setInterval(() => {
        setDuration((prev) => {
          if (prev - 1 === 0) {
            alert('¡Tiempo cumplido!')
            controlTimer('pause')
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => clearInterval(interval)
  }, [timerActive, duration, setDuration, controlTimer])

  const minutos = Math.floor(duration / 60)
    .toString()
    .padStart(2, '0')
  const segundos = (duration % 60).toString().padStart(2, '0')

  return (
    <div className="timer-section">

      <div className="timer-display">
        <input type="number" value={minutos} onChange={(e) => setDuration(e.target.value * 60)} />
        <span className="timer-number">{minutos}:{segundos}</span>
        
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
      </div>
    </div>
  )
}