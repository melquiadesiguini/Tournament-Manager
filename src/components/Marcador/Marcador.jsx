function Marcador({
  titulo,
  tipo,
  puntos,
  total,
  onModificar,
  color,
}) {
  const tecnicas = [
    { nombre: 'IPPON', puntos: 'ippon', valor: 1 },
    { nombre: 'NIBON', puntos: 'nibon', valor: 2 },
    { nombre: 'SANBON', puntos: 'sanbon', valor: 3 },
  ]

  const colorClass = color === 'blue' ? 'marcador-blue' : 'marcador-red'
  const buttonColorClass =
    color === 'blue'
      ? 'btn-marcador-blue'
      : 'btn-marcador-red'

  return (
    <div className={`marcador ${colorClass}`}>
      <div className={`marcador-titulo ${colorClass}`}>
        {titulo}
      </div>

      <div className="marcador-tecnicas">
        {tecnicas.map((tecnica) => (
          <div key={tecnica.puntos} className="tecnica-row">
            <span className="tecnica-nombre">
              {tecnica.nombre} ({tecnica.valor}p)
            </span>
            <div className="tecnica-controls">
              <button
                onClick={() => onModificar(tipo, tecnica.puntos, -1)}
                className={`btn-control ${buttonColorClass}`}
              >
                -
              </button>
              <span className="tecnica-valor">
                {puntos[tecnica.puntos]}
              </span>
              <button
                onClick={() => onModificar(tipo, tecnica.puntos, 1)}
                className={`btn-control ${buttonColorClass}`}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className={`marcador-total ${colorClass}`}>
        <span className="total-label">Puntaje Total</span>
        <span className="total-numero">{total}</span>
      </div>
    </div>
  )
}

export default Marcador;