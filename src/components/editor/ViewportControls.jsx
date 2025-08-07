import { useEditorStore } from '../../store/editorStore'
import './ViewportControls.css'

function ViewportControls({ editorControls }) {
  const { 
    isWireframe, 
    isGridSnap, 
    toggleWireframe, 
    toggleGridSnap
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
    </div>
  )
}

export default ViewportControls
