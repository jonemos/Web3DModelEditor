// 간단한 IndexedDB 래퍼 (customMeshes 전용)

const DB_NAME = 'Web3DModelEditorDB'
const DB_VERSION = 1
const STORE_CUSTOM_MESHES = 'customMeshes'

const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION)
  req.onupgradeneeded = (e) => {
    const db = req.result
    if (!db.objectStoreNames.contains(STORE_CUSTOM_MESHES)) {
      db.createObjectStore(STORE_CUSTOM_MESHES, { keyPath: 'id' })
    }
  }
  req.onsuccess = () => resolve(req.result)
  req.onerror = () => reject(req.error)
})

const withStore = async (mode, fn) => {
  const db = await openDB()
  const tx = db.transaction(STORE_CUSTOM_MESHES, mode)
  const store = tx.objectStore(STORE_CUSTOM_MESHES)
  const result = await fn(store)
  await new Promise((res, rej) => {
    tx.oncomplete = () => res()
    tx.onabort = () => rej(tx.error)
    tx.onerror = () => rej(tx.error)
  })
  return result
}

export const idbGetAllCustomMeshes = async () => {
  try {
    return await withStore('readonly', (store) => new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    }))
  } catch (e) {
    console.error('IndexedDB getAll 실패, 빈 배열 반환:', e)
    return []
  }
}

export const idbAddCustomMesh = async (meshData) => {
  // glbData를 ArrayBuffer로 보관 (Array로 온 경우 변환)
  let toStore = { ...meshData }
  try {
    const data = meshData?.glbData
    if (Array.isArray(data)) {
      toStore.glbData = new Uint8Array(data).buffer
    }
  } catch {}

  // thumbnail(dataURL)을 Blob으로 변환하여 저장 (대용량에 유리)
  try {
    const th = meshData?.thumbnail
    if (typeof th === 'string' && th.startsWith('data:')) {
      const resp = await fetch(th)
      const blob = await resp.blob()
      toStore.thumbnail = blob
    }
  } catch (e) {
    console.warn('썸네일 Blob 변환 실패(문자열 유지):', e)
  }

  await withStore('readwrite', (store) => new Promise((resolve, reject) => {
    const req = store.put(toStore)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  }))
}

export const idbDeleteCustomMesh = async (id) => {
  await withStore('readwrite', (store) => new Promise((resolve, reject) => {
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  }))
}

export const migrateLocalStorageCustomMeshesToIDB = async () => {
  try {
    const stored = localStorage.getItem('customMeshes')
    if (!stored) return false
    const meshes = JSON.parse(stored)
    if (!Array.isArray(meshes) || meshes.length === 0) {
      localStorage.removeItem('customMeshes')
      return false
    }
    for (const m of meshes) {
      await idbAddCustomMesh(m)
    }
  localStorage.removeItem('customMeshes')
    return true
  } catch (e) {
    console.warn('customMeshes 마이그레이션 실패(계속 진행):', e)
    return false
  }
}
