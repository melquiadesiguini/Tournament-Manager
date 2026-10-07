import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import useAuth from '../hooks/useAuth'
import { listarResultados } from '../lib/resultados'
import './Cuenta.css'

const NOMBRES_MODULO = { kata: 'Kata', kobudo: 'Kobudo', destreza: 'Destreza', kumite: 'Kumite' }

// Resumen en una línea del resultado guardado
function resumen(r) {
  const p = r.payload || {}
  if (r.modulo === 'kumite') {
    return `${p.nombreShiro} ${p.shiroTotal} - ${p.akaTotal} ${p.nombreAka} · Ganador: ${p.ganador}${
      p.categoria ? ` · ${p.categoria}` : ''
    }`
  }
  return `${p.competitor || '—'} · Puntaje final: ${p.finalScore}`
}

// Resultados guardados en la nube para la organización del usuario
function Historial() {
  const { configurado, cargando, user } = useAuth()
  const [estado, setEstado] = useState({ cargando: true, resultados: [], error: false })

  useEffect(() => {
    if (!user) return undefined
    let activo = true
    listarResultados().then((r) => {
      if (activo) setEstado({ cargando: false, resultados: r.resultados, error: !r.ok })
    })
    return () => {
      activo = false
    }
  }, [user])

  let contenido
  if (!configurado) {
    contenido = <p className="cuenta-nota">La conexión con la base de datos no está configurada.</p>
  } else if (cargando) {
    contenido = <p className="cuenta-nota">Cargando…</p>
  } else if (!user) {
    contenido = (
      <p className="cuenta-nota">
        Para ver el historial en la nube tenés que <Link to="/cuenta">iniciar sesión</Link>.
      </p>
    )
  } else if (estado.cargando) {
    contenido = <p className="cuenta-nota">Cargando resultados…</p>
  } else if (estado.error) {
    contenido = <div className="cuenta-error">No se pudo cargar el historial.</div>
  } else if (estado.resultados.length === 0) {
    contenido = <p className="cuenta-nota">Todavía no hay resultados guardados.</p>
  } else {
    contenido = (
      <div className="historial-tabla-wrap">
        <table className="historial-tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Módulo</th>
              <th>Área</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {estado.resultados.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString('es-AR')}</td>
                <td>{NOMBRES_MODULO[r.modulo] || r.modulo}</td>
                <td>{r.area || '—'}</td>
                <td>{resumen(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="pagina-columna">
      <Header />
      <main className="cuenta-container">
        <section className="cuenta-card cuenta-card-ancha">
          <h1>Historial</h1>
          {contenido}
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default Historial
