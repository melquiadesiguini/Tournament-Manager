import { useEffect, useState } from 'react'
import foto1 from '../../assets/images/foto1.jpg'
import foto2 from '../../assets/images/foto2.jpg'
import foto3 from '../../assets/images/foto3.jpg'
import foto4 from '../../assets/images/foto4.jpg'
import foto5 from '../../assets/images/foto5.jpeg'
import foto6 from '../../assets/images/foto6.jpg'

export default function Gallery() {
  const [selectedImage, setSelectedImage] = useState(null)

  useEffect(() => {
    if (!selectedImage) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedImage(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage])

  const images = [
    {
      id: 1,
      src: foto1,
      title: 'Sudamericano Chile 2025',
      alt: 'Sudamericano Chile 2025'
    },
    {
      id: 2,
      src: foto2,
      title: '3ra edición de “Karate y salud”',
      alt: '3ra edición de “Karate y salud”'
    },
    {
      id: 3,
      src:foto3 ,
      title: 'Torneo KYUDOKAN ARGENTINA',
      alt: 'Torneo KYUDOKAN ARGENTINA'
    },
    {
      id: 4,
      src: foto4,
      title: 'Representantes en el MUNDIAL WUKF',
      alt: 'Representantes en el MUNDIAL WUKF'
    },
    {
      id: 5,
      src: foto5,
      title: '1° Practica de la SELEECION',
      alt: '1° Practica de la SELEECION'
    },
    {
      id: 6,
      src: foto6,
      title: '2da Fecha del TORNEO RANKEABLE 2024',
      alt: '2da Fecha del TORNEO RANKEABLE 2024'
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
            <div
              key={image.id}
              className="gallery-item"
              onClick={() => setSelectedImage(image)}
            >
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

      {selectedImage && (
        <div className="lightbox" onClick={() => setSelectedImage(null)}>
          <button
            type="button"
            className="lightbox-close"
            onClick={() => setSelectedImage(null)}
            aria-label="Cerrar"
          >
            &times;
          </button>
          <img
            src={selectedImage.src}
            alt={selectedImage.alt}
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="lightbox-caption">{selectedImage.title}</p>
        </div>
      )}
    </section>
  )
}