import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import useAuth from '../hooks/useAuth'

// Nombres de jueces de la organización del usuario (tabla "jueces"), para autocompletar
async function listarJueces() {
  if (!supabase) return []
  const { data, error } = await supabase.from('jueces').select('nombre').order('nombre').limit(1000)
  return error ? [] : data.map((j) => j.nombre)
}

// Agrega a la tabla los nombres que todavía no existen (los repetidos se ignoran)
async function registrarJueces(nombres) {
  if (!supabase) return
  const limpios = [...new Set(nombres.map((n) => n.trim()).filter(Boolean))]
  if (limpios.length === 0) return
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return
  const { data: miembro } = await supabase
    .from('members')
    .select('org_id')
    .eq('user_id', session.user.id)
    .limit(1)
    .maybeSingle()
  if (!miembro) return
  await supabase
    .from('jueces')
    .upsert(
      limpios.map((nombre) => ({ org_id: miembro.org_id, nombre })),
      { onConflict: 'org_id,nombre', ignoreDuplicates: true }
    )
}

export function useJueces() {
  const { user } = useAuth()
  const [nombres, setNombres] = useState([])

  useEffect(() => {
    let activo = true
    if (!user) return undefined
    listarJueces().then((lista) => activo && setNombres(lista))
    return () => {
      activo = false
    }
  }, [user])

  const registrar = useCallback(
    (lista) =>
      registrarJueces(lista).then(() => listarJueces()).then(setNombres),
    []
  )

  return { nombres: user ? nombres : [], registrar }
}
