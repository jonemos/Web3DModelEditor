// SQLite(sql.js) 기반 래퍼로 교체 (기존 API 유지)
import { customMeshesGetAll, customMeshesUpsert, customMeshesDelete, getDB } from './sqlite'

// Dual-storage IndexedDB (blobs) for GLB and thumbnails
const BLOB_DB = 'Web3DModelEditorBlobs'
const STORE_GLB = 'glb'
const STORE_THUMB = 'thumb'
const MIGRATION_FLAG = 'blobstores_migrated_v1'

function openBlobDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BLOB_DB, 1)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains(STORE_GLB)) d.createObjectStore(STORE_GLB)
      if (!d.objectStoreNames.contains(STORE_THUMB)) d.createObjectStore(STORE_THUMB)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function blobPut(store, key, blob) {
  const db = await openBlobDB()
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const st = tx.objectStore(store)
    const r = st.put(blob, key)
    r.onsuccess = () => resolve()
    r.onerror = () => reject(r.error)
  })
}

async function blobGet(store, key) {
  const db = await openBlobDB()
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const st = tx.objectStore(store)
    const r = st.get(key)
    r.onsuccess = () => resolve(r.result ?? null)
    r.onerror = () => reject(r.error)
  })
}

async function blobDelete(store, key) {
  const db = await openBlobDB()
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const st = tx.objectStore(store)
    const r = st.delete(key)
    r.onsuccess = () => resolve()
    r.onerror = () => reject(r.error)
  })
}

// One-time migration: if legacy sqlite has base64, move to blob stores
async function migrateB64ToBlobsOnce() {
  try {
    if (localStorage.getItem(MIGRATION_FLAG)) return
    const all = await customMeshesGetAll()
    for (const m of all) {
      // If meta-only already (no legacy fields), skip
      const hasB64 = (m.glbData && m.glbData.byteLength) || (typeof m.thumbnail === 'string' && m.thumbnail.startsWith('data:'))
      if (hasB64) {
        // Save blobs
        if (m.glbData) {
          await blobPut(STORE_GLB, m.id, new Blob([m.glbData], { type: 'model/gltf-binary' }))
        }
        if (typeof m.thumbnail === 'string' && m.thumbnail.startsWith('data:')) {
          // Convert dataURL to Blob
          const blob = await (await fetch(m.thumbnail)).blob()
          await blobPut(STORE_THUMB, m.id, blob)
        }
        // Update sqlite row to meta-only (preserve name/createdAt)
        await customMeshesUpsert({ id: m.id, name: m.name, thumbnailStr: null })
      }
    }
    localStorage.setItem(MIGRATION_FLAG, '1')
  } catch (e) {
    console.warn('Blob migration skipped:', e)
  }
}

export const idbGetAllCustomMeshes = async () => {
  try {
    await migrateB64ToBlobsOnce()
    const metas = await customMeshesGetAll()
    // Hydrate blobs from IDB
    const out = []
    for (const m of metas) {
      const glbBlob = await blobGet(STORE_GLB, m.id)
      const thumbBlob = await blobGet(STORE_THUMB, m.id)
      out.push({
        id: m.id,
        name: m.name,
        glbData: glbBlob ? await glbBlob.arrayBuffer() : (m.glbData ?? null), // fallback legacy
        thumbnail: thumbBlob || m.thumbnail || null,
        createdAt: m.createdAt
      })
    }
    return out
  } catch (e) {
    console.error('getAll failed:', e)
    return []
  }
}

export const idbAddCustomMesh = async (meshData) => {
  // 1) Save meta to SQLite (no big binaries or data URLs)
  await customMeshesUpsert({ id: meshData.id, name: meshData.name, thumbnailStr: null })
  // 2) Save blobs to IDB stores
  if (meshData.glbData) {
    const bin = meshData.glbData instanceof Uint8Array ? meshData.glbData : new Uint8Array(meshData.glbData)
    await blobPut(STORE_GLB, meshData.id, new Blob([bin], { type: 'model/gltf-binary' }))
  }
  if (meshData.thumbnail) {
    if (meshData.thumbnail instanceof Blob) {
      await blobPut(STORE_THUMB, meshData.id, meshData.thumbnail)
    } else if (typeof meshData.thumbnail === 'string') {
      try {
        const blob = await (await fetch(meshData.thumbnail)).blob()
        await blobPut(STORE_THUMB, meshData.id, blob)
      } catch (e) {
        console.warn('thumbnail dataURL->Blob 변환 실패:', e)
      }
    }
  }
}

export const idbDeleteCustomMesh = async (id) => {
  await customMeshesDelete(id)
  await blobDelete(STORE_GLB, id)
  await blobDelete(STORE_THUMB, id)
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
