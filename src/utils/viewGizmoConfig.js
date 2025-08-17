// 프로젝트 전역 설정 통합 매니저 (Async Only)
// - 모든 퍼시스턴스는 SQLite(sql.js) 비동기 API로 수행
// - 동기(localStorage) 경로와 레거시 마이그레이션 제거
// - 기존 하위 호환 동기 API는 제공하지 않음

// 통합 설정 스토리지 키 (버전 포함)
const APP_SETTINGS_KEY = 'web3dEditor.settings.v1'

// 공통 유틸
const isPlainObject = (v) => Object.prototype.toString.call(v) === '[object Object]'
const shallowMerge = (base, ext) => ({ ...base, ...(isPlainObject(ext) ? ext : {}) })
const shallowEqual = (a, b) => {
  if (a === b) return true
  if (!a || !b) return false
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    if (a[k] !== b[k]) return false
  }
  return true
}

// 간단한 디바운스
function debounce(fn, ms = 200) {
  let t = null
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

// 기본 설정 값들
export const defaultViewGizmoConfig = {
  isWireframe: false,
  isGridSnap: false,
  isGridVisible: true,
  gizmoSpace: 'world',
  gizmoSize: 0.5,
  snapMove: 1,
  snapRotateDeg: 5,
  snapScale: 0.01,
  cameraPanSpeed: 10,
  cameraOrbitSpeed: 10,
  cameraZoomSpeed: 0.5,
  isPostProcessingEnabled: false,
}

export const defaultUISettings = {
  showLibrary: false,
  showAssets: true,
  isPostProcessingPanelOpen: false,
  showHDRI: false,
  isViewGizmoSettingsOpen: false,
  dragUseSelectionForDnD: false,
}

export const defaultEditorSettings = {
  // 편집기 전용 값이 생기면 여기에 추가
}

export const defaultGameSettings = {
  // 게임 전용 값이 생기면 여기에 추가
}

export const defaultEnvironmentSettings = {
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
  postProcessing: { enabled: false, preset: 'default' },
  toneMapping: { enabled: true, mapping: 'ACESFilmic', exposure: 1.0 },
  safeMode: { enabled: false, pixelRatio: 1 },
  rendererAA: 'msaa', // 'msaa' | 'fxaa' | 'none'
  renderMode: 'continuous', // 'continuous' | 'on-demand'
}

export const defaultAppSettings = {
  __version: 1,
  viewGizmo: { ...defaultViewGizmoConfig },
  ui: { ...defaultUISettings },
  editor: { ...defaultEditorSettings },
  game: { ...defaultGameSettings },
  environment: { ...defaultEnvironmentSettings },
}

function normalizeAppSettings(raw) {
  const root = shallowMerge(defaultAppSettings, raw)
  root.viewGizmo = shallowMerge(defaultViewGizmoConfig, root.viewGizmo)
  root.ui = shallowMerge(defaultUISettings, root.ui)
  root.editor = shallowMerge(defaultEditorSettings, root.editor)
  root.game = shallowMerge(defaultGameSettings, root.game)
  root.environment = shallowMerge(defaultEnvironmentSettings, root.environment)
  return root
}

// ------------------------------
// SQLite 연동 비동기 API (단일 경로)
// ------------------------------
import { settingsGet, settingsSet } from './sqlite'

// Runtime 객체(Texture/PMREM 등)를 제거해 직렬화 가능한 형태로 정리
export function sanitizeHDRISettings(h) {
  const src = h || {}
  const cur = src.currentHDRI || null
  const safeCurrent = cur
    ? {
        name: cur.name,
        type: cur.type,
        // URL만 보존(있을 때). Texture/RT는 저장 금지
        url: cur.url || undefined,
      }
    : null
  return {
    hdriIntensity: Number.isFinite(src.hdriIntensity) ? src.hdriIntensity : defaultEnvironmentSettings.hdriSettings.hdriIntensity,
    hdriRotation: Number.isFinite(src.hdriRotation) ? src.hdriRotation : defaultEnvironmentSettings.hdriSettings.hdriRotation,
    sunLightEnabled: !!src.sunLightEnabled,
    sunIntensity: Number.isFinite(src.sunIntensity) ? src.sunIntensity : defaultEnvironmentSettings.hdriSettings.sunIntensity,
    timeOfDay: Number.isFinite(src.timeOfDay) ? src.timeOfDay : defaultEnvironmentSettings.hdriSettings.timeOfDay,
    sunAzimuth: Number.isFinite(src.sunAzimuth) ? src.sunAzimuth : defaultEnvironmentSettings.hdriSettings.sunAzimuth,
    sunElevation: Number.isFinite(src.sunElevation) ? src.sunElevation : defaultEnvironmentSettings.hdriSettings.sunElevation,
    sunColor: typeof src.sunColor === 'string' ? src.sunColor : defaultEnvironmentSettings.hdriSettings.sunColor,
    currentHDRI: safeCurrent,
  }
}

export async function getAppSettingsAsync() {
  try {
    const fromSql = await settingsGet(APP_SETTINGS_KEY)
    if (fromSql && typeof fromSql === 'object') return normalizeAppSettings(fromSql)
  } catch {}
  // fallback: 기본값 반환
  return { ...defaultAppSettings }
}

export async function saveAppSettingsAsync(settings) {
  const normalized = normalizeAppSettings(settings || {})
  try { await settingsSet(APP_SETTINGS_KEY, normalized) } catch {}
  return true
}

export async function loadSettingsSectionAsync(section) {
  const app = await getAppSettingsAsync()
  return app?.[section]
}

export async function saveSettingsSectionAsync(section, partial) {
  const app = await getAppSettingsAsync()
  const next = { ...app, [section]: shallowMerge(app?.[section] || {}, partial || {}) }
  return saveAppSettingsAsync(next)
}

// 제네릭 자동 저장 구독기 (Zustand 등 호환)
// pickFn: storeState -> 섹션에 저장할 평면 객체
export function startSettingsAutoPersist(store, section, pickFn, debounceMs = 150) {
  if (!store || typeof store.getState !== 'function' || typeof store.subscribe !== 'function') return () => {}
  if (typeof pickFn !== 'function') return () => {}

  let prev = pickFn(store.getState())
  const persist = debounce((val) => {
    try { saveSettingsSectionAsync(section, val) } catch {}
  }, debounceMs)
  const unsub = store.subscribe((state) => {
    try {
      const value = pickFn(state)
      if (!shallowEqual(value, prev)) {
        prev = value
        persist(value)
      }
    } catch {
      // ignore
    }
  })
  return unsub
}

// ------------------------------
// View/Gizmo 비동기 전용 API
// ------------------------------

export function startViewGizmoConfigAutoPersist(store) {
  const pick = (s) => ({
    isWireframe: !!s.isWireframe,
    isGridSnap: !!s.isGridSnap,
    isGridVisible: !!s.isGridVisible,
    gizmoSpace: s.gizmoSpace || 'world',
    gizmoSize: Number.isFinite(s.gizmoSize) ? s.gizmoSize : 1,
    snapMove: Number.isFinite(s.snapMove) ? s.snapMove : 1,
    snapRotateDeg: Number.isFinite(s.snapRotateDeg) ? s.snapRotateDeg : 15,
    snapScale: Number.isFinite(s.snapScale) ? s.snapScale : 0.1,
    isPostProcessingEnabled: !!s.isPostProcessingEnabled,
    cameraPanSpeed: Number.isFinite(s.cameraPanSpeed) ? s.cameraPanSpeed : 50,
    cameraOrbitSpeed: Number.isFinite(s.cameraOrbitSpeed) ? s.cameraOrbitSpeed : 100,
    cameraZoomSpeed: Number.isFinite(s.cameraZoomSpeed) ? s.cameraZoomSpeed : 0.3,
  })
  return startSettingsAutoPersist(store, 'viewGizmo', pick, 150)
}

// ------------------------------
// 환경 설정(HDRI) 비동기 전용 API
// ------------------------------

export async function loadViewGizmoConfigAsync() {
  const cfg = await loadSettingsSectionAsync('viewGizmo')
  return shallowMerge(defaultViewGizmoConfig, cfg || {})
}

export async function loadEnvironmentSettingsAsync() {
  const env = await loadSettingsSectionAsync('environment')
  return shallowMerge(defaultEnvironmentSettings, env || {})
}

export async function saveEnvironmentSettingsAsync(cfg) {
  return saveSettingsSectionAsync('environment', cfg)
}

export function startEnvironmentAutoPersist(store) {
  const pick = (s) => ({
  hdriSettings: sanitizeHDRISettings(s.hdriSettings),
    postProcessing: { enabled: !!s.isPostProcessingEnabled, preset: s.postProcessingPreset || 'default' },
    // safeMode는 스토어에서 직접 관리되므로 자동 저장에 포함
    safeMode: { enabled: !!s.safeMode?.enabled, pixelRatio: Number(s.safeMode?.pixelRatio ?? 1) },
  })
  return startSettingsAutoPersist(store, 'environment', pick, 200)
}
