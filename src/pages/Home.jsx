import { Link } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import HeroSection from '../components/Home/HeroSection'
import Caracteristicas from '../components/Home/Caracteristicas'
import Gallery from '../components/Home/Gallery'
import '../components/Home/Home.css'

function Home() {
  return (
    <>
      <Header />
      <main className="home-main">
        <HeroSection />
        <Caracteristicas />
        <Gallery />
        
        {/* Sección CTA */}
        <section className="cta-section">
          <div className="cta-content">
            <h2>¿Listo para tu primer combate?</h2>
            <p>Accede al Kumite Manager y comienza a registrar combates</p>
            <Link to="/kumite" className="cta-button">
              Ir a Kumite Manager
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
export default Home