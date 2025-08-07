import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameService } from '../hooks/useGameService'
import { useEventBus } from '../../infrastructure/events/EventBus'
import PlainThreeCanvas from '../components/game/PlainThreeCanvas'
import GameUI from '../components/game/GameUI'
import './GamePage.css'

function GamePage() {
  const navigate = useNavigate()
  const gameService = useGameService()
  const eventBus = useEventBus()
  
  // State from service
  const [gameState, setGameState] = useState(() => gameService.getState())
  const [loadingStatus, setLoadingStatus] = useState('게임 로딩 중...')

  // Subscribe to game events
  useEffect(() => {
    const updateState = () => {
      setGameState(gameService.getState())
    }

    const unsubscribeGameStarted = eventBus.subscribe('GAME_STARTED', updateState)
    const unsubscribeGamePaused = eventBus.subscribe('GAME_PAUSED', updateState)
    const unsubscribeGameRestarted = eventBus.subscribe('GAME_RESTARTED', updateState)

    return () => {
      unsubscribeGameStarted()
      unsubscribeGamePaused()
      unsubscribeGameRestarted()
    }
  }, [gameService, eventBus])

  // Extract values from game state
  const { isLoading } = gameState

  useEffect(() => {
    // 게임 초기화
    const initGame = async () => {
      try {
        setLoadingStatus('게임 엔진 초기화 중...')
        await new Promise(resolve => setTimeout(resolve, 1000)) // 시뮬레이션된 로딩
        
        setLoadingStatus('게임 준비 완료!')
        setTimeout(() => {
          gameService.setLoading(false)
        }, 500)
      } catch (error) {
        setLoadingStatus(`❌ 게임 로딩 실패: ${error.message}`)
        // Game loading error occurred
      }
    }

    initGame()
  }, [gameService])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Escape') {
        gameService.pause()
      }
      if (e.code === 'KeyR') {
        gameService.restart()
      }
      if (e.code === 'KeyH') {
        navigate('/')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [gameService, navigate])

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
