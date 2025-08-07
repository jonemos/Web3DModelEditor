import { useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
import PlainEditorCanvas from '../components/editor/PlainEditorCanvas'
import EditorUI from '../components/editor/EditorUI'
import MenuBar from '../components/editor/MenuBar'
import ViewportControls from '../components/editor/ViewportControls'
import { useEditorStore } from '../store/editorStore'
import { MeshLibraryManager } from '../utils/meshLibraryManager'
import Toast from '../components/ui/Toast'
import './EditorPage.css'

// 메시지 상수
const MESSAGES = {
  NEW_MAP_CONFIRM: '새 맵을 만들면 현재 작업이 사라집니다. 계속하시겠습니까?',
  EXPORT_NOT_READY: '익스포트 기능은 준비 중입니다.',
  EXIT_CONFIRM: '에디터를 종료하시겠습니까?',
  UNDO_NOT_READY: '실행 취소 기능은 준비 중입니다.',
  REDO_NOT_READY: '다시 실행 기능은 준비 중입니다.',
  COPY_NOT_READY: '복사 기능은 준비 중입니다.',
  PASTE_NOT_READY: '붙여넣기 기능은 준비 중입니다.',
  DELETE_NOT_READY: '삭제 기능은 준비 중입니다.',
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
  const { clearMap, saveMap, loadMap, addObject, setSelectedObject, addCustomMesh, selectedObject } = useEditorStore()
  const [showDialog, setShowDialog] = useState(null)
  const [dialogInput, setDialogInput] = useState('')
  const [toast, setToast] = useState(null)
  
  // EditorControls 인스턴스를 관리하기 위한 ref
  const editorControlsRef = useRef(null)
  const postProcessingRef = useRef(null)
  const meshLibraryManager = useRef(new MeshLibraryManager())

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
        alert(MESSAGES.COPY_NOT_READY)
        break
        
      case 'paste':
        alert(MESSAGES.PASTE_NOT_READY)
        break
        
      case 'delete':
        alert(MESSAGES.DELETE_NOT_READY)
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
        alert(MESSAGES.TOGGLE_GRID_NOT_READY)
        break
        
      case 'toggle-stats':
        alert(MESSAGES.TOGGLE_STATS_NOT_READY)
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

      setToast({ message: '라이브러리에 추가 중...', type: 'info' });

      const meshData = await meshLibraryManager.current.addMeshToLibrary(object, name);
      console.log('EditorPage: 생성된 메쉬 데이터:', meshData);
      
      // 스토어에 추가
      addCustomMesh(meshData);
      
      // 강제로 LibraryPanel 새로고침을 위한 이벤트 발생
      window.dispatchEvent(new CustomEvent('customMeshAdded', { detail: meshData }));

      setToast({ message: `"${name}"이(가) 라이브러리에 추가되었습니다!`, type: 'success' });
      
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
