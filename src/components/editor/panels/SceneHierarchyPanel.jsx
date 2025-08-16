import { useState, useRef, memo, useMemo } from 'react'
import './SceneHierarchyPanel.css'
import { useEditorStore } from '../../../store/editorStore'
import { setParent as setParent3D, clearParent as clearParent3D, isAncestorOf as isAncestor3D } from '../../../utils/HierarchyUtils'
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
  const [dragOverId, setDragOverId] = useState(null)
  const [dragOverZone, setDragOverZone] = useState(null) // 'above' | 'inside' | 'below'
  
  const [collapsedIds, setCollapsedIds] = useState(() => new Set())
  const [altDupActive, setAltDupActive] = useState(false)
  const store = useEditorStore()

  // 다중 선택된 객체들을 가져오기
  const selectedObjects = editorControls?.selectedObjects || []

  // parentId 기반 트리 구성 (order로 정렬)
  const treeRoots = useMemo(() => {
    const byParent = new Map()
    const list = Array.isArray(objects) ? objects : []
    for (const o of list) {
      const pid = Object.prototype.hasOwnProperty.call(o, 'parentId') && o.parentId != null ? o.parentId : null
      if (!byParent.has(pid)) byParent.set(pid, [])
      byParent.get(pid).push(o)
    }
    for (const arr of byParent.values()) {
      arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }
    return { roots: byParent.get(null) || [], byParent }
  }, [objects])

  // 접기/펼치기 토글
  const toggleCollapse = (id) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleNameClick = (e, obj) => {
    // EditorControls를 통해 실제 Three.js 오브젝트 선택
    if (editorControls) {
      const threeObject = editorControls.findObjectById(obj.id)
      if (threeObject) {
        if (e?.ctrlKey || e?.metaKey) {
          // 토글 선택 (멀티)
          try { editorControls.objectSelector?.toggleObjectSelection?.(threeObject) } catch {}
        } else {
          editorControls.selectObject(threeObject)
        }
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

  // DnD: 드래그 시작 - 선택된 ID 집합을 payload로
  const handleDragStart = (e, obj) => {
    try { e.stopPropagation() } catch {}
    const selectedIds = Array.isArray(store.selectedIds) && store.selectedIds.length > 0
      ? store.selectedIds
      : [obj.id]

    // Alt 드래그: 복제 후 복제본을 드래그 대상으로
    if (e.altKey && editorControls) {
      try {
        const threes = selectedIds.map(id => editorControls.findObjectById(id)).filter(Boolean)
        if (threes.length > 0) {
          editorControls.deselectAllObjects?.()
          editorControls.objectSelector?.selectMultipleObjects?.(threes, false)
          const clones = editorControls.transformManager?.duplicateSelected?.() || []
          const newIds = Array.isArray(clones) ? clones.map(c => c?.userData?.id).filter(Boolean) : []
          if (newIds.length > 0) {
      setAltDupActive(true)
      const json = JSON.stringify({ ids: newIds })
      e.dataTransfer.setData('application/json', json)
      e.dataTransfer.setData('text/plain', json)
            e.dataTransfer.effectAllowed = 'move'
            return
          }
        }
      } catch {}
    }

    const json = JSON.stringify({ ids: selectedIds })
    e.dataTransfer.setData('application/json', json)
    e.dataTransfer.setData('text/plain', json)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, targetObj) => {
    e.preventDefault()
    setIsDraggingToRoot(false)
    const id = targetObj?.id ?? null
    setDragOverId(id)
    // 상/하/안쪽 판정
    try {
      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top
      const h = rect.height || 1
      const zone = y < h * 0.25 ? 'above' : (y > h * 0.75 ? 'below' : 'inside')
      setDragOverZone(zone)
    } catch {
      setDragOverZone('inside')
    }
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragLeave = (e, targetObj) => {
    const id = targetObj?.id ?? null
    // dragOverId와 dragOverZone을 일관되게 초기화 (클로저로 인한 상태 불일치 방지)
    setDragOverId((prevId) => {
      if (prevId === id) {
        setDragOverZone(null)
        return null
      }
      return prevId
    })
  }

  const handleDropOnItem = (e, targetObj) => {
    e.preventDefault()
    setDragOverId(null)
    setDragOverZone(null)
    setIsDraggingToRoot(false)
    // cross-browser: application/json이 비어있으면 text/plain도 시도
    let payload = null
    try {
      const txt = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain') || ''
      if (txt) payload = JSON.parse(txt)
    } catch {}
    const ids = Array.isArray(payload?.ids) ? payload.ids : []
    if (!ids.length || !targetObj) return
    const api = store
    try { api.beginBatch && api.beginBatch() } catch {}
    const zone = dragOverZone || 'inside'
    if (zone === 'inside') {
      for (const id of ids) {
        if (id === targetObj.id) continue
        const child3 = editorControls?.findObjectById?.(id)
        const parent3 = editorControls?.findObjectById?.(targetObj.id)
        if (child3 && parent3 && isAncestor3D(child3, parent3)) continue
        try { api.setParent && api.setParent(id, targetObj.id) } catch {}
        if (child3 && parent3) { try { setParent3D(child3, parent3, true) } catch {} }
      }
    } else {
      // 상/하: 같은 부모로 이동 후 순서 조정
      const newParentId = targetObj.parentId ?? null
      for (const id of ids) {
        if (id === targetObj.id) continue
        const child3 = editorControls?.findObjectById?.(id)
        const targetParent3 = newParentId != null ? editorControls?.findObjectById?.(newParentId) : editorControls?.scene
        if (child3 && targetParent3 && isAncestor3D(child3, targetParent3)) continue
        try { api.setParent && api.setParent(id, newParentId) } catch {}
        if (child3) {
          try {
            if (newParentId == null) { clearParent3D(child3, editorControls?.scene, true) }
            else { const p3 = editorControls?.findObjectById?.(newParentId); if (p3) setParent3D(child3, p3, true) }
          } catch {}
        }
      }
      // 순서 재배치
      try {
        const all = Array.isArray(objects) ? objects : []
        const siblings = all.filter(o => (o.parentId ?? null) === (newParentId ?? null))
        const moveSet = new Set(ids)
        const base = siblings.map(s => s.id).filter(id => !moveSet.has(id))
        const targetIdx = base.indexOf(targetObj.id)
        const insertIdx = zone === 'above' ? Math.max(0, targetIdx) : Math.min(base.length, targetIdx + 1)
        const orderedIds = [...base.slice(0, insertIdx), ...ids, ...base.slice(insertIdx)]
        api.reorderSiblings && api.reorderSiblings(newParentId, orderedIds)
      } catch {}
    }
    try { api.endBatch && api.endBatch() } catch {}
    try { editorControls?.objectSelector?.updateAllSelectionOutlines?.() } catch {}
  }

  

  const renderObjectItem = (obj, isWall = false, depth = 0) => {
    // 단일 선택 확인
    const isSingleSelected = selectedObject?.name === obj.name || selectedObject?.id === obj.id
    
    // 다중 선택 확인 - editorControls에서 selectedObjects 배열 사용
    const isMultiSelected = selectedObjects.some(selectedObj => 
      selectedObj?.name === obj.name || 
      selectedObj?.id === obj.id ||
      selectedObj?.userData?.id === obj.id
    )
    // 스토어 선택 아이디 기반 보정
    const isStoreSelected = Array.isArray(store?.selectedIds) ? store.selectedIds.includes(obj.id) : false
    
    const isSelected = isSingleSelected || isMultiSelected || isStoreSelected
    const isEditing = editingId === obj.id
    const isDragOver = dragOverId === obj.id
    const children = treeRoots.byParent.get(obj.id) || []
    const indent = Math.max(0, depth) * 12
    const collapsed = collapsedIds.has(obj.id)
    const showChildren = !collapsed
    const zone = isDragOver ? (dragOverZone || 'inside') : null
    
    return (
      <>
        <div 
          key={obj.id} 
          className={`object-item ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
          data-selected={isSelected ? 'true' : 'false'}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 8px',
            margin: '2px 0',
            borderRadius: '3px',
            backgroundColor: isSelected ? '#ff8c00' : (isDragOver && zone === 'inside' ? '#2d2d2d' : '#252525'),
            borderLeft: `3px solid ${isSelected ? '#ff6600' : 'transparent'}`,
            border: isSelected ? '2px solid #ff6600' : '1px solid transparent',
            borderTop: isDragOver && zone === 'above' ? '2px solid #00b894' : undefined,
            borderBottom: isDragOver && zone === 'below' ? '2px solid #00b894' : undefined,
            transition: 'all 0.2s ease',
            minHeight: '28px',
            width: '100%',
            boxSizing: 'border-box',
            boxShadow: isSelected ? '0 0 8px rgba(255, 140, 0, 0.8)' : 'none',
            transform: isSelected ? 'scale(1.02)' : 'scale(1)',
            paddingLeft: `${8 + indent}px`
          }}
          onContextMenu={(e) => onContextMenu && onContextMenu(e, obj)}
          draggable={!isWall}
          onDragStart={(e) => !isWall && handleDragStart(e, obj)}
          onDragOver={(e) => !isWall && handleDragOver(e, obj)}
          onDragLeave={(e) => !isWall && handleDragLeave(e, obj)}
          onDrop={(e) => !isWall && handleDropOnItem(e, obj)}
          onDragEnd={() => { setDragOverId(null); setDragOverZone(null); setIsDraggingToRoot(false) }}
        >
          {/* 접기/펼치기 */}
          <button
            onClick={(ev) => { ev.stopPropagation(); toggleCollapse(obj.id) }}
            title={collapsed ? '펼치기' : '접기'}
            style={{
              background: 'none', border: 'none', color: '#aaa', cursor: 'pointer',
              width: 16, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >{children.length > 0 ? (collapsed ? '▸' : '▾') : '·'}</button>
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
            {obj.visible !== false ? '👁' : '🙈'}
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
              onClick={(e) => handleNameClick(e, obj)}
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
        {/* children */}
  {children.length > 0 && showChildren && (
          <div>
            {children.map(child => renderObjectItem(child, isWall, depth + 1))}
          </div>
        )}
      </>
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
              {treeRoots.roots.map(obj => renderObjectItem(obj, false, 0))}
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
