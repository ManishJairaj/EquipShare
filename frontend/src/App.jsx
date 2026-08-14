import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import EquipmentDetail from './pages/EquipmentDetail.jsx'
import Landing from './pages/Landing.jsx'
import Chat from './pages/Chat.jsx'

function App() {
  return (
    <div className="equipshare-app">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/explore" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:conversationId" element={<Chat />} />
          <Route path="/equipment/:id" element={<EquipmentDetail />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
