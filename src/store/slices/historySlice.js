// History slice: undo/redo with batch support
/**
 * @typedef {Object} TransformPayload
 * @property {number|string} id
 * @property {{x:number,y:number,z:number}} position
 * @property {{x:number,y:number,z:number}} rotation
 * @property {{x:number,y:number,z:number}} scale
 *
 * @typedef {Object} UpdatePayload
 * @property {number|string} id
 * @property {Partial<{name:string,visible:boolean,frozen:boolean,parentId:number|string,position:{x:number,y:number,z:number},rotation:{x:number,y:number,z:number},scale:{x:number,y:number,z:number}}>} before
 * @property {Partial<{name:string,visible:boolean,frozen:boolean,parentId:number|string,position:{x:number,y:number,z:number},rotation:{x:number,y:number,z:number},scale:{x:number,y:number,z:number}}>} after
 *
 * @typedef {Object} ReparentPayload
 * @property {number|string} id
 * @property {{parentId:number|string|null}} before
 * @property {{parentId:number|string|null}} after
 *
 * @typedef {Object} AddRemovePayload
 * @property {any} object
 *
 * @typedef {Object} PartTransformEntry
 * @property {'part-transform'} type
 * @property {{uuid:string, before?:TransformPayload, after?:TransformPayload}[]} parts
 *
 * @typedef {Object} TransformEntry
 * @property {'transform'} type
 * @property {number|string} id
 * @property {TransformPayload} before
 * @property {TransformPayload} after
 *
 * @typedef {Object} UpdateEntry
 * @property {'update'} type
 * @property {number|string} id
 * @property {UpdatePayload['before']} before
 * @property {UpdatePayload['after']} after
 *
 * @typedef {Object} AddEntry
 * @property {'add'} type
 * @property {AddRemovePayload['object']} object
 *
 * @typedef {Object} RemoveEntry
 * @property {'remove'} type
 * @property {AddRemovePayload['object']} object
 *
 * @typedef {Object} ReparentEntry
 * @property {'reparent'} type
 * @property {number|string} id
 * @property {ReparentPayload['before']} before
 * @property {ReparentPayload['after']} after
 *
 * @typedef {Object} BatchEntry
 * @property {'batch'} type
 * @property {Array<HistoryEntry>} entries
 *
 * @typedef {PartTransformEntry|TransformEntry|UpdateEntry|AddEntry|RemoveEntry|ReparentEntry|BatchEntry} HistoryEntry
 */

import { normalizeTransformFields } from '../helpers'

export const createHistorySlice = (set, get) => ({
  _historyPast: [],
  _historyFuture: [],
  _batchActive: false,
  _batchBuffer: [],
  canUndo: false,
  canRedo: false,

  _pushHistory: (entry) => {
    const { _batchActive, _historyPast } = get()
    if (_batchActive) {
      set((state) => ({ _batchBuffer: [...state._batchBuffer, entry] }))
      return
    }
    const nextPast = [..._historyPast, entry]
    set({ _historyPast: nextPast, _historyFuture: [], canUndo: nextPast.length > 0, canRedo: false })
  },

  beginBatch: () => set({ _batchActive: true, _batchBuffer: [] }),
  endBatch: () => set((state) => {
    if (!state._batchActive) return {}
    const entries = state._batchBuffer
    if (entries.length === 0) return { _batchActive: false, _batchBuffer: [] }
    /** @type {BatchEntry} */
    const batchEntry = { type: 'batch', entries }
    const nextPast = [...state._historyPast, batchEntry]
    return { _batchActive: false, _batchBuffer: [], _historyPast: nextPast, _historyFuture: [], canUndo: nextPast.length > 0, canRedo: false }
  }),

  undo: () => {
    const state = get()
    const past = [...state._historyPast]
    if (past.length === 0) return false
    try { state.setSelectedObject && state.setSelectedObject(null); state.setSelectedIds && state.setSelectedIds([]) } catch {}
    const entry = past.pop()
    applyUndo(entry, set, get)
    const nextFuture = [...state._historyFuture, entry]
    set({ _historyPast: past, _historyFuture: nextFuture, canUndo: past.length > 0, canRedo: nextFuture.length > 0 })
    return true
  },

  redo: () => {
    const state = get()
    const future = [...state._historyFuture]
    if (future.length === 0) return false
    try { state.setSelectedObject && state.setSelectedObject(null); state.setSelectedIds && state.setSelectedIds([]) } catch {}
    const entry = future.pop()
    applyRedo(entry, set, get)
    const nextPast = [...state._historyPast, entry]
    set({ _historyFuture: future, _historyPast: nextPast, canUndo: nextPast.length > 0, canRedo: future.length > 0 })
    return true
  },
})

