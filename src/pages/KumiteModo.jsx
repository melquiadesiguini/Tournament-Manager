import { Link } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import './KumiteModo.css'

// Pantalla previa a Kumite: se elige el rol con el que se va a usar el tablero
function KumiteModo() {
  return (
    <>
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
              Tablero de anotación: puntos, faltas y SHIKAKU, KIKEN u ORDEN MÉDICA. No modifica la Mesa
            </span>
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default KumiteModo
