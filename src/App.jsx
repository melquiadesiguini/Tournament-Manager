import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Kata from './pages/Kata'
import Kumite from './pages/Kumite'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/kata" element={<Kata />} />
        <Route path="/kumite" element={<Kumite />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App