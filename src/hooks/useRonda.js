import { useEffect, useState } from 'react'

const STORAGE_KEY = 'tm-ronda'
const EVENTO = 'tm-ronda-cambio'

// Número de ronda vigente (se lee al guardar un resultado)
export function readRonda() {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function escribir(valor) {
  try {
    if (valor) localStorage.setItem(STORAGE_KEY, valor)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // sin acceso a localStorage: el número queda solo en esta ventana
  }
  // avisa a los campos de esta misma ventana (el evento "storage" solo llega a las otras)
  window.dispatchEvent(new Event(EVENTO))
}

// Pasa a la ronda siguiente (si todavía no se había puesto número, se considera que era la 1)
export function avanzarRonda() {
  const actual = Number(readRonda()) || 1
  if (actual < 999) escribir(String(actual + 1))
}

// Al terminar una categoría, la próxima empieza de cero: se borra el número de ronda
export function limpiarRonda() {
  escribir('')
}

// Número de ronda de este puesto. Se recuerda en el navegador y se guarda con cada resultado.
export default function useRonda() {
  const [ronda, setRondaState] = useState(readRonda)

  useEffect(() => {
    const actualizar = () => setRondaState(readRonda())
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY || e.key === null) actualizar()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(EVENTO, actualizar)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(EVENTO, actualizar)
    }
  }, [])

  const setRonda = (valor) => escribir(String(valor).replace(/\D/g, '').slice(0, 3))

  return { ronda, setRonda }
}
