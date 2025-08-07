import { useState, useRef, memo } from 'react'
import './SceneHierarchyPanel.css'

const SceneHierarchyPanel = memo(function SceneHierarchyPanel({ 
  objects, 
  walls, 
  selectedObject, 
  onObjectVisibilityToggle, 
  onObjectSelect, 
  onObjectRemove,
  onObjectFocus,
  onObjectRename,
  onContextMenu,
  editorControls
}) {
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const inputRef = useRef(null)

  // 디버깅용 로그 (필요시에만)
  // Scene hierarchy panel rendering

  const handleNameClick = (obj) => {
    // Name clicked in hierarchy
    
    // EditorControls를 통해 실제 Three.js 오브젝트 선택
    if (editorControls) {
      const threeObject = editorControls.findObjectById(obj.id)
      if (threeObject) {
        // EditorControls의 선택 기능 사용 (3D 뷰에서 클릭하는 것과 동일)
        editorControls.selectObject(threeObject)
        // Three.js object selected via hierarchy
      } else {
        // Three.js object not found for ID
      }
    } else {
      // fallback: EditorControls가 없는 경우 기존 방식 사용
      onObjectSelect(obj)
    }
  }

  const handleNameDoubleClick = (obj) => {
    // Name double clicked in hierarchy
    
    // EditorControls를 통해 포커스 (카메라 이동)
    if (editorControls) {
      const threeObject = editorControls.findObjectById(obj.id)
      if (threeObject) {
        // 먼저 선택하고
        editorControls.selectObject(threeObject)
        // 그 다음 포커스 (카메라 이동)
        if (editorControls.focusOnObject) {
          editorControls.focusOnObject(threeObject)
        }
        // Focused on Three.js object via hierarchy
      } else {
        // Three.js object not found for focus
      }
    } else {
      // fallback: EditorControls가 없는 경우 기존 방식 사용
      onObjectFocus(obj)
    }
  }

  const handleRename = (obj) => {
    setEditingId(obj.id)
    setEditingName(obj.name)
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }, 0)
  }

  const handleRenameSubmit = (obj) => {
    // Rename submission in hierarchy
    if (editingName.trim() && editingName !== obj.name) {
      onObjectRename(obj, editingName.trim())
    }
    setEditingId(null)
    setEditingName('')
  }

  const handleRenameCancel = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleKeyDown = (e, obj) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(obj)
    } else if (e.key === 'Escape') {
      handleRenameCancel()
    } else if (e.key === 'F2' && !editingId) {
      e.preventDefault()
      handleRename(obj)
    }
  }

  const handleObjectDelete = (obj) => {
    // Delete object from hierarchy
    
    // 삭제 확인 메시지
    const confirmMessage = `"${obj.name || '이름 없음'}"을(를) 삭제하시겠습니까?`;
    
    if (window.confirm(confirmMessage)) {
      // 객체 삭제 실행 (EditorUI의 handleObjectRemove가 기즈모 해제를 처리함)
      onObjectRemove(obj);
    }
  }
  return (
    <div className="panel-section hierarchy-section expanded-section">
      <h3>씬 오브젝트 ({objects.length + walls.length})</h3>
      <div className="hierarchy-list">
        {/* 오브젝트 섹션 */}
        {objects.length > 0 && (
          <div className="hierarchy-category">
            <div className="category-header">
              <span className="category-icon">📦</span>
              <span>모델 ({objects.length})</span>
            </div>
            {objects.map((obj, index) => (
              <div 
                key={obj.id || index} 
                className="hierarchy-item"
                onKeyDown={(e) => handleKeyDown(e, obj)}
                onContextMenu={(e) => onContextMenu && onContextMenu(e, obj)}
                tabIndex={0}
              >
                <button 
                  className="visibility-btn"
                  onClick={() => onObjectVisibilityToggle(obj)}
                  title={obj.visible !== false ? "숨기기" : "보이기"}
                >
                  {obj.visible !== false ? '👁️' : '🙈'}
                </button>
                {editingId === obj.id ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleRenameSubmit(obj)}
                    onKeyDown={(e) => handleKeyDown(e, obj)}
                    className="object-name-input"
                  />
                ) : (
                  <span 
                    className={`object-name ${selectedObject?.id === obj.id ? 'selected' : ''}`}
                    onClick={() => handleNameClick(obj)}
                    onDoubleClick={() => handleNameDoubleClick(obj)}
                    title={`모델: ${obj.name} (더블클릭: 포커스, F2: 이름변경)`}
                  >
                    {obj.name}
                  </span>
                )}
                <button 
                  className="delete-btn"
                  onClick={() => handleObjectDelete(obj)}
                  title="삭제"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* 벽 섹션 */}
        {walls.length > 0 && (
          <div className="hierarchy-category">
            <div className="category-header">
              <span className="category-icon">🧱</span>
              <span>벽 ({walls.length})</span>
            </div>
            {walls.map((wall, index) => (
              <div 
                key={wall.id || index} 
                className="hierarchy-item"
                onKeyDown={(e) => handleKeyDown(e, wall)}
                onContextMenu={(e) => onContextMenu && onContextMenu(e, wall)}
                tabIndex={0}
              >
                <button 
                  className="visibility-btn"
                  onClick={() => onObjectVisibilityToggle(wall)}
                  title={wall.visible !== false ? "숨기기" : "보이기"}
                >
                  {wall.visible !== false ? '👁️' : '🙈'}
                </button>
                {editingId === wall.id ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleRenameSubmit(wall)}
                    onKeyDown={(e) => handleKeyDown(e, wall)}
                    className="object-name-input"
                  />
                ) : (
                  <span 
                    className={`object-name ${selectedObject?.id === wall.id ? 'selected' : ''}`}
                    onClick={() => handleNameClick(wall)}
                    onDoubleClick={() => handleNameDoubleClick(wall)}
                    title={`벽: ${wall.name} (더블클릭: 포커스, F2: 이름변경)`}
                  >
                    {wall.name}
                  </span>
                )}
                <button 
                  className="delete-btn"
                  onClick={() => handleObjectDelete(wall)}
                  title="삭제"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* 오브젝트가 없는 경우 */}
        {objects.length === 0 && walls.length === 0 && (
          <div className="empty-hierarchy">
            <p>씬에 오브젝트가 없습니다</p>
            <small>메뉴에서 오브젝트를 추가하세요</small>
          </div>
        )}
      </div>
    </div>
  )
})

export default SceneHierarchyPanel
