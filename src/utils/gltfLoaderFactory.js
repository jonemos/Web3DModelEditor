import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Singleton instances to avoid reinitialization cost
let dracoLoader = null;
let ktx2Loader = null;
let ktx2Detected = false;

/**
 * Optionally provide a renderer once to enable KTX2 hardware transcode detection.
 */
export function setKTX2Renderer(renderer) {
  try {
    if (!renderer) return;
    if (!ktx2Loader) {
      ktx2Loader = new KTX2Loader().setTranscoderPath('/libs/basis/');
    }
    if (!ktx2Detected) {
      ktx2Loader.detectSupport(renderer);
      ktx2Detected = true;
    }
  } catch {}
}

function ensureDecoders() {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    // Expect decoder files under public/libs/draco/
    dracoLoader.setDecoderPath('/libs/draco/');
  }
  if (!ktx2Loader) {
    // If setKTX2Renderer hasn't run yet, KTX2 will still work but without GPU-specific path until detectSupport is called later.
    ktx2Loader = new KTX2Loader().setTranscoderPath('/libs/basis/');
  }
}

/**
 * Returns a GLTFLoader configured with DRACO, Meshopt, and KTX2.
 */
export function getGLTFLoader() {
  ensureDecoders();
  const loader = new GLTFLoader();
  try { loader.setDRACOLoader(dracoLoader); } catch {}
  try { loader.setKTX2Loader(ktx2Loader); } catch {}
  try { loader.setMeshoptDecoder(MeshoptDecoder); } catch {}
  return loader;
}
