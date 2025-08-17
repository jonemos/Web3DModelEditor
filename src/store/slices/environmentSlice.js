// Environment slice: HDRI, renderer, post-processing
import { saveEnvironmentSettingsAsync } from '../../utils/viewGizmoConfig'

export const createEnvironmentSlice = (set, get) => ({
  hdriSettings: {
    currentHDRI: { name: '기본 배경', type: 'none' },
    hdriIntensity: 1,
    hdriRotation: 0,
    sunLightEnabled: true,
    sunIntensity: 1,
    timeOfDay: 12,
    sunAzimuth: 0,
    sunElevation: 45,
    sunColor: '#ffffff',
  },
  sunLightRef: null,
  postProcessingManager: null,
  isPostProcessingEnabled: true,
  postProcessingPreset: 'default',
  safeMode: { enabled: false, pixelRatio: 1.0, notes: 'Disables FXAA/SSAO and forces pixelRatio to 1.0 to reduce VRAM.' },
  rendererAA: 'msaa',
  renderMode: 'continuous',

  updateHDRISettings: (updates) => set((state) => ({ hdriSettings: { ...state.hdriSettings, ...updates } })),
  setSunLightRef: (ref) => set({ sunLightRef: ref }),
  setPostProcessingManager: (ppm) => set({ postProcessingManager: ppm }),

  // HDRI 설정 저장 (직렬화 안전하게)
  saveHDRISettings: async () => {
    const { hdriSettings } = get()
    try {
      const { sanitizeHDRISettings } = await import('../../utils/viewGizmoConfig')
      const safe = sanitizeHDRISettings(hdriSettings)
      await saveEnvironmentSettingsAsync({ hdriSettings: safe })
    } catch {}
  },

  setRendererAA: (mode) => {
    const valid = ['msaa', 'fxaa', 'none'];
    const m = valid.includes(mode) ? mode : 'msaa';
    set({ rendererAA: m });
    try { saveEnvironmentSettingsAsync({ rendererAA: m }) } catch {}
    try {
      const ppm = get().postProcessingManager;
      if (ppm) ppm.setEffectEnabled('fxaa', m === 'fxaa' && !get().safeMode?.enabled);
    } catch {}
  },

  setRenderMode: (mode) => {
    const valid = ['continuous', 'on-demand'];
    const m = valid.includes(mode) ? mode : 'continuous';
    set({ renderMode: m });
    try { saveEnvironmentSettingsAsync({ renderMode: m }) } catch {}
  },

  togglePostProcessingEnabled: () => set((state) => ({ isPostProcessingEnabled: !state.isPostProcessingEnabled })),
  setPostProcessingPreset: (key) => set({ postProcessingPreset: key || 'default' }),
})
