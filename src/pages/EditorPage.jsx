import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import PlainEditorCanvas from '../components/editor/PlainEditorCanvas'
import EditorUI from '../components/editor/EditorUI'
import MenuBar from '../components/editor/MenuBar'
import ViewportControls from '../components/editor/ViewportControls'
import { useEditorStore } from '../store/editorStore'
import { getGLBMeshManager } from '../utils/GLBMeshManager'
import Toast from '../components/ui/Toast'
import { idbAddCustomMesh } from '../utils/idb'
import * as THREE from 'three'
import './EditorPage.css'

// 메시지 상수
const MESSAGES = {
  NEW_MAP_CONFIRM: '새 맵을 만들면 현재 작업이 사라집니다. 계속하시겠습니까?',
  EXPORT_NOT_READY: '익스포트 기능은 준비 중입니다.',
  EXIT_CONFIRM: '에디터를 종료하시겠습니까?',
  UNDO_NOT_READY: '실행 취소 기능은 준비 중입니다.',
  REDO_NOT_READY: '다시 실행 기능은 준비 중입니다.',
  SELECT_ALL_NOT_READY: '전체 선택 기능은 준비 중입니다.',
  DESELECT_ALL_NOT_READY: '선택 해제 기능은 준비 중입니다.',
  RESET_VIEWPORT_NOT_READY: '뷰포트 리셋 기능은 준비 중입니다.',
  RESET_CAMERA_INFO: '카메라 리셋: 키패드 0번을 누르세요.',
  TOGGLE_GRID_NOT_READY: '그리드 토글 기능은 준비 중입니다.',
  TOGGLE_STATS_NOT_READY: '통계 표시 기능은 준비 중입니다.',
  SHORTCUTS_INFO: '단축키 정보:\nW/E/R: 기즈모 모드\nF: 오브젝트 포커스\nESC: 선택 해제\n키패드 0: 카메라 리셋\n키패드 5: 카메라 모드 토글\n키패드 1/3/7/9: 뷰 변경',
  HELP_INFO: '도움말:\n• 좌클릭: 오브젝트 선택\n• Shift+좌클릭: 다중 선택\n• 중간클릭: 팬 이동\n• Alt+중간클릭: 카메라 회전\n• 마우스 휠: 줌',
  ABOUT_INFO: 'ThirdPersonTreeJS Editor\nVersion 1.0.0\n3D 에디터 프로그램'
};

