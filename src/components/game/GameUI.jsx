import { useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import './GameUI.css'

function GameUI() {
  const { 
    isPaused,
    pause,
    resume,
    restart,
    toggleCameraFollowMode,
    cameraState,
    playerPosition
  } = useGameStore()
  
  const [showSidebar, setShowSidebar] = useState(false)
  const [treeCount, setTreeCount] = useState(10)

  const handleTreeCountChange = (e) => {
    const count = parseInt(e.target.value, 10)
    setTreeCount(count)
    // TODO: 나무 개수 업데이트 로직
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    // TODO: 플레이어 모델 업로드 로직
    // File uploaded successfully
  }

  const resetToDefaultModel = () => {
    if (window.confirm('캐릭터를 기본 모델로 되돌리시겠습니까?')) {
      // TODO: 기본 모델로 리셋 로직
      // Reset to default model
    }
  }

  return (
    <>
      {/* 크로스헤어 */}
      <div className="crosshair"></div>
      
      {/* 게임 메시지 */}
      <div className="game-message"></div>
      
      {/* 일시정지 오버레이 */}
      {isPaused && (
        <div className="pause-overlay">
          <h2>게임 일시정지</h2>
          <button onClick={resume} className="resume-btn">
            계속하기
          </button>
          <button onClick={restart} className="restart-btn">
            재시작
          </button>
        </div>
      )}
      
      {/* 컨트롤 안내 */}
      <div className="controls-info">
        <div>WASD: 이동</div>
        <div>마우스: 카메라 회전</div>
        <div>스크롤: 줌</div>
        <div>ESC: 일시정지</div>
        <div>위치: ({Math.round(playerPosition.x)}, {Math.round(playerPosition.z)})</div>
      </div>
      
      {/* 사이드바 토글 버튼 */}
      <button 
        className="sidebar-toggle-btn"
        onClick={() => setShowSidebar(!showSidebar)}
      >
        ⚙️
      </button>
      
      {/* 사이드바 */}
      <div className={`sidebar ${showSidebar ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>게임 설정</h3>
          <button 
            className="close-btn"
            onClick={() => setShowSidebar(false)}
          >
            ✕
          </button>
        </div>
        
        <div className="sidebar-content">
          {/* 플레이어 모델 업로드 */}
          <div className="section">
            <h4>플레이어 모델</h4>
            <input
              type="file"
              accept=".glb,.gltf"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="model-file-input"
            />
            <button 
              className="upload-btn"
              onClick={() => document.getElementById('model-file-input').click()}
            >
              모델 업로드
            </button>
            <button 
              className="reset-btn"
              onClick={resetToDefaultModel}
            >
              기본 모델로 리셋
            </button>
            <div className="model-info">기본 모델 사용 중</div>
          </div>
          
          {/* 나무 개수 조절 */}
          <div className="section">
            <h4>나무 개수: {treeCount}</h4>
            <input
              type="range"
              min="0"
              max="20"
              value={treeCount}
              onChange={handleTreeCountChange}
              className="slider"
            />
          </div>
          
          {/* 카메라 설정 */}
          <div className="section">
            <h4>카메라</h4>
            <button 
              className={`camera-btn ${cameraState.followMode ? 'active' : ''}`}
              onClick={toggleCameraFollowMode}
            >
              {cameraState.followMode ? '따라가기 모드' : '고정 모드'}
            </button>
          </div>
          
          {/* 맵 선택 */}
          <div className="section">
            <h4>맵 선택</h4>
            <select className="map-select">
              <option value="default">기본 맵</option>
            </select>
            <button className="apply-map-btn">맵 적용</button>
          </div>
        </div>
      </div>
    </>
  )
}

export default GameUI
