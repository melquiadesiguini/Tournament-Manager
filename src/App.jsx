import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthProvider from './context/AuthProvider'
import RutaProtegida from './components/RutaProtegida'
import Home from './pages/Home'
import Kata from './pages/Kata'
import Kumite from './pages/Kumite'
import KumiteModo from './pages/KumiteModo'
import Kobudo from './pages/Kobudo'
import Destreza from './pages/Destreza'
import Pantalla from './pages/Pantalla'
import Cuenta from './pages/Cuenta'
import ConfigHistorial from './pages/ConfigHistorial'
import ConfigInicio from './pages/ConfigInicio'
import ConfigUsuarios from './pages/ConfigUsuarios'
import ConfigPersonas from './pages/ConfigPersonas'
import ConfigOrganizaciones from './pages/ConfigOrganizaciones'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/pantalla" element={<Pantalla />} />
          <Route path="/cuenta" element={<Cuenta />} />
          <Route path="/registro" element={<Cuenta registro />} />
          <Route element={<RutaProtegida />}>
            <Route path="/" element={<Home />} />
            <Route path="/kata" element={<Kata />} />
            <Route path="/kumite" element={<KumiteModo />} />
            <Route path="/kumite/mesa" element={<Kumite />} />
            <Route path="/kumite/kansa" element={<Kumite modoKansa />} />
            <Route path="/kobudo" element={<Kobudo />} />
            <Route path="/destreza" element={<Destreza />} />
            <Route path="/historial" element={<Navigate to="/configuracion/historial" replace />} />
            <Route path="/configuracion" element={<ConfigInicio />} />
            <Route path="/configuracion/historial" element={<ConfigHistorial />} />
            <Route path="/configuracion/usuarios" element={<ConfigUsuarios />} />
            <Route path="/configuracion/organizaciones" element={<ConfigOrganizaciones />} />
            <Route
              path="/configuracion/jueces"
              element={<ConfigPersonas tabla="jueces" titulo="Jueces" />}
            />
            <Route
              path="/configuracion/competidores"
              element={<ConfigPersonas tabla="competidores" titulo="Competidores" />}
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
