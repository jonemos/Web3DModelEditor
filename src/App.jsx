import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import GamePage from './pages/GamePage'
import EditorPage from './pages/EditorPage'
import MigrationTestPage from './pages/MigrationTestPage'
import MigrationTestPageNew from './pages/MigrationTestPage.New' // 새 테스트 페이지
import './App.css'

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/test-migration" element={<MigrationTestPage />} />
          <Route path="/test-migration-new" element={<MigrationTestPageNew />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
