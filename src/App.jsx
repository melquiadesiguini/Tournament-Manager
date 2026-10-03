import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Kata from './pages/Kata'
import Kumite from './pages/Kumite'
import Kobudo from './pages/Kobudo'
import Destreza from './pages/Destreza'
import Pantalla from './pages/Pantalla'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/kata" element={<Kata />} />
        <Route path="/kumite" element={<Kumite />} />
        <Route path="/kobudo" element={<Kobudo />} />
        <Route path="/destreza" element={<Destreza />} />
        <Route path="/pantalla" element={<Pantalla />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App