function EditorPage() {
  const navigate = useNavigate()
  const { 
    clearMap, 
    saveMap, 
    loadMap, 
    addObject, 
    setSelectedObject, 
    addCustomMesh, 
    selectedObject, 
  selectedIds,
    toggleGridVisible,
    scene,
    hdriSettings,
    sunLightRef,
    setSunLightRef,
    saveHDRISettings,
    objects,
  setSelectedIds,
  setParent,
  reorderSiblings,
    copyObject,
    pasteObject,
    deleteSelectedObject,
    hasClipboardData
  } = useEditorStore()
  
  const [showDialog, setShowDialog] = useState(null)
  const [mapList, setMapList] = useState([])
  const [mapListLoading, setMapListLoading] = useState(false)
  const [loadingMapName, setLoadingMapName] = useState('')
  const [dialogInput, setDialogInput] = useState('')
  const [toast, setToast] = useState(null)
  const [showInspector, setShowInspector] = useState(true) // 인스펙터 패널 상태 추가
  
  // EditorControls 인스턴스를 관리하기 위한 ref
  const editorControlsRef = useRef(null)
  const [editorControlsState, setEditorControlsState] = useState(null)
  const postProcessingRef = useRef(null)
  const glbMeshManager = useRef(getGLBMeshManager())
  // 커스텀 메쉬 썸네일 blob:ObjectURL 추적 (초기 하이드레이션용)
  const customThumbUrlsRef = useRef(new Set())

  // 앱 시작 시 IndexedDB에서 커스텀 메쉬 하이드레이션 (LibraryPanel 미오픈 대비)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const meshes = await glbMeshManager.current.getCustomMeshes()
        if (!cancelled) {
          // 기존 상태가 비어있을 때만 주입 (불필요한 덮어쓰기 방지)
          if ((useEditorStore.getState().customMeshes || []).length === 0) {
            // blob: URL 추적
            const urls = meshes
              .map(m => (typeof m.thumbnail === 'string' && m.thumbnail.startsWith('blob:')) ? m.thumbnail : null)
              .filter(Boolean)
            customThumbUrlsRef.current = new Set(urls)
            useEditorStore.getState().loadCustomMeshes(meshes)
          }
        }
      } catch {}
    })()
    return () => {
      cancelled = true
      for (const url of customThumbUrlsRef.current) {
        try { URL.revokeObjectURL(url) } catch {}
      }
      customThumbUrlsRef.current.clear()
    }
  }, [])

  // 전역 토스트 이벤트 리스너 (어디서든 window.dispatchEvent로 토스트 띄우기)
  useEffect(() => {
    const handler = (e) => {
      const { message, type = 'info', duration = 3000 } = e.detail || {}
      if (!message) return
      setToast({ message, type })
      if (duration > 0) setTimeout(() => setToast(null), duration)
    }
    window.addEventListener('appToast', handler)
    return () => window.removeEventListener('appToast', handler)
  }, [])

  // HDRI 설정 지속 관리
  useEffect(() => {
    if (scene && hdriSettings.sunLightEnabled && !sunLightRef) {
      // 태양 조명이 활성화되어 있지만 씬에 없으면 생성
      createPersistentSunLight()
    } else if (scene && !hdriSettings.sunLightEnabled && sunLightRef) {
      // 태양 조명이 비활성화되어 있으면 제거
      removePersistentSunLight()
    }
  }, [scene, hdriSettings.sunLightEnabled, sunLightRef])

  // 씬 리셋 이후 레퍼런스는 있으나 씬에서 빠져있을 수 있으므로 재부착 가드
  useEffect(() => {
    if (!scene || !sunLightRef || !hdriSettings.sunLightEnabled) return
    const existsInScene = (() => {
      let found = false
      scene.traverse((c) => { if (c === sunLightRef) found = true })
      return found
    })()
    if (!existsInScene) {
      try { scene.add(sunLightRef) } catch {}
    }
  }, [scene, sunLightRef, hdriSettings.sunLightEnabled])

  // 초기 HDRI 환경 설정
  useEffect(() => {
    if (scene && hdriSettings.currentHDRI && hdriSettings.currentHDRI.type === 'none') {
      // 기본 배경 적용
      scene.background = new THREE.Color(0x2a2a2a) // 회색 배경
      scene.environment = null
  // 기본 HDRI 배경 적용됨
    }
  }, [scene, hdriSettings.currentHDRI])

  // 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e?.defaultPrevented) return;
      const t = e?.target; const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      if (e?.repeat) return;
      // I키 - 인스펙터 토글
      if (e.key === 'i' || e.key === 'I') {
        if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
          e.preventDefault()
          setShowInspector(prev => !prev)
        }
      }
      
      // Ctrl+C - 복사 (다음 프레임으로 연기해 입력 지연 감소)
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        if (!selectedObject) {
          setToast({ message: '복사할 객체를 먼저 선택해주세요', type: 'warning' });
          setTimeout(() => setToast(null), 2000);
          return;
        }
        requestAnimationFrame(() => {
          try {
            // EditorControls에서 실제 선택된 Three.js 객체 우선
            let threeObject = null;
            if (editorControlsRef.current) {
              const objectId = selectedObject.id || selectedObject;
              threeObject = editorControlsRef.current.findObjectById(objectId) || (editorControlsRef.current.selectedObjects?.[0] || null);
            }
            if (threeObject) {
              copyObject(threeObject);
              setToast({ message: `"${threeObject.name}"이(가) 복사되었습니다`, type: 'success' });
            } else {
              copyObject(selectedObject);
              setToast({ message: `"${selectedObject.name}"이(가) 복사되었습니다`, type: 'success' });
            }
          } finally {
            setTimeout(() => setToast(null), 2000);
          }
        });
      }
      
      // Ctrl+V - 붙여넣기 (다음 프레임으로 연기)
      if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        requestAnimationFrame(() => {
          try {
            if (hasClipboardData()) {
              const pastedObject = pasteObject();
              if (pastedObject) {
                setToast({ message: `"${pastedObject.name}"이(가) 붙여넣기되었습니다`, type: 'success' });
              } else {
                setToast({ message: '붙여넣기에 실패했습니다', type: 'error' });
              }
            } else {
              setToast({ message: '붙여넣을 객체가 클립보드에 없습니다', type: 'warning' });
            }
          } finally {
            setTimeout(() => setToast(null), 2000);
          }
        });
      }
      
  // Delete 키 - 삭제는 KeyboardController(Object actions)에서 처리됨(중복 제거)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedObject, objects, copyObject, pasteObject, deleteSelectedObject, hasClipboardData, setToast]) // 필요한 의존성 모두 추가

  // 지속적인 태양 조명 생성 함수
  const createPersistentSunLight = () => {
    if (!scene) return

    const sunLight = new THREE.DirectionalLight(hdriSettings.sunColor, hdriSettings.sunIntensity)
    
    // 저장된 위치 적용
    const azimuthRad = hdriSettings.sunAzimuth * Math.PI / 180
    const elevationRad = hdriSettings.sunElevation * Math.PI / 180
    const distance = 100
    const x = Math.sin(azimuthRad) * Math.cos(elevationRad) * distance
    const y = Math.sin(elevationRad) * distance
    const z = Math.cos(azimuthRad) * Math.cos(elevationRad) * distance

    sunLight.position.set(x, y, z)
    sunLight.lookAt(0, 0, 0)
    
    // 그림자 설정
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 2048
    sunLight.shadow.mapSize.height = 2048
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 500
    sunLight.shadow.camera.left = -50
    sunLight.shadow.camera.right = 50
    sunLight.shadow.camera.top = 50
    sunLight.shadow.camera.bottom = -50

    sunLight.name = 'sunLight'
  // 새 맵 정리(clearMap)에서 삭제되지 않도록 시스템 오브젝트로 표시
  sunLight.userData = sunLight.userData || {}
  sunLight.userData.isSystemObject = true
    setSunLightRef(sunLight)
    scene.add(sunLight)

  // Sun light created
  }

  // 지속적인 태양 조명 제거 함수
  const removePersistentSunLight = () => {
    if (!scene || !sunLightRef) return

    scene.remove(sunLightRef)
    if (sunLightRef.dispose) {
      sunLightRef.dispose()
    }
    setSunLightRef(null)

  // Sun light removed
  }

  // HDRI 설정 자동 저장(스토어 내부에서 직렬화 안전한 형태로 저장)
  useEffect(() => {
    if (scene) {
      setTimeout(() => saveHDRISettings(), 100)
    }
  }, [hdriSettings, scene, saveHDRISettings])

  // EditorControls 인스턴스를 설정하는 함수
  const setEditorControls = (controls) => {
    editorControlsRef.current = controls
  setEditorControlsState(controls)
    // EditorControls instance received in EditorPage
  }

  // PostProcessingManager 인스턴스를 설정하는 함수
  const setPostProcessingManager = (manager) => {
    postProcessingRef.current = manager
  // PostProcessingManager linked
  }

  const handleFileImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.glb,.gltf'
    input.multiple = false
    
    input.onchange = (event) => {
      const file = event.target.files[0]
      if (!file) return
      
      const url = URL.createObjectURL(file)
      const fileName = file.name.replace(/\.[^/.]+$/, "")
      
      // File selected for import
      
      // 새 GLB 오브젝트 생성
      const newObject = {
        id: Date.now(),
        type: 'glb', // 중요: 타입을 명시적으로 설정
        file: url, // URL을 file 속성으로 설정
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        name: fileName
      }
      
      // New object created
      
      // 오브젝트 추가
      addObject(newObject)
      
      // 추가된 오브젝트를 선택 상태로 만들기
      setTimeout(() => {
        setSelectedObject(newObject.id)
        // GLB file import completed
      }, 100)
    }
    
    input.click()
  }

  // 간단한 뷰 상태 직렬화/역직렬화 유틸
  const getViewState = () => {
    const state = {}
    try {
      const ec = editorControlsRef.current
      const bc = window.__blenderControls
      const cam = ec?.getCamera?.() || (bc?.camera)
      if (cam) {
        state.camera = {
          position: cam.position ? cam.position.toArray() : null,
          target: (bc && bc.target) ? bc.target.toArray() : (ec?.getCameraTarget?.()?.toArray?.() || [0,0,0]),
          up: cam.up ? cam.up.toArray() : null,
          fov: cam.fov,
          near: cam.near,
          far: cam.far
        }
      }
      // 주요 토글/옵션
      const s = useEditorStore.getState()
      state.viewOptions = {
        isWireframe: s.isWireframe,
        isGridSnap: s.isGridSnap,
        isGridVisible: s.isGridVisible,
        gizmoSpace: s.gizmoSpace,
        gizmoSize: s.gizmoSize,
        snapMove: s.snapMove,
        snapRotateDeg: s.snapRotateDeg,
        snapScale: s.snapScale,
        cameraPanSpeed: s.cameraPanSpeed,
        cameraOrbitSpeed: s.cameraOrbitSpeed,
        cameraZoomSpeed: s.cameraZoomSpeed,
        isPostProcessingEnabled: s.isPostProcessingEnabled,
      }
    } catch {}
    return state
  }

  const applyViewState = (state) => {
    if (!state || typeof state !== 'object') return
    try {
      const ec = editorControlsRef.current
      const bc = window.__blenderControls
      // 카메라
      if (state.camera) {
        const cam = ec?.getCamera?.() || (bc?.camera)
        if (cam) {
          if (Array.isArray(state.camera.position)) cam.position.fromArray(state.camera.position)
          if (Array.isArray(state.camera.up)) cam.up.fromArray(state.camera.up)
          if (typeof state.camera.fov === 'number') cam.fov = state.camera.fov
          if (typeof state.camera.near === 'number') cam.near = state.camera.near
          if (typeof state.camera.far === 'number') cam.far = state.camera.far
          cam.updateProjectionMatrix?.()
          if (bc && Array.isArray(state.camera.target)) {
            bc.target.fromArray(state.camera.target)
          } else if (ec && Array.isArray(state.camera.target)) {
            ec.setCameraTarget?.(new THREE.Vector3().fromArray(state.camera.target))
          }
        }
      }
      // 옵션들
      if (state.viewOptions) {
        const s = useEditorStore.getState()
        const setters = {
          isWireframe: 'toggleWireframe',
          isGridSnap: 'toggleGridSnap',
          isGridVisible: 'toggleGridVisible',
        }
        // 토글류는 현재값과 다를 때만 토글 호출
        if (typeof state.viewOptions.isWireframe === 'boolean' && s.isWireframe !== state.viewOptions.isWireframe) useEditorStore.getState().toggleWireframe()
        if (typeof state.viewOptions.isGridSnap === 'boolean' && s.isGridSnap !== state.viewOptions.isGridSnap) useEditorStore.getState().toggleGridSnap()
        if (typeof state.viewOptions.isGridVisible === 'boolean' && s.isGridVisible !== state.viewOptions.isGridVisible) useEditorStore.getState().toggleGridVisible()
        if (state.viewOptions.gizmoSpace && s.gizmoSpace !== state.viewOptions.gizmoSpace) useEditorStore.getState().toggleGizmoSpace()
        if (Number.isFinite(state.viewOptions.gizmoSize)) useEditorStore.getState().setGizmoSize(state.viewOptions.gizmoSize)
        if (Number.isFinite(state.viewOptions.snapMove)) useEditorStore.getState().setSnapMove(state.viewOptions.snapMove)
        if (Number.isFinite(state.viewOptions.snapRotateDeg)) useEditorStore.getState().setSnapRotateDeg(state.viewOptions.snapRotateDeg)
        if (Number.isFinite(state.viewOptions.snapScale)) useEditorStore.getState().setSnapScale(state.viewOptions.snapScale)
        if (Number.isFinite(state.viewOptions.cameraPanSpeed)) useEditorStore.getState().setCameraPanSpeed(state.viewOptions.cameraPanSpeed)
        if (Number.isFinite(state.viewOptions.cameraOrbitSpeed)) useEditorStore.getState().setCameraOrbitSpeed(state.viewOptions.cameraOrbitSpeed)
        if (Number.isFinite(state.viewOptions.cameraZoomSpeed)) useEditorStore.getState().setCameraZoomSpeed(state.viewOptions.cameraZoomSpeed)
        if (typeof state.viewOptions.isPostProcessingEnabled === 'boolean') {
          const cur = useEditorStore.getState().isPostProcessingEnabled
          if (cur !== state.viewOptions.isPostProcessingEnabled) useEditorStore.getState().togglePostProcessingEnabled()
        }
        // 즉시 반영
        ec?.applyInitialViewState?.()
        if (bc) bc.update?.()
      }
    } catch {}
  }

  const handleMenuAction = (action) => {
    // Menu action triggered
    
    switch (action) {
      case 'new-map':
        if (confirm(MESSAGES.NEW_MAP_CONFIRM)) {
          clearMap()
          // 뷰 초기화: 카메라/타겟 기본값으로
          try {
            editorControlsRef.current?.resetCamera?.()
          } catch {}
          try {
            if (window.__blenderControls) {
              window.__blenderControls.target.set(0,0,0)
              window.__blenderControls.update?.()
            }
          } catch {}
        }
        break
        
      case 'load-map':
        setShowDialog('load')
        break
        
      case 'save-map':
        setShowDialog('save')
        break
        
      case 'import':
        handleFileImport()
        break
        
      case 'export':
        alert(MESSAGES.EXPORT_NOT_READY)
        break
        
      case 'exit':
        if (confirm(MESSAGES.EXIT_CONFIRM)) {
          navigate('/')
        }
        break
        
      case 'undo':
        alert(MESSAGES.UNDO_NOT_READY)
        break
        
      case 'redo':
        alert(MESSAGES.REDO_NOT_READY)
        break
        
      case 'copy':
        
        if (selectedObject) {
          const objectToCopy = objects.find(obj => obj.id === selectedObject);
          if (objectToCopy) {
            copyObject(objectToCopy);
            setToast({ 
              message: `"${objectToCopy.name}"이(가) 복사되었습니다`, 
              type: 'success' 
            });
            setTimeout(() => setToast(null), 2000);
          } else {
            setToast({ 
              message: '복사할 객체를 찾을 수 없습니다', 
              type: 'error' 
            });
            setTimeout(() => setToast(null), 2000);
          }
        } else {
          setToast({ 
            message: '복사할 객체를 먼저 선택해주세요', 
            type: 'warning' 
          });
          setTimeout(() => setToast(null), 2000);
        }
        break
        
      case 'paste':
        
        if (hasClipboardData()) {
          const pastedObject = pasteObject();
          if (pastedObject) {
            setToast({ 
              message: `"${pastedObject.name}"이(가) 붙여넣기되었습니다`, 
              type: 'success' 
            });
            setTimeout(() => setToast(null), 2000);
          } else {
            setToast({ 
              message: '붙여넣기에 실패했습니다', 
              type: 'error' 
            });
            setTimeout(() => setToast(null), 2000);
          }
        } else {
          setToast({ 
            message: '붙여넣을 객체가 클립보드에 없습니다', 
            type: 'warning' 
          });
          setTimeout(() => setToast(null), 2000);
        }
        break
        
      case 'delete':
        
        if (selectedObject) {
          const objectToDelete = objects.find(obj => obj.id === selectedObject);
          if (objectToDelete) {
            const objectName = objectToDelete.name;
            deleteSelectedObject();
            setToast({ 
              message: `"${objectName}"이(가) 삭제되었습니다`, 
              type: 'success' 
            });
            setTimeout(() => setToast(null), 2000);
          } else {
            setToast({ 
              message: '삭제할 객체를 찾을 수 없습니다', 
              type: 'error' 
            });
            setTimeout(() => setToast(null), 2000);
          }
        } else {
          setToast({ 
            message: '삭제할 객체를 먼저 선택해주세요', 
            type: 'warning' 
          });
          setTimeout(() => setToast(null), 2000);
        }
        break
        
      case 'select-all':
        alert(MESSAGES.SELECT_ALL_NOT_READY)
        break
        
      case 'deselect-all':
        alert(MESSAGES.DESELECT_ALL_NOT_READY)
        break
        
      case 'reset-viewport':
        alert(MESSAGES.RESET_VIEWPORT_NOT_READY)
        break
        
      case 'reset-camera':
        // 키패드 0번과 동일한 기능
        alert(MESSAGES.RESET_CAMERA_INFO)
        break
        
      case 'toggle-grid':
        
        toggleGridVisible();
        const currentState = useEditorStore.getState();
        const isVisible = currentState.isGridVisible;
        
        // EditorControls에 변경사항 반영
        if (editorControlsRef.current) {
          editorControlsRef.current.toggleGrid();
        }
        
        setToast({ 
          message: `그리드가 ${isVisible ? '표시' : '숨김'} 되었습니다`, 
          type: 'info' 
        })
        setTimeout(() => setToast(null), 2000)
        break
        
      case 'toggle-stats':
        alert(MESSAGES.TOGGLE_STATS_NOT_READY)
        break
        
      case 'toggle-inspector':
        setShowInspector(prev => !prev)
        setToast({ 
          message: `인스펙터가 ${!showInspector ? '표시' : '숨김'} 되었습니다`, 
          type: 'info' 
        })
        setTimeout(() => setToast(null), 2000)
        break
        
      case 'fullscreen':
        if (document.fullscreenElement) {
          document.exitFullscreen()
        } else {
          document.documentElement.requestFullscreen()
        }
        break
        
      case 'show-shortcuts':
        alert(MESSAGES.SHORTCUTS_INFO)
        break
        
      case 'show-help':
        alert(MESSAGES.HELP_INFO)
        break
        
      case 'about':
        alert(MESSAGES.ABOUT_INFO)
        break
        
      default:
        // Unknown menu action
    }
  }

  const handleDialogConfirm = async () => {
    if (showDialog === 'save' && dialogInput.trim()) {
      const viewState = getViewState()
      // 스토어의 saveMap에 viewState를 포함 저장
  await saveMap(dialogInput.trim(), viewState)
      alert(`맵이 "${dialogInput.trim()}"으로 저장되었습니다.`)
    } else if (showDialog === 'load' && dialogInput.trim()) {
      // 먼저 로드하여 오브젝트/벽을 반영
  const success = await useEditorStore.getState().loadMap?.(dialogInput.trim())
      if (success) {
        // 저장된 viewState가 있으면 적용
        try {
      const raw = await useEditorStore.getState().getMapData?.(dialogInput.trim())
          if (raw && raw.viewState) applyViewState(raw.viewState)
        } catch {}
        try { window.__requestRender && window.__requestRender() } catch {}
        alert(`맵 "${dialogInput.trim()}"을 불러왔습니다.`)
      } else {
        alert(`맵 "${dialogInput.trim()}"을 찾을 수 없습니다.`)
      }
    }
    
    setShowDialog(null)
    setDialogInput('')
  }

  const handleDialogCancel = () => {
    setShowDialog(null)
    setDialogInput('')
  }

  // 맵 목록 로딩/동작
  const reloadMapList = async () => {
    try {
      setMapListLoading(true)
      const rows = await useEditorStore.getState().listMaps?.()
      setMapList(Array.isArray(rows) ? rows : [])
    } catch {
      setMapList([])
    } finally {
      setMapListLoading(false)
    }
  }

  useEffect(() => {
    if (showDialog === 'load') {
      reloadMapList()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDialog])

  const handleLoadFromList = async (name) => {
    if (!name) return
    try {
      setLoadingMapName(name)
      setToast({ message: `"${name}" 불러오는 중…`, type: 'info' })
      const ok = await useEditorStore.getState().loadMap?.(name)
      if (ok) {
        try {
          const raw = await useEditorStore.getState().getMapData?.(name)
          if (raw?.viewState) applyViewState(raw.viewState)
        } catch {}
        try { window.__requestRender && window.__requestRender() } catch {}
        setShowDialog(null)
        setDialogInput('')
        setToast({ message: `맵 "${name}"을 불러왔습니다.`, type: 'success' })
        setTimeout(() => setToast(null), 1800)
      } else {
        setToast({ message: `맵 "${name}"을 찾을 수 없습니다.`, type: 'error' })
        setTimeout(() => setToast(null), 1800)
      }
    } catch (e) {
      setToast({ message: '불러오기 중 오류가 발생했습니다.', type: 'error' })
      setTimeout(() => setToast(null), 1800)
    } finally {
      setLoadingMapName('')
    }
  }

  const handleDeleteMap = async (name) => {
    if (!name) return
    const yes = window.confirm(`정말 "${name}" 맵을 삭제하시겠습니까?`)
    if (!yes) return
    const ok = await useEditorStore.getState().deleteMap?.(name)
    if (ok) {
      await reloadMapList()
      setToast({ message: `맵 "${name}"이(가) 삭제되었습니다.`, type: 'success' })
      setTimeout(() => setToast(null), 1500)
    } else {
      setToast({ message: '삭제에 실패했습니다.', type: 'error' })
      setTimeout(() => setToast(null), 1500)
    }
  }

  // Notify user if some assets were missing on map load
  useEffect(() => {
    const onWarn = (e) => {
      const d = e?.detail || {}
      if (d?.type === 'customMeshMissing') {
        setToast({ message: `일부 커스텀 메쉬를 찾지 못했습니다. (id=${d.id})`, type: 'warning' })
        setTimeout(() => setToast(null), 2500)
      }
    }
    window.addEventListener('mapLoadWarning', onWarn)
    return () => window.removeEventListener('mapLoadWarning', onWarn)
  }, [])

  // 메쉬를 라이브러리에 추가하는 핸들러
  const handleAddToLibrary = async (object) => {
    try {
      const name = prompt('메쉬 이름을 입력하세요:', object.name || '커스텀 메쉬');
      if (!name) return;

      // 항상 현재 변환 상태를 지오메트리에 굽고 루트는 항등으로 저장
      const preserveTransform = true;

      setToast({ message: '라이브러리에 추가 중...', type: 'info' });

      // 실제 Three.js 객체로 해석
      const ec = editorControlsRef.current;
      let exportTarget = null;

      // 다중 선택이면 그룹으로 내보내기 준비
      const selectedList = ec?.selectedObjects && ec.selectedObjects.length > 0 ? [...ec.selectedObjects] : [];
      if (selectedList.length > 1) {
        // 멀티 선택: 그룹 피벗을 (0,0,0)/(0,0,0)/(1,1,1)로 고정하고,
        // 각 자식을 자신의 월드 변환 그대로 배치하여 시각적 동일성 보장
        const group = new THREE.Group();
        group.name = name;
        group.position.set(0, 0, 0);
        group.rotation.set(0, 0, 0);
        group.scale.set(1, 1, 1);
        group.updateMatrixWorld(true);

        selectedList.forEach((obj) => {
          try {
            obj.updateMatrixWorld(true);
            const clone = obj.clone(true);
            const rel = new THREE.Matrix4().copy(obj.matrixWorld);
            const pos = new THREE.Vector3();
            const quat = new THREE.Quaternion();
            const scl = new THREE.Vector3(1, 1, 1);
            rel.decompose(pos, quat, scl);
            clone.position.copy(pos);
            clone.quaternion.copy(quat);
            clone.scale.copy(scl);
            clone.updateMatrix();
            clone.updateMatrixWorld(true);
            group.add(clone);
          } catch {}
        });
        group.updateMatrixWorld(true);
        exportTarget = group;
      } else {
        // 단일 선택: 그대로 Object3D를 넘기고, 베이크는 GLBMeshManager 쪽에서 단 1회 수행
        const targetId = (object && typeof object === 'object') ? (object.id ?? object.userData?.ownerId ?? object) : object;
        exportTarget = (object && typeof object === 'object' && object.isObject3D)
          ? object
          : (ec ? (ec.findObjectById?.(targetId) || (ec.selectedObjects?.[0] || null)) : null);
      }

      if (!exportTarget) {
        setToast({ message: '내보낼 Three.js 객체를 찾지 못했습니다.', type: 'error' });
        setTimeout(() => setToast(null), 4000);
        return;
      }

  const meshData = await glbMeshManager.current.addCustomMesh(exportTarget, name, { preserveTransform, compressToSingleMesh: true });
  // 생성된 GLB 파일 즉시 다운로드
  try { glbMeshManager.current.downloadCustomMesh(meshData); } catch {}
      // 중복 방지 및 덮어쓰기 정책
      const exists = (useEditorStore.getState().customMeshes || []).some(m => m.id === meshData.id)
      if (exists) {
        const overwrite = confirm(`동일 ID의 커스텀 메쉬가 이미 있습니다.\n\n- 기존 항목을 덮어쓸까요?`)
        if (!overwrite) {
          setToast({ message: '추가가 취소되었습니다(중복 ID).', type: 'warning' })
          setTimeout(() => setToast(null), 2500)
          return
        }
        // IDB 업서트 후 스토어 교체 반영
        await idbAddCustomMesh(meshData)
        const prev = useEditorStore.getState().customMeshes || []
        const next = prev.map(m => m.id === meshData.id ? meshData : m)
        useEditorStore.getState().loadCustomMeshes(next)
      } else {
        // 스토어 액션은 내부에서 IDB 저장도 처리
        await addCustomMesh(meshData)
      }
      
      // 강제로 LibraryPanel 새로고침을 위한 이벤트 발생
      window.dispatchEvent(new CustomEvent('customMeshAdded', { detail: meshData }));

  setToast({ message: `"${name}" GLB가 내보내지고 라이브러리에 추가되었습니다! (그룹 피벗 항등/자식 월드 변환 유지)`, type: 'success' });
      
      // 5초 후 토스트 자동 닫기
  setTimeout(() => setToast(null), 5000);
    } catch (error) {
      console.error('라이브러리 추가 실패:', error);
      const msg = (error && (error.message === 'NO_MESH_FOUND'))
        ? '선택한 오브젝트에서 내보낼 메시를 찾지 못했습니다. (스키닝/인스턴스/비메시 제외)'
        : '라이브러리 추가에 실패했습니다.';
      setToast({ message: msg, type: 'error' });
      
      // 5초 후 토스트 자동 닫기
      setTimeout(() => setToast(null), 5000);
    }
  }

  return (
    <div className="editor-page">
      <MenuBar onMenuAction={handleMenuAction} />
      <div className="editor-container">
  {/* 좌측 트리 패널 제거: 인스펙터 상단으로 이동됨 */}
        <PlainEditorCanvas 
          onEditorControlsReady={setEditorControls}
          onPostProcessingReady={setPostProcessingManager}
          onContextMenu={(e) => {
            // 커스텀 이벤트를 통해 전달
            const contextMenuEvent = new CustomEvent('editorContextMenu', {
              detail: { originalEvent: e }
            });
            window.dispatchEvent(contextMenuEvent);
          }}
        />
  <ViewportControls editorControls={editorControlsState} />
        <EditorUI 
          editorControls={editorControlsState} 
          postProcessingManager={postProcessingRef.current}
          onAddToLibrary={handleAddToLibrary}
          showInspector={showInspector}
          onToggleInspector={setShowInspector}
        />
      </div>

      {/* 다이얼로그 */}
      {showDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>{showDialog === 'save' ? '맵 저장' : '맵 불러오기'}</h3>
            <input
              type="text"
              value={dialogInput}
              onChange={(e) => setDialogInput(e.target.value)}
              placeholder="맵 이름을 입력하세요"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDialogConfirm()
                if (e.key === 'Escape') handleDialogCancel()
              }}
            />
            <div className="dialog-buttons">
              <button type="button" onClick={handleDialogConfirm} disabled={!!loadingMapName}>확인</button>
              <button type="button" onClick={handleDialogCancel} disabled={!!loadingMapName}>취소</button>
            </div>
            {showDialog === 'load' && (
              <div style={{marginTop: 12, maxHeight: 260, overflow: 'auto', borderTop: '1px solid #444', paddingTop: 10}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8}}>
                  <strong>저장된 맵 목록</strong>
                  <button onClick={reloadMapList} disabled={mapListLoading} style={{padding:'4px 8px'}}>
                    {mapListLoading ? '새로고침…' : '새로고침'}
                  </button>
                </div>
                {mapList.length === 0 && (
                  <div style={{opacity:0.7}}>저장된 맵이 없습니다.</div>
                )}
                {mapList.map((m) => (
                  <div key={m.name} style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap: 8, padding:'6px 0', borderBottom:'1px solid #333'}}>
                    <div style={{display:'flex', flexDirection:'column'}}>
                      <span style={{fontWeight:600}}>{m.name}</span>
                      <span style={{fontSize:12, opacity:0.8}}>업데이트: {m.updated_at ? new Date(m.updated_at).toLocaleString() : '-'}</span>
                    </div>
                    <div style={{display:'flex', gap:6}}>
                      <button type="button" onClick={() => handleLoadFromList(m.name)} disabled={!!loadingMapName} style={{padding:'4px 8px'}}>
                        {loadingMapName === m.name ? '불러오는 중…' : '불러오기'}
                      </button>
                      <button type="button" onClick={() => handleDeleteMap(m.name)} disabled={!!loadingMapName} style={{padding:'4px 8px', background:'#a33', color:'#fff'}}>삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast 메시지 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

export default EditorPage
