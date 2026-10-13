import { useId, useState } from 'react'
import './AutocompletarJuez.css'

// Resalta en negrita la parte del nombre que coincide con lo escrito
function Resaltado({ nombre, texto }) {
  const q = texto.trim().toLowerCase()
  const i = q ? nombre.toLowerCase().indexOf(q) : -1
  if (i < 0) return nombre
  return (
    <>
      {nombre.slice(0, i)}
      <strong>{nombre.slice(i, i + q.length)}</strong>
      {nombre.slice(i + q.length)}
    </>
  )
}

// Campo de nombre de juez con lista desplegable: mientras se escribe, muestra debajo los nombres
// que se van encontrando en la base (`sugerencias`, que llegan al llamar a `onBuscar`).
// Se elige con el mouse, o con ↑ ↓ y Enter; Esc la cierra.
function AutocompletarJuez({ value, onChange, onBuscar, sugerencias, placeholder, ariaLabel }) {
  const idLista = useId()
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(-1)

  const mostrar = abierto && value.trim().length >= 2 && sugerencias.length > 0

  const escribir = (e) => {
    onChange(e.target.value)
    onBuscar(e.target.value)
    setAbierto(true)
    setActivo(-1)
  }

  const elegir = (nombre) => {
    onChange(nombre)
    setAbierto(false)
    setActivo(-1)
  }

  const teclas = (e) => {
    if (!mostrar) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo((i) => (i + 1) % sugerencias.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((i) => (i <= 0 ? sugerencias.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activo >= 0) {
      e.preventDefault()
      elegir(sugerencias[activo])
    } else if (e.key === 'Escape') {
      setAbierto(false)
    }
  }

  return (
    <div className="auto-juez">
      <input
        type="text"
        className="judge-name-input"
        autoComplete="off"
        role="combobox"
        aria-expanded={mostrar}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={escribir}
        onKeyDown={teclas}
        onBlur={() => setAbierto(false)}
      />
      {mostrar && (
        <ul id={idLista} className="auto-juez-lista" role="listbox">
          {sugerencias.map((nombre, i) => (
            <li
              key={nombre}
              role="option"
              aria-selected={i === activo}
              className={i === activo ? 'activa' : ''}
              // mouseDown (y no click) para elegir antes de que el campo pierda el foco
              onMouseDown={(e) => {
                e.preventDefault()
                elegir(nombre)
              }}
              onMouseEnter={() => setActivo(i)}
            >
              <Resaltado nombre={nombre} texto={value} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default AutocompletarJuez
