import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFExporter } from 'three-stdlib'
import { useEditorStore } from '../../store/editorStore'
import FloorSizePanel from './panels/FloorSizePanel'
import SceneHierarchyPanel from './panels/SceneHierarchyPanel'
import ObjectPropertiesPanel from './panels/ObjectPropertiesPanel'
import LibraryPanel from './panels/LibraryPanel'
import ContextMenu from './ContextMenu'
import Toast from '../ui/Toast'
import './EditorUI.css'

function EditorUI({ editorControls }) {
  const {
    selectedObject,
    transformMode,
    floorWidth,
    floorDepth,
    objects,
    walls,
    savedObjects,
    setTransformMode,
    setFloorSize,
    addWall,
    addObject,
    removeObject,
    addAsset,
    saveMap,
    loadMap,
    clearMap,
    toggleObjectVisibility,
    renameObject,
    setSelectedObject
  } = useEditorStore()

  const [mapName, setMapName] = useState('')
  const [assetName, setAssetName] = useState('')
  const [showLibrary, setShowLibrary] = useState(false)
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

  // 디버깅용 로그
  // Console output removed
  // Console output removed
  // Console output removed

  // 전역 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F키 - 포커스
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        if (selectedObject?.id) {
          // 선택된 오브젝트가 있으면 포커스
          handleObjectFocus(selectedObject)
        }
      }
    }

    const handleContextMenu = (e) => {
      // 선택된 객체가 있을 때만 컨텍스트 메뉴 표시
      if (selectedObject) {
        e.preventDefault();
        console.log('컨텍스트 메뉴 표시 - 선택된 객체:', selectedObject);
        setContextMenu({
          isVisible: true,
          x: e.clientX,
          y: e.clientY
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('contextmenu', handleContextMenu)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [selectedObject])

  const handleAddWall = () => {
    const newWall = {
      id: Date.now(),
      position: [0, 2.5, 0],
      scale: [1, 1, 1],
      name: `wall_${walls.length + 1}`
    }
    addWall(newWall)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    const fileName = file.name.replace(/\.[^/.]+$/, "")
    
    if (assetName) {
      addAsset(assetName, url)
      setAssetName('')
    } else {
      addAsset(fileName, url)
    }
  }

  const handleAddObject = (assetUrl, assetName) => {
    const newObject = {
      id: Date.now(),
      url: assetUrl,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      name: assetName
    }
    addObject(newObject)
  }

  const handleSaveMap = () => {
    if (!mapName) {
      alert('맵 이름을 입력하세요')
      return
    }
    saveMap(mapName)
    alert(`맵 '${mapName}'이 저장되었습니다.`)
    setMapName('')
  }

  const handleLoadMap = () => {
    if (!mapName) {
      alert('불러올 맵 이름을 입력하세요')
      return
    }
    const success = loadMap(mapName)
    if (success) {
      alert(`맵 '${mapName}'을 불러왔습니다.`)
    } else {
      alert('맵을 찾을 수 없습니다.')
    }
    setMapName('')
  }

  const handleClearMap = () => {
    if (window.confirm('모든 오브젝트를 삭제하시겠습니까?')) {
      clearMap()
    }
  }

  const handleFloorSizeChange = (width, depth) => {
    setFloorSize(width, depth)
  }

  const handleObjectVisibilityToggle = (obj) => {
    toggleObjectVisibility(obj)
  }

  const handleObjectSelect = (obj) => {
    // null 체크 추가
    if (!obj) {
      // Console output removed
      // EditorControls를 통해 선택 해제
      if (editorControls) {
        editorControls.deselectAllObjects()
      }
      setSelectedObject(null)
      return
    }
    
    // 오브젝트 선택 로직
    // Console output removed
    
    // EditorControls를 통해 실제 Three.js 오브젝트 선택
    if (editorControls) {
      // loadedObjects에서 실제 Three.js 오브젝트 찾기
      const threeObject = editorControls.findObjectById(obj.id)
      if (threeObject) {
        // EditorControls의 선택 기능 사용
        editorControls.selectObject(threeObject)
        // Console output removed
      } else {
        // Console output removed
      }
    } else {
      // Console output removed
    }
    
    // 스토어에서 선택된 오브젝트 설정
    setSelectedObject(obj)
  }

  const handleObjectFocus = (obj) => {
    // F키와 같은 것처럼 오브젝트에 포커스
    // Console output removed
    
    // 먼저 오브젝트를 선택
    handleObjectSelect(obj)
    
    // EditorControls를 통해 포커스 기능 실행
    if (editorControls) {
      const threeObject = editorControls.findObjectById(obj.id)
      if (threeObject) {
        // 포커스 기능 (F키와 동일)
        editorControls.focusOnObject(threeObject)
        // Console output removed
      }
    }
  }

  const handleObjectRename = (obj, newName) => {
    // 오브젝트 이름 변경
    // Console output removed
    renameObject(obj.id, newName)
    
    // 선택된 오브젝트가 이름이 변경된 오브젝트라면 업데이트
    if (selectedObject?.id === obj.id) {
      const updatedSelectedObject = {
        ...selectedObject,
        name: newName
      }
      setSelectedObject(updatedSelectedObject)
    }
  }

  const handleObjectRemove = (obj) => {
    // Console output removed
    // Console output removed
    
    // 1단계: 기즈모와 아웃라인 우선 해제 (최우선)
    if (editorControls && editorControls.objectSelector) {
      // Console output removed
      
      // 기즈모 해제
      if (editorControls.objectSelector.transformControls) {
        try {
          editorControls.objectSelector.transformControls.detach()
          // Console output removed
        } catch (error) {
          // Console output removed
        }
      }
      
      // 아웃라인 제거 (Three.js 객체에서 직접)
      try {
        const threeObject = editorControls.findObjectById(obj.id)
        if (threeObject) {
          editorControls.objectSelector.removeSelectionOutline(threeObject)
          // Console output removed
        }
      } catch (error) {
        // Console output removed
      }
    }
    
    // 2단계: 선택 해제 및 전체 정리
    if (selectedObject && selectedObject.id === obj.id) {
      // Console output removed
      
      if (editorControls) {
        try {
          editorControls.deselectAllObjects()
          // Console output removed
        } catch (error) {
          // Console output removed
        }
      }
      
      // UI 상태 초기화
      setSelectedObject(null)
      // Console output removed
    }
    
    // 3단계: 시간차 지연 후 씬에서 객체 완전 제거
    // Console output removed
    setTimeout(() => {
      try {
        removeObject(obj)
        // Console output removed
        // Console output removed
      } catch (error) {
        // Console output removed
      }
    }, 50) // 지연을 50ms로 증가하여 더 안전하게
  }

  const handleLibraryToggle = () => {
    setShowLibrary(!showLibrary)
  }

  const handleLibraryDrop = (objectData, position) => {
    // 라이브러리에서 드롭된 오브젝트를 씬에 추가
    const newObject = {
      id: Date.now(),
      type: 'glb',
      file: objectData.file,
      position: position || { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      name: objectData.name
    }
    addObject(newObject)
    
    // 추가된 오브젝트를 선택 상태로 만들기
    setTimeout(() => {
      setSelectedObject(newObject.id)
    }, 100)
  }

  const handleCloseContextMenu = () => {
    setContextMenu({
      isVisible: false,
      x: 0,
      y: 0
    })
  }

  const handleAddToLibrary = async (selectedObj) => {
    console.log('라이브러리 추가 시작...');
    console.log('받은 selectedObj 매개변수:', selectedObj);
    
    if (!editorControls) {
      console.error('EditorControls가 아직 준비되지 않았습니다.');
      showToast('에디터가 준비되지 않았습니다.', 'error');
      return;
    }

    // 선택된 객체들 가져오기 (아웃라인이 적용된 객체들)
    const selectedObjects = editorControls.getSelectedObjects();
    console.log('선택된 객체들 (아웃라인 적용):', selectedObjects);

    if (!selectedObjects || selectedObjects.length === 0) {
      console.log('선택된 객체가 없습니다.');
      showToast('라이브러리에 추가할 객체를 먼저 선택해주세요. 3D 뷰에서 객체를 클릭하거나 드래그하여 선택하세요.', 'error');
      return;
    }

    try {
      // 여러 객체가 선택된 경우 하나의 그룹으로 만들기
      let objectToExport;
      if (selectedObjects.length === 1) {
        objectToExport = selectedObjects[0];
      } else {
        // 여러 객체를 하나의 그룹으로 결합
        const group = new THREE.Group();
        selectedObjects.forEach(obj => {
          const clone = obj.clone();
          group.add(clone);
        });
        objectToExport = group;
      }

      console.log('내보낼 객체:', objectToExport);
      showToast(`${selectedObjects.length}개 객체를 라이브러리에 추가 중...`, 'info');

      // 사용자 정의 이름 입력
      const customName = prompt('라이브러리에 추가할 객체의 이름을 입력하세요:', 
        selectedObj?.name || objectToExport.name || `Custom Object ${JSON.parse(localStorage.getItem('customObjects') || '[]').length + 1}`
      );
      if (!customName) return;

      // GLB 파일로 내보내기
      const exporter = new GLTFExporter();
      const gltfData = await new Promise((resolve, reject) => {
        exporter.parse(
          objectToExport,
          (result) => resolve(result),
          (error) => reject(error),
          { binary: true }
        );
      });

      // 썸네일 생성
      const thumbnail = await generateThumbnail(objectToExport);

      // 커스텀 객체 저장
      const customObjects = JSON.parse(localStorage.getItem('customObjects') || '[]');
      
      const newObject = {
        id: `custom_${Date.now()}`,
        name: customName,
        glbData: Array.from(new Uint8Array(gltfData)),
        thumbnail: thumbnail,
        createdAt: new Date().toISOString()
      };

      customObjects.push(newObject);
      localStorage.setItem('customObjects', JSON.stringify(customObjects));

      console.log('커스텀 객체 저장 완료:', newObject.name);
      showToast(`"${customName}"이 라이브러리에 추가되었습니다!`, 'success');

      // 패널 새로고침
      setForceRefresh(prev => prev + 1);
    } catch (error) {
      console.error('GLB 내보내기 실패:', error);
      showToast('객체를 라이브러리에 추가하는데 실패했습니다.', 'error');
    }
  };

  const exportObjectToLibrary = async (threeObject, customName) => {
    try {
      // 1. 객체를 복제하고 원점 중심으로 이동
      const clonedObject = threeObject.clone();
      
      // 바운딩 박스 계산
      const box = new THREE.Box3().setFromObject(clonedObject);
      const center = box.getCenter(new THREE.Vector3());
      
      // 원점 중심으로 이동
      clonedObject.position.sub(center);
      
      // 2. 씬 생성 및 객체 추가
      const exportScene = new THREE.Scene();
      exportScene.add(clonedObject);
      
      // 3. GLB 파일로 내보내기
      const exporter = new GLTFExporter();
      
      const glbData = await new Promise((resolve, reject) => {
        exporter.parse(
          exportScene,
          (result) => resolve(result),
          (error) => reject(error),
          { binary: true }
        );
      });

      // 4. 썸네일 생성
      const thumbnail = await generateThumbnail(clonedObject);
      
      // 5. 파일 저장을 위한 Blob 생성
      const glbBlob = new Blob([glbData], { type: 'application/octet-stream' });
      const glbUrl = URL.createObjectURL(glbBlob);
      
      // 6. 라이브러리 객체 정보 생성
      const customObject = {
        id: `custom_${Date.now()}`,
        name: customName,
        type: 'custom',
        geometry: 'CustomGeometry',
        glbUrl: glbUrl,
        glbData: Array.from(new Uint8Array(glbData)), // 저장을 위해 배열로 변환
        thumbnail: thumbnail,
        createdAt: new Date().toISOString(),
        originalObject: {
          position: threeObject.position.toArray(),
          rotation: threeObject.rotation.toArray(),
          scale: threeObject.scale.toArray()
        }
      };

      // 7. 로컬 스토리지에 저장
      const savedCustomObjects = JSON.parse(localStorage.getItem('customLibraryObjects') || '[]');
      savedCustomObjects.push(customObject);
      localStorage.setItem('customLibraryObjects', JSON.stringify(savedCustomObjects));

      alert(`"${customName}"이(가) 라이브러리에 추가되었습니다!`);
      
      // 라이브러리 패널 새로고침
      if (showLibrary) {
        setShowLibrary(false);
        setTimeout(() => setShowLibrary(true), 100);
      }

    } catch (error) {
      console.error('GLB 내보내기 오류:', error);
      alert('객체를 GLB 파일로 내보내는 중 오류가 발생했습니다.');
    }
  }

  const generateThumbnail = async (object) => {
    try {
      // 썸네일 생성을 위한 임시 씬과 카메라 설정
      const thumbnailScene = new THREE.Scene();
      const thumbnailCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      const thumbnailRenderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        preserveDrawingBuffer: true 
      });
      
      thumbnailRenderer.setSize(128, 128);
      thumbnailRenderer.setClearColor(0x2a2a2a, 1);
      
      // 객체 복제 및 추가
      const clonedForThumbnail = object.clone();
      thumbnailScene.add(clonedForThumbnail);
      
      // 조명 추가
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      thumbnailScene.add(ambientLight);
      thumbnailScene.add(directionalLight);
      
      // 카메라 위치 설정 (객체를 잘 보이도록)
      const box = new THREE.Box3().setFromObject(clonedForThumbnail);
      const size = box.getSize(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z);
      
      thumbnailCamera.position.set(maxSize * 1.5, maxSize * 1.2, maxSize * 1.5);
      thumbnailCamera.lookAt(box.getCenter(new THREE.Vector3()));
      
      // 렌더링
      thumbnailRenderer.render(thumbnailScene, thumbnailCamera);
      
      // 캔버스를 데이터 URL로 변환
      const canvas = thumbnailRenderer.domElement;
      const dataURL = canvas.toDataURL('image/png');
      
      // 리소스 정리
      thumbnailRenderer.dispose();
      
      return dataURL;
    } catch (error) {
      console.error('썸네일 생성 오류:', error);
      return null;
    }
  }

  return (
    <div className="editor-ui">
      {/* 좌측 도구 모음 */}
      <div className="tool-panel">
        <div className="tool-section">
          <button 
            className={`tool-btn library-btn ${showLibrary ? 'active' : ''}`}
            onClick={handleLibraryToggle}
            title="라이브러리"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4,6H20V8H4V6M4,11H20V13H4V11M4,16H20V18H4V16Z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* 라이브러리 패널 */}
      {showLibrary && (
        <LibraryPanel 
          onObjectDrop={handleLibraryDrop}
          onClose={() => setShowLibrary(false)}
          forceRefresh={forceRefresh}
        />
      )}

      {/* Toast 메시지 */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      {/* 컨텍스트 메뉴 */}
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        isVisible={contextMenu.isVisible}
        onClose={handleCloseContextMenu}
        onAddToLibrary={handleAddToLibrary}
        selectedObject={selectedObject}
      />

      {/* 우측 패널 - 오브젝트 목록 */}
      <div className="right-panel">
        {/* 바닥 크기 패널 */}
        <FloorSizePanel 
          floorWidth={floorWidth}
          floorDepth={floorDepth}
          onFloorSizeChange={handleFloorSizeChange}
        />

        {/* 씬 하이라키 패널 */}
        <SceneHierarchyPanel 
          objects={objects}
          walls={walls}
          selectedObject={selectedObject}
          onObjectVisibilityToggle={handleObjectVisibilityToggle}
          onObjectSelect={handleObjectSelect}
          onObjectRemove={handleObjectRemove}
          onObjectFocus={handleObjectFocus}
          onObjectRename={handleObjectRename}
          onContextMenu={(e, obj) => {
            e.preventDefault();
            console.log('하이라키에서 컨텍스트 메뉴:', obj);
            // 객체를 먼저 선택
            handleObjectSelect(obj);
            // 컨텍스트 메뉴 표시
            setContextMenu({
              isVisible: true,
              x: e.clientX,
              y: e.clientY
            });
          }}
          editorControls={editorControls}
        />

        {/* 오브젝트 속성 패널 */}
        <ObjectPropertiesPanel 
          selectedObject={selectedObject}
        />
      </div>
    </div>
  )
}

export default EditorUI
