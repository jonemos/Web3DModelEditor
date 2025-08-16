// 프로젝트 전역 설정 통합 매니저
// - 다중 네임스페이스(섹션)로 설정을 보관
// - localStorage에 단일 키로 저장/로드
// - 기존 view/gizmo API는 하위 호환 제공

// 구버전(개별 키) 호환을 위한 레거시 키
const LEGACY_VIEW_GIZMO_KEY = 'viewGizmoConfig'

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

// 디바운스
function debounce(fn, ms = 200) {
  let t = null
  return (...args) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

// 기본 스키마 정의 (필요 시 섹션 확장)
export const defaultViewGizmoConfig = {
  isWireframe: false,
  isGridSnap: false,
  isGridVisible: true,
  gizmoSpace: 'world',
  gizmoSize: 1.0,
  snapMove: 1.0,
  snapRotateDeg: 15,
  snapScale: 0.1,
  isPostProcessingEnabled: false
}

export const defaultUISettings = {
  showLibrary: false,
  showAssets: false,
  isPostProcessingPanelOpen: false,
  showHDRI: false,
  // 뷰/기즈모 설정 팝오버 열림 상태 (UI 섹션에 영구 저장)
  isViewGizmoSettingsOpen: false
}

export const defaultEditorSettings = {
  // 예: 기본 변환 모드, 패널 배치 등 추후 확장
}

export const defaultGameSettings = {
  // 예: 플레이어 감도, HUD 토글 등 추후 확장
}

export const defaultAppSettings = {
  __version: 1,
  viewGizmo: { ...defaultViewGizmoConfig },
  ui: { ...defaultUISettings },
  editor: { ...defaultEditorSettings },
  game: { ...defaultGameSettings }
}

// 통합 저장소 로드 (레거시 마이그레이션 포함)
export function loadAppSettings() {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      return normalizeAppSettings(data)
    }
    // 레거시 단일 키에서 마이그레이션
    const legacyRaw = localStorage.getItem(LEGACY_VIEW_GIZMO_KEY)
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw)
      const migrated = {
        ...defaultAppSettings,
        viewGizmo: shallowMerge(defaultViewGizmoConfig, legacy)
      }
      // 즉시 통합 키로 저장하고, 레거시는 남겨두되 이후부터는 통합 키 사용
      saveAppSettings(migrated)
      return migrated
    }
    return { ...defaultAppSettings }
  } catch {
    return { ...defaultAppSettings }
  }
}

function normalizeAppSettings(raw) {
  // 루트 및 섹션별 보정 (얕은 병합)
  const root = shallowMerge(defaultAppSettings, raw)
  root.viewGizmo = shallowMerge(defaultViewGizmoConfig, root.viewGizmo)
  root.ui = shallowMerge(defaultUISettings, root.ui)
  root.editor = shallowMerge(defaultEditorSettings, root.editor)
  root.game = shallowMerge(defaultGameSettings, root.game)
  return root
}

export function saveAppSettings(settings) {
  try {
    const normalized = normalizeAppSettings(settings || {})
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(normalized))
    return true
  } catch {
    return false
  }
}

// 섹션 단위 로드/세이브
export function loadSettingsSection(section) {
  const app = loadAppSettings()
  return app?.[section]
}

export function saveSettingsSection(section, partial) {
  const app = loadAppSettings()
  const next = { ...app, [section]: shallowMerge(app?.[section] || {}, partial || {}) }
  return saveAppSettings(next)
}

// 제네릭 자동 저장 구독기 (Zustand 등 호환)
// pickFn: storeState -> 섹션에 저장할 평면 객체
export function startSettingsAutoPersist(store, section, pickFn, debounceMs = 150) {
  if (!store || typeof store.getState !== 'function' || typeof store.subscribe !== 'function') return () => {}
  if (typeof pickFn !== 'function') return () => {}

  let prev = pickFn(store.getState())
  const persist = debounce((val) => saveSettingsSection(section, val), debounceMs)
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
// 하위 호환: View/Gizmo 전용 API
// ------------------------------

export function loadViewGizmoConfig() {
  const cfg = loadSettingsSection('viewGizmo')
  return shallowMerge(defaultViewGizmoConfig, cfg || {})
}

export function saveViewGizmoConfig(cfg) {
  return saveSettingsSection('viewGizmo', cfg)
}

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
    isPostProcessingEnabled: !!s.isPostProcessingEnabled
  })
  return startSettingsAutoPersist(store, 'viewGizmo', pick, 150)
}
