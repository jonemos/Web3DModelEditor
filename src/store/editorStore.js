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

export const useEditorStore = create((set, get) => {
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
