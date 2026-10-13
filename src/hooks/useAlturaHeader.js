import { useEffect, useState } from 'react'

// Alto en px del encabezado fijo de la página (cambia si el menú se acomoda en dos líneas)
export default function useAlturaHeader() {
  const [alto, setAlto] = useState(0)

  useEffect(() => {
    const header = document.querySelector('header')
    if (!header) return undefined
    const medir = () => setAlto(Math.ceil(header.getBoundingClientRect().height))
    medir()
    window.addEventListener('resize', medir)
    const observer = window.ResizeObserver ? new ResizeObserver(medir) : null
    observer?.observe(header)
    return () => {
      window.removeEventListener('resize', medir)
      observer?.disconnect()
    }
  }, [])

  return alto
}
