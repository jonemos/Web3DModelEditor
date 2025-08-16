import * as THREE from 'three'

// Keep world transform when changing parent
export function setParent(child, newParent, keepTransform = true) {
  if (!child || !child.isObject3D) return false
  if (newParent && !newParent.isObject3D) return false
  if (child === newParent) return false

  // Prevent parenting to own descendant
  if (newParent && isAncestorOf(child, newParent)) return false

  let worldMatrix = null
  if (keepTransform) {
    child.updateMatrixWorld(true)
    worldMatrix = child.matrixWorld.clone()
  }

  // Detach from current parent
  if (child.parent) {
    try { child.parent.remove(child) } catch {}
  }

  // Attach to new parent or scene
  if (newParent) {
    try { newParent.add(child) } catch {}
  }

  if (keepTransform && worldMatrix) {
    const parentMatrixWorld = (child.parent && child.parent.matrixWorld) ? child.parent.matrixWorld : new THREE.Matrix4()
    const invParent = new THREE.Matrix4().copy(parentMatrixWorld).invert()
    const local = new THREE.Matrix4().copy(invParent).multiply(worldMatrix)
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    local.decompose(pos, quat, scl)
    child.position.copy(pos)
    child.quaternion.copy(quat)
    child.scale.copy(scl)
    child.updateMatrix()
    child.updateMatrixWorld(true)
  }
  return true
}

export function clearParent(child, scene, keepTransform = true) {
  if (!child || !child.isObject3D) return false
  const targetParent = scene && scene.isScene ? scene : null
  return setParent(child, targetParent, keepTransform)
}

export function getChildren(parent, recursive = false) {
  if (!parent || !parent.isObject3D) return []
  if (!recursive) return [...parent.children]
  const result = []
  parent.traverse((c) => { if (c !== parent) result.push(c) })
  return result
}

export function getRoot(object) {
  if (!object || !object.isObject3D) return null
  let cur = object
  while (cur.parent && !cur.parent.isScene) cur = cur.parent
  return cur.parent && cur.parent.isScene ? cur : null
}

export function isAncestorOf(a, b) {
  // a is ancestor of b?
  if (!a || !b || !a.isObject3D || !b.isObject3D) return false
  let cur = b.parent
  while (cur) { if (cur === a) return true; cur = cur.parent }
  return false
}
