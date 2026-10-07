import { Link } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import './KumiteModo.css'

// Pantalla previa a Kumite: se elige el rol con el que se va a usar el tablero
function KumiteModo() {
  return (
    <div className="pagina-columna">
      <Header />
      <main className="modo-container">
        <h1 className="modo-titulo">Kumite</h1>
        <p className="modo-subtitulo">Elegí cómo vas a usar el tablero</p>

        <div className="modo-opciones">
          <Link to="/kumite/mesa" className="modo-card modo-mesa">
            <span className="modo-icono" aria-hidden="true">🖥️</span>
            <span className="modo-nombre">MESA</span>
            <span className="modo-detalle">
              Tablero completo: cronómetro, puntajes, faltas y resultado
            </span>
          </Link>

          <Link to="/kumite/kansa" className="modo-card modo-kansa">
            <span className="modo-icono" aria-hidden="true">🚩</span>
            <span className="modo-nombre">KANSA</span>
            <span className="modo-detalle">
              Mismo tablero que la Mesa, pero independiente: no la modifica ni se ve en la pantalla pública
            </span>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default KumiteModo
