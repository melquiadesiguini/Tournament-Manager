import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthProvider from './context/AuthProvider'
import Home from './pages/Home'
import Kata from './pages/Kata'
import Kumite from './pages/Kumite'
import KumiteModo from './pages/KumiteModo'
import Kobudo from './pages/Kobudo'
import Destreza from './pages/Destreza'
import Pantalla from './pages/Pantalla'
import Cuenta from './pages/Cuenta'
import Historial from './pages/Historial'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/kata" element={<Kata />} />
          <Route path="/kumite" element={<KumiteModo />} />
          <Route path="/kumite/mesa" element={<Kumite />} />
          <Route path="/kumite/kansa" element={<Kumite modoKansa />} />
          <Route path="/kobudo" element={<Kobudo />} />
          <Route path="/destreza" element={<Destreza />} />
          <Route path="/pantalla" element={<Pantalla />} />
          <Route path="/cuenta" element={<Cuenta />} />
          <Route path="/historial" element={<Historial />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
