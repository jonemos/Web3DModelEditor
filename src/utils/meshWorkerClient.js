// Mesh worker client: manages a singleton Worker and request/response mapping
let _worker = null;
let _idSeq = 1;
const _pending = new Map();

export function isWorkerSupported() {
  try {
    return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
  } catch { return false; }
}

export function getMeshWorker() {
  if (_worker) return _worker;
  // Vite-friendly module worker
  _worker = new Worker(new URL('../workers/meshWorker.js', import.meta.url), { type: 'module' });
  _worker.onmessage = (ev) => {
    const msg = ev.data || {};
    const { id } = msg;
    if (!id || !_pending.has(id)) return;
    const { resolve, reject } = _pending.get(id);
    _pending.delete(id);
    if (msg.type === 'thumbnailFromGLBResult' || msg.type === 'thumbnailFromObjectJSONResult') {
      if (msg.ok) resolve(msg); else reject(new Error(msg.error || 'thumbnail failed'));
      return;
    }
    if (msg.type === 'exportGLBFromObjectJSONResult') {
      if (msg.ok) resolve(msg); else reject(new Error(msg.error || 'export failed'));
      return;
    }
    if (msg.type === 'error') {
      reject(new Error(msg.error || 'worker error'));
      return;
    }
    resolve(msg);
  };
  _worker.onerror = (e) => {
    // Fail-fast all pendings
    for (const [, pr] of _pending.entries()) { pr.reject(e?.error || new Error('Worker error')); }
    _pending.clear();
  };
  return _worker;
}

function _post(type, payload, transfers = []) {
  const id = `mw_${_idSeq++}`;
  const worker = getMeshWorker();
  const msg = { type, id, ...payload };
  return new Promise((resolve, reject) => {
    _pending.set(id, { resolve, reject });
    worker.postMessage(msg, transfers);
  });
}

export async function workerThumbnailFromGLB(glbBuffer, size = 128, transfer = true) {
  const transfers = transfer ? [glbBuffer] : [];
  const res = await _post('thumbnailFromGLB', { glbBuffer, size }, transfers);
  return res; // { type, id, ok, bitmap }
}

export async function workerThumbnailFromObjectJSON(objectJSON, size = 128) {
  const res = await _post('thumbnailFromObjectJSON', { objectJSON, size });
  return res;
}

export async function workerExportGLBFromObjectJSON(objectJSON, options = {}) {
  const res = await _post('exportGLBFromObjectJSON', { objectJSON, options });
  return res; // { type, id, ok, glb }
}

export function imageBitmapToDataURL(bitmap, type = 'image/png', quality) {
  try {
    // Prefer OffscreenCanvas if available
    if (typeof OffscreenCanvas !== 'undefined') {
      const c = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = c.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      return c.convertToBlob({ type, quality }).then((blob) => new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : '');
        fr.onerror = () => reject(fr.error || new Error('FileReader error'));
        fr.readAsDataURL(blob);
      }));
    }
  } catch {}
  // Fallback to DOM canvas
  const c = document.createElement('canvas');
  c.width = bitmap.width; c.height = bitmap.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  return Promise.resolve(c.toDataURL(type, quality));
}
