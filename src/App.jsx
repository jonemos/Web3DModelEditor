import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './presentation/pages/HomePage'
import GamePage from './presentation/pages/GamePage'
import EditorPage from './presentation/pages/EditorPage'
import { DIProvider } from './infrastructure/react/providers/DIProvider.jsx'
import { appBootstrapper } from './application/bootstrap/ApplicationBootstrapper.js'
import './App.css'

function App() {
  return (
    <DIProvider container={appBootstrapper.container}>
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
          </Routes>
        </div>
      </Router>
    </DIProvider>
  )
}

export default App
