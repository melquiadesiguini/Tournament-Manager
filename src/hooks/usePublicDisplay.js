import { useEffect, useState } from 'react'

const STORAGE_KEY = 'tm-display'

function writeDisplay(payload) {
  try {
    if (payload) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, t: Date.now() }))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // sin acceso a localStorage: la pantalla pública simplemente no se actualiza
  }
}

function readDisplay() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

// Panel de control: publica el resultado mientras el cartel está visible
// y lo retira al cerrarlo (o al salir de la página).
export function usePublishResult(visible, buildPayload) {
  useEffect(() => {
    writeDisplay(visible ? buildPayload() : null)
    return () => writeDisplay(null)
    // buildPayload se evalúa solo cuando el cartel aparece o desaparece
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])
}

// Pantalla pública: se actualiza cuando el panel de control publica algo.
export function useDisplayState() {
  const [state, setState] = useState(readDisplay)

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY || e.key === null) setState(readDisplay())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return state
}

// Abre la pantalla pública; si hay un segundo monitor y el navegador lo
// permite, la abre directamente ahí.
export async function openPublicDisplay() {
  const url = `${import.meta.env.BASE_URL}pantalla`
  let features = 'popup=yes,width=1280,height=720'

  try {
    if (window.screen.isExtended && window.getScreenDetails) {
      const details = await window.getScreenDetails()
      const other = details.screens.find((s) => !s.isPrimary)
      if (other) {
        features = `popup=yes,left=${other.availLeft},top=${other.availTop},width=${other.availWidth},height=${other.availHeight}`
      }
    }
  } catch {
    // sin permiso para ver los monitores: se abre en la pantalla actual
  }

  window.open(url, 'tm-display', features)
}
