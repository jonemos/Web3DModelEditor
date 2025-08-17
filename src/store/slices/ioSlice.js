// IO slice: maps/assets/custom meshes
import { safeCloneForHistory, normalizeTransformFields } from '../helpers'
import { idbAddCustomMesh, idbDeleteCustomMesh } from '../../utils/idb'

export const createIOSlice = (set, get) => ({
  savedObjects: new Map(),
  customMeshes: [],
  objects: [],
  walls: [],
  annotations: [],

  addAsset: (name, url) => set((state) => {
    const newMap = new Map(state.savedObjects)
    newMap.set(name, url)
    return { savedObjects: newMap }
  }),

  addCustomMesh: async (meshData) => {
    try {
      await idbAddCustomMesh(meshData)
      set((state) => ({ customMeshes: [...state.customMeshes, meshData] }))
    } catch {}
  },

  deleteCustomMesh: async (meshId) => {
    try {
      await idbDeleteCustomMesh(meshId)
      set((state) => ({ customMeshes: state.customMeshes.filter(mesh => mesh.id !== meshId) }))
    } catch {}
  },

  loadCustomMeshes: (meshes) => set(() => ({
    customMeshes: (Array.isArray(meshes) ? meshes : []).map(m => ({ ...m, type: 'custom' }))
  })),

  addObject: (object) => set((state) => {
    const normalized = normalizeTransformFields(object)
    const parentId = Object.prototype.hasOwnProperty.call(normalized, 'parentId') ? normalized.parentId ?? null : null
    let order = normalized.order
    if (!Number.isFinite(order)) {
      const siblings = state.objects.filter(o => (o.parentId ?? null) === parentId)
      const maxOrder = siblings.reduce((m, o) => Number.isFinite(o.order) ? Math.max(m, o.order) : m, -1)
      order = maxOrder + 1
    }
    const enriched = { ...normalized, parentId, order }
    const nextObjects = [...state.objects, enriched]
    const entry = { type: 'add', object: safeCloneForHistory(enriched) }
    const { _pushHistory } = get()
    _pushHistory(entry)
    return { objects: nextObjects }
  }),

  removeObject: (object) => set((state) => {
    if (object.isSystemObject) return state
    const filtered = state.objects.filter(obj => obj !== object)
    const entry = { type: 'remove', object: safeCloneForHistory(object) }
    const { _pushHistory } = get()
    _pushHistory(entry)
    return { objects: filtered, selectedObject: state.selectedObject === object ? null : state.selectedObject }
  }),

  removeObjectById: (objectId) => set((state) => {
    const target = state.objects.find(o => o.id === objectId)
    if (!target) return {}
    if (target.isSystemObject) return {}
    const { _pushHistory } = get()
    const children = state.objects.filter(o => o.parentId === objectId)
    let objectsNext = state.objects
    for (const child of children) {
      const beforeParent = child.parentId ?? null
      const afterParent = target.parentId ?? null
      if (beforeParent !== afterParent) {
        _pushHistory({ type: 'reparent', id: child.id, before: { parentId: beforeParent }, after: { parentId: afterParent } })
        objectsNext = objectsNext.map(o => o.id === child.id ? { ...o, parentId: afterParent } : o)
      }
    }
    const entry = { type: 'remove', object: safeCloneForHistory(target) }
    _pushHistory(entry)
    const filtered = objectsNext.filter(o => o.id !== objectId)
    const nextAnnotations = (state.annotations || []).filter(a => a.ownerId !== objectId)
    return { objects: filtered, annotations: nextAnnotations, selectedObject: (state.selectedObject && (typeof state.selectedObject === 'object' ? state.selectedObject.id : state.selectedObject) === objectId) ? null : state.selectedObject }
  }),
})
