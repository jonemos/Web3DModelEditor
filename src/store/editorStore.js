import { create } from 'zustand'
import { defaultViewGizmoConfig, defaultUISettings, defaultEnvironmentSettings, loadViewGizmoConfigAsync, startViewGizmoConfigAutoPersist, loadSettingsSectionAsync, startSettingsAutoPersist, loadEnvironmentSettingsAsync, startEnvironmentAutoPersist, saveEnvironmentSettingsAsync } from '../utils/viewGizmoConfig'
import { normalizeVec3, normalizeTransformFields, safeCloneForHistory, pickTransform, snapshotForUpdate } from './helpers'
import { createSceneSlice } from './slices/sceneSlice'
import { createEnvironmentSlice } from './slices/environmentSlice'
import { createUISlice } from './slices/uiSlice'
import { createSelectionSlice } from './slices/selectionSlice'
import { createIOSlice } from './slices/ioSlice'
import { createHistorySlice } from './slices/historySlice'

// 초기 View/Gizmo 설정 스냅샷
const vg = { ...defaultViewGizmoConfig }
const uiInitial = { ...defaultUISettings }

export const useEditorStore = create((set, get) => {
  // 비동기 리하이드레이션: SQLite 최신값으로 덮어쓰기 (초기 1회)
  ;(async () => {
    try {
      const results = await Promise.allSettled([
        loadViewGizmoConfigAsync(),
        loadSettingsSectionAsync('ui'),
        loadEnvironmentSettingsAsync(),
      ])
      // View/Gizmo
      try {
        if (results[0].status === 'fulfilled' && results[0].value) {
          const vgAsync = results[0].value
          set((s) => ({
            isWireframe: !!vgAsync.isWireframe,
            isGridSnap: !!vgAsync.isGridSnap,
            isGridVisible: !!vgAsync.isGridVisible,
            gizmoSpace: vgAsync.gizmoSpace || 'world',
            gizmoSize: Number.isFinite(vgAsync.gizmoSize) ? vgAsync.gizmoSize : s.gizmoSize,
            snapMove: Number.isFinite(vgAsync.snapMove) ? vgAsync.snapMove : s.snapMove,
            snapRotateDeg: Number.isFinite(vgAsync.snapRotateDeg) ? vgAsync.snapRotateDeg : s.snapRotateDeg,
            snapScale: Number.isFinite(vgAsync.snapScale) ? vgAsync.snapScale : s.snapScale,
            cameraPanSpeed: Number.isFinite(vgAsync.cameraPanSpeed) ? vgAsync.cameraPanSpeed : s.cameraPanSpeed,
            cameraOrbitSpeed: Number.isFinite(vgAsync.cameraOrbitSpeed) ? vgAsync.cameraOrbitSpeed : s.cameraOrbitSpeed,
            cameraZoomSpeed: Number.isFinite(vgAsync.cameraZoomSpeed) ? vgAsync.cameraZoomSpeed : s.cameraZoomSpeed,
            isPostProcessingEnabled: !!vgAsync.isPostProcessingEnabled,
          }))
        }
      } finally {
        try { set({ viewReady: true }) } catch {}
      }

      // UI section
      try {
        if (results[1].status === 'fulfilled' && results[1].value) {
          const uiAsync = results[1].value
          set({
            showLibrary: !!uiAsync.showLibrary,
            showAssets: !!uiAsync.showAssets,
            isPostProcessingPanelOpen: !!uiAsync.isPostProcessingPanelOpen,
            showHDRI: !!uiAsync.showHDRI,
            isViewGizmoSettingsOpen: !!uiAsync.isViewGizmoSettingsOpen,
            dragUseSelectionForDnD: !!uiAsync.dragUseSelectionForDnD,
          })
        }
      } finally {
        try { set({ uiReady: true }) } catch {}
      }

      // Environment section
      try {
        if (results[2].status === 'fulfilled' && results[2].value) {
          const envAsync = results[2].value
          set((s) => ({
            isPostProcessingEnabled: !!(envAsync.postProcessing?.enabled ?? s.isPostProcessingEnabled),
            postProcessingPreset: envAsync.postProcessing?.preset || s.postProcessingPreset,
            safeMode: { ...s.safeMode, ...(envAsync.safeMode || {}) },
            rendererAA: envAsync.rendererAA || s.rendererAA,
            renderMode: envAsync.renderMode || s.renderMode,
            hdriSettings: envAsync.hdriSettings ? { ...s.hdriSettings, ...envAsync.hdriSettings } : s.hdriSettings,
          }))
        }
      } finally {
        try { set({ envReady: true }) } catch {}
      }
    } catch {
      try { set({ viewReady: true, uiReady: true, envReady: true }) } catch {}
    }
  })()

  return {
    // ----- slice composition -----
    ...createSceneSlice(set, get),
    ...createEnvironmentSlice(set, get),
    ...createUISlice(set, get),
    ...createSelectionSlice(set, get),
    ...createIOSlice(set, get),
    ...createHistorySlice(set, get),

    // ----- root-only state/actions -----
    // View/Gizmo & viewport
    isWireframe: !!vg.isWireframe,
    isGridSnap: !!vg.isGridSnap,
    isGridVisible: !!vg.isGridVisible,
    gridSize: 1,
    gizmoSpace: vg.gizmoSpace || 'world',
    gizmoSize: Number.isFinite(vg.gizmoSize) ? vg.gizmoSize : 0.5,
    snapMove: Number.isFinite(vg.snapMove) ? vg.snapMove : 1.0,
    snapRotateDeg: Number.isFinite(vg.snapRotateDeg) ? vg.snapRotateDeg : 5,
    snapScale: Number.isFinite(vg.snapScale) ? vg.snapScale : 0.01,
    cameraPanSpeed: Number.isFinite(vg.cameraPanSpeed) ? vg.cameraPanSpeed : 10,
    cameraOrbitSpeed: Number.isFinite(vg.cameraOrbitSpeed) ? vg.cameraOrbitSpeed : 10,
    cameraZoomSpeed: Number.isFinite(vg.cameraZoomSpeed) ? vg.cameraZoomSpeed : 0.5,

    // UI flags hydration defaults
    showLibrary: !!uiInitial.showLibrary,
    showAssets: !!uiInitial.showAssets,
    isPostProcessingPanelOpen: !!uiInitial.isPostProcessingPanelOpen,
    showHDRI: !!uiInitial.showHDRI,
    isViewGizmoSettingsOpen: !!uiInitial.isViewGizmoSettingsOpen,
    dragUseSelectionForDnD: !!uiInitial.dragUseSelectionForDnD,

    // Extra runtime flags
    viewReady: false,
    uiReady: false,
    envReady: false,

    // Controls/misc
    useBlenderControls: true,
    setUseBlenderControls: (on) => set({ useBlenderControls: !!on }),
    dropIndicator: { easing: 'easeInOutQuad', inMs: 200, outMs: 220, maxOpacity: 0.6 },
    updateDropIndicator: (updates) => set((state) => ({ dropIndicator: { ...state.dropIndicator, ...updates } })),

    // Viewport actions
    toggleWireframe: () => set((state) => ({ isWireframe: !state.isWireframe })),
    toggleGridSnap: () => set((state) => ({ isGridSnap: !state.isGridSnap })),
    toggleGridVisible: () => set((state) => ({ isGridVisible: !state.isGridVisible })),
    setGridSize: (size) => set({ gridSize: size }),
    toggleGizmoSpace: () => set((state) => ({ gizmoSpace: state.gizmoSpace === 'world' ? 'local' : 'world' })),
    setGizmoSize: (size) => set({ gizmoSize: Math.max(0.1, Math.min(5, Number(size) || 1)) }),
    setSnapMove: (val) => set({ snapMove: Math.max(0.001, Math.min(1000, Number(val) || 1)) }),
    setSnapRotateDeg: (deg) => set({ snapRotateDeg: Math.max(0.1, Math.min(360, Number(deg) || 15)) }),
    setSnapScale: (val) => set({ snapScale: Math.max(0.001, Math.min(100, Number(val) || 0.1)) }),
    setCameraPanSpeed: (v) => set({ cameraPanSpeed: Math.max(1, Math.min(500, Number(v) || 50)) }),
    setCameraOrbitSpeed: (v) => set({ cameraOrbitSpeed: Math.max(1, Math.min(1000, Number(v) || 100)) }),
    setCameraZoomSpeed: (v) => set({ cameraZoomSpeed: Math.max(0.01, Math.min(5, Number(v) || 0.3)) }),
    rehydrateViewGizmoConfig: async () => {
      try {
        const cfg = await loadViewGizmoConfigAsync()
        set({
          isWireframe: !!cfg.isWireframe,
          isGridSnap: !!cfg.isGridSnap,
          isGridVisible: !!cfg.isGridVisible,
          gizmoSpace: cfg.gizmoSpace || 'world',
          gizmoSize: Number.isFinite(cfg.gizmoSize) ? cfg.gizmoSize : 0.5,
          snapMove: Number.isFinite(cfg.snapMove) ? cfg.snapMove : 1,
          snapRotateDeg: Number.isFinite(cfg.snapRotateDeg) ? cfg.snapRotateDeg : 5,
          snapScale: Number.isFinite(cfg.snapScale) ? cfg.snapScale : 0.01,
          isPostProcessingEnabled: !!cfg.isPostProcessingEnabled,
          cameraPanSpeed: Number.isFinite(cfg.cameraPanSpeed) ? cfg.cameraPanSpeed : 10,
          cameraOrbitSpeed: Number.isFinite(cfg.cameraOrbitSpeed) ? cfg.cameraOrbitSpeed : 10,
          cameraZoomSpeed: Number.isFinite(cfg.cameraZoomSpeed) ? cfg.cameraZoomSpeed : 0.5,
        })
      } catch {}
    },

    // Clipboard helpers
    clipboard: null,
    hasClipboardData: () => get().clipboard !== null,
    clearClipboard: () => set({ clipboard: null }),
    copyObject: (object) => {
      if (!object) return
      if (object.isObject3D) {
        const objectId = object.userData?.id
        if (objectId) {
          const { updateObjectTransform } = get()
          updateObjectTransform(objectId, {
            position: { x: object.position.x, y: object.position.y, z: object.position.z },
            rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
            scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z },
          })
        }
        const objectData = get().objects.find(obj => obj.id === object.userData?.id)
        const objectCopy = {
          name: `${object.name}_copy`,
          type: objectData?.type || object.userData?.type || 'basic',
          geometry: objectData?.geometry || object.userData?.geometry || 'BoxGeometry',
          params: objectData?.params || object.userData?.params || [1,1,1],
          uuid: object.uuid,
          ...(objectData?.type === 'glb' && { url: objectData.url, customMeshId: objectData.customMeshId, file: undefined }),
          position: { x: object.position.x, y: object.position.y, z: object.position.z },
          rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
          scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z },
          visible: object.visible,
          material: objectData?.material || object.userData?.material || { type: 'MeshStandardMaterial', color: 0xff0000 },
          originalObject: object,
        }
        set({ clipboard: objectCopy })
        return
      }
      if (object.isSystemObject) return
      const objectCopy = { ...object, id: undefined, name: `${object.name}_copy` }
      set({ clipboard: objectCopy })
    },
    pasteObject: () => {
      const state = get()
      if (!state.clipboard) return null
      const newObject = {
        ...state.clipboard,
        id: Date.now(),
        position: { x: state.clipboard.position?.x || 0, y: state.clipboard.position?.y || 0, z: state.clipboard.position?.z || 0 },
        rotation: { x: state.clipboard.rotation?.x || 0, y: state.clipboard.rotation?.y || 0, z: state.clipboard.rotation?.z || 0 },
        scale: { x: state.clipboard.scale?.x || 1, y: state.clipboard.scale?.y || 1, z: state.clipboard.scale?.z || 1 },
      }
      set({ objects: [...state.objects, newObject], selectedObject: newObject.id })
      return newObject
    },

    // Object mutations not yet sliced
    updateObject: (id, updates) => set((state) => {
      const before = state.objects.find(o => o.id === id)
      const norm = normalizeTransformFields(updates)
      const next = state.objects.map(obj => obj.id === id ? { ...obj, ...norm } : obj)
      if (before) {
        const entry = { type: 'update', id, before: snapshotForUpdate(before, norm), after: norm }
        const { _pushHistory } = get(); _pushHistory(entry)
      }
      return { objects: next }
    }),
    setParent: (objectId, newParentId) => set((state) => {
      const target = state.objects.find(o => o.id === objectId)
      if (!target) return {}
      const beforeParent = target.parentId ?? null
      const afterParent = newParentId ?? null
      if (beforeParent === afterParent) return {}
      const entry = { type: 'reparent', id: objectId, before: { parentId: beforeParent }, after: { parentId: afterParent } }
      const { _pushHistory } = get(); _pushHistory(entry)
      const siblings = state.objects.filter(o => (o.parentId ?? null) === afterParent && o.id !== objectId)
      const maxOrder = siblings.reduce((m, o) => Number.isFinite(o.order) ? Math.max(m, o.order) : m, -1)
      const newOrder = maxOrder + 1
      return { objects: state.objects.map(o => o.id === objectId ? { ...o, parentId: afterParent, order: newOrder } : o) }
    }),
    reorderSiblings: (parentId, orderedIds) => set((state) => {
      if (!Array.isArray(orderedIds)) return {}
      const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]))
      const updated = state.objects.map(o => {
        if ((o.parentId ?? null) !== (parentId ?? null)) return o
        if (!orderMap.has(o.id)) return o
        return { ...o, order: orderMap.get(o.id) }
      })
      return { objects: updated }
    }),
    toggleObjectVisibility: (object) => set((state) => {
      const newVisibleState = object.visible !== false ? false : true
      const updatedObjects = state.objects.map(obj => obj.id === object.id ? { ...obj, visible: newVisibleState } : obj)
      const entry = { type: 'update', id: object.id, before: { visible: object.visible }, after: { visible: newVisibleState } }
      const { _pushHistory } = get(); _pushHistory(entry)
      const updatedWalls = state.walls.map(wall => wall.id === object.id ? { ...wall, visible: newVisibleState } : wall)
      return { objects: updatedObjects, walls: updatedWalls }
    }),
    toggleObjectFreeze: (object) => set((state) => {
      const newFreezeState = object.frozen !== true ? true : false
      const updatedObjects = state.objects.map(obj => obj.id === object.id ? { ...obj, frozen: newFreezeState } : obj)
      const entry = { type: 'update', id: object.id, before: { frozen: object.frozen }, after: { frozen: newFreezeState } }
      const { _pushHistory } = get(); _pushHistory(entry)
      const updatedWalls = state.walls.map(wall => wall.id === object.id ? { ...wall, frozen: newFreezeState } : wall)
      return { objects: updatedObjects, walls: updatedWalls }
    }),
    renameObject: (objectId, newName) => set((state) => {
      const before = state.objects.find(o => o.id === objectId)
      const updatedObjects = state.objects.map(obj => obj.id === objectId ? { ...obj, name: newName } : obj)
      if (before) { const entry = { type: 'update', id: objectId, before: { name: before.name }, after: { name: newName } }; const { _pushHistory } = get(); _pushHistory(entry) }
      const updatedWalls = state.walls.map(wall => wall.id === objectId ? { ...wall, name: newName } : wall)
      return { objects: updatedObjects, walls: updatedWalls }
    }),
    deleteSelectedObject: () => {
      const state = get()
      if (!state.selectedObject) return
      const selectedId = typeof state.selectedObject === 'object' ? state.selectedObject.id : state.selectedObject
      if (!selectedId) return
      const objectToDelete = state.objects.find(obj => obj.id === selectedId)
      if (!objectToDelete || objectToDelete.isSystemObject) return
      const updatedObjects = state.objects.filter(obj => obj.id !== selectedId)
      const entry = { type: 'remove', object: safeCloneForHistory(objectToDelete) }
      const { _pushHistory } = get(); _pushHistory(entry)
      const nextAnnotations = (state.annotations || []).filter(a => a.ownerId !== selectedId)
      set({ objects: updatedObjects, annotations: nextAnnotations, selectedObject: null })
    },
    addWall: (wall) => set((state) => ({ walls: [...state.walls, wall] })),
    removeWall: (wallId) => set((state) => ({ walls: state.walls.filter(wall => wall.id !== wallId) })),
    updateWall: (id, updates) => set((state) => ({ walls: state.walls.map(wall => wall.id === id ? { ...wall, ...updates } : wall) })),

    // Scene sync helpers
    syncSceneToState: () => {
      const state = get(); const scene = state.scene; if (!scene) return false
      const idToObject3D = new Map()
      try { scene.traverse((child) => { const id = child?.userData?.id; if (id) idToObject3D.set(id, child) }) } catch {}
      const updatedObjects = state.objects.map((o) => {
        const n = normalizeTransformFields(o); const obj3d = idToObject3D.get(o.id); if (!obj3d || !obj3d.isObject3D) return n
        const next = { ...n, position: { x: obj3d.position.x, y: obj3d.position.y, z: obj3d.position.z }, rotation: { x: obj3d.rotation.x, y: obj3d.rotation.y, z: obj3d.rotation.z }, scale: { x: obj3d.scale.x, y: obj3d.scale.y, z: obj3d.scale.z } }
        try {
          const type = o.type
          const lightKind = type === 'light' ? o.lightType : (type === 'directional_light' ? 'directional' : type === 'point_light' ? 'point' : type === 'spot_light' ? 'spot' : null)
          if (obj3d.isLight && lightKind) {
            if (typeof obj3d.intensity === 'number') next.intensity = obj3d.intensity
            if (obj3d.color && typeof obj3d.color.getHex === 'function') next.color = obj3d.color.getHex()
            next.castShadow = !!obj3d.castShadow
            if (lightKind === 'point' || lightKind === 'spot') { if (typeof obj3d.distance === 'number') next.distance = obj3d.distance; if (typeof obj3d.decay === 'number') next.decay = obj3d.decay }
            if (lightKind === 'spot') { if (typeof obj3d.angle === 'number') next.angle = obj3d.angle; if (typeof obj3d.penumbra === 'number') next.penumbra = obj3d.penumbra }
          }
        } catch {}
        return next
      })
      set({ objects: updatedObjects }); return true
    },
    pruneOrphanSceneObjects: () => {
      try {
        const scene = get().scene; if (!scene) return
        const keepIds = new Set((get().objects || []).map(o => o.id)); const toRemove = []
        scene.traverse((child) => {
          if (child?.userData?.isSystemObject) return; if (child?.userData?.isSelectionOutline) return
          const cid = child?.userData?.id; if (!cid || !keepIds.has(cid)) { const n = (child.name || '').toLowerCase(); if (n.includes('transformcontrols') || n.includes('gizmo') || n.includes('helper')) return; toRemove.push(child) }
        })
        toRemove.forEach((obj) => { try { if (obj.parent) obj.parent.remove(obj); else scene.remove(obj) } catch {} })
      } catch {}
    },

    // Safe mode controls (env-related)
    toggleSafeMode: (on) => {
      const enabled = on !== undefined ? !!on : !get().safeMode?.enabled
      const current = get().safeMode || { enabled: false, pixelRatio: 1.0 }
      const next = { ...current, enabled }
      set({ safeMode: next })
      try { const ppm = get().postProcessingManager; if (ppm) { ppm.setEffectEnabled('fxaa', !enabled); ppm.setEffectEnabled('ssao', !enabled); ppm.handleResize(window.innerWidth, window.innerHeight) } } catch {}
      try { const renderer = get().renderer; if (renderer) { const pr = enabled ? (get().safeMode.pixelRatio || 1.0) : Math.min(2, window.devicePixelRatio || 1); renderer.setPixelRatio(pr) } } catch {}
      try { get().estimateVRAMUsage?.() } catch {}
      try { saveEnvironmentSettingsAsync({ safeMode: { enabled: get().safeMode.enabled, pixelRatio: get().safeMode.pixelRatio } }) } catch {}
    },
    setSafeModePixelRatio: (pr) => {
      const clamped = Math.max(0.5, Math.min(2, Number(pr) || 1))
      const next = { ...(get().safeMode || { enabled: false, pixelRatio: 1.0 }), pixelRatio: clamped }
      set({ safeMode: next })
      try { const renderer = get().renderer; if (renderer && get().safeMode.enabled) renderer.setPixelRatio(clamped) } catch {}
      try { const ppm = get().postProcessingManager; if (ppm) ppm.handleResize(window.innerWidth, window.innerHeight) } catch {}
      try { get().estimateVRAMUsage?.() } catch {}
      try { saveEnvironmentSettingsAsync({ safeMode: { enabled: get().safeMode.enabled, pixelRatio: clamped } }) } catch {}
    },

    // Annotation API
    annotations: [],
    addAnnotation: (ann) => set((state) => {
      const id = ann?.id || `ann_${Date.now()}_${Math.random().toString(36).slice(2,7)}`
      const ownerId = ann?.ownerId ?? null
      const text = typeof ann?.text === 'string' ? ann.text : ''
      const l = normalizeVec3(ann?.local, { x: 0, y: 0, z: 0 })
      const next = [...(state.annotations || []), { id, ownerId, text, local: l }]
      return { annotations: next }
    }),
    removeAnnotation: (id) => set((state) => ({ annotations: (state.annotations || []).filter(a => a.id !== id) })),
    setAnnotations: (arr) => set({ annotations: Array.isArray(arr) ? arr.map(a => ({ id: a?.id || `ann_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, ownerId: a?.ownerId ?? null, text: typeof a?.text === 'string' ? a.text : '', local: normalizeVec3(a?.local, { x: 0, y: 0, z: 0 }) })) : [] }),

    // Map persistence
    saveMap: async (name, viewState) => {
      const state = get(); try { state.syncSceneToState?.() } catch {}
      const serializedObjects = state.objects.map((o) => { if (o?.type === 'glb') { const { glbData, ...rest } = o || {}; return { ...rest } } return o })
      let autoView = viewState
      try {
        if (!autoView) {
          const cam = state.camera
          autoView = cam ? { camera: { type: cam.type, position: { x: cam.position.x, y: cam.position.y, z: cam.position.z }, rotation: { x: cam.rotation.x, y: cam.rotation.y, z: cam.rotation.z }, zoom: typeof cam.zoom === 'number' ? cam.zoom : undefined }, viewport: { isWireframe: !!state.isWireframe, isGridSnap: !!state.isGridSnap, isGridVisible: !!state.isGridVisible, gizmoSpace: state.gizmoSpace, gizmoSize: state.gizmoSize, snapMove: state.snapMove, snapRotateDeg: state.snapRotateDeg, snapScale: state.snapScale, rendererAA: state.rendererAA, renderMode: state.renderMode, isPostProcessingEnabled: !!state.isPostProcessingEnabled, postProcessingPreset: state.postProcessingPreset, safeMode: { ...state.safeMode }, hdriSettings: { ...state.hdriSettings } } } : undefined
        }
      } catch {}
      const mapData = { __version: 1, walls: state.walls, objects: serializedObjects, annotations: Array.isArray(state.annotations) ? state.annotations : [], viewState: autoView || undefined }
      try { const { mapsUpsert } = await import('../utils/sqlite'); await mapsUpsert(String(name || ''), mapData, mapData.__version) } catch {}
      try { localStorage.setItem(`map_${name}`, JSON.stringify(mapData)) } catch {}
    },
    getMapData: async (name) => {
      try { const { mapsGet } = await import('../utils/sqlite'); const obj = await mapsGet(String(name || '')); if (obj) return obj } catch {}
      try { const s = localStorage.getItem(`map_${name}`); if (!s) return null; const parsed = JSON.parse(s); if (parsed && !('__version' in parsed)) parsed.__version = 1; return parsed } catch { return null }
    },
    listMaps: async () => {
      const rows = []
      try { const { mapsList } = await import('../utils/sqlite'); const sqlRows = await mapsList(); if (Array.isArray(sqlRows)) rows.push(...sqlRows) } catch {}
      try { const keys = Object.keys(localStorage || {}); const mapKeys = keys.filter(k => k.startsWith('map_')); const existing = new Set(rows.map(r => String(r.name))); for (const k of mapKeys) { const nm = k.substring(4); if (!existing.has(nm)) rows.push({ name: nm, version: 1, updated_at: null }) } } catch {}
      rows.sort((a,b) => (b.updated_at||0) - (a.updated_at||0)); return rows
    },
    deleteMap: async (name) => {
      const nm = String(name || '')
      try { const { mapsDelete } = await import('../utils/sqlite'); await mapsDelete(nm); try { localStorage.removeItem(`map_${nm}`) } catch {}; return true } catch { try { localStorage.removeItem(`map_${nm}`) } catch {}; return false }
    },
    loadMap: async (name) => {
      let mapData = null; try { const { mapsGet } = await import('../utils/sqlite'); mapData = await mapsGet(String(name || '')) } catch {}
      if (!mapData) { const s = localStorage.getItem(`map_${name}`); if (s) { try { mapData = JSON.parse(s) } catch { mapData = null } } }
      if (!mapData) return false
      if (!('__version' in mapData)) mapData.__version = 1
      const normalizedObjects = (mapData.objects || []).map(o => {
        const n = normalizeTransformFields(o)
        if (n?.type === 'glb') { if (n.glbData && typeof n.glbData === 'object' && !Array.isArray(n.glbData) && !(n.glbData instanceof ArrayBuffer) && !(n.glbData instanceof Uint8Array)) delete n.glbData }
        if (!n?.type) { if (n.url || n.file) n.type = 'glb'; else if (n.geometry && n.params) n.type = 'basic'; else if (n.size && n.material) n.type = 'cube' }
        if (n?.type === 'glb' && !n.url && !n.file && !n.customMeshId && !n.glbData) { if (n.userData?.originalData?.id) n.customMeshId = n.userData.originalData.id; if (!n.customMeshId && n.userData?.customMeshId) n.customMeshId = n.userData.customMeshId; if (!n.customMeshId && n.userData?.url) n.url = n.userData.url }
        if (n?.type === 'mesh' && !n.geometry && !n.params && (n.userData?.type === 'basic' || n.userData?.geometry)) {
          const originalName = n.userData?.originalName || n.name || ''; const lower = String(originalName).toLowerCase(); let geometry = n.userData?.geometry; let params = n.userData?.params
          if (!geometry) {
            if (lower.includes('정육면체') || lower.includes('box')) { geometry = 'BoxGeometry'; params = [1,1,1] }
            else if (lower.includes('구체') || lower.includes('sphere')) { geometry = 'SphereGeometry'; params = [0.5, 32, 16] }
            else if (lower.includes('원기둥') || lower.includes('cylinder')) { geometry = 'CylinderGeometry'; params = [0.5, 0.5, 1, 32] }
            else if (lower.includes('원뿔') || lower.includes('cone')) { geometry = 'ConeGeometry'; params = [0.5, 1, 32] }
            else if (lower.includes('평면') || lower.includes('plane')) { geometry = 'PlaneGeometry'; params = [1, 1] }
            else if (lower.includes('도넛') || lower.includes('torus')) { geometry = 'TorusGeometry'; params = [0.5, 0.2, 16, 100] }
          }
          if (geometry) { n.type = 'basic'; n.geometry = geometry; n.params = params || [] }
        }
        const parentId = Object.prototype.hasOwnProperty.call(n, 'parentId') ? n.parentId ?? null : null
        let order = n.order; if (!Number.isFinite(order)) order = 0
        return { ...n, parentId, order }
      })
      const normalizedWalls = (mapData.walls || []).map(normalizeTransformFields)
      const normalizedAnnotations = Array.isArray(mapData.annotations) ? mapData.annotations.map((a) => ({ id: a?.id || `ann_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, ownerId: a?.ownerId ?? null, text: typeof a?.text === 'string' ? a.text : '', local: normalizeVec3(a?.local, { x: 0, y: 0, z: 0 }) })) : []
      set(() => ({ walls: normalizedWalls, objects: normalizedObjects, annotations: normalizedAnnotations }))
      try { requestAnimationFrame(() => { try { get().pruneOrphanSceneObjects?.() } catch {} }) } catch {}
      try {
        const vs = mapData.viewState
        if (vs && vs.viewport) {
          const v = vs.viewport; const patch = {}
          patch.isWireframe = !!v.isWireframe; patch.isGridSnap = !!v.isGridSnap; patch.isGridVisible = !!v.isGridVisible; patch.gizmoSpace = v.gizmoSpace || get().gizmoSpace
          if (Number.isFinite(v.gizmoSize)) patch.gizmoSize = v.gizmoSize; if (Number.isFinite(v.snapMove)) patch.snapMove = v.snapMove; if (Number.isFinite(v.snapRotateDeg)) patch.snapRotateDeg = v.snapRotateDeg; if (Number.isFinite(v.snapScale)) patch.snapScale = v.snapScale
          if (v.rendererAA) patch.rendererAA = v.rendererAA; if (v.renderMode) patch.renderMode = v.renderMode
          patch.isPostProcessingEnabled = !!v.isPostProcessingEnabled; if (v.postProcessingPreset) patch.postProcessingPreset = v.postProcessingPreset; if (v.safeMode) patch.safeMode = { ...get().safeMode, ...v.safeMode }; if (v.hdriSettings) patch.hdriSettings = { ...get().hdriSettings, ...v.hdriSettings }
          if (Object.keys(patch).length > 0) set(patch)
        }
      } catch {}
      return true
    },
    clearMap: () => {
      const state = get(); set({ objects: (state.objects || []).filter(obj => obj.isSystemObject), walls: [], annotations: [], selectedObject: null, selectedIds: [] })
      try { const scene = get().scene; if (scene) { const keepIds = new Set((get().objects || []).map(o => o.id)); const toRemove = []; scene.traverse((child) => { if (child?.userData?.isSystemObject) return; if (child?.userData?.isSelectionOutline) return; const cid = child?.userData?.id; if (!cid || !keepIds.has(cid)) toRemove.push(child) }); toRemove.forEach((obj) => { try { if (obj.parent) obj.parent.remove(obj); else scene.remove(obj) } catch {} }) } } catch {}
      try { requestAnimationFrame(() => { try { get().pruneOrphanSceneObjects?.() } catch {} }) } catch {}
      try { window.dispatchEvent(new CustomEvent('annotationsCleared')) } catch {}
    },
  }
})

// 자동 저장 시작 (스토어 생성 후 1회)
try { startViewGizmoConfigAutoPersist(useEditorStore) } catch {}
try { startEnvironmentAutoPersist(useEditorStore) } catch {}
try { startSettingsAutoPersist(
  useEditorStore,
  'ui',
  (s) => ({
    showLibrary: !!s.showLibrary,
    showAssets: !!s.showAssets,
    isPostProcessingPanelOpen: !!s.isPostProcessingPanelOpen,
    showHDRI: !!s.showHDRI,
    isViewGizmoSettingsOpen: !!s.isViewGizmoSettingsOpen,
    dragUseSelectionForDnD: !!s.dragUseSelectionForDnD,
  }),
  120,
) } catch {}
