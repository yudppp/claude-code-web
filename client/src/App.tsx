import { Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { SessionDetailPage } from './pages/SessionDetailPage'
import { SessionListPage } from './pages/SessionListPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SessionListPage />} />
        <Route path="/session/:sessionId" element={<SessionDetailPage />} />
      </Routes>
    </Router>
  )
}

export default App
