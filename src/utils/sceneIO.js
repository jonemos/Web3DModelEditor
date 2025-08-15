// Export/Import utilities for scene graph with parentId/order
// These functions operate on the store state shape used by editorStore.js

export function exportScene(objects, walls = []) {
  // Deep clone minimal data; parentId/order included
  const safeObjects = objects.map(o => ({
    id: o.id,
    name: o.name,
    type: o.type,
    parentId: o.parentId ?? null,
    order: Number.isFinite(o.order) ? o.order : 0,
    position: { x: o.position?.x ?? 0, y: o.position?.y ?? 0, z: o.position?.z ?? 0 },
    rotation: { x: o.rotation?.x ?? 0, y: o.rotation?.y ?? 0, z: o.rotation?.z ?? 0 },
    scale: { x: o.scale?.x ?? 1, y: o.scale?.y ?? 1, z: o.scale?.z ?? 1 },
    visible: o.visible !== false,
    frozen: o.frozen === true
  }));
  const safeWalls = (walls || []).map(w => ({ ...w }));
  return JSON.stringify({ objects: safeObjects, walls: safeWalls }, null, 2);
}

export function importScene(jsonString) {
  const data = JSON.parse(jsonString);
  const objects = (data.objects || []).map(o => ({
    ...o,
    parentId: Object.prototype.hasOwnProperty.call(o, 'parentId') ? (o.parentId ?? null) : null,
    order: Number.isFinite(o.order) ? o.order : 0
  }));
  const walls = data.walls || [];
  return { objects, walls };
}

// Build a tree for UI consumption
export function buildTree(objects) {
  const byParent = new Map();
  const byId = new Map();
  objects.forEach(o => {
    const pid = o.parentId ?? null;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(o);
    byId.set(o.id, o);
  });
  // sort by order
  for (const arr of byParent.values()) {
    arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  function attach(node) {
    const children = byParent.get(node.id) || [];
    return { ...node, children: children.map(attach) };
  }
  const roots = byParent.get(null) || [];
  return roots.map(attach);
}
