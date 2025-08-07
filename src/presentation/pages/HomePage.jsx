import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './HomePage.css'

function HomePage() {
  const navigate = useNavigate()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const choiceResult = await deferredPrompt.userChoice
      if (choiceResult.outcome === 'accepted') {
        // User accepted the install prompt
      }
      setDeferredPrompt(null)
    }
    setShowInstallPrompt(false)
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
  }

  return (
    <div className="home-page">
      <div className="start-menu fade-in">
        <h1>🎮<br />ThirdPerson TreeJS Game</h1>
        <div className="menu-buttons">
          <button 
            className="menu-btn start-game-btn"
            onClick={() => navigate('/game')}
          >
            게임 시작
          </button>
          <button 
            className="menu-btn editor-btn"
            onClick={() => navigate('/editor')}
          >
            에디터
          </button>
        </div>
      </div>

      {/* PWA 설치 프롬프트 */}
      {showInstallPrompt && (
        <div className="install-prompt">
          <p>이 게임을 홈 화면에 추가하시겠습니까?</p>
          <button onClick={handleInstall} className="install-btn">
            설치
          </button>
          <button onClick={handleDismiss} className="dismiss-btn">
            나중에
          </button>
        </div>
      )}
    </div>
  )
}

export default HomePage
