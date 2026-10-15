import { useState } from 'react'
import AutocompletarJuez from '../AutocompletarJuez/AutocompletarJuez'
import useResponsableMesa, { recordarResponsable, sugerirResponsables } from '../../hooks/useResponsableMesa'

// Campo para el nombre del responsable de mesa. Se recuerda en el navegador, se guarda con cada
// resultado y los nombres ya usados se sugieren al escribir (para completar más rápido la próxima vez).
// variante 'entrada': sección "Entrada de Datos" de Kata, Kobudo y Destreza.
// variante 'campo': etiqueta chica, como el área y la categoría de Kumite.
function ResponsableField({ variante = 'entrada' }) {
  const { responsable, setResponsable } = useResponsableMesa()
  const [sugerencias, setSugerencias] = useState([])

  const input = (
    // al salir del campo, el nombre queda guardado en la lista de sugerencias
    <div onBlur={() => recordarResponsable(responsable)}>
      <AutocompletarJuez
        value={responsable}
        onChange={setResponsable}
        onBuscar={(texto) => setSugerencias(sugerirResponsables(texto))}
        sugerencias={sugerencias}
        placeholder="Nombre del responsable de mesa"
        ariaLabel="Responsable de mesa"
      />
    </div>
  )

  if (variante === 'campo') {
    return (
      <div className="responsable-field">
        <label>RESPONSABLE DE MESA</label>
        {input}
      </div>
    )
  }

  return (
    <div className="responsable-entrada">
      <label>Responsable de mesa</label>
      {input}
    </div>
  )
}

export default ResponsableField
