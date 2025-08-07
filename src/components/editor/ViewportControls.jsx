import { useEditorStore } from '../../store/editorStore'
import './ViewportControls.css'

function ViewportControls({ editorControls }) {
  const { 
    isWireframe, 
    isGridSnap,
    isGridVisible,
    gizmoSpace,
    isMagnetEnabled,
    showMagnetRays,
    toggleWireframe, 
    toggleGridSnap,
    toggleGridVisible,
    toggleGizmoSpace,
    toggleMagnet,
    toggleMagnetRays
  } = useEditorStore()

  const handleWireframeToggle = () => {
    toggleWireframe()
    
    // EditorControls를 통해 와이어프레임 업데이트
    if (editorControls) {
      editorControls.updateWireframe();
    }
  }

  const handleGridSnapToggle = () => {
    toggleGridSnap()
    
    // EditorControls를 통해 그리드 스냅 업데이트
    if (editorControls) {
      editorControls.updateGridSnap();
    }
  }

  const handleGridVisibleToggle = () => {
    toggleGridVisible()
    
    // EditorControls를 통해 그리드 가시성 업데이트
    if (editorControls) {
      editorControls.toggleGrid();
    }
  }

  const handleGizmoSpaceToggle = () => {
    toggleGizmoSpace()
    
    // EditorControls를 통해 기즈모 좌표계 업데이트
    if (editorControls) {
      editorControls.updateGizmoSpace();
    }
  }

  const handleMagnetToggle = () => {
    toggleMagnet()
    
    // EditorControls를 통해 자석 기능 업데이트
    if (editorControls) {
      editorControls.updateMagnet();
    }
  }

  const handleMagnetRaysToggle = () => {
    toggleMagnetRays()
    
    // EditorControls를 통해 레이 표시 업데이트
    if (editorControls) {
      editorControls.updateMagnetRays();
    }
  }

  return (
    <div className="viewport-controls">
      <button 
        className={`viewport-control-btn ${isWireframe ? 'active' : ''}`}
        onClick={handleWireframeToggle}
        title="렌더링 모드 (와이어프레임)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </button>

      <button 
        className={`viewport-control-btn ${isGridSnap ? 'active' : ''}`}
        onClick={handleGridSnapToggle}
        title="그리드 스냅"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <path d="M9 9h6v6H9z"/>
          <path d="M3 9h18"/>
          <path d="M3 15h18"/>
          <path d="M9 3v18"/>
          <path d="M15 3v18"/>
        </svg>
      </button>

      <button 
        className={`viewport-control-btn ${isGridVisible ? 'active' : ''}`}
        onClick={handleGridVisibleToggle}
        title="그리드 표시/숨기기"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3h18v18H3z"/>
          <path d="M8 3v18"/>
          <path d="M13 3v18"/>
          <path d="M18 3v18"/>
          <path d="M3 8h18"/>
          <path d="M3 13h18"/>
          <path d="M3 18h18"/>
        </svg>
      </button>

      <button 
        className={`viewport-control-btn ${gizmoSpace === 'local' ? 'active' : ''}`}
        onClick={handleGizmoSpaceToggle}
        title={`기즈모 좌표계 (${gizmoSpace === 'world' ? '월드' : '로컬'})`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {gizmoSpace === 'world' ? (
            // 월드 좌표계 아이콘 (글로벌 좌표)
            <>
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 3v18"/>
              <path d="M3 12h18"/>
              <path d="M8 8l8 8"/>
              <path d="M16 8l-8 8"/>
            </>
          ) : (
            // 로컬 좌표계 아이콘 (객체 중심 좌표)
            <>
              <rect x="4" y="4" width="16" height="16" rx="2"/>
              <path d="M12 4v16"/>
              <path d="M4 12h16"/>
              <circle cx="12" cy="12" r="2"/>
            </>
          )}
        </svg>
      </button>

      <button 
        className={`viewport-control-btn ${isMagnetEnabled ? 'active' : ''}`}
        onClick={handleMagnetToggle}
        title="자석 모드 (메쉬 표면에 스냅)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 15l6-6 6 6"/>
          <path d="M6 8h12"/>
          <circle cx="12" cy="17" r="2"/>
          <path d="M8 12L12 8l4 4"/>
        </svg>
      </button>

      <button 
        className={`viewport-control-btn ${showMagnetRays ? 'active' : ''}`}
        onClick={handleMagnetRaysToggle}
        title="자석 레이 표시"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6"/>
          <path d="M12 17v6"/>
          <path d="M4.22 4.22l4.24 4.24"/>
          <path d="M15.54 15.54l4.24 4.24"/>
          <path d="M1 12h6"/>
          <path d="M17 12h6"/>
          <path d="M4.22 19.78l4.24-4.24"/>
          <path d="M15.54 8.46l4.24-4.24"/>
        </svg>
      </button>
    </div>
  )
}

export default ViewportControls
