import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import useAuth from '../hooks/useAuth'

// Guarda los nombres escritos a mano que todavía no están en la lista de jueces
// (la base ignora los que ya existen, también si están cargados como "Apellido Nombre")
async function registrarJueces(nombres) {
  if (!supabase) return
  const limpios = [...new Set(nombres.map((n) => n.trim()).filter(Boolean))]
  await Promise.all(limpios.map((texto) => supabase.rpc('registrar_juez', { texto })))
}

// Sugerencias de nombres mientras se escribe. La base solo devuelve hasta 8 coincidencias
// (mínimo 2 letras): quien carga puntajes no puede ver la lista completa.
export function useJueces() {
  const { user } = useAuth()
  const [sugerencias, setSugerencias] = useState([])
  const pedido = useRef(0)
  const espera = useRef(null)

  useEffect(() => () => clearTimeout(espera.current), [])

  const buscar = useCallback(
    (texto) => {
      clearTimeout(espera.current)
      const actual = ++pedido.current
      if (!user || !supabase || texto.trim().length < 2) {
        setSugerencias([])
        return
      }
      espera.current = setTimeout(async () => {
        const { data, error } = await supabase.rpc('sugerir_jueces', { texto })
        // se descartan respuestas viejas si el usuario siguió escribiendo
        if (actual === pedido.current) setSugerencias(error || !data ? [] : data)
      }, 200)
    },
    [user]
  )

  return { sugerencias, buscar, registrar: registrarJueces }
}
