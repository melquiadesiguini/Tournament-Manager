import { useEffect, useState } from 'react'

const STORAGE_KEY = 'tm-responsable-mesa'
const CLAVE_LISTA = 'tm-responsables'
const MAX = 60
const MAX_GUARDADOS = 30

function leerLista() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_LISTA) || '[]')
    return Array.isArray(lista) ? lista.filter((n) => typeof n === 'string') : []
  } catch {
    return []
  }
}

// Guarda el nombre en la lista de usados (el más reciente primero, sin repetidos) para sugerirlo la próxima vez
export function recordarResponsable(nombre) {
  const limpio = String(nombre).replace(/\s+/g, ' ').trim()
  if (limpio.length < 2) return
  const lista = [limpio, ...leerLista().filter((n) => n.toLowerCase() !== limpio.toLowerCase())].slice(0, MAX_GUARDADOS)
  try {
    localStorage.setItem(CLAVE_LISTA, JSON.stringify(lista))
  } catch {
    // sin acceso a localStorage: no se recuerda
  }
}

// Nombres usados antes que contienen lo escrito (mínimo 2 letras, hasta 8)
export function sugerirResponsables(texto) {
  const q = texto.trim().toLowerCase()
  if (q.length < 2) return []
  return leerLista()
    .filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q)
    .slice(0, 8)
}

// Valor vigente: se lee al guardar un resultado (el campo y la pantalla no comparten estado, sí el navegador)
export function leerResponsable() {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

// Nombre del responsable de mesa de este puesto. Se recuerda en el navegador (la misma persona
// suele atender la mesa durante todo el torneo) y se guarda junto con cada resultado.
export default function useResponsableMesa() {
  const [responsable, setResponsableState] = useState(leerResponsable)

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY || e.key === null) setResponsableState(leerResponsable())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setResponsable = (valor) => {
    const texto = String(valor).slice(0, MAX)
    setResponsableState(texto)
    try {
      if (texto) localStorage.setItem(STORAGE_KEY, texto)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // sin acceso a localStorage: el nombre queda solo en esta ventana
    }
  }

  return { responsable, setResponsable }
}
