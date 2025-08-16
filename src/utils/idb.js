// SQLite(sql.js) 기반 래퍼로 교체 (기존 API 유지)
import { customMeshesGetAll, customMeshesUpsert, customMeshesDelete } from './sqlite'

export const idbGetAllCustomMeshes = async () => {
  try {
    return await customMeshesGetAll()
  } catch (e) {
    console.error('SQLite getAll 실패, 빈 배열 반환:', e)
    return []
  }
}

export const idbAddCustomMesh = async (meshData) => {
  // sql.js에는 base64로 직렬화하여 저장하므로 변환은 sqlite.js에서 처리
  await customMeshesUpsert({
    id: meshData.id,
    name: meshData.name,
  data: meshData.glbData,
  thumbnail: meshData.thumbnail,
  })
}

export const idbDeleteCustomMesh = async (id) => {
  await customMeshesDelete(id)
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
