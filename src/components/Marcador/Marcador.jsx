import useCountUp from '../../hooks/useCountUp'

function Marcador({
  titulo,
  tipo,
  puntos,
  total,
  onModificar,
  faltas,
  onFalta,
  nombre,
  onNombreChange,
  color,
}) {
  const totalAnimado = useCountUp(total)

  const tecnicas = [
    { nombre: 'IPPON', puntos: 'ippon', valor: 1 },
    { nombre: 'NIBON', puntos: 'nibon', valor: 2 },
    { nombre: 'SANBON', puntos: 'sanbon', valor: 3 },
  ]

  const columnasFaltas = ['ADV', 'KEIK', 'H-CH', 'HANS', 'SHIK']
  const filasFaltas = [
    { nombre: 'CHUKOKU', clave: 'chukoku' },
    { nombre: 'MUBOBI', clave: 'mubobi' },
  ]

  const columnasJogai = ['J1', 'J2', 'J3', 'J4']

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

      <div className="marcador-nombre">
        <input
          type="text"
          value={nombre}
          onChange={(e) => onNombreChange(tipo, e.target.value)}
          placeholder="Nombre del competidor"
        />
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

      <div className={`marcador-faltas ${colorClass}`}>
        <table className="faltas-table">
          <thead>
            <tr>
              <th>FALTAS</th>
              {columnasFaltas.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filasFaltas.map((fila) => (
              <tr key={fila.clave}>
                <td className="falta-nombre">{fila.nombre}</td>
                {columnasFaltas.map((col) => (
                  <td
                    key={col}
                    className={`falta-celda ${faltas[fila.clave].includes(col) ? 'falta-marcada' : ''}`}
                    onClick={() => onFalta(tipo, fila.clave, col)}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`marcador-jogai ${colorClass}`}>
        <table className="faltas-table">
          <thead>
            <tr>
              <th>FALTAS</th>
              {columnasJogai.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="falta-nombre">JOGAI</td>
              {columnasJogai.map((col) => (
                <td
                  key={col}
                  className={`falta-celda ${faltas.jogai.includes(col) ? 'falta-marcada' : ''}`}
                  onClick={() => onFalta(tipo, 'jogai', col)}
                />
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className={`marcador-total ${colorClass}`}>
        <span className="total-label">Puntaje Total</span>
        <span className="total-numero">{Math.round(totalAnimado)}</span>
      </div>
    </div>
  )
}

export default Marcador;