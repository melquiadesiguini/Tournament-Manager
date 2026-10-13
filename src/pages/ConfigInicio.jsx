import { Navigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { SECCIONES_CONFIG } from '../lib/permisos'
import ConfigPagina from './ConfigPagina'

// /configuracion: lleva a la primera sección que el rol del usuario puede ver
function ConfigInicio() {
  const { perfilCargado, esSuperAdmin, puede } = useAuth()
  const primera = SECCIONES_CONFIG.find((s) => (s.permiso === 'superadmin' ? esSuperAdmin : puede(s.permiso)))
  if (perfilCargado && primera) return <Navigate to={primera.a} replace />
  return <ConfigPagina titulo="Configuración">{null}</ConfigPagina>
}

export default ConfigInicio
