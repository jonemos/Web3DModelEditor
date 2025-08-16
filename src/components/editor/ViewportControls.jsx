import { useEditorStore } from '../../store/editorStore'
import { useEffect, useMemo } from 'react'
import './ViewportControls.css'

function ViewportControls({ editorControls }) {
  const { 
    isWireframe, 
    isGridSnap,
    isGridVisible,
    gizmoSpace,
  gizmoSize,
  snapMove,
  snapRotateDeg,
  snapScale,
    toggleWireframe, 
    toggleGridSnap,
    toggleGridVisible,
    toggleGizmoSpace,
  setGizmoSize,
  setSnapMove,
  setSnapRotateDeg,
  setSnapScale,
  } = useEditorStore()

  // 뷰/기즈모 설정 팝오버 열림 상태 (UI 섹션에 영구 저장)
  const isViewGizmoSettingsOpen = useEditorStore((s) => s.isViewGizmoSettingsOpen)
  const setIsViewGizmoSettingsOpen = useEditorStore((s) => s.setIsViewGizmoSettingsOpen)

  const isPostProcessingEnabled = useEditorStore((s) => s.isPostProcessingEnabled)
  const togglePostProcessingEnabled = useEditorStore((s) => s.togglePostProcessingEnabled)

  // 미세 디바운스 유틸과 디바운스된 적용 함수들
  const debounce = (fn, ms = 80) => {
    let t
    return (...args) => {
      if (t) clearTimeout(t)
      t = setTimeout(() => fn(...args), ms)
    }
  }
  const debouncedUpdateWireframe = useMemo(() => debounce(() => {
    try { editorControls?.updateWireframe?.() } catch {}
  }, 80), [editorControls])
  const debouncedUpdateGridSnap = useMemo(() => debounce(() => {
    try { editorControls?.updateGridSnap?.() } catch {}
  }, 80), [editorControls])
  const debouncedUpdateGizmoSize = useMemo(() => debounce(() => {
    try { editorControls?.objectSelector?.updateGizmoSize?.() } catch {}
  }, 80), [editorControls])

  const handleWireframeToggle = () => {
    toggleWireframe()
    // EditorControls를 통해 와이어프레임 업데이트 (디바운스)
    debouncedUpdateWireframe()
  }

  const handleGridSnapToggle = () => {
    toggleGridSnap()
  // EditorControls를 통해 그리드 스냅 업데이트 (디바운스)
  debouncedUpdateGridSnap()
  }

  const handleGridVisibleToggle = () => {
    toggleGridVisible()
    
  // EditorControls를 통해 그리드 가시성 업데이트
  try { editorControls?.toggleGrid?.() } catch {}
  }

  const handleGizmoSpaceToggle = () => {
    toggleGizmoSpace()
    
    // EditorControls를 통해 기즈모 좌표계 업데이트
    try { editorControls?.updateGizmoSpace?.() } catch {}
  }

  // 설정 패널 토글: 전역 UI 상태 사용 (영구 저장)
  const showSettings = isViewGizmoSettingsOpen
  const toggleSettings = () => setIsViewGizmoSettingsOpen(!isViewGizmoSettingsOpen)

  // 값 변경 시 즉시 반영 (디바운스)
  useEffect(() => {
    debouncedUpdateGizmoSize()
  }, [debouncedUpdateGizmoSize, gizmoSize])

  useEffect(() => {
    debouncedUpdateGridSnap()
  }, [debouncedUpdateGridSnap, snapMove, snapRotateDeg, snapScale, isGridSnap])

  // 에디터 컨트롤 생성 직후 저장된 상태를 한 번 더 반영
  useEffect(() => {
    if (!editorControls) return
    try { editorControls.updateWireframe?.() } catch {}
    try { editorControls.updateGridSnap?.() } catch {}
    try { editorControls.updateGizmoSpace?.() } catch {}
    try { editorControls.objectSelector?.updateGizmoSize?.() } catch {}
  }, [editorControls])

  return (
    <div className="viewport-controls">
  {/* 렌더링 모드(와이어프레임) 및 그리드 스냅 빠른 토글 버튼 제거됨 - 설정 패널에서 관리 */}

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

  {/* Post-processing 토글 버튼 제거됨: 설정 패널에서 관리 */}

      {/* 뷰 환경/기즈모 설정 패널 열기 */}
      <button 
        className={`viewport-control-btn ${showSettings ? 'active' : ''}`}
        onClick={toggleSettings}
        title="뷰/기즈모 설정"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1v22"/>
          <path d="M5 5h14"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>

      {showSettings && (
        <div className="viewport-settings-pop">
          <div className="row">
            <label>포스트프로세싱</label>
            <input type="checkbox" checked={isPostProcessingEnabled} onChange={togglePostProcessingEnabled} />
          </div>
          <div className="row">
            <label>와이어프레임</label>
            <input type="checkbox" checked={isWireframe} onChange={handleWireframeToggle} />
          </div>
          <div className="row">
            <label>그리드 스냅</label>
            <input type="checkbox" checked={isGridSnap} onChange={handleGridSnapToggle} />
          </div>
          <div className="row">
            <label>기즈모 크기</label>
            <input type="range" min="0.1" max="3" step="0.1" value={gizmoSize}
              onChange={(e)=> setGizmoSize(e.target.value)} />
            <span>{Number(gizmoSize).toFixed(1)}</span>
          </div>
          <div className="row">
            <label>이동 스냅</label>
            <input type="number" step="0.1" value={snapMove}
              onChange={(e)=> setSnapMove(e.target.value)} />
          </div>
          <div className="row">
            <label>회전 스냅(도)</label>
            <input type="number" step="1" value={snapRotateDeg}
              onChange={(e)=> setSnapRotateDeg(e.target.value)} />
          </div>
          <div className="row">
            <label>크기 스냅</label>
            <input type="number" step="0.01" value={snapScale}
              onChange={(e)=> setSnapScale(e.target.value)} />
          </div>
          <div className="hint">스냅은 그리드 스냅이 활성화되어야 적용됩니다.</div>
        </div>
      )}

  {/* 자석 기능 UI 제거됨 */}
    </div>
  )
}

export default ViewportControls
