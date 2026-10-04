import useArea from '../../hooks/useArea'

// Campo para ingresar el número de área (tatami). Se guarda en el navegador y la
// pantalla pública lo muestra como "Área N° X".
// variante 'grupo': igual que los campos de Kata, Kobudo y Destreza (título grande).
// variante 'campo': etiqueta chica, como la categoría de Kumite.
function AreaField({ variante = 'grupo' }) {
  const { area, setArea } = useArea()

  const input = (
    <input
      type="text"
      inputMode="numeric"
      value={area}
      onChange={(e) => setArea(e.target.value)}
      placeholder="–"
      maxLength={3}
      aria-label="Número de área"
      title="Número de área: se muestra en la pantalla pública"
    />
  )

  if (variante === 'campo') {
    return (
      <div className="area-field">
        <label>ÁREA N°</label>
        {input}
      </div>
    )
  }

  return (
    <div className="input-group input-group-area">
      <h2>Área N°</h2>
      {input}
    </div>
  )
}

export default AreaField
