import { useState } from 'react'
import './CampoClave.css'

// Campo de contraseña con el ojo para mostrarla u ocultarla. Recibe el texto de la etiqueta y las
// propiedades normales de un input (value, onChange, autoComplete, minLength...).
function CampoClave({ etiqueta, ...input }) {
  const [visible, setVisible] = useState(false)

  return (
    <label>
      {etiqueta}
      <span className="campo-clave">
        <input {...input} type={visible ? 'text' : 'password'} />
        <button
          type="button"
          className="campo-clave-ojo"
          onClick={() => setVisible((v) => !v)}
          // no le saca el foco al campo: se puede seguir escribiendo
          onMouseDown={(e) => e.preventDefault()}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M3 3l18 18" />}
          </svg>
        </button>
      </span>
    </label>
  )
}

export default CampoClave
