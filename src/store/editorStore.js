import { create } from 'zustand'

console.log('🔥 에디터 스토어 파일 로드됨');

// localStorage에서 HDRI 설정 로드하는 헬퍼 함수
const loadInitialHDRISettings = () => {
  try {
    const savedSettings = localStorage.getItem('hdriSettings')
    if (savedSettings) {
      const settings = JSON.parse(savedSettings)
      console.log('초기 HDRI 설정 로드됨:', settings)
      return settings
    }
  } catch (error) {
    console.error('초기 HDRI 설정 로드 실패:', error)
  }
  return null
}

const initialHDRISettings = loadInitialHDRISettings()

// 스토어 인스턴스를 직접 생성하여 getState() 메서드에 접근 가능하도록 함
const createEditorStore = () => create((set, get) => {
  console.log('🔥 에디터 스토어 생성 시작');
  
  return {
  // Scene state
  scene: null,
  camera: null,
  renderer: null,
  
  // Selected object
  selectedObject: null,
  transformMode: 'translate',
  
  // Viewport settings
  isWireframe: false,
  isGridSnap: false,
  isGridVisible: true, // 그리드 가시성
  gridSize: 1, // 그리드 크기 (단위: Three.js 유닛)
  
  // Gizmo settings
  gizmoSpace: 'world', // 'world' or 'local'
  isMagnetEnabled: false, // 자석 기능 활성화
  showMagnetRays: false, // 자석 레이 표시

  // HDRI settings - 패널이 닫혀도 유지되는 설정 (localStorage에서 초기값 로드)
  hdriSettings: {
    currentHDRI: {
      name: '기본 배경',
      type: 'none'
    },
    hdriIntensity: 1,
    hdriRotation: 0,
    sunLightEnabled: true,
    sunIntensity: 1,
    timeOfDay: 12,
    sunAzimuth: 0,
    sunElevation: 45,
    sunColor: '#ffffff',
    ...initialHDRISettings // localStorage에서 로드된 설정으로 덮어쓰기
  },
  
  // HDRI 조명 ref - 씬에서 지속적으로 관리
  sunLightRef: null,

  // Assets
  savedObjects: new Map(),
  customMeshes: (() => {
    // 스토어 초기화 시 로컬 스토리지에서 커스텀 메쉬 로드
    try {
      const stored = localStorage.getItem('customMeshes');
      const meshes = stored ? JSON.parse(stored) : [];
      console.log('에디터 스토어 초기화: 로컬 스토리지에서 커스텀 메쉬 로드:', meshes.length, '개');
      return meshes;
    } catch (error) {
      console.error('로컬 스토리지에서 커스텀 메쉬 로드 실패:', error);
      return [];
    }
  })(), // 즉시 실행 함수로 초기값 설정
  objects: [],
  walls: [],
  
  // Clipboard for copy/paste functionality
  clipboard: null, // 복사된 객체를 저장하는 클립보드
  
  // Actions
  setSelectedObject: (object) => set({ selectedObject: object }),
  setTransformMode: (mode) => set({ transformMode: mode }),
  
  // Viewport actions
  toggleWireframe: () => set((state) => ({ isWireframe: !state.isWireframe })),
  toggleGridSnap: () => set((state) => ({ isGridSnap: !state.isGridSnap })),
  toggleGridVisible: () => set((state) => ({ isGridVisible: !state.isGridVisible })),
  setGridSize: (size) => set({ gridSize: size }),
  
  // Gizmo actions
  toggleGizmoSpace: () => set((state) => ({ 
    gizmoSpace: state.gizmoSpace === 'world' ? 'local' : 'world' 
  })),
  toggleMagnet: () => set((state) => ({ isMagnetEnabled: !state.isMagnetEnabled })),
  toggleMagnetRays: () => set((state) => ({ showMagnetRays: !state.showMagnetRays })),
  
  // HDRI actions
  updateHDRISettings: (updates) => set((state) => ({
    hdriSettings: { ...state.hdriSettings, ...updates }
  })),
  
  setSunLightRef: (ref) => set({ sunLightRef: ref }),
  
  // HDRI 설정 초기화 (localStorage에서 로드)
  initializeHDRISettings: () => {
    try {
      const savedSettings = localStorage.getItem('hdriSettings')
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)
        console.log('스토어에서 HDRI 설정 초기화:', settings)
        set((state) => ({
          hdriSettings: { ...state.hdriSettings, ...settings }
        }))
        return true
      }
    } catch (error) {
      console.error('HDRI 설정 초기화 실패:', error)
    }
    return false
  },
  
  // HDRI 설정 저장 (localStorage에)
  saveHDRISettings: () => {
    const { hdriSettings } = get()
    try {
      localStorage.setItem('hdriSettings', JSON.stringify(hdriSettings))
      console.log('스토어에서 HDRI 설정 저장:', hdriSettings)
    } catch (error) {
      console.error('HDRI 설정 저장 실패:', error)
    }
  },
  
  // Asset actions
  addAsset: (name, url) => set((state) => {
    const newMap = new Map(state.savedObjects)
    newMap.set(name, url)
    return { savedObjects: newMap }
  }),

  addCustomMesh: (meshData) => set((state) => {
    console.log('에디터 스토어: 커스텀 메쉬 추가', meshData.name, '기존 개수:', state.customMeshes.length);
    const newCustomMeshes = [...state.customMeshes, meshData];
    console.log('에디터 스토어: 업데이트 후 개수:', newCustomMeshes.length);
    return { customMeshes: newCustomMeshes };
  }),

  deleteCustomMesh: (meshId) => set((state) => {
    console.log('에디터 스토어: 커스텀 메쉬 삭제', meshId);
    const filteredMeshes = state.customMeshes.filter(mesh => mesh.id !== meshId);
    console.log('에디터 스토어: 삭제 후 개수:', filteredMeshes.length);
    return { customMeshes: filteredMeshes };
  }),

  loadCustomMeshes: (meshes) => set((state) => {
    console.log('에디터 스토어: 커스텀 메쉬 로드', meshes.length, '개');
    return { customMeshes: meshes };
  }),
  
  // 객체의 transform 정보 업데이트
  updateObjectTransform: (objectId, transform) => set((state) => ({
    objects: state.objects.map(obj => 
      obj.id === objectId 
        ? { ...obj, ...transform }
        : obj
    )
  })),
  
  addObject: (object) => set((state) => ({
    objects: [...state.objects, object]
  })),
  
  removeObject: (object) => set((state) => {
    // 시스템 객체는 삭제할 수 없음
    if (object.isSystemObject) {
      console.warn('시스템 객체는 삭제할 수 없습니다:', object.name);
      return state;
    }
    
    return {
      objects: state.objects.filter(obj => obj !== object),
      selectedObject: state.selectedObject === object ? null : state.selectedObject
    };
  }),
  
  addWall: (wall) => set((state) => ({
    walls: [...state.walls, wall]
  })),
  
  removeWall: (wallId) => set((state) => ({
    walls: state.walls.filter(wall => wall.id !== wallId)
  })),
  
  updateObject: (id, updates) => set((state) => ({
    objects: state.objects.map(obj => 
      obj.id === id ? { ...obj, ...updates } : obj
    )
  })),
  
  // Clipboard actions
  copyObject: (object) => {
    console.log('copyObject 함수 호출됨:', object);
    if (!object) {
      console.warn('copyObject: 객체가 null 또는 undefined입니다');
      return;
    }
    
    // Three.js 객체인지 확인
    if (object.isObject3D) {
      console.log('Three.js 객체가 감지됨, 필요한 정보 추출 중...');
      console.log('복사할 객체의 transform:', {
        position: object.position,
        rotation: object.rotation,
        scale: object.scale
      });
      
      // 먼저 objects 배열을 Three.js 객체의 현재 transform으로 업데이트
      const state = get();
      const objectId = object.userData?.id;
      if (objectId) {
        const { updateObjectTransform } = get();
        updateObjectTransform(objectId, {
          position: {
            x: object.position.x,
            y: object.position.y,
            z: object.position.z
          },
          rotation: {
            x: object.rotation.x,
            y: object.rotation.y,
            z: object.rotation.z
          },
          scale: {
            x: object.scale.x,
            y: object.scale.y,
            z: object.scale.z
          }
        });
      }
      
      // 업데이트된 상태에서 객체 정보 다시 가져오기
      const updatedState = get();
      const objectData = updatedState.objects.find(obj => obj.id === objectId);
      console.log('업데이트된 objects 배열에서 찾은 객체 정보:', objectData);
      
      // Three.js 객체와 objects 배열 정보를 결합하여 클립보드용 객체 생성
      const objectCopy = {
        name: `${object.name}_copy`,
        type: objectData?.type || object.userData?.type || 'basic', // 원본 타입 유지 (glb, mesh 등)
        geometry: objectData?.geometry || object.userData?.geometry || 'BoxGeometry',
        params: objectData?.params || object.userData?.params || [1, 1, 1],
        uuid: object.uuid, // 원본 참조용
        
        // GLB 객체의 경우 추가 정보 복사
        ...(objectData?.type === 'glb' && {
          url: objectData.url,
          glbData: objectData.glbData,
          file: objectData.file
        }),
        
        position: {
          x: object.position.x,
          y: object.position.y,
          z: object.position.z
        },
        rotation: {
          x: object.rotation.x,
          y: object.rotation.y,
          z: object.rotation.z
        },
        scale: {
          x: object.scale.x,
          y: object.scale.y,
          z: object.scale.z
        },
        visible: object.visible,
        material: objectData?.material || object.userData?.material || {
          type: 'MeshStandardMaterial',
          color: 0xff0000
        },
        // 원본 Three.js 객체 참조 (복사 시 필요)
        originalObject: object
      };
      
      set({ clipboard: objectCopy });
      console.log('Three.js 객체가 클립보드에 복사되었습니다:', object.name);
      console.log('clipboard 설정됨:', objectCopy);
      return;
    }
    
    // 시스템 객체는 복사할 수 없음
    if (object.isSystemObject) {
      console.warn('시스템 객체는 복사할 수 없습니다:', object.name);
      return;
    }
    
    // 일반 객체의 복사본을 클립보드에 저장
    const objectCopy = {
      ...object,
      id: undefined, // 새로운 ID가 부여되도록 undefined로 설정
      name: `${object.name}_copy` // 복사본임을 나타내는 접미사 추가
    };
    
    set({ clipboard: objectCopy });
    console.log('객체가 클립보드에 복사되었습니다:', object.name);
  },
  
  pasteObject: () => {
    console.log('pasteObject 함수 호출됨');
    const state = get();
    console.log('현재 클립보드 상태:', state.clipboard);
    
    if (!state.clipboard) {
      // 클립보드가 비어있을 때는 조용히 null 반환 (경고 메시지 제거)
      console.log('클립보드가 비어있음');
      return null;
    }
    
    // 클립보드의 객체를 기반으로 새 객체 생성
    const newObject = {
      ...state.clipboard,
      id: Date.now(), // 새로운 고유 ID 생성
      position: {
        x: state.clipboard.position?.x || 0, // 복사한 위치 그대로 사용
        y: state.clipboard.position?.y || 0,
        z: state.clipboard.position?.z || 0
      },
      rotation: {
        x: state.clipboard.rotation?.x || 0, // 복사한 회전 그대로 사용
        y: state.clipboard.rotation?.y || 0,
        z: state.clipboard.rotation?.z || 0
      },
      scale: {
        x: state.clipboard.scale?.x || 1, // 복사한 크기 그대로 사용
        y: state.clipboard.scale?.y || 1,
        z: state.clipboard.scale?.z || 1
      }
    };
    
    console.log('새로 생성될 객체:', newObject);
    
    // 새 객체를 씬에 추가
    const updatedObjects = [...state.objects, newObject];
    set({ 
      objects: updatedObjects,
      selectedObject: newObject.id // 새로 생성된 객체 선택
    });
    
    console.log('객체가 붙여넣기되었습니다:', newObject.name);
    return newObject;
  },
  
  // 클립보드 상태 확인 헬퍼 함수
  hasClipboardData: () => {
    const state = get();
    console.log('hasClipboardData 호출됨, clipboard:', state.clipboard);
    const result = state.clipboard !== null;
    console.log('hasClipboardData 결과:', result);
    return result;
  },
  
  // 클립보드 비우기 함수
  clearClipboard: () => {
    set({ clipboard: null });
    console.log('클립보드가 비워졌습니다.');
  },
  
  deleteSelectedObject: () => {
    console.log('deleteSelectedObject 함수 호출됨');
    const state = get();
    console.log('현재 선택된 객체 ID:', state.selectedObject);
    console.log('현재 객체 목록:', state.objects);
    
    if (!state.selectedObject) {
      console.warn('선택된 객체가 없습니다.');
      return;
    }
    
    // 선택된 객체 찾기
    const objectToDelete = state.objects.find(obj => obj.id === state.selectedObject);
    console.log('삭제할 객체:', objectToDelete);
    
    if (!objectToDelete) {
      console.warn('선택된 객체를 찾을 수 없습니다.');
      return;
    }
    
    // 시스템 객체는 삭제할 수 없음
    if (objectToDelete.isSystemObject) {
      console.warn('시스템 객체는 삭제할 수 없습니다:', objectToDelete.name);
      return;
    }
    
    // 객체 삭제
    const updatedObjects = state.objects.filter(obj => obj.id !== state.selectedObject);
    console.log('삭제 후 객체 목록:', updatedObjects);
    
    set({ 
      objects: updatedObjects,
      selectedObject: null // 선택 해제
    });
    
    console.log('객체가 삭제되었습니다:', objectToDelete.name);
  },
  
  updateWall: (id, updates) => set((state) => ({
    walls: state.walls.map(wall => 
      wall.id === id ? { ...wall, ...updates } : wall
    )
  })),

  toggleObjectVisibility: (object) => set((state) => {
    const newVisibleState = object.visible !== false ? false : true
    
    // 오브젝트 배열에서 찾아서 업데이트
    const updatedObjects = state.objects.map(obj => 
      obj.id === object.id ? { ...obj, visible: newVisibleState } : obj
    )
    
    // 벽 배열에서 찾아서 업데이트
    const updatedWalls = state.walls.map(wall => 
      wall.id === object.id ? { ...wall, visible: newVisibleState } : wall
    )
    
    return {
      objects: updatedObjects,
      walls: updatedWalls
    }
  }),

  toggleObjectFreeze: (object) => set((state) => {
    const newFreezeState = object.frozen !== true ? true : false
    
    // 오브젝트 배열에서 찾아서 업데이트
    const updatedObjects = state.objects.map(obj => 
      obj.id === object.id ? { ...obj, frozen: newFreezeState } : obj
    )
    
    // 벽 배열에서 찾아서 업데이트
    const updatedWalls = state.walls.map(wall => 
      wall.id === object.id ? { ...wall, frozen: newFreezeState } : wall
    )
    
    return {
      objects: updatedObjects,
      walls: updatedWalls
    }
  }),

  renameObject: (objectId, newName) => set((state) => {
    // 오브젝트 배열에서 찾아서 이름 업데이트
    const updatedObjects = state.objects.map(obj => 
      obj.id === objectId ? { ...obj, name: newName } : obj
    )
    
    // 벽 배열에서 찾아서 이름 업데이트
    const updatedWalls = state.walls.map(wall => 
      wall.id === objectId ? { ...wall, name: newName } : wall
    )
    
    return {
      objects: updatedObjects,
      walls: updatedWalls
    }
  }),
  
  saveMap: (name) => {
    const state = get()
    const mapData = {
      walls: state.walls,
      objects: state.objects
    }
    localStorage.setItem(`map_${name}`, JSON.stringify(mapData))
  },
  
  loadMap: (name) => {
    const mapDataString = localStorage.getItem(`map_${name}`)
    if (mapDataString) {
      const mapData = JSON.parse(mapDataString)
      
      set((state) => {
        return {
          walls: mapData.walls || [],
          objects: mapData.objects || []
        };
      });
      
      return true
    }
    return false
  },
  
  clearMap: () => set((state) => ({
    objects: state.objects.filter(obj => obj.isSystemObject), // 시스템 객체는 유지
    walls: [],
    selectedObject: null
  })),
  
  // Scene setup
  setScene: (scene, camera, renderer) => set({ scene, camera, renderer })
  };
});

// 스토어 인스턴스 생성
const editorStoreInstance = createEditorStore()

// hook 함수로 export (기존 코드 호환성 유지)
export const useEditorStore = editorStoreInstance

// 스토어 인스턴스도 export (새 아키텍처에서 getState() 접근용)
export { editorStoreInstance }
