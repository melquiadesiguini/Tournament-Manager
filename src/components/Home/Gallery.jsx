import foto1 from '../../assets/images/foto1.jpg'
import foto2 from '../../assets/images/foto2.jpg'
import foto3 from '../../assets/images/foto3.jpg'

export default function Gallery() {
  const images = [
    {
      id: 1,
      src: foto1,
      title: 'Combate Senior',
      alt: 'Torneo de Karate'
    },
    {
      id: 2,
      src: foto2,
      title: 'Kata Demostración',
      alt: 'Kata Performance'
    },
    {
      id: 3,
      src:foto3 ,
      title: 'Entrenamiento',
      alt: 'Entrenamientos del Dojo'
    },
    {
      id: 4,
      src: foto3,
      title: 'Torneo Jóvenes',
      alt: 'Categoría Júnior'
    }
  ]

  return (
    <section className="gallery">
      <div className="gallery-container">
        <h2>Galería de Torneos</h2>
        <p className="section-subtitle">
          Momentos destacados de nuestros eventos
        </p>

        <div className="gallery-grid">
          {images.map((image) => (
            <div key={image.id} className="gallery-item">
              <img 
                src={image.src} 
                alt={image.alt}
                className="gallery-image"
              />
              <div className="gallery-overlay">
                <h3>{image.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}