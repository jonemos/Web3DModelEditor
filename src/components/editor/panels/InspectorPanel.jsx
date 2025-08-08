import { useState, useEffect, memo } from 'react'
import SceneHierarchyPanel from './SceneHierarchyPanel'
import { PropertiesManager } from '../../../utils/PropertiesManager'
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
  const [activeTab, setActiveTab] = useState('transform')
  const [propertiesManager, setPropertiesManager] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0) // 강제 리렌더링용
  const [lastUpdateTime, setLastUpdateTime] = useState(0) // 실시간 업데이트용

  // PropertiesManager 초기화
  useEffect(() => {
    const manager = new PropertiesManager(editorControls)
    
    // 속성 변경 콜백 등록
    manager.onPropertyChange((changeData) => {
      if (onObjectUpdate) {
        onObjectUpdate(changeData)
      }
    })
    
    setPropertiesManager(manager)
    
    return () => {
      manager.dispose()
    }
  }, [editorControls, onObjectUpdate])

  // 선택된 객체 변경 시 PropertiesManager 업데이트
  useEffect(() => {
    console.log('InspectorPanel useEffect 트리거됨:', {
      hasPropertiesManager: !!propertiesManager,
      selectedObject,
      selectedObjectType: selectedObject?.constructor?.name
    })
    
    if (propertiesManager && selectedObject) {
      console.log('PropertiesManager.setSelectedObject 호출 전')
      propertiesManager.setSelectedObject(selectedObject)
      console.log('PropertiesManager.setSelectedObject 호출 후')
      
      // 강제 리렌더링 트리거
      setRefreshKey(prev => prev + 1)
    }
  }, [propertiesManager, selectedObject])

  // 실시간 트랜스폼 업데이트
  useEffect(() => {
    if (!selectedObject || !propertiesManager) return

    const updateInterval = setInterval(() => {
      // 선택된 객체의 트랜스폼이 변경되었는지 확인
      if (propertiesManager.threeObject) {
        const currentTime = Date.now()
        if (currentTime - lastUpdateTime > 100) { // 100ms 간격으로 체크
          setLastUpdateTime(currentTime)
          setRefreshKey(prev => prev + 1)
        }
      }
    }, 100)

    return () => clearInterval(updateInterval)
  }, [selectedObject, propertiesManager, lastUpdateTime])

  const objectType = propertiesManager?.getObjectType() || 'unknown'
  
  console.log('objectType 가져오기:', {
    hasPropertiesManager: !!propertiesManager,
    objectType,
    refreshKey
  })
  
  const objectInfo = propertiesManager?.getObjectInfo()
  
  console.log('objectInfo 가져오기:', {
    hasPropertiesManager: !!propertiesManager,
    objectInfo,
    refreshKey
  })
  
  console.log('InspectorPanel 상태 체크:', {
    hasPropertiesManager: !!propertiesManager,
    hasSelectedObject: !!selectedObject,
    objectType,
    objectInfo,
    refreshKey
  })

  // 탭 목록 정의
  const getAvailableTabs = () => {
    if (!selectedObject) return []
    
    console.log('getAvailableTabs 호출됨:', {
      selectedObject,
      objectType,
      objectName: selectedObject?.name,
      objectConstructor: selectedObject?.constructor?.name
    })
    
    const tabs = [
      { id: 'transform', label: '트랜스폼', icon: '🔄' }
    ]

    // Object 속성 탭 (모든 객체에 대해)
    tabs.push({ id: 'object', label: '오브젝트', icon: '📦' })

    if (objectType === 'mesh') {
      tabs.push({ id: 'material', label: '머티리얼', icon: '🎨' })
    }
    
    if (objectType === 'light') {
      tabs.push({ id: 'light', label: '라이트', icon: '💡' })
    }
    
    if (objectType === 'camera') {
      tabs.push({ id: 'camera', label: '카메라', icon: '📷' })
    }

    console.log('생성된 탭들:', tabs)
    return tabs
  }

  const availableTabs = getAvailableTabs()

  // 현재 탭이 사용할 수 없는 경우 첫 번째 탭으로 변경
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(tab => tab.id === activeTab)) {
      setActiveTab(availableTabs[0].id)
    }
  }, [availableTabs, activeTab])

  // Object 탭 렌더링
  const renderObjectTab = () => {
    if (!objectInfo) {
      return <div style={{color: 'red', padding: '20px'}}>objectInfo가 없습니다</div>
    }

    return (
      <div className="object-properties">
        <div className="property-group">
          <label>Name</label>
          <input
            type="text"
            value={objectInfo.name}
            onChange={(e) => {
              if (propertiesManager?.threeObject) {
                propertiesManager.threeObject.name = e.target.value
                propertiesManager.notifyPropertyChange('object', 'name', e.target.value)
              }
            }}
          />
        </div>

        <div className="property-group">
          <label>Type</label>
          <span className="readonly-value">{objectInfo.type}</span>
        </div>

        <div className="property-group">
          <label>ID</label>
          <span className="readonly-value">{objectInfo.id}</span>
        </div>

        <div className="property-group">
          <label>Visible</label>
          <input
            type="checkbox"
            checked={propertiesManager?.threeObject?.visible !== false}
            onChange={(e) => {
              if (propertiesManager?.threeObject) {
                propertiesManager.threeObject.visible = e.target.checked
                propertiesManager.notifyPropertyChange('object', 'visible', e.target.checked)
              }
            }}
          />
        </div>

        <div className="property-group">
          <label>Cast Shadow</label>
          <input
            type="checkbox"
            checked={propertiesManager?.threeObject?.castShadow || false}
            onChange={(e) => {
              if (propertiesManager?.threeObject) {
                propertiesManager.threeObject.castShadow = e.target.checked
                propertiesManager.notifyPropertyChange('object', 'castShadow', e.target.checked)
              }
            }}
          />
        </div>

        <div className="property-group">
          <label>Receive Shadow</label>
          <input
            type="checkbox"
            checked={propertiesManager?.threeObject?.receiveShadow || false}
            onChange={(e) => {
              if (propertiesManager?.threeObject) {
                propertiesManager.threeObject.receiveShadow = e.target.checked
                propertiesManager.notifyPropertyChange('object', 'receiveShadow', e.target.checked)
              }
            }}
          />
        </div>
      </div>
    )
  }

  // Transform 탭 렌더링
  const renderTransformTab = () => {
    console.log('renderTransformTab 호출됨:', {
      objectInfo: !!objectInfo,
      objectInfoData: objectInfo
    })
    
    if (!objectInfo) {
      console.log('objectInfo가 null이어서 null 반환')
      return <div style={{color: 'red', padding: '20px'}}>objectInfo가 없습니다</div>
    }

    return (
      <div className="transform-properties">
        {/* Position */}
        <div className="transform-row">
          <div className="transform-label">Position</div>
          <div className="transform-inputs">
            <div className="transform-input-group">
              <span className="input-label">X</span>
              <input
                type="number"
                step="0.1"
                value={objectInfo.position.x}
                onChange={(e) => propertiesManager?.setTransformProperty('position', 'x', e.target.value)}
              />
            </div>
            <div className="transform-input-group">
              <span className="input-label">Y</span>
              <input
                type="number"
                step="0.1"
                value={objectInfo.position.y}
                onChange={(e) => propertiesManager?.setTransformProperty('position', 'y', e.target.value)}
              />
            </div>
            <div className="transform-input-group">
              <span className="input-label">Z</span>
              <input
                type="number"
                step="0.1"
                value={objectInfo.position.z}
                onChange={(e) => propertiesManager?.setTransformProperty('position', 'z', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Rotation */}
        <div className="transform-row">
          <div className="transform-label">Rotation</div>
          <div className="transform-inputs">
            <div className="transform-input-group">
              <span className="input-label">X</span>
              <input
                type="number"
                step="1"
                value={objectInfo.rotation.x}
                onChange={(e) => propertiesManager?.setTransformProperty('rotation', 'x', e.target.value)}
              />
            </div>
            <div className="transform-input-group">
              <span className="input-label">Y</span>
              <input
                type="number"
                step="1"
                value={objectInfo.rotation.y}
                onChange={(e) => propertiesManager?.setTransformProperty('rotation', 'y', e.target.value)}
              />
            </div>
            <div className="transform-input-group">
              <span className="input-label">Z</span>
              <input
                type="number"
                step="1"
                value={objectInfo.rotation.z}
                onChange={(e) => propertiesManager?.setTransformProperty('rotation', 'z', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Scale */}
        <div className="transform-row">
          <div className="transform-label">Scale</div>
          <div className="transform-inputs">
            <div className="transform-input-group">
              <span className="input-label">X</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={objectInfo.scale.x}
                onChange={(e) => propertiesManager?.setTransformProperty('scale', 'x', e.target.value)}
              />
            </div>
            <div className="transform-input-group">
              <span className="input-label">Y</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={objectInfo.scale.y}
                onChange={(e) => propertiesManager?.setTransformProperty('scale', 'y', e.target.value)}
              />
            </div>
            <div className="transform-input-group">
              <span className="input-label">Z</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={objectInfo.scale.z}
                onChange={(e) => propertiesManager?.setTransformProperty('scale', 'z', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Material 탭 렌더링
  const renderMaterialTab = () => {
    if (objectType !== 'mesh') return <div className="not-available">메시 객체가 아닙니다</div>

    return (
      <div className="material-properties">
        <div className="property-group">
          <label>Color</label>
          <input
            type="color"
            value={propertiesManager?.getMaterialProperty('color') || '#ffffff'}
            onChange={(e) => propertiesManager?.setMaterialProperty('color', e.target.value)}
          />
        </div>

        <div className="property-group">
          <label>Metalness</label>
          <div className="range-input">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={propertiesManager?.getMaterialProperty('metalness') || 0}
              onChange={(e) => propertiesManager?.setMaterialProperty('metalness', e.target.value)}
            />
            <span>{(propertiesManager?.getMaterialProperty('metalness') || 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="property-group">
          <label>Roughness</label>
          <div className="range-input">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={propertiesManager?.getMaterialProperty('roughness') || 0.8}
              onChange={(e) => propertiesManager?.setMaterialProperty('roughness', e.target.value)}
            />
            <span>{(propertiesManager?.getMaterialProperty('roughness') || 0.8).toFixed(2)}</span>
          </div>
        </div>

        <div className="property-group">
          <label>Emissive</label>
          <input
            type="color"
            value={propertiesManager?.getMaterialProperty('emissive') || '#000000'}
            onChange={(e) => propertiesManager?.setMaterialProperty('emissive', e.target.value)}
          />
        </div>

        <div className="property-group">
          <label>Emissive Intensity</label>
          <div className="range-input">
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={propertiesManager?.getMaterialProperty('emissiveIntensity') || 0}
              onChange={(e) => propertiesManager?.setMaterialProperty('emissiveIntensity', e.target.value)}
            />
            <span>{(propertiesManager?.getMaterialProperty('emissiveIntensity') || 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="property-group">
          <label>Opacity</label>
          <div className="range-input">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={propertiesManager?.getMaterialProperty('opacity') || 1}
              onChange={(e) => propertiesManager?.setMaterialProperty('opacity', e.target.value)}
            />
            <span>{(propertiesManager?.getMaterialProperty('opacity') || 1).toFixed(2)}</span>
          </div>
        </div>
      </div>
    )
  }

  // Light 탭 렌더링
  const renderLightTab = () => {
    if (objectType !== 'light') return <div className="not-available">라이트 객체가 아닙니다</div>

    const lightType = propertiesManager?.getLightProperty('type')

    return (
      <div className="light-properties">
        <div className="property-group">
          <label>Type</label>
          <span className="readonly-value">{lightType}</span>
        </div>

        <div className="property-group">
          <label>Color</label>
          <input
            type="color"
            value={propertiesManager?.getLightProperty('color') || '#ffffff'}
            onChange={(e) => propertiesManager?.setLightProperty('color', e.target.value)}
          />
        </div>

        <div className="property-group">
          <label>Intensity</label>
          <div className="range-input">
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={propertiesManager?.getLightProperty('intensity') || 1}
              onChange={(e) => propertiesManager?.setLightProperty('intensity', e.target.value)}
            />
            <span>{(propertiesManager?.getLightProperty('intensity') || 1).toFixed(1)}</span>
          </div>
        </div>

        {/* SpotLight specific properties */}
        {lightType === 'SpotLight' && (
          <>
            <div className="property-group">
              <label>Distance</label>
              <input
                type="number"
                min="0"
                step="1"
                value={propertiesManager?.getLightProperty('distance') || 0}
                onChange={(e) => propertiesManager?.setLightProperty('distance', e.target.value)}
              />
            </div>

            <div className="property-group">
              <label>Angle</label>
              <div className="range-input">
                <input
                  type="range"
                  min="0"
                  max="1.57"
                  step="0.01"
                  value={propertiesManager?.getLightProperty('angle') || 0}
                  onChange={(e) => propertiesManager?.setLightProperty('angle', e.target.value)}
                />
                <span>{(propertiesManager?.getLightProperty('angle') || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="property-group">
              <label>Penumbra</label>
              <div className="range-input">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={propertiesManager?.getLightProperty('penumbra') || 0}
                  onChange={(e) => propertiesManager?.setLightProperty('penumbra', e.target.value)}
                />
                <span>{(propertiesManager?.getLightProperty('penumbra') || 0).toFixed(2)}</span>
              </div>
            </div>
          </>
        )}

        {/* PointLight and SpotLight distance/decay */}
        {(lightType === 'PointLight' || lightType === 'SpotLight') && (
          <>
            {lightType === 'PointLight' && (
              <div className="property-group">
                <label>Distance</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={propertiesManager?.getLightProperty('distance') || 0}
                  onChange={(e) => propertiesManager?.setLightProperty('distance', e.target.value)}
                />
              </div>
            )}

            <div className="property-group">
              <label>Decay</label>
              <div className="range-input">
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={propertiesManager?.getLightProperty('decay') || 1}
                  onChange={(e) => propertiesManager?.setLightProperty('decay', e.target.value)}
                />
                <span>{(propertiesManager?.getLightProperty('decay') || 1).toFixed(1)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // Camera 탭 렌더링
  const renderCameraTab = () => {
    if (objectType !== 'camera') return <div className="not-available">카메라 객체가 아닙니다</div>

    return (
      <div className="camera-properties">
        <div className="property-group">
          <label>Type</label>
          <span className="readonly-value">{propertiesManager?.getCameraProperty('type')}</span>
        </div>

        <div className="property-group">
          <label>FOV</label>
          <div className="range-input">
            <input
              type="range"
              min="10"
              max="120"
              step="1"
              value={propertiesManager?.getCameraProperty('fov') || 75}
              onChange={(e) => propertiesManager?.setCameraProperty('fov', e.target.value)}
            />
            <span>{propertiesManager?.getCameraProperty('fov') || 75}°</span>
          </div>
        </div>

        <div className="property-group">
          <label>Near</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={propertiesManager?.getCameraProperty('near') || 0.1}
            onChange={(e) => propertiesManager?.setCameraProperty('near', e.target.value)}
          />
        </div>

        <div className="property-group">
          <label>Far</label>
          <input
            type="number"
            min="1"
            step="1"
            value={propertiesManager?.getCameraProperty('far') || 1000}
            onChange={(e) => propertiesManager?.setCameraProperty('far', e.target.value)}
          />
        </div>
      </div>
    )
  }

  const renderTabContent = () => {
    console.log('renderTabContent 디버깅:', {
      selectedObject: !!selectedObject,
      activeTab,
      objectType,
      objectInfo: !!objectInfo,
      objectInfoDetails: objectInfo
    })
    
    if (!selectedObject) {
      return (
        <div className="no-selection">
          <div className="no-selection-icon">📦</div>
          <div className="no-selection-text">오브젝트를 선택하세요</div>
          <div className="no-selection-hint">씬 계층구조에서 오브젝트를 클릭하거나<br/>3D 뷰에서 직접 선택할 수 있습니다</div>
        </div>
      )
    }

    switch (activeTab) {
      case 'transform':
        const transformResult = renderTransformTab()
        console.log('renderTransformTab 결과:', transformResult)
        return transformResult
      case 'object':
        return renderObjectTab()
      case 'material':
        return renderMaterialTab()
      case 'light':
        return renderLightTab()
      case 'camera':
        return renderCameraTab()
      default:
        return renderTransformTab()
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
            {selectedObject && objectInfo && (
              <div className="object-info">
                <span className="object-name">{objectInfo.name}</span>
                <span className="object-type">({objectType})</span>
              </div>
            )}
          </div>
          
          {/* 탭 네비게이션 */}
          {selectedObject && availableTabs.length > 0 && (
            <div className="properties-tabs">
              {availableTabs.map(tab => (
                <button
                  key={tab.id}
                  className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="tab-icon">{tab.icon}</span>
                  <span className="tab-label">{tab.label}</span>
                </button>
              ))}
            </div>
          )}

          <div className="properties-container">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  )
})

export default InspectorPanel
