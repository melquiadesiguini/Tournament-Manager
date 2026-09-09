import { useEffect } from 'react'

export default function Timer({
  duration,
  setDuration,
  timerActive,
  controlTimer,
  onTimeUp,
}) {
  // Hook para el cronómetro
  useEffect(() => {
    let interval

    if (timerActive && duration > 0) {
      interval = setInterval(() => {
        setDuration((prev) => {
          if (prev - 1 === 0) {
            controlTimer('pause')
            onTimeUp?.()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => clearInterval(interval)
  }, [timerActive, duration, setDuration, controlTimer, onTimeUp])

  const minutos = Math.floor(duration / 60)
    .toString()
    .padStart(2, '0')
  const segundos = (duration % 60).toString().padStart(2, '0')

  const handleMinutosChange = (e) => {
    const nuevosMinutos = Math.max(0, Number(e.target.value) || 0)
    setDuration(nuevosMinutos * 60 + (duration % 60))
  }

  const handleSegundosChange = (e) => {
    const nuevosSegundos = Math.min(59, Math.max(0, Number(e.target.value) || 0))
    setDuration(Math.floor(duration / 60) * 60 + nuevosSegundos)
  }

  return (
    <div className="timer-section">

      <div className="timer-display">
        <div className="timer-clock">
          <input
            type="number"
            min="0"
            value={minutos}
            onChange={handleMinutosChange}
            disabled={timerActive}
            aria-label="Minutos"
            className="timer-clock-input"
          />
          <span className="timer-clock-sep">:</span>
          <input
            type="number"
            min="0"
            max="59"
            value={segundos}
            onChange={handleSegundosChange}
            disabled={timerActive}
            aria-label="Segundos"
            className="timer-clock-input"
          />
        </div>
      </div>
    </div>
  )
}