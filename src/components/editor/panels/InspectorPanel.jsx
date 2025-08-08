import { useState, memo } from 'react'
import SceneHierarchyPanel from './SceneHierarchyPanel'
import ObjectPropertiesPanel from './ObjectPropertiesPanel'
import './InspectorPanel.css'

const InspectorPanel = memo(function InspectorPanel({
  // SceneHierarchy 관련 props
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
  editorControls,
  
  // ObjectProperties 관련 props
  onObjectUpdate,
  
  onClose
}) {
  // 탭 제거하고 세로 구조로 변경

  // 선택된 객체 타입 확인
  const getSelectedObjectType = () => {
    if (!selectedObject) return null
    
    // 3D 뷰에서 선택된 객체 가져오기
    const threeObject = editorControls?.findObjectById(selectedObject.id || selectedObject)
    
    if (threeObject) {
      // Three.js 객체 타입별 분류
      if (threeObject.isLight) return 'light'
      if (threeObject.isCamera) return 'camera'
      if (threeObject.isHelper) return 'helper'
      if (threeObject.isMesh) return 'mesh'
      if (threeObject.isGroup) return 'group'
    }
    
    // 스토어 객체 타입별 분류
    if (selectedObject.type === 'glb') return 'mesh'
    if (selectedObject.type === 'basic') return 'mesh'
    if (selectedObject.type === 'cube') return 'mesh'
    if (selectedObject.type === 'ground') return 'mesh'
    if (selectedObject.type === 'light') return 'light'
    if (selectedObject.type === 'camera') return 'camera'
    
    return 'mesh' // 기본값
  }

  const selectedObjectType = getSelectedObjectType()

  const renderPropertiesContent = () => {
    if (!selectedObject) {
      return (
        <div className="no-selection">
          <div className="no-selection-icon">📦</div>
          <div className="no-selection-text">오브젝트를 선택하세요</div>
          <div className="no-selection-hint">씬 계층구조에서 오브젝트를 클릭하거나<br/>3D 뷰에서 직접 선택할 수 있습니다</div>
        </div>
      )
    }

    switch (selectedObjectType) {
      case 'mesh':
        return (
          <ObjectPropertiesPanel
            selectedObject={selectedObject}
            onObjectUpdate={onObjectUpdate}
          />
        )
      
      case 'light':
        return (
          <div className="properties-section">
            <h4>라이트 속성</h4>
            <div className="property-group">
              <label>타입</label>
              <span>{selectedObject.lightType || 'DirectionalLight'}</span>
            </div>
            <div className="property-group">
              <label>색상</label>
              <input 
                type="color" 
                defaultValue="#ffffff"
                onChange={(e) => {
                  // 라이트 색상 변경 로직
                }}
              />
            </div>
            <div className="property-group">
              <label>강도</label>
              <input 
                type="range" 
                min="0" 
                max="2" 
                step="0.1"
                defaultValue="1"
                onChange={(e) => {
                  // 라이트 강도 변경 로직
                }}
              />
            </div>
          </div>
        )
      
      case 'camera':
        return (
          <div className="properties-section">
            <h4>카메라 속성</h4>
            <div className="property-group">
              <label>타입</label>
              <span>PerspectiveCamera</span>
            </div>
            <div className="property-group">
              <label>FOV</label>
              <input 
                type="range" 
                min="10" 
                max="120" 
                defaultValue="75"
                onChange={(e) => {
                  // 카메라 FOV 변경 로직
                }}
              />
            </div>
          </div>
        )
      
      case 'helper':
        return (
          <div className="properties-section">
            <h4>헬퍼 속성</h4>
            <div className="property-group">
              <label>타입</label>
              <span>{selectedObject.helperType || 'Helper'}</span>
            </div>
            <div className="property-group">
              <label>가시성</label>
              <input 
                type="checkbox" 
                defaultChecked={true}
                onChange={(e) => {
                  // 헬퍼 가시성 변경 로직
                }}
              />
            </div>
          </div>
        )
      
      default:
        return (
          <ObjectPropertiesPanel
            selectedObject={selectedObject}
            onObjectUpdate={onObjectUpdate}
          />
        )
    }
  }

  return (
    <div className="inspector-panel">
      <div className="inspector-header">
        <h3>인스펙터</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="inspector-content">
        {/* 계층구조 섹션 */}
        <div className="hierarchy-section">
          <div className="section-header">
            <h4>씬 계층구조</h4>
          </div>
          <div className="hierarchy-container">
            <SceneHierarchyPanel
              objects={objects}
              walls={walls}
              selectedObject={selectedObject}
              onObjectVisibilityToggle={onObjectVisibilityToggle}
              onObjectFreezeToggle={onObjectFreezeToggle}
              onObjectSelect={onObjectSelect}
              onObjectRemove={onObjectRemove}
              onObjectFocus={onObjectFocus}
              onObjectRename={onObjectRename}
              onContextMenu={onContextMenu}
              editorControls={editorControls}
            />
          </div>
        </div>

        {/* 속성 섹션 */}
        <div className="properties-section-wrapper">
          <div className="section-header">
            <h4>속성</h4>
          </div>
          <div className="properties-container">
            {renderPropertiesContent()}
          </div>
        </div>
      </div>
    </div>
  )
})

export default InspectorPanel
