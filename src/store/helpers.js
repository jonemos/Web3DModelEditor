// 공용 헬퍼: 벡터/트랜스폼 정규화와 히스토리 스냅샷 유틸

export const normalizeVec3 = (v, def = { x: 0, y: 0, z: 0 }) => {
  if (!v && v !== 0) return { ...def }
  if (Array.isArray(v)) {
    const [x = def.x, y = def.y, z = def.z] = v
    return { x, y, z }
  }
  if (typeof v === 'object') {
    const x = Number.isFinite(v.x) ? v.x : def.x
    const y = Number.isFinite(v.y) ? v.y : def.y
    const z = Number.isFinite(v.z) ? v.z : def.z
    return { x, y, z }
  }
  return { ...def }
}

export const normalizeTransformFields = (obj) => {
  if (!obj || typeof obj !== 'object') return obj
  const normalized = { ...obj }
  normalized.position = normalizeVec3(obj.position, { x: 0, y: 0, z: 0 })
  normalized.rotation = normalizeVec3(obj.rotation, { x: 0, y: 0, z: 0 })
  normalized.scale = normalizeVec3(obj.scale, { x: 1, y: 1, z: 1 })
  return normalized
}

export function safeCloneForHistory(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const clone = { ...obj }
  if ('glbData' in clone) delete clone.glbData
  if ('file' in clone) delete clone.file
  return clone
}

export function pickTransform(obj) {
  return {
    position: normalizeVec3(obj.position, { x: 0, y: 0, z: 0 }),
    rotation: normalizeVec3(obj.rotation, { x: 0, y: 0, z: 0 }),
    scale: normalizeVec3(obj.scale, { x: 1, y: 1, z: 1 })
  }
}

export function snapshotForUpdate(obj, updates) {
  const snap = {}
  const fields = ['name', 'visible', 'frozen', 'parentId', 'position', 'rotation', 'scale']
  for (const k of fields) {
    if (k in updates) {
      if (k === 'position' || k === 'rotation' || k === 'scale') {
        snap[k] = normalizeVec3(obj[k], k === 'scale' ? { x: 1, y: 1, z: 1 } : { x: 0, y: 0, z: 0 })
      } else {
        snap[k] = obj[k]
      }
    }
  }
  return snap
}
