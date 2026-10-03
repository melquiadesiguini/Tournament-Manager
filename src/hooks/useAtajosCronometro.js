import { useCallback, useEffect, useRef } from 'react'

// Atajos de teclado del cronómetro: Espacio = iniciar/pausar, R = reiniciar.
// Se ignoran al escribir en un campo, con Ctrl/Alt/Cmd apretados (Ctrl+R recarga
// la página) y cuando `habilitado` es false (por ejemplo con un cartel abierto).
//
// Además mantiene el foco en el botón Iniciar/Pausar: devuelve una ref (callback
// estable) para ese botón; el foco va ahí cuando el botón aparece y vuelve después
// de tocar cualquier otro botón.
export default function useAtajosCronometro({ controlTimer, timerActive, habilitado = true }) {
  const estadoRef = useRef({ controlTimer, timerActive, habilitado })
  useEffect(() => {
    estadoRef.current = { controlTimer, timerActive, habilitado }
  })

  const botonRef = useRef(null)
  const asignarBotonInicio = useCallback((el) => {
    botonRef.current = el
    el?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const escribiendoEnCampo = (e) => {
      const t = e.target
      return (
        t instanceof HTMLElement &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      )
    }
    const atajoDe = (e) => {
      if (!estadoRef.current.habilitado) return null
      if (e.ctrlKey || e.altKey || e.metaKey || escribiendoEnCampo(e)) return null
      if (e.code === 'Space') return 'alternar'
      if (e.key.toLowerCase() === 'r') return 'reset'
      return null
    }
    const onKeyDown = (e) => {
      const atajo = atajoDe(e)
      if (!atajo) return
      e.preventDefault() // evita el scroll de la página con Espacio
      if (e.repeat) return
      const { controlTimer: control, timerActive: activo } = estadoRef.current
      control(atajo === 'alternar' ? (activo ? 'pause' : 'start') : 'reset')
    }
    // Si un botón tiene el foco, Espacio lo "clickearía" al soltar la tecla
    const onKeyUp = (e) => {
      if (e.code === 'Space' && atajoDe(e)) e.preventDefault()
    }
    const onClick = (e) => {
      const boton = botonRef.current
      if (
        estadoRef.current.habilitado &&
        boton?.isConnected &&
        e.target instanceof Element &&
        e.target.closest('button')
      ) {
        boton.focus({ preventScroll: true })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('click', onClick)
    }
  }, [])

  return asignarBotonInicio
}
