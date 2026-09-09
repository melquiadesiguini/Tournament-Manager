import { useEffect, useRef } from 'react'
import playBuzzer from '../../utils/playBuzzer'

export default function Timer({
  duration,
  setDuration,
  timerActive,
  controlTimer,
  onTimeUp,
}) {
  // Refs para siempre llamar a la versión más reciente sin reiniciar el intervalo
  const durationRef = useRef(duration)
  const controlTimerRef = useRef(controlTimer)
  const onTimeUpRef = useRef(onTimeUp)

  useEffect(() => {
    durationRef.current = duration
  }, [duration])

  useEffect(() => {
    controlTimerRef.current = controlTimer
  }, [controlTimer])

  useEffect(() => {
    onTimeUpRef.current = onTimeUp
  }, [onTimeUp])

  // Hook para el cronómetro: un único intervalo por cada activación,
  // no se recrea en cada tick (evita drift). Los efectos secundarios
  // (sonido, pausar, avisar que terminó) van en código imperativo normal,
  // nunca dentro del updater de setState: React (en modo Strict, en
  // desarrollo) puede invocar los updaters dos veces para detectar
  // efectos secundarios impuros, lo que duplicaba el sonido.
  useEffect(() => {
    if (!timerActive || durationRef.current <= 0) return undefined

    const interval = setInterval(() => {
      const next = durationRef.current - 1
      durationRef.current = next
      setDuration(next)

      if (next <= 0) {
        clearInterval(interval)
        controlTimerRef.current('pause')
        playBuzzer()
        onTimeUpRef.current?.()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [timerActive, setDuration])

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