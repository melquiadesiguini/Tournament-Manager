import { Navigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import ConfigPagina from './ConfigPagina'

// /configuracion: lleva a la primera sección que el rol del usuario puede ver
function ConfigInicio() {
  const { perfilCargado, esAdmin, puedeVerHistorial } = useAuth()
  if (perfilCargado && esAdmin) return <Navigate to="/configuracion/usuarios" replace />
  if (perfilCargado && puedeVerHistorial) return <Navigate to="/configuracion/historial" replace />
  return <ConfigPagina titulo="Configuración">{null}</ConfigPagina>
}

export default ConfigInicio
