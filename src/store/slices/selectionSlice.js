// Selection & transform mode slice
import { normalizeTransformFields } from '../helpers'

export const createSelectionSlice = (set, get) => ({
  selectedObject: null,
  selectedIds: [],
  transformMode: 'translate',

  setSelectedObject: (object) => set({ selectedObject: object }),
  setSelectedIds: (ids) => set({ selectedIds: Array.isArray(ids) ? Array.from(new Set(ids)) : [] }),
  setTransformMode: (mode) => set({ transformMode: mode }),

  updateObjectTransform: (objectId, transform) => set((state) => {
    const norm = normalizeTransformFields(transform)
    const before = state.objects.find(o => o.id === objectId)
    const after = before ? { ...before, ...norm } : null
    const next = state.objects.map(obj => obj.id === objectId ? { ...obj, ...norm } : obj)
    if (before) {
      const entry = { type: 'transform', id: objectId, before: { position: before.position, rotation: before.rotation, scale: before.scale }, after: { position: after.position, rotation: after.rotation, scale: after.scale } }
      const { _pushHistory } = get()
      _pushHistory(entry)
    }
    return { objects: next }
  }),
})
