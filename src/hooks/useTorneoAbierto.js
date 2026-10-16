import { useEffect, useState } from 'react'
import useAuth from './useAuth'
import { listarTorneos } from '../lib/torneos'

export const MENSAJE_SIN_TORNEO = 'No hay un torneo abierto: no se pueden cargar resultados. Abrí uno en Configuración → Torneos.'

// Torneo abierto de la organización (estado "activo"; hay uno solo por vez). Los resultados nuevos se guardan
// siempre en ese torneo (lo asigna la base) y, si no hay ninguno abierto, la base no deja guardar.
// Sin sesión o sin base de datos (modo local) no se aplica ninguna restricción.
//   aplica: ¿rige la regla?   torneo: { id, nombre } | null   sinTorneo: no hay torneo abierto (ya se consultó)
export default function useTorneoAbierto() {
  const { configurado, user } = useAuth()
  const userId = user?.id ?? null
  const aplica = Boolean(configurado && userId)
  const [estado, setEstado] = useState({ cargando: true, torneo: null })

  useEffect(() => {
    if (!aplica) return undefined
    let activo = true
    listarTorneos().then((r) => {
      if (activo) setEstado({ cargando: false, torneo: r.filas.find((t) => t.estado === 'activo') ?? null, error: !r.ok })
    })
    return () => {
      activo = false
    }
  }, [aplica, userId])

  return {
    aplica,
    cargando: aplica && estado.cargando,
    torneo: aplica ? estado.torneo : null,
    // si la consulta falló no se bloquea: la base hace cumplir la regla igual
    sinTorneo: aplica && !estado.cargando && !estado.error && estado.torneo === null,
  }
}
