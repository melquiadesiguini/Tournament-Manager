import useRonda from '../../hooks/useRonda'

// Campo para el número de ronda. Se recuerda en el navegador, se guarda con cada resultado
// y sube solo al pulsar "Finalizar ronda".
function RondaField() {
  const { ronda, setRonda } = useRonda()

  return (
    <div className="input-group input-group-area">
      <h2>Ronda N°</h2>
      <input
        type="text"
        inputMode="numeric"
        value={ronda}
        onChange={(e) => setRonda(e.target.value)}
        placeholder="–"
        maxLength={3}
        aria-label="Número de ronda"
      />
    </div>
  )
}

export default RondaField
