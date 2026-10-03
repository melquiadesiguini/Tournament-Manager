import { useEffect, useRef, useState } from 'react'

// Cuando `active` es true, mide el contenido referenciado y calcula la escala
// necesaria para que entre completo en el alto disponible de la pantalla,
// sin necesidad de hacer scroll (usado para el modo pantalla completa).
// CSS `transform` no afecta el layout, asi que scrollHeight siempre refleja
// el alto natural del contenido sin importar la escala ya aplicada.
//
// Opciones (opcionales):
// - `reservedHeight`: alto en px que el contenedor ya ocupa con su propio
//   relleno y no está disponible para el contenido.
// - `measureChildren`: para contenedores que se estiran hasta llenar la pantalla
//   (alto fijo, con el contenido distribuido adentro): el alto natural se mide por
//   lo que ocupan los hijos y no por el contenedor, y se observan los hijos.
export default function useFitToScreen(active, reservedHeight = 0, measureChildren = false) {
  const contentRef = useRef(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (!active) return undefined

    const naturalHeightOf = (el) => {
      const kids = el.children
      if (!measureChildren || kids.length === 0) return el.scrollHeight
      const first = kids[0]
      const last = kids[kids.length - 1]
      return last.offsetTop + last.offsetHeight - first.offsetTop
    }

    const recalculate = () => {
      const el = contentRef.current
      if (!el) return

      const naturalHeight = naturalHeightOf(el)
      const availableHeight = window.innerHeight - reservedHeight

      const nextScale =
        naturalHeight > availableHeight
          ? Math.max(0.4, availableHeight / naturalHeight)
          : 1

      setScale(nextScale)
    }

    recalculate()
    window.addEventListener('resize', recalculate)

    let observer
    let mutations
    if (contentRef.current && window.ResizeObserver) {
      const el = contentRef.current
      observer = new ResizeObserver(recalculate)
      const observeAll = () => {
        observer.disconnect()
        observer.observe(el)
        if (measureChildren) Array.from(el.children).forEach((child) => observer.observe(child))
      }
      observeAll()

      if (measureChildren) {
        // los hijos aparecen y desaparecen (por ejemplo al elegir el sistema de jueces)
        mutations = new MutationObserver(() => {
          observeAll()
          recalculate()
        })
        mutations.observe(el, { childList: true })
      }
    }

    return () => {
      window.removeEventListener('resize', recalculate)
      if (observer) observer.disconnect()
      if (mutations) mutations.disconnect()
    }
  }, [active, reservedHeight, measureChildren])

  return { contentRef, scale }
}
