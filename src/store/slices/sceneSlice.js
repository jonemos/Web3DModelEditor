// Scene slice: scene/camera/renderer refs, stats, estimateVRAM
export const createSceneSlice = (set, get) => ({
  scene: null,
  camera: null,
  renderer: null,
  stats: { fps: 0, objects: 0, vertices: 0, triangles: 0 },
  vramEstimateMB: 0,

  setScene: (scene, camera, renderer) => set({ scene, camera, renderer }),
  setStats: (partial) => set((state) => ({ stats: { ...state.stats, ...partial } })),

  estimateVRAMUsage: (opts = {}) => {
    const width = opts.width || window.innerWidth;
    const height = opts.height || window.innerHeight;
    let pr = 1;
    try { pr = get().renderer?.getPixelRatio?.() || window.devicePixelRatio || 1; } catch {}
    const w = Math.max(1, Math.floor(width * pr));
    const h = Math.max(1, Math.floor(height * pr));
    const bppColor = 4; // RGBA8
    const bppDepth = 4; // Depth/Stencil rough
    let total = (w * h) * (bppColor + bppDepth);
    try {
      const ppm = get().postProcessingManager;
      const ppOn = get().isPostProcessingEnabled;
      if (ppm && ppOn) {
        total += (w * h) * (bppColor + bppDepth);
        const eff = ppm.getSettings?.() || {};
        if (eff.ssao?.enabled) total += 2 * (w * h) * bppColor;
        if (eff.fxaa?.enabled) total += (w * h) * bppColor;
      }
    } catch {}
    const mb = Math.round(total / (1024 * 1024));
    set({ vramEstimateMB: mb });
    return mb;
  },
})
