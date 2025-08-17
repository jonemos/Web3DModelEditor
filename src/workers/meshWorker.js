// Mesh worker: OffscreenCanvas thumbnail rendering and optional GLTF export/merge
// Runs as a module worker (type: 'module')
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// Helper: set up small scene/camera/renderer on OffscreenCanvas
function createThumbPipeline(size = 128) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  let canvas;
  try {
    canvas = new OffscreenCanvas(size, size);
  } catch {
    // Fallback: OffscreenCanvas may not be available in some worker environments
    canvas = new OffscreenCanvas(size, size);
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  } catch (e) {
    // If WebGL context fails, try basic context
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: false });
  }
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x2a2a2a, 1);
  // Lights
  scene.add(new THREE.AmbientLight(0x404040, 0.6));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.8); d1.position.set(1,1,1); scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.4); d2.position.set(-1,-1,-1); scene.add(d2);
  return { scene, camera, renderer, canvas };
}

function frameObjectFitCamera(object, camera) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
  cameraZ *= 1.5;
  camera.position.set(cameraZ * 0.7, cameraZ * 0.5, cameraZ);
  camera.lookAt(0,0,0);
}

function buildSingleMesh(object) {
  const root = object.clone(true);
  root.updateMatrixWorld(true);
  const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const geometries = [];
  const materials = [];
  let ok = true;
  root.traverse((n) => {
    if (!ok) return;
    if (n.isMesh) {
      if (n.isSkinnedMesh || n.isInstancedMesh) { ok = false; return; }
      if (Array.isArray(n.material)) { ok = false; return; }
      const src = n.geometry; if (!src?.isBufferGeometry) return;
      const geo = src.clone();
      const m = new THREE.Matrix4().copy(n.matrixWorld).premultiply(invRoot);
      try { geo.clearGroups(); } catch {}
      geo.applyMatrix4(m);
      geometries.push(geo);
      materials.push(n.material);
    }
  });
  if (!ok || geometries.length === 0) return null;
  const merged = BufferGeometryUtils.mergeGeometries(geometries, true);
  if (!merged || !merged.groups || merged.groups.length !== materials.length) return null;
  const single = new THREE.Mesh(merged, materials);
  single.name = object.name || 'MergedMesh';
  return single;
}

// Handlers
async function handleThumbnailFromGLB({ id, glbBuffer, size = 128 }) {
  const loader = new GLTFLoader();
  const { scene, camera, renderer, canvas } = createThumbPipeline(size);
  return new Promise((resolve) => {
    try {
      loader.parse(glbBuffer, '', (gltf) => {
        try {
          const model = gltf.scene;
          scene.add(model);
          frameObjectFitCamera(model, camera);
          renderer.render(scene, camera);
          const bitmap = canvas.transferToImageBitmap();
          // Clean
          scene.remove(model);
          try { renderer.dispose(); } catch {}
          resolve({ ok: true, id, bitmap });
        } catch (e) {
          resolve({ ok: false, id, error: String(e && e.message || e) });
        }
      }, (error) => resolve({ ok: false, id, error: String(error && error.message || error) }));
    } catch (e) {
      resolve({ ok: false, id, error: String(e && e.message || e) });
    }
  });
}

async function handleThumbnailFromObjectJSON({ id, objectJSON, size = 128 }) {
  const { scene, camera, renderer, canvas } = createThumbPipeline(size);
  try {
    const obj = new THREE.ObjectLoader().parse(objectJSON);
    scene.add(obj);
    frameObjectFitCamera(obj, camera);
    renderer.render(scene, camera);
    const bitmap = canvas.transferToImageBitmap();
    scene.remove(obj);
    try { renderer.dispose(); } catch {}
    return { ok: true, id, bitmap };
  } catch (e) {
    return { ok: false, id, error: String(e && e.message || e) };
  }
}

async function handleExportFromObjectJSON({ id, objectJSON, options = {} }) {
  const { compressToSingleMesh = true, preserveTransform = false } = options;
  try {
    const root = new THREE.ObjectLoader().parse(objectJSON);
    let target = root;
    if (compressToSingleMesh) {
      const merged = buildSingleMesh(root);
      if (merged) target = merged;
    }
    // Optional: bake transforms when requested
    if (preserveTransform) {
      target.updateMatrixWorld(true);
      const invRoot = new THREE.Matrix4().copy(target.matrixWorld).invert();
      target.traverse?.((n) => {
        if (!n?.isMesh || !n.geometry?.isBufferGeometry) return;
        const mat = new THREE.Matrix4().copy(n.matrixWorld).premultiply(invRoot);
        const baked = n.geometry.clone();
        baked.applyMatrix4(mat);
        n.geometry = baked;
      });
      target.traverse?.((n) => {
        try {
          n.position?.set(0,0,0);
          n.rotation?.set(0,0,0,'XYZ');
          n.scale?.set(1,1,1);
        } catch {}
      });
    }
    const exporter = new GLTFExporter();
    const glb = await new Promise((resolve, reject) => exporter.parse(target, resolve, reject, {
      binary: true,
      includeCustomExtensions: true,
      embedImages: true,
      maxTextureSize: 1024,
      forcePowerOfTwoTextures: false,
      truncateDrawRange: false
    }));
    return { ok: true, id, glb };
  } catch (e) {
    return { ok: false, id, error: String(e && e.message || e) };
  }
}

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  let res;
  switch (msg.type) {
    case 'thumbnailFromGLB':
      res = await handleThumbnailFromGLB(msg);
      if (res.ok && res.bitmap) {
        // Transfer ImageBitmap back
        self.postMessage({ type: 'thumbnailFromGLBResult', id: res.id, ok: true, bitmap: res.bitmap }, [res.bitmap]);
      } else {
        self.postMessage({ type: 'thumbnailFromGLBResult', id: msg.id, ok: false, error: res?.error || 'UNKNOWN' });
      }
      break;
    case 'thumbnailFromObjectJSON':
      res = await handleThumbnailFromObjectJSON(msg);
      if (res.ok && res.bitmap) {
        self.postMessage({ type: 'thumbnailFromObjectJSONResult', id: res.id, ok: true, bitmap: res.bitmap }, [res.bitmap]);
      } else {
        self.postMessage({ type: 'thumbnailFromObjectJSONResult', id: msg.id, ok: false, error: res?.error || 'UNKNOWN' });
      }
      break;
    case 'exportGLBFromObjectJSON':
      res = await handleExportFromObjectJSON(msg);
      if (res.ok && res.glb) {
        // Transfer ArrayBuffer
        self.postMessage({ type: 'exportGLBFromObjectJSONResult', id: res.id, ok: true, glb: res.glb }, [res.glb]);
      } else {
        self.postMessage({ type: 'exportGLBFromObjectJSONResult', id: msg.id, ok: false, error: res?.error || 'UNKNOWN' });
      }
      break;
    default:
      self.postMessage({ type: 'error', id: msg.id, ok: false, error: 'Unknown message type' });
  }
};
