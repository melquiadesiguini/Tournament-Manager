import { useEffect, useState } from 'react'

// Devuelve la fecha/hora actual, actualizada cada segundo.
export default function useClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  return now
}
