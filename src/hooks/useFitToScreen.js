import { useEffect, useRef, useState } from 'react'

// Cuando `active` es true, mide el contenido referenciado y calcula la escala
// necesaria para que entre completo en el alto disponible de la pantalla,
// sin necesidad de hacer scroll (usado para el modo pantalla completa).
// CSS `transform` no afecta el layout, asi que scrollHeight siempre refleja
// el alto natural del contenido sin importar la escala ya aplicada.
export default function useFitToScreen(active) {
  const contentRef = useRef(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (!active) return undefined

    const recalculate = () => {
      const el = contentRef.current
      if (!el) return

      const naturalHeight = el.scrollHeight
      const availableHeight = window.innerHeight

      const nextScale =
        naturalHeight > availableHeight
          ? Math.max(0.4, availableHeight / naturalHeight)
          : 1

      setScale(nextScale)
    }

    recalculate()
    window.addEventListener('resize', recalculate)

    let observer
    if (contentRef.current && window.ResizeObserver) {
      observer = new ResizeObserver(recalculate)
      observer.observe(contentRef.current)
    }

    return () => {
      window.removeEventListener('resize', recalculate)
      if (observer) observer.disconnect()
    }
  }, [active])

  return { contentRef, scale }
}
