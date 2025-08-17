import { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
// 라우트 단위 코드 스플리팅
const HomePage = lazy(() => import('./pages/HomePage'))
const GamePage = lazy(() => import('./pages/GamePage'))
const EditorPage = lazy(() => import('./pages/EditorPage'))
import './App.css'
import { ToastProvider } from './context/ToastContext.jsx'

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <ToastProvider>
        <div className="App">
          <Suspense fallback={<div style={{padding: 16}}>Loading…</div>}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/game" element={<GamePage />} />
              <Route path="/editor" element={<EditorPage />} />
            </Routes>
          </Suspense>
        </div>
      </ToastProvider>
    </Router>
  )
}

export default App
