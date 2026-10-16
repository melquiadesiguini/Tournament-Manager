import { useState } from 'react'
import useAuth from '../hooks/useAuth'
import CampoClave from './CampoClave/CampoClave'

// Mismas reglas que las Edge Functions (supabase/functions/_shared/validar.ts)
const MIN = 8
const MAX = 72

// Formulario para elegir una contraseña nueva. Lo usan el cambio obligatorio del primer ingreso,
// el cambio voluntario y el restablecimiento por email. Llama a `alTerminar` cuando se guardó.
function FormNuevaClave({ alTerminar, textoBoton = 'Guardar contraseña' }) {
  const { cambiarClave, perfil } = useAuth()
  const [clave, setClave] = useState('')
  const [repetida, setRepetida] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    if (clave.length < MIN) return setError(`La contraseña debe tener al menos ${MIN} caracteres.`)
    if (clave.length > MAX) return setError(`La contraseña no puede tener más de ${MAX} caracteres.`)
    if (clave !== repetida) return setError('Las contraseñas no coinciden.')
    if (perfil?.nombre_usuario && clave.toLowerCase() === perfil.nombre_usuario) {
      return setError('La contraseña no puede ser igual a tu nombre de usuario.')
    }
    setEnviando(true)
    const r = await cambiarClave(clave)
    setEnviando(false)
    if (!r.ok) return setError(r.mensaje)
    alTerminar?.()
  }

  return (
    <form className="cuenta-form" onSubmit={enviar}>
      <CampoClave
        etiqueta="Contraseña nueva"
        required
        minLength={MIN}
        maxLength={MAX}
        value={clave}
        onChange={(e) => setClave(e.target.value)}
        autoComplete="new-password"
        autoFocus
      />
      <CampoClave
        etiqueta="Repetí la contraseña"
        required
        minLength={MIN}
        maxLength={MAX}
        value={repetida}
        onChange={(e) => setRepetida(e.target.value)}
        autoComplete="new-password"
      />
      {error && <div className="cuenta-error">{error}</div>}
      <button type="submit" className="cuenta-boton cuenta-boton-primario" disabled={enviando}>
        {enviando ? 'Un momento…' : textoBoton}
      </button>
    </form>
  )
}

export default FormNuevaClave
