import { useEffect, useRef, useState } from 'react'

// Anima un número desde su valor anterior hasta el nuevo valor.
export default function useCountUp(value, duration = 500) {
  const numericValue = Number.isFinite(value) ? value : 0
  const [display, setDisplay] = useState(numericValue)
  const fromRef = useRef(numericValue)
  const rafRef = useRef(null)

  useEffect(() => {
    const from = fromRef.current
    const to = numericValue

    if (from === to) {
      setDisplay(to)
      return
    }

    const start = performance.now()
    cancelAnimationFrame(rafRef.current)

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (to - from) * eased)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
        setDisplay(to)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [numericValue, duration])

  return display
}