function applyUndo(entry, set, get) {
  if (!entry) return
  switch (entry.type) {
    case 'part-transform': {
      const state = get()
      const scene = state.scene
      if (!scene) break
      const parts = Array.isArray(entry.parts) ? entry.parts : []
      for (const p of parts) {
        const uuid = p.uuid
        const before = p.before || entry.before
        if (!uuid || !before) continue
        let target = null
        scene.traverse((child)=>{ if (!target && child.uuid === uuid) target = child })
        if (target && target.isObject3D) {
          try {
            target.position.set(before.position.x, before.position.y, before.position.z)
            target.rotation.set(before.rotation.x, before.rotation.y, before.rotation.z)
            target.scale.set(before.scale.x, before.scale.y, before.scale.z)
            target.updateMatrix()
            target.updateMatrixWorld(true)
          } catch {}
        }
      }
      break
    }
    case 'batch': {
      for (let i = entry.entries.length - 1; i >= 0; i--) applyUndo(entry.entries[i], set, get)
      break
    }
    case 'reparent': {
      const state = get()
      const id = entry.id
      const before = entry.before
      if (!id || !before) break
      set({ objects: state.objects.map(o => o.id === id ? { ...o, parentId: before.parentId ?? null } : o) })
      break
    }
    case 'add': {
      const id = entry.object?.id
      if (!id) break
      const state = get()
      set({ objects: state.objects.filter(o => o.id !== id) })
      break
    }
    case 'remove': {
      const state = get()
      const restored = entry.object
      if (!restored) break
      set({ objects: [...state.objects, normalizeTransformFields(restored)] })
      break
    }
    case 'update':
    case 'transform': {
      const state = get()
      const id = entry.id
      const before = entry.before
      if (!id || !before) break
      set({ objects: state.objects.map(o => o.id === id ? { ...o, ...normalizeTransformFields(before) } : o) })
      break
    }
    default:
      break
  }
}

function applyRedo(entry, set, get) {
  if (!entry) return
  switch (entry.type) {
    case 'part-transform': {
      const state = get()
      const scene = state.scene
      if (!scene) break
      const parts = Array.isArray(entry.parts) ? entry.parts : []
      for (const p of parts) {
        const uuid = p.uuid
        const after = p.after || entry.after
        if (!uuid || !after) continue
        let target = null
        scene.traverse((child)=>{ if (!target && child.uuid === uuid) target = child })
        if (target && target.isObject3D) {
          try {
            target.position.set(after.position.x, after.position.y, after.position.z)
            target.rotation.set(after.rotation.x, after.rotation.y, after.rotation.z)
            target.scale.set(after.scale.x, after.scale.y, after.scale.z)
            target.updateMatrix()
            target.updateMatrixWorld(true)
          } catch {}
        }
      }
      break
    }
    case 'batch': {
      for (let i = 0; i < entry.entries.length; i++) applyRedo(entry.entries[i], set, get)
      break
    }
    case 'reparent': {
      const state = get()
      const id = entry.id
      const after = entry.after
      if (!id || !after) break
      set({ objects: state.objects.map(o => o.id === id ? { ...o, parentId: after.parentId ?? null } : o) })
      break
    }
    case 'add': {
      const state = get()
      const added = entry.object
      if (!added) break
      set({ objects: [...state.objects, normalizeTransformFields(added)] })
      break
    }
    case 'remove': {
      const id = entry.object?.id
      if (!id) break
      const state = get()
      set({ objects: state.objects.filter(o => o.id !== id) })
      break
    }
    case 'update':
    case 'transform': {
      const state = get()
      const id = entry.id
      const after = entry.after
      if (!id || !after) break
      set({ objects: state.objects.map(o => o.id === id ? { ...o, ...normalizeTransformFields(after) } : o) })
      break
    }
    default:
      break
  }
}
