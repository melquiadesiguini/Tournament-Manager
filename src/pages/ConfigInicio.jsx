import { Navigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { seccionesVisibles } from '../lib/permisos'
import ConfigPagina from './ConfigPagina'

// /configuracion: lleva a la primera sección que el rol del usuario puede ver
function ConfigInicio() {
  const { perfilCargado, esSuperAdmin, puede } = useAuth()
  const [primera] = seccionesVisibles({ esSuperAdmin, puede })
  if (perfilCargado && primera) return <Navigate to={primera.a} replace />
  return <ConfigPagina titulo="Configuración">{null}</ConfigPagina>
}

export default ConfigInicio
