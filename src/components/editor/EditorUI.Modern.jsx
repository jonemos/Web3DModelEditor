/**
 * EditorUI Modern - 새 아키텍처와 통합된 에디터 UI
 * 
 * 주요 특징:
 * - 서비스 레지스트리 통합
 * - 이벤트 기반 상태 관리
 * - 플러그인 시스템 UI 지원
 * - 동적 패널 등록
 */

import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFExporter } from 'three-stdlib'
import { useEditorStore } from '../../store/editorStore'
import InspectorPanel from './panels/InspectorPanel'
import LibraryPanel from './panels/LibraryPanel'
import AssetsPanel from './panels/AssetsPanel'
import PostProcessingPanel from './panels/PostProcessingPanel'
import HDRIPanel from './panels/HDRIPanel'
import ContextMenu from './ContextMenu'
import Toast from '../ui/Toast'
import { app } from '../../core/ApplicationBootstrap.js'
import { eventBus, EventTypes } from '../../core/EventBus.js'
import './EditorUI.css'

function EditorUIModern({ 
  editorControls, 
  postProcessingManager, 
  onAddToLibrary, 
  showInspector, 
  onToggleInspector,
  isNewArchitectureEnabled = false 
}) {
  // 기존 Zustand 스토어 (호환성 유지)
  const {
    selectedObject,
    transformMode,
    objects,
    walls,
    savedObjects,
    setTransformMode,
    addWall,
    addObject,
    removeObject,
    addAsset,
    saveMap,
    loadMap,
    clearMap,
    toggleObjectVisibility,
    toggleObjectFreeze,
    renameObject,
    setSelectedObject
  } = useEditorStore()

  // UI 상태
  const [mapName, setMapName] = useState('')
  const [assetName, setAssetName] = useState('')
  const [showLibrary, setShowLibrary] = useState(false)
  const [showAssets, setShowAssets] = useState(false)
  const [showPostProcessing, setShowPostProcessing] = useState(false)
  const [showHDRI, setShowHDRI] = useState(false)
  const [isPostProcessingPanelOpen, setIsPostProcessingPanelOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState({
    isVisible: false,
    x: 0,
    y: 0
  })
  const [forceRefresh, setForceRefresh] = useState(0)
  const [toast, setToast] = useState({
    message: '',
    type: 'info',
    isVisible: false
  })

  // 새 아키텍처 서비스들
  const [services, setServices] = useState({})
  const [dynamicPanels, setDynamicPanels] = useState([])
  const [pluginCommands, setPluginCommands] = useState([])

  // 새 아키텍처 초기화 체크
  useEffect(() => {
    if (!isNewArchitectureEnabled) return

    const checkServices = () => {
      if (app.isInitialized) {
        const serviceRegistry = app.serviceRegistry
        const commandManager = app.commandManager
        
        if (serviceRegistry && commandManager) {
          setServices({
            serviceRegistry,
            commandManager,
            sceneService: serviceRegistry.get('sceneService'),
            selectionService: serviceRegistry.get('selectionService'),
            cameraPlugin: serviceRegistry.get('cameraPlugin'),
            gridManager: serviceRegistry.get('gridManager')
          })
          console.log('✅ EditorUI Modern: Services connected')
        }
      }
    }

    checkServices()
    
    // 아키텍처 준비 이벤트 리스너
    const handleArchitectureReady = () => {
      checkServices()
    }
    
    eventBus.on(EventTypes.APP_INITIALIZED, handleArchitectureReady)
    
    return () => {
      eventBus.off(EventTypes.APP_INITIALIZED, handleArchitectureReady)
    }
  }, [isNewArchitectureEnabled])

  // 플러그인 UI 등록 시스템
  useEffect(() => {
    if (!services.serviceRegistry) return

    // 동적 패널 등록 이벤트 리스너
    const handlePanelRegistered = (event) => {
      const { panelId, component, title, icon } = event.detail
      setDynamicPanels(prev => [
        ...prev.filter(p => p.id !== panelId),
        { id: panelId, component, title, icon }
      ])
    }

    const handlePanelUnregistered = (event) => {
      const { panelId } = event.detail
      setDynamicPanels(prev => prev.filter(p => p.id !== panelId))
    }

    // 플러그인 명령 등록 이벤트 리스너
    const handleCommandRegistered = (event) => {
      const { commandId, label, icon, category } = event.detail
      setPluginCommands(prev => [
        ...prev.filter(c => c.id !== commandId),
        { id: commandId, label, icon, category }
      ])
    }

    eventBus.on(EventTypes.PANEL_REGISTERED, handlePanelRegistered)
    eventBus.on(EventTypes.PANEL_UNREGISTERED, handlePanelUnregistered)
    eventBus.on(EventTypes.COMMAND_REGISTERED, handleCommandRegistered)

    return () => {
      eventBus.off(EventTypes.PANEL_REGISTERED, handlePanelRegistered)
      eventBus.off(EventTypes.PANEL_UNREGISTERED, handlePanelUnregistered)
      eventBus.off(EventTypes.COMMAND_REGISTERED, handleCommandRegistered)
    }
  }, [services.serviceRegistry])

  // Toast 함수들
  const showToast = (message, type = 'info') => {
    setToast({
      message,
      type,
      isVisible: true
    })
    setTimeout(() => {
      setToast(prev => ({ ...prev, isVisible: false }))
    }, 3000)
  }

  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }))
  }

  // 새 아키텍처 명령 실행
  const executeCommand = async (commandId, params = {}) => {
    if (!services.commandManager) {
      console.warn('Command Manager not available')
      return
    }

    try {
      await services.commandManager.executeCommand(commandId, params)
      console.log(`✅ Command executed: ${commandId}`)
    } catch (error) {
      console.error(`❌ Command failed: ${commandId}`, error)
      showToast(`명령 실행 실패: ${commandId}`, 'error')
    }
  }

  // 컨텍스트 메뉴 핸들러
  const handleContextMenu = (e) => {
    if (selectedObject) {
      e.preventDefault()
      setContextMenu({
        isVisible: true,
        x: e.clientX,
        y: e.clientY
      })
    }
  }

  // 글로벌 키보드 이벤트 처리 (새 아키텍처 우선)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 새 아키텍처가 활성화된 경우 이벤트로 처리
      if (isNewArchitectureEnabled) {
        eventBus.emit(EventTypes.KEYBOARD_INPUT, {
          key: e.key,
          code: e.code,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          shiftKey: e.shiftKey,
          event: e
        })
        return
      }

      // 기존 키보드 처리 (호환성)
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        if (selectedObject?.id) {
          handleObjectFocus(selectedObject)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedObject, isNewArchitectureEnabled])

  // 카메라 제어 (새 아키텍처 통합)
  const handleCameraReset = () => {
    if (isNewArchitectureEnabled && services.commandManager) {
      executeCommand('resetCamera')
    } else if (editorControls?.cameraController) {
      editorControls.cameraController.resetCamera()
    }
  }

  const handleCameraProjectionToggle = () => {
    if (isNewArchitectureEnabled && services.commandManager) {
      executeCommand('toggleCameraProjection')
    } else if (editorControls?.cameraController) {
      editorControls.cameraController.toggleProjection()
    }
  }

  // 그리드 제어 (새 아키텍처 통합)
  const handleGridToggle = () => {
    if (isNewArchitectureEnabled && services.commandManager) {
      executeCommand('toggleGrid')
    } else if (editorControls) {
      editorControls.toggleGrid()
    }
  }

  // Transform 모드 변경 (새 아키텍처 통합)
  const handleTransformModeChange = (mode) => {
    if (isNewArchitectureEnabled && services.commandManager) {
      executeCommand('setTransformMode', { mode })
    } else {
      setTransformMode(mode)
      if (editorControls?.objectSelector) {
        editorControls.objectSelector.setGizmoMode(mode)
      }
    }
  }

  // 객체 삭제 (새 아키텍처 통합)
  const handleDeleteSelected = () => {
    if (!selectedObject) return

    if (isNewArchitectureEnabled && services.commandManager) {
      executeCommand('deleteObject', { object: selectedObject })
    } else {
      removeObject(selectedObject.id || selectedObject)
    }
  }

  // 객체 포커스 (새 아키텍처 통합)
  const handleObjectFocus = (object) => {
    if (isNewArchitectureEnabled && services.cameraPlugin) {
      // 새 아키텍처: CameraPlugin 사용
      if (object?.isObject3D) {
        const box = new THREE.Box3().setFromObject(object)
        const center = box.getCenter(new THREE.Vector3())
        services.cameraPlugin.setCameraTarget(center)
      }
    } else if (editorControls?.cameraController) {
      // 기존 시스템
      if (object?.isObject3D) {
        editorControls.cameraController.focusOnObject(object)
      }
    }
  }

  // 저장/로드 (새 아키텍처 통합)
  const handleSaveMap = () => {
    if (!mapName.trim()) {
      showToast('맵 이름을 입력해주세요', 'error')
      return
    }

    if (isNewArchitectureEnabled && services.sceneService) {
      // 새 아키텍처: SceneService 사용
      const sceneData = services.sceneService.exportScene()
      saveMap(mapName, sceneData)
    } else {
      // 기존 시스템
      saveMap(mapName)
    }
    
    showToast(`맵 "${mapName}" 저장됨`, 'success')
  }

  // 동적 패널 렌더링
  const renderDynamicPanels = () => {
    return dynamicPanels.map(panel => {
      const PanelComponent = panel.component
      return (
        <div key={panel.id} className="dynamic-panel">
          <h3>
            {panel.icon && <span className="panel-icon">{panel.icon}</span>}
            {panel.title}
          </h3>
          <PanelComponent services={services} />
        </div>
      )
    })
  }

  // 플러그인 명령 버튼 렌더링
  const renderPluginCommands = () => {
    const commandsByCategory = pluginCommands.reduce((acc, cmd) => {
      const category = cmd.category || 'General'
      if (!acc[category]) acc[category] = []
      acc[category].push(cmd)
      return acc
    }, {})

    return Object.entries(commandsByCategory).map(([category, commands]) => (
      <div key={category} className="plugin-command-category">
        <h4>{category}</h4>
        <div className="plugin-commands">
          {commands.map(cmd => (
            <button
              key={cmd.id}
              onClick={() => executeCommand(cmd.id)}
              className="plugin-command-btn"
              title={cmd.label}
            >
              {cmd.icon && <span className="cmd-icon">{cmd.icon}</span>}
              {cmd.label}
            </button>
          ))}
        </div>
      </div>
    ))
  }

  return (
    <div className="editor-ui" onContextMenu={handleContextMenu}>
      {/* 아키텍처 상태 표시 (개발용) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="architecture-status">
          <span className={`status-indicator ${isNewArchitectureEnabled ? 'modern' : 'legacy'}`}>
            {isNewArchitectureEnabled ? '🚀 Modern UI' : '⚡ Legacy UI'}
          </span>
        </div>
      )}

      {/* Transform 모드 버튼들 */}
      <div className="transform-controls">
        <button
          className={`transform-btn ${transformMode === 'translate' ? 'active' : ''}`}
          onClick={() => handleTransformModeChange('translate')}
          title="이동 모드 (W)"
        >
          📐 Move
        </button>
        <button
          className={`transform-btn ${transformMode === 'rotate' ? 'active' : ''}`}
          onClick={() => handleTransformModeChange('rotate')}
          title="회전 모드 (E)"
        >
          🔄 Rotate
        </button>
        <button
          className={`transform-btn ${transformMode === 'scale' ? 'active' : ''}`}
          onClick={() => handleTransformModeChange('scale')}
          title="크기 모드 (R)"
        >
          📏 Scale
        </button>
      </div>

      {/* 카메라 컨트롤 */}
      <div className="camera-controls">
        <button onClick={handleCameraReset} title="카메라 리셋 (Numpad 0)">
          🎥 Reset Camera
        </button>
        <button onClick={handleCameraProjectionToggle} title="투영 모드 전환 (Numpad 5)">
          🔄 Toggle Projection
        </button>
        <button onClick={handleGridToggle} title="그리드 토글">
          # Toggle Grid
        </button>
      </div>

      {/* 선택된 객체 정보 */}
      {selectedObject && (
        <div className="selected-object-info">
          <h3>선택된 객체</h3>
          <p>ID: {selectedObject.id || selectedObject.uuid || 'Unknown'}</p>
          <div className="object-actions">
            <button onClick={() => handleObjectFocus(selectedObject)}>
              🎯 Focus
            </button>
            <button onClick={handleDeleteSelected} className="delete-btn">
              🗑️ Delete
            </button>
          </div>
        </div>
      )}

      {/* 맵 저장/로드 */}
      <div className="map-controls">
        <input
          type="text"
          placeholder="맵 이름"
          value={mapName}
          onChange={(e) => setMapName(e.target.value)}
        />
        <button onClick={handleSaveMap}>💾 Save Map</button>
      </div>

      {/* 기존 패널들 */}
      {showInspector && <InspectorPanel />}
      {showLibrary && <LibraryPanel />}
      {showAssets && <AssetsPanel />}
      {showPostProcessing && <PostProcessingPanel />}
      {showHDRI && <HDRIPanel />}

      {/* 동적 플러그인 패널들 */}
      {isNewArchitectureEnabled && (
        <div className="dynamic-panels">
          {renderDynamicPanels()}
        </div>
      )}

      {/* 플러그인 명령들 */}
      {isNewArchitectureEnabled && pluginCommands.length > 0 && (
        <div className="plugin-commands-panel">
          <h3>플러그인 명령</h3>
          {renderPluginCommands()}
        </div>
      )}

      {/* 컨텍스트 메뉴 */}
      {contextMenu.isVisible && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ ...contextMenu, isVisible: false })}
          selectedObject={selectedObject}
          onDeleteObject={handleDeleteSelected}
          onToggleVisibility={toggleObjectVisibility}
          onToggleFreeze={toggleObjectFreeze}
          onRename={renameObject}
        />
      )}

      {/* Toast 알림 */}
      {toast.isVisible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
      )}
    </div>
  )
}

export default EditorUIModern
