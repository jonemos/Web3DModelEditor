import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import PlainEditorCanvas from '../components/editor/PlainEditorCanvas'
import EditorUI from '../components/editor/EditorUI'
import MenuBar from '../components/editor/MenuBar'
import ViewportControls from '../components/editor/ViewportControls'
import { useEditorStore } from '../store/editorStore'
import { getGLBMeshManager } from '../utils/GLBMeshManager'
import Toast from '../components/ui/Toast'
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
    toggleGridVisible,
    scene,
    hdriSettings,
    sunLightRef,
    setSunLightRef,
    saveHDRISettings,
    objects,
    copyObject,
    pasteObject,
    deleteSelectedObject,
    hasClipboardData
  } = useEditorStore()
  
  const [showDialog, setShowDialog] = useState(null)
  const [dialogInput, setDialogInput] = useState('')
  const [toast, setToast] = useState(null)
  const [showInspector, setShowInspector] = useState(true) // 인스펙터 패널 상태 추가
  
  // EditorControls 인스턴스를 관리하기 위한 ref
  const editorControlsRef = useRef(null)
  const postProcessingRef = useRef(null)
  const glbMeshManager = useRef(getGLBMeshManager())

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

  // 초기 HDRI 환경 설정
  useEffect(() => {
    if (scene && hdriSettings.currentHDRI && hdriSettings.currentHDRI.type === 'none') {
      // 기본 배경 적용
      scene.background = new THREE.Color(0x2a2a2a) // 회색 배경
      scene.environment = null
      console.log('기본 HDRI 배경이 적용되었습니다')
    }
  }, [scene, hdriSettings.currentHDRI])

  // 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (e) => {
      // I키 - 인스펙터 토글
      if (e.key === 'i' || e.key === 'I') {
        if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
          e.preventDefault()
          setShowInspector(prev => !prev)
        }
      }
      
      // Ctrl+C - 복사
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault()
        console.log('Ctrl+C 키 감지됨, 복사 실행')
        console.log('현재 selectedObject:', selectedObject)
        console.log('selectedObject.uuid:', selectedObject?.uuid)
        console.log('selectedObject.name:', selectedObject?.name)
        console.log('현재 objects 배열:', objects)
        console.log('objects 첫 번째 항목:', objects[0])
        console.log('objects 첫 번째 항목의 키들:', objects[0] ? Object.keys(objects[0]) : 'objects 배열이 비어있음')
        
        if (selectedObject) {
          // selectedObject가 Three.js 객체이므로 직접 복사해보자
          console.log('selectedObject를 직접 copyObject에 전달')
          copyObject(selectedObject);
          setToast({ 
            message: `"${selectedObject.name}"이(가) 복사되었습니다`, 
            type: 'success' 
          });
          setTimeout(() => setToast(null), 2000);
        } else {
          console.log('selectedObject가 null 또는 undefined')
          setToast({ 
            message: '복사할 객체를 먼저 선택해주세요', 
            type: 'warning' 
          });
          setTimeout(() => setToast(null), 2000);
        }
      }
      
      // Ctrl+V - 붙여넣기
      if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault()
        console.log('Ctrl+V 키 감지됨, 붙여넣기 실행')
        console.log('hasClipboardData():', hasClipboardData())
        
        if (hasClipboardData()) {
          console.log('pasteObject 함수 호출 전')
          const pastedObject = pasteObject();
          console.log('pasteObject 함수 호출 후, 결과:', pastedObject)
          if (pastedObject) {
            setToast({ 
              message: `"${pastedObject.name}"이(가) 붙여넣기되었습니다`, 
              type: 'success' 
            });
            setTimeout(() => setToast(null), 2000);
          } else {
            console.log('pastedObject가 null/undefined')
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
      }
      
      // Delete 키 - 삭제
      if (e.key === 'Delete') {
        e.preventDefault()
        console.log('Delete 키 감지됨, 삭제 실행')
        
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
      }
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
    setSunLightRef(sunLight)
    scene.add(sunLight)

    console.log('지속적인 태양 조명이 생성되었습니다')
  }

  // 지속적인 태양 조명 제거 함수
  const removePersistentSunLight = () => {
    if (!scene || !sunLightRef) return

    scene.remove(sunLightRef)
    if (sunLightRef.dispose) {
      sunLightRef.dispose()
    }
    setSunLightRef(null)

    console.log('지속적인 태양 조명이 제거되었습니다')
  }

  // HDRI 설정 자동 저장
  useEffect(() => {
    if (scene) {
      setTimeout(() => saveHDRISettings(), 100)
    }
  }, [hdriSettings, scene, saveHDRISettings])

  // EditorControls 인스턴스를 설정하는 함수
  const setEditorControls = (controls) => {
    editorControlsRef.current = controls
    // EditorControls instance received in EditorPage
  }

  // PostProcessingManager 인스턴스를 설정하는 함수
  const setPostProcessingManager = (manager) => {
    postProcessingRef.current = manager
    console.log('PostProcessingManager instance received in EditorPage')
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
        position: { x: 0, y: 0, z: 0 }, // 객체 형태로 변경
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

  const handleMenuAction = (action) => {
    // Menu action triggered
    
    switch (action) {
      case 'new-map':
        if (confirm(MESSAGES.NEW_MAP_CONFIRM)) {
          clearMap()
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
        console.log('메뉴에서 복사 액션 실행됨')
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
        console.log('메뉴에서 붙여넣기 액션 실행됨')
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
        console.log('메뉴에서 삭제 액션 실행됨')
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
        console.log('Grid toggle menu action triggered');
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

  const handleDialogConfirm = () => {
    if (showDialog === 'save' && dialogInput.trim()) {
      saveMap(dialogInput.trim())
      alert(`맵이 "${dialogInput.trim()}"으로 저장되었습니다.`)
    } else if (showDialog === 'load' && dialogInput.trim()) {
      const success = loadMap(dialogInput.trim())
      if (success) {
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

  // 메쉬를 라이브러리에 추가하는 핸들러
  const handleAddToLibrary = async (object) => {
    try {
      const name = prompt('메쉬 이름을 입력하세요:', object.name || '커스텀 메쉬');
      if (!name) return;

      // 변환 값 유지 여부 확인
      const preserveTransform = confirm(
        '현재 객체의 크기, 회전, 위치 변경사항을 GLB에 적용하시겠습니까?\n\n' +
        '- "확인": 현재 변환 상태가 적용된 메쉬로 저장\n' +
        '- "취소": 원본 상태로 저장 (변환 값 초기화)'
      );

      setToast({ message: '라이브러리에 추가 중...', type: 'info' });

      const meshData = await glbMeshManager.current.addCustomMesh(object, name, { preserveTransform });
      console.log('EditorPage: 생성된 메쉬 데이터:', meshData);
      
      // 스토어에 추가
      addCustomMesh(meshData);
      
      // 강제로 LibraryPanel 새로고침을 위한 이벤트 발생
      window.dispatchEvent(new CustomEvent('customMeshAdded', { detail: meshData }));

      const transformMessage = preserveTransform ? ' (변환 상태 적용됨)' : ' (원본 상태로 저장됨)';
      setToast({ message: `"${name}"이(가) 라이브러리에 추가되었습니다!${transformMessage}`, type: 'success' });
      
      // 5초 후 토스트 자동 닫기
      setTimeout(() => setToast(null), 5000);
    } catch (error) {
      console.error('라이브러리 추가 실패:', error);
      setToast({ message: '라이브러리 추가에 실패했습니다.', type: 'error' });
      
      // 5초 후 토스트 자동 닫기
      setTimeout(() => setToast(null), 5000);
    }
  }

  return (
    <div className="editor-page">
      <MenuBar onMenuAction={handleMenuAction} />
      <div className="editor-container">
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
        <ViewportControls editorControls={editorControlsRef.current} />
        <EditorUI 
          editorControls={editorControlsRef.current} 
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
              <button onClick={handleDialogConfirm}>확인</button>
              <button onClick={handleDialogCancel}>취소</button>
            </div>
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
