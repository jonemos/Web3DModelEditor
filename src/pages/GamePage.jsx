import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import PlainThreeCanvas from '../components/game/PlainThreeCanvas'
import GameUI from '../components/game/GameUI'
import './GamePage.css'

function GamePage() {
  const navigate = useNavigate()
  const { isLoading, setLoading, pause, restart, setKey } = useGameStore()
  const [loadingStatus, setLoadingStatus] = useState('게임 로딩 중...')

  useEffect(() => {
    // 게임 초기화
    const initGame = async () => {
      try {
        setLoadingStatus('게임 엔진 초기화 중...')
        await new Promise(resolve => setTimeout(resolve, 1000)) // 시뮬레이션된 로딩
        
        setLoadingStatus('게임 준비 완료!')
        setTimeout(() => {
          setLoading(false)
        }, 500)
      } catch (error) {
        setLoadingStatus(`❌ 게임 로딩 실패: ${error.message}`)
        // Game loading error occurred
      }
    }

    initGame()
  }, [setLoading])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Escape') {
        pause()
      }
      if (e.code === 'KeyR') {
        restart()
      }
      if (e.code === 'KeyH') {
        navigate('/')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [pause, restart, navigate])

  // 마우스 포인터 잠금 요청
  useEffect(() => {
    const canvas = document.querySelector('canvas')
    if (canvas) {
      canvas.addEventListener('click', () => {
        canvas.requestPointerLock()
      })
    }
  }, [isLoading])

  return (
    <div className="game-page">
      {isLoading && (
        <div className="loading-screen">
          <div className="loader"></div>
          <p className="loading-status">{loadingStatus}</p>
        </div>
      )}
      
      {!isLoading && (
        <>
          <PlainThreeCanvas />
          <GameUI />
          
          {/* 홈으로 돌아가기 버튼 */}
          <button 
            className="home-btn"
            onClick={() => navigate('/')}
            title="홈으로 돌아가기 (H)"
          >
            🏠
          </button>
        </>
      )}
    </div>
  )
}

export default GamePage
