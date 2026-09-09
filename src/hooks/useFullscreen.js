import { useCallback, useEffect, useState } from 'react'

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null
}

// Alterna pantalla completa sobre el elemento referenciado por `ref`.
export default function useFullscreen(ref) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(getFullscreenElement() === ref.current)
    }

    document.addEventListener('fullscreenchange', handleChange)
    document.addEventListener('webkitfullscreenchange', handleChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
      document.removeEventListener('webkitfullscreenchange', handleChange)
    }
  }, [ref])

  const toggleFullscreen = useCallback(() => {
    const el = ref.current
    if (!el) return

    if (getFullscreenElement()) {
      if (document.exitFullscreen) document.exitFullscreen()
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
    } else if (el.requestFullscreen) {
      el.requestFullscreen()
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen()
    }
  }, [ref])

  return { isFullscreen, toggleFullscreen }
}
