import { Link } from 'react-router-dom'
import  hero  from '../../assets/images/hero.jpg'


function HeroSection() {
  return (
    <section className="hero">
      <div className="hero-content">
        <div className="hero-text">
          <h1 className='hero-title'>TOURNAMENT MANAGER</h1>
          <p className="hero-subtitle">Sistema de Gestión de Torneos Karate</p>
          <p className="hero-description">
            Administra combates, registra puntuaciones y controla tiempos con precisión
          </p>
          <div className="hero-buttons">
            <Link to="/kumite" className="btn-primary">
              KUMITE
            </Link>
            <Link to="/kata" className="btn-secondary">
              KATA
            </Link>
          </div>
        </div>
        <div className="hero-image">
          <img 
            src={hero} 
            alt="Karate Tournament"
            className="hero-img"
          />
        </div>
      </div>
    </section>
  )
}
export default HeroSection