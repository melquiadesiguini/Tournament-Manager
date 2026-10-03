import { useEffect, useState } from 'react'

const STORAGE_KEY = 'tm-area'

function readArea() {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

// Número de área (tatami) de este puesto. Se guarda en localStorage y se comparte
// con las demás ventanas del navegador, en particular con la pantalla pública,
// que lo muestra como "Área N° X".
export default function useArea() {
  const [area, setAreaState] = useState(readArea)

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY || e.key === null) setAreaState(readArea())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setArea = (valor) => {
    const limpio = String(valor).replace(/\D/g, '').slice(0, 3)
    setAreaState(limpio)
    try {
      if (limpio) localStorage.setItem(STORAGE_KEY, limpio)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // sin acceso a localStorage: el número queda solo en esta ventana
    }
  }

  return { area, setArea }
}

export const etiquetaArea = (area) => `Área N° ${area}`
