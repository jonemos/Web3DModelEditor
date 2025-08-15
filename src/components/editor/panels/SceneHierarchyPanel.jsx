import { useState, useRef, memo } from 'react'
import './SceneHierarchyPanel.css'

const SceneHierarchyPanel = memo(function SceneHierarchyPanel({ 
  objects, 
  walls, 
  selectedObject, 
  onObjectVisibilityToggle, 
  onObjectFreezeToggle,
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

  // 다중 선택된 객체들을 가져오기
  const selectedObjects = editorControls?.selectedObjects || []

  const handleNameClick = (obj) => {
    // EditorControls를 통해 실제 Three.js 오브젝트 선택
    if (editorControls) {
      const threeObject = editorControls.findObjectById(obj.id)
      if (threeObject) {
        editorControls.selectObject(threeObject)
      }
    }
    // 항상 상위 컴포넌트에 선택 상태 전달
    onObjectSelect(obj)
  }

  const handleNameDoubleClick = (obj) => {
    // EditorControls를 통해 포커스 (카메라 이동)
    if (editorControls) {
      const threeObject = editorControls.findObjectById(obj.id)
      if (threeObject) {
        editorControls.selectObject(threeObject)
        onObjectFocus(obj)
      }
    } else {
      onObjectFocus(obj)
    }
    
    setEditingId(obj.id)
    setEditingName(obj.name)
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }, 50)
  }

  const handleNameChange = (e) => {
    setEditingName(e.target.value)
  }

  const handleNameSubmit = (obj) => {
    if (editingName.trim() && editingName !== obj.name) {
      onObjectRename(obj, editingName.trim())
    }
    setEditingId(null)
    setEditingName('')
  }

  const handleNameKeyDown = (e, obj) => {
    if (e.key === 'Enter') {
      handleNameSubmit(obj)
    } else if (e.key === 'Escape') {
      setEditingId(null)
      setEditingName('')
    }
  }

  const handleNameBlur = (obj) => {
    handleNameSubmit(obj)
  }

  const renderObjectItem = (obj, isWall = false) => {
    // 단일 선택 확인
    const isSingleSelected = selectedObject?.name === obj.name || selectedObject?.id === obj.id
    
    // 다중 선택 확인 - editorControls에서 selectedObjects 배열 사용
    const isMultiSelected = selectedObjects.some(selectedObj => 
      selectedObj?.name === obj.name || 
      selectedObj?.id === obj.id ||
      selectedObj?.userData?.id === obj.id
    )
    
    const isSelected = isSingleSelected || isMultiSelected
    const isEditing = editingId === obj.id
    
    return (
      <div 
        key={obj.id} 
        className={`object-item ${isSelected ? 'selected' : ''}`}
        data-selected={isSelected ? 'true' : 'false'}
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 8px',
          margin: '2px 0',
          borderRadius: '3px',
          backgroundColor: isSelected ? '#ff8c00' : '#252525',
          borderLeft: `3px solid ${isSelected ? '#ff6600' : 'transparent'}`,
          border: isSelected ? '2px solid #ff6600' : '1px solid transparent',
          transition: 'all 0.2s ease',
          minHeight: '28px',
          width: '100%',
          boxSizing: 'border-box',
          boxShadow: isSelected ? '0 0 8px rgba(255, 140, 0, 0.8)' : 'none',
          transform: isSelected ? 'scale(1.02)' : 'scale(1)'
        }}
        onContextMenu={(e) => onContextMenu && onContextMenu(e, obj)}
      >
        <button
          className="visibility-btn"
          onClick={() => onObjectVisibilityToggle(obj)}
          title={obj.visible !== false ? "숨기기" : "보이기"}
          style={{
            background: 'none',
            border: 'none',
            color: isSelected ? '#ffffff' : '#cccccc',
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '2px',
            fontSize: '14px',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            flexGrow: 0
          }}
        >
          {obj.visible !== false ? '👁' : '�'}
        </button>
        
        <span className="object-icon" style={{
          fontSize: '16px',
          flexShrink: 0,
          flexGrow: 0,
          width: '20px',
          textAlign: 'center'
        }}>
          {isWall ? '🧱' : obj.type === 'player' ? '🚶' : '📦'}
        </span>
        
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editingName}
            onChange={handleNameChange}
            onBlur={() => handleNameBlur(obj)}
            onKeyDown={(e) => handleNameKeyDown(e, obj)}
            className="object-name-input"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span 
            className="object-name"
            onClick={() => handleNameClick(obj)}
            onDoubleClick={() => handleNameDoubleClick(obj)}
            style={{
              flex: '1',
              flexGrow: 1,
              flexShrink: 1,
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: '3px',
              fontSize: '12px',
              color: isSelected ? '#ffffff' : '#cccccc',
              userSelect: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              fontWeight: isSelected ? 'bold' : 'normal'
            }}
          >
            {obj.name}
          </span>
        )}
        
        <button
          className={`freeze-btn ${obj.frozen ? 'frozen' : ''}`}
          onClick={() => onObjectFreezeToggle(obj)}
          title={obj.frozen ? "고정 해제" : "고정"}
          style={{
            background: obj.frozen ? '#ff6b6b' : 'none',
            border: 'none',
            color: obj.frozen ? '#ffffff' : (isSelected ? '#ffffff' : '#cccccc'),
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '2px',
            fontSize: '14px',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            flexGrow: 0
          }}
        >
          {obj.frozen ? '🔒' : '🔓'}
        </button>
        
        <button
          className="delete-btn"
          onClick={() => onObjectRemove(obj)}
          title="삭제"
            style={{
              background: 'none',
              border: 'none',
              color: isSelected ? '#ffcccc' : '#ff6b6b',
              cursor: 'pointer',
              padding: '2px',
              borderRadius: '2px',
              fontSize: '12px',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              flexGrow: 0,
              fontWeight: 'bold'
            }}
          >
            ×
          </button>
      </div>
    )
  }

  return (
    <div className="scene-hierarchy-panel">
      <div className="panel-header">
        <h3>씬 계층구조</h3>
      </div>
      <div className="panel-content">
        <div className="objects-list">
          {objects && objects.length > 0 && (
            <>
              <h4>오브젝트</h4>
              {objects.map(obj => renderObjectItem(obj, false))}
            </>
          )}
          
          {walls && walls.length > 0 && (
            <>
              <h4>벽</h4>
              {walls.map(wall => renderObjectItem(wall, true))}
            </>
          )}
          
          {(!objects || objects.length === 0) && (!walls || walls.length === 0) && (
            <div className="empty-state">
              씬에 오브젝트가 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default SceneHierarchyPanel
