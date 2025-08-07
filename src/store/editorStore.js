import { create } from 'zustand'

console.log('🔥 에디터 스토어 파일 로드됨');

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
  
  // Floor settings
  floorWidth: 50,
  floorDepth: 50,
  
  // Viewport settings
  isWireframe: false,
  isGridSnap: false,
  gridSize: 1, // 그리드 크기 (단위: Three.js 유닛)
  
  // Gizmo settings
  gizmoSpace: 'world', // 'world' or 'local'
  isMagnetEnabled: false, // 자석 기능 활성화
  showMagnetRays: false, // 자석 레이 표시

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
  setFloorSize: (width, depth) => set({ floorWidth: width, floorDepth: depth }),
  
  // Viewport actions
  toggleWireframe: () => set((state) => ({ isWireframe: !state.isWireframe })),
  toggleGridSnap: () => set((state) => ({ isGridSnap: !state.isGridSnap })),
  setGridSize: (size) => set({ gridSize: size }),
  
  // Gizmo actions
  toggleGizmoSpace: () => set((state) => ({ 
    gizmoSpace: state.gizmoSpace === 'world' ? 'local' : 'world' 
  })),
  toggleMagnet: () => set((state) => ({ isMagnetEnabled: !state.isMagnetEnabled })),
  toggleMagnetRays: () => set((state) => ({ showMagnetRays: !state.showMagnetRays })),
  
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
  
  removeObject: (object) => set((state) => ({
    objects: state.objects.filter(obj => obj !== object),
    selectedObject: state.selectedObject === object ? null : state.selectedObject
  })),
  
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
      floor: {
        width: state.floorWidth,
        depth: state.floorDepth
      },
      walls: state.walls,
      objects: state.objects
    }
    localStorage.setItem(`map_${name}`, JSON.stringify(mapData))
  },
  
  loadMap: (name) => {
    const mapDataString = localStorage.getItem(`map_${name}`)
    if (mapDataString) {
      const mapData = JSON.parse(mapDataString)
      set({
        floorWidth: mapData.floor.width,
        floorDepth: mapData.floor.depth,
        walls: mapData.walls || [],
        objects: mapData.objects || []
      })
      return true
    }
    return false
  },
  
  clearMap: () => set({
    objects: [],
    walls: [],
    selectedObject: null
  }),
  
  // Scene setup
  setScene: (scene, camera, renderer) => set({ scene, camera, renderer })
  };
});
