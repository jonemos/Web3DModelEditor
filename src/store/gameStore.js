import { create } from 'zustand'
import * as THREE from 'three'

export const useGameStore = create((set, get) => ({
  // Game state
  isPlaying: true,
  isPaused: false,
  isLoading: true,
  
  // Scene objects
  scene: null,
  camera: null,
  renderer: null,
  player: null,
  mixer: null,
  clock: new THREE.Clock(),
  
  // Player state
  playerPosition: { x: 0, y: 1, z: 0 },
  playerRotation: 0,
  
  // Camera state
  cameraState: {
    distance: 10,
    height: 5,
    followMode: true,
    rotationSpeed: 0.002,
    zoomSpeed: 1,
    minDistance: 3,
    maxDistance: 50,
    phi: Math.PI / 4,
    theta: 0
  },
  
  // Mouse and keyboard state
  keys: {},
  mouseState: {
    isMouseDown: false,
    prevMousePos: { x: 0, y: 0 },
    sensitivity: 0.002
  },
  
  // Game objects
  trees: [],
  items: [],
  walls: [],
  
  // Actions
  setLoading: (loading) => set({ isLoading: loading }),
  
  setScene: (scene, camera, renderer) => set({ scene, camera, renderer }),
  
  setPlayer: (player) => set({ player }),
  
  updatePlayerPosition: (position) => set({ playerPosition: position }),
  
  updatePlayerRotation: (rotation) => set({ playerRotation: rotation }),
  
  setKey: (key, pressed) => set((state) => ({
    keys: { ...state.keys, [key]: pressed }
  })),
  
  pause: () => set({ isPaused: true }),
  
  resume: () => set({ isPaused: false }),
  
  restart: () => set({ 
    isPlaying: true, 
    isPaused: false,
    playerPosition: { x: 0, y: 1, z: 0 },
    playerRotation: 0
  }),
  
  toggleCameraFollowMode: () => set((state) => ({
    cameraState: {
      ...state.cameraState,
      followMode: !state.cameraState.followMode
    }
  })),
  
  updateCameraDistance: (distance) => set((state) => ({
    cameraState: {
      ...state.cameraState,
      distance: Math.max(
        state.cameraState.minDistance,
        Math.min(state.cameraState.maxDistance, distance)
      )
    }
  })),
  
  updateCameraAngles: (phi, theta) => set((state) => ({
    cameraState: {
      ...state.cameraState,
      phi: Math.max(0.1, Math.min(Math.PI - 0.1, phi)),
      theta
    }
  })),
  
  setMouseDown: (isDown, pos) => set((state) => ({
    mouseState: {
      ...state.mouseState,
      isMouseDown: isDown,
      prevMousePos: pos || state.mouseState.prevMousePos
    }
  })),
  
  addItem: (item) => set((state) => ({
    items: [...state.items, item]
  })),
  
  removeItem: (itemId) => set((state) => ({
    items: state.items.filter(item => item.id !== itemId)
  })),
  
  setTrees: (trees) => set({ trees }),
  
  addWall: (wall) => set((state) => ({
    walls: [...state.walls, wall]
  })),
  
  clearWalls: () => set({ walls: [] }),
  
  setMixer: (mixer) => set({ mixer })
}))
