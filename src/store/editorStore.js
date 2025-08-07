import { create } from 'zustand'

export const useEditorStore = create((set, get) => ({
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
  
  // Assets
  savedObjects: new Map(),
  objects: [
    // 테스트용 기본 오브젝트들
    {
      id: 'test_cube',
      name: 'Test Cube',
      position: [0, 1, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      type: 'test',
      visible: true
    },
    {
      id: 'tree_trunk',
      name: 'Tree Trunk',
      position: [5, 1.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      type: 'test',
      visible: true
    },
    {
      id: 'tree_leaves',
      name: 'Tree Leaves',
      position: [5, 4, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      type: 'test',
      visible: true
    }
  ],
  walls: [],
  
  // Actions
  setSelectedObject: (object) => set({ selectedObject: object }),
  setTransformMode: (mode) => set({ transformMode: mode }),
  setFloorSize: (width, depth) => set({ floorWidth: width, floorDepth: depth }),
  
  addAsset: (name, url) => set((state) => {
    const newMap = new Map(state.savedObjects)
    newMap.set(name, url)
    return { savedObjects: newMap }
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
}))
