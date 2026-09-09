 function Caracteristicas() {
  const features = [
    {
      id: 1,
      icon: '⏱️',
      title: 'Cronómetro Preciso',
      description: 'Controla tiempos de combate con precisión de segundos'
    },
    {
      id: 2,
      icon: '📊',
      title: 'Sistema de Puntuación',
      description: 'Registra Ippon, Nibon y Sanbon automáticamente'
    },
    {
      id: 3,
      icon: '🥋',
      title: 'Múltiples Categorías',
      description: 'Compatible con todas las categorías de karate'
    }
  ]

  return (
    <section className="caracteristicas">
      <div className="caracteristicas-container">
        <h2>¿Por qué Kumite Manager?</h2>
        <p className="section-subtitle">
          Todo lo que necesitas para administrar torneos de karate
        </p>
        
        <div className="features-grid">
          {features.map((feature) => (
            <div key={feature.id} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Caracteristicas