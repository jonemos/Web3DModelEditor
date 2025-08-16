import { create } from 'zustand'
import { defaultViewGizmoConfig, defaultUISettings, defaultEnvironmentSettings, loadViewGizmoConfigAsync, startViewGizmoConfigAutoPersist, loadSettingsSectionAsync, startSettingsAutoPersist, loadEnvironmentSettingsAsync, startEnvironmentAutoPersist, saveEnvironmentSettingsAsync } from '../utils/viewGizmoConfig'
import { idbAddCustomMesh, idbDeleteCustomMesh } from '../utils/idb'

// HDRI 초기값은 기본 환경값에서만 시작 (동기 로컬스토리지 제거)
const initialHDRISettings = { ...(defaultEnvironmentSettings?.hdriSettings || {}) }

// 벡터 정규화 유틸: [x,y,z] 또는 {x,y,z} 또는 null 모두 안전 처리
const normalizeVec3 = (v, def = { x: 0, y: 0, z: 0 }) => {
  if (!v && v !== 0) return { ...def }
  if (Array.isArray(v)) {
    const [x = def.x, y = def.y, z = def.z] = v
    return { x, y, z }
  }
  if (typeof v === 'object') {
    const x = Number.isFinite(v.x) ? v.x : def.x
    const y = Number.isFinite(v.y) ? v.y : def.y
    const z = Number.isFinite(v.z) ? v.z : def.z
    return { x, y, z }
  }
  // 단일 숫자 등 예외 입력은 기본값으로 처리
  return { ...def }
}

// 오브젝트 변환 필드 정규화
const normalizeTransformFields = (obj) => {
  if (!obj || typeof obj !== 'object') return obj
  const normalized = { ...obj }
  normalized.position = normalizeVec3(obj.position, { x: 0, y: 0, z: 0 })
  normalized.rotation = normalizeVec3(obj.rotation, { x: 0, y: 0, z: 0 })
  normalized.scale = normalizeVec3(obj.scale, { x: 1, y: 1, z: 1 })
  return normalized
}

export const useEditorStore = create((set, get) => {
  // 설정 하이드레이션 (초기 1회)
  const vg = { ...defaultViewGizmoConfig } // async hydrate later overrides
  const uiInitial = { ...defaultUISettings }
  // 비동기 리하이드레이션: SQLite 최신값으로 덮어쓰기
  ;(async () => {
    try {
      const results = await Promise.allSettled([
        loadViewGizmoConfigAsync(),
        loadSettingsSectionAsync('ui'),
        loadEnvironmentSettingsAsync(),
      ])
      // View/Gizmo
      try {
        if (results[0].status === 'fulfilled' && results[0].value) {
          const vgAsync = results[0].value
          set((s) => ({
            isWireframe: !!vgAsync.isWireframe,
            isGridSnap: !!vgAsync.isGridSnap,
            isGridVisible: !!vgAsync.isGridVisible,
            gizmoSpace: vgAsync.gizmoSpace || 'world',
            gizmoSize: Number.isFinite(vgAsync.gizmoSize) ? vgAsync.gizmoSize : s.gizmoSize,
            snapMove: Number.isFinite(vgAsync.snapMove) ? vgAsync.snapMove : s.snapMove,
            snapRotateDeg: Number.isFinite(vgAsync.snapRotateDeg) ? vgAsync.snapRotateDeg : s.snapRotateDeg,
            snapScale: Number.isFinite(vgAsync.snapScale) ? vgAsync.snapScale : s.snapScale,
            cameraPanSpeed: Number.isFinite(vgAsync.cameraPanSpeed) ? vgAsync.cameraPanSpeed : s.cameraPanSpeed,
            cameraOrbitSpeed: Number.isFinite(vgAsync.cameraOrbitSpeed) ? vgAsync.cameraOrbitSpeed : s.cameraOrbitSpeed,
            cameraZoomSpeed: Number.isFinite(vgAsync.cameraZoomSpeed) ? vgAsync.cameraZoomSpeed : s.cameraZoomSpeed,
            isPostProcessingEnabled: !!vgAsync.isPostProcessingEnabled,
          }))
        }
      } finally {
        try { set({ viewReady: true }) } catch {}
      }

      // UI section
      try {
        if (results[1].status === 'fulfilled' && results[1].value) {
          const uiAsync = results[1].value
          set({
            showLibrary: !!uiAsync.showLibrary,
            showAssets: !!uiAsync.showAssets,
            isPostProcessingPanelOpen: !!uiAsync.isPostProcessingPanelOpen,
            showHDRI: !!uiAsync.showHDRI,
            isViewGizmoSettingsOpen: !!uiAsync.isViewGizmoSettingsOpen,
            dragUseSelectionForDnD: !!uiAsync.dragUseSelectionForDnD,
          })
        }
      } finally {
        try { set({ uiReady: true }) } catch {}
      }

      // Environment section
      try {
        if (results[2].status === 'fulfilled' && results[2].value) {
          const envAsync = results[2].value
          set((s) => ({
            isPostProcessingEnabled: !!(envAsync.postProcessing?.enabled ?? s.isPostProcessingEnabled),
            postProcessingPreset: envAsync.postProcessing?.preset || s.postProcessingPreset,
            safeMode: { ...s.safeMode, ...(envAsync.safeMode || {}) },
            rendererAA: envAsync.rendererAA || s.rendererAA,
            renderMode: envAsync.renderMode || s.renderMode,
            hdriSettings: envAsync.hdriSettings ? { ...s.hdriSettings, ...envAsync.hdriSettings } : s.hdriSettings,
          }))
        }
      } finally {
        try { set({ envReady: true }) } catch {}
      }
    } catch {
      // 실패 시에도 플래그는 true로 전환하여 UI가 멈추지 않도록 처리
      try { set({ viewReady: true, uiReady: true, envReady: true }) } catch {}
    }
  })()
  
  return {
  // Scene state
  scene: null,
  camera: null,
  renderer: null,
  
  // History (Undo/Redo)
  _historyPast: [],
  _historyFuture: [],
  _batchActive: false,
  _batchBuffer: [],
  // UI 피드백용 히스토리 가능 여부
  canUndo: false,
  canRedo: false,
  
  // Selected object
  selectedObject: null,
  selectedIds: [],
  transformMode: 'translate',
  
  // Viewport settings
  isWireframe: !!vg.isWireframe,
  isGridSnap: !!vg.isGridSnap,
  isGridVisible: !!vg.isGridVisible, // 그리드 가시성
  gridSize: 1, // 그리드 크기 (단위: Three.js 유닛)
  
  // Gizmo settings
  gizmoSpace: vg.gizmoSpace || 'world', // 'world' or 'local'
  gizmoSize: Number.isFinite(vg.gizmoSize) ? vg.gizmoSize : 0.5, // TransformControls size
  // Snap increments
  snapMove: Number.isFinite(vg.snapMove) ? vg.snapMove : 1.0,
  snapRotateDeg: Number.isFinite(vg.snapRotateDeg) ? vg.snapRotateDeg : 5,
  snapScale: Number.isFinite(vg.snapScale) ? vg.snapScale : 0.01,
  // Camera control sensitivities (hydrate from viewGizmo)
  cameraPanSpeed: Number.isFinite(vg.cameraPanSpeed) ? vg.cameraPanSpeed : 10,
  cameraOrbitSpeed: Number.isFinite(vg.cameraOrbitSpeed) ? vg.cameraOrbitSpeed : 10,
  cameraZoomSpeed: Number.isFinite(vg.cameraZoomSpeed) ? vg.cameraZoomSpeed : 0.5,
  // 자석 기능 제거됨

  // HDRI settings - 패널이 닫혀도 유지되는 설정 (비동기 환경 저장으로 재하이드레이트)
  hdriSettings: {
    currentHDRI: {
      name: '기본 배경',
      type: 'none'
    },
    hdriIntensity: 1,
    hdriRotation: 0,
    sunLightEnabled: true,
    sunIntensity: 1,
    timeOfDay: 12,
    sunAzimuth: 0,
    sunElevation: 45,
    sunColor: '#ffffff',
  ...initialHDRISettings
  },
  
  // HDRI 조명 ref - 씬에서 지속적으로 관리
  sunLightRef: null,

  // 드롭 인디케이터 설정
  dropIndicator: {
    easing: 'easeInOutQuad',
    inMs: 200,
    outMs: 220,
    maxOpacity: 0.6
  },

  // 렌더/포스트프로세싱 참조 및 세이프 모드
  postProcessingManager: null,
  // 섹션별 리하이드레이션 완료 플래그
  viewReady: false,
  uiReady: false,
  envReady: false,
  // 전역 포스트프로세싱 사용 여부 (기본값은 환경 기본 설정)
  isPostProcessingEnabled: !!(defaultEnvironmentSettings?.postProcessing?.enabled),
  // 간단한 프리셋 키 (효과 조합 프리셋)
  postProcessingPreset: defaultEnvironmentSettings?.postProcessing?.preset || 'default',
  safeMode: { enabled: false, pixelRatio: 1.0, notes: 'Disables FXAA/SSAO and forces pixelRatio to 1.0 to reduce VRAM.' },
  vramEstimateMB: 0,
  // 뷰 통계 (FPS/오브젝트/버텍스/폴리곤)
  stats: { fps: 0, objects: 0, vertices: 0, triangles: 0 },
  // 렌더러/렌더 모드 설정 (환경 저장 연동)
  rendererAA: defaultEnvironmentSettings?.rendererAA || 'msaa', // 'msaa' | 'fxaa' | 'none'
  renderMode: defaultEnvironmentSettings?.renderMode || 'continuous', // 'continuous' | 'on-demand'

  // Assets
  savedObjects: new Map(),
  // 커스텀 메쉬 목록 (IndexedDB에서 앱 시작 시 로드됨)
  customMeshes: [],
  objects: [],
  walls: [],
  
  // Clipboard for copy/paste functionality
  clipboard: null, // 복사된 객체를 저장하는 클립보드
  
  // UI Panels (persisted via settings.ui)
  showLibrary: !!uiInitial.showLibrary,
  showAssets: !!uiInitial.showAssets,
  isPostProcessingPanelOpen: !!uiInitial.isPostProcessingPanelOpen,
  showHDRI: !!uiInitial.showHDRI,
  // View/Gizmo 설정 팝오버 열림 상태
  isViewGizmoSettingsOpen: !!uiInitial.isViewGizmoSettingsOpen,
  // DnD 동작 설정: 드래그 시작 시 선택 집합을 항상 사용(기본: false)
  dragUseSelectionForDnD: !!uiInitial.dragUseSelectionForDnD,

  // Actions for UI Panels
  setShowLibrary: (v) => set({ showLibrary: !!v }),
  setShowAssets: (v) => set({ showAssets: !!v }),
  setIsPostProcessingPanelOpen: (v) => set({ isPostProcessingPanelOpen: !!v }),
  setShowHDRI: (v) => set({ showHDRI: !!v }),
  setIsViewGizmoSettingsOpen: (v) => set({ isViewGizmoSettingsOpen: !!v }),
  setDragUseSelectionForDnD: (on) => set({ dragUseSelectionForDnD: !!on }),

  // Actions
  setSelectedObject: (object) => set({ selectedObject: object }),
  setSelectedIds: (ids) => set({ selectedIds: Array.isArray(ids) ? Array.from(new Set(ids)) : [] }),
  setTransformMode: (mode) => set({ transformMode: mode }),
  
  // Viewport actions
  toggleWireframe: () => set((state) => ({ isWireframe: !state.isWireframe })),
  toggleGridSnap: () => set((state) => ({ isGridSnap: !state.isGridSnap })),
  toggleGridVisible: () => set((state) => ({ isGridVisible: !state.isGridVisible })),
  setGridSize: (size) => set({ gridSize: size }),
  
  // Gizmo actions
  toggleGizmoSpace: () => set((state) => ({ 
    gizmoSpace: state.gizmoSpace === 'world' ? 'local' : 'world' 
  })),
  setGizmoSize: (size) => set({ gizmoSize: Math.max(0.1, Math.min(5, Number(size) || 1)) }),
  setSnapMove: (val) => set({ snapMove: Math.max(0.001, Math.min(1000, Number(val) || 1)) }),
  setSnapRotateDeg: (deg) => set({ snapRotateDeg: Math.max(0.1, Math.min(360, Number(deg) || 15)) }),
  setSnapScale: (val) => set({ snapScale: Math.max(0.001, Math.min(100, Number(val) || 0.1)) }),
  setCameraPanSpeed: (v) => set({ cameraPanSpeed: Math.max(1, Math.min(500, Number(v) || 50)) }),
  setCameraOrbitSpeed: (v) => set({ cameraOrbitSpeed: Math.max(1, Math.min(1000, Number(v) || 100)) }),
  setCameraZoomSpeed: (v) => set({ cameraZoomSpeed: Math.max(0.01, Math.min(5, Number(v) || 0.3)) }),
  rehydrateViewGizmoConfig: async () => {
    try {
      const cfg = await loadViewGizmoConfigAsync()
      set({
        isWireframe: !!cfg.isWireframe,
        isGridSnap: !!cfg.isGridSnap,
        isGridVisible: !!cfg.isGridVisible,
        gizmoSpace: cfg.gizmoSpace || 'world',
  gizmoSize: Number.isFinite(cfg.gizmoSize) ? cfg.gizmoSize : 0.5,
  snapMove: Number.isFinite(cfg.snapMove) ? cfg.snapMove : 1,
  snapRotateDeg: Number.isFinite(cfg.snapRotateDeg) ? cfg.snapRotateDeg : 5,
  snapScale: Number.isFinite(cfg.snapScale) ? cfg.snapScale : 0.01,
        isPostProcessingEnabled: !!cfg.isPostProcessingEnabled,
  cameraPanSpeed: Number.isFinite(cfg.cameraPanSpeed) ? cfg.cameraPanSpeed : 10,
  cameraOrbitSpeed: Number.isFinite(cfg.cameraOrbitSpeed) ? cfg.cameraOrbitSpeed : 10,
  cameraZoomSpeed: Number.isFinite(cfg.cameraZoomSpeed) ? cfg.cameraZoomSpeed : 0.5
      })
    } catch {}
  },
  // 자석 기능 제거됨

  // Camera control mode: use BlenderControls instead of legacy
  useBlenderControls: true,
  setUseBlenderControls: (on) => set({ useBlenderControls: !!on }),
  
  // HDRI actions
  updateHDRISettings: (updates) => set((state) => ({
    hdriSettings: { ...state.hdriSettings, ...updates }
  })),
  
  setSunLightRef: (ref) => set({ sunLightRef: ref }),

  // 드롭 인디케이터 설정 업데이트
  updateDropIndicator: (updates) => set((state) => ({
    dropIndicator: { ...state.dropIndicator, ...updates }
  })),

  // 포스트프로세싱 매니저 참조 저장
  setPostProcessingManager: (ppm) => set({ postProcessingManager: ppm }),
  setRendererAA: (mode) => {
    const valid = ['msaa', 'fxaa', 'none'];
    const m = valid.includes(mode) ? mode : 'msaa';
    set({ rendererAA: m });
  try { saveEnvironmentSettingsAsync({ rendererAA: m }) } catch {}
    // 런타임 반영: FXAA 상호배타 처리 및 렌더러 AA는 재생성 시 반영(현재 프레임 즉시 반영 불가)
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
  // 포스트프로세싱 전체 온/오프
  togglePostProcessingEnabled: () => set((state) => ({ isPostProcessingEnabled: !state.isPostProcessingEnabled })),
  setPostProcessingPreset: (key) => set({ postProcessingPreset: key || 'default' }),

  // 통계 갱신
  setStats: (partial) => set((state) => ({ stats: { ...state.stats, ...partial } })),

  // 세이프 모드 토글 및 픽셀 비율 설정
  toggleSafeMode: (on) => {
    const enabled = on !== undefined ? !!on : !get().safeMode.enabled;
    const current = get().safeMode;
    const next = { ...current, enabled };
    set({ safeMode: next });
    try {
      const ppm = get().postProcessingManager;
      if (ppm) {
        ppm.setEffectEnabled('fxaa', !enabled);
        ppm.setEffectEnabled('ssao', !enabled);
        // 픽셀 비율 변경에 맞춰 버퍼 재설정
        ppm.handleResize(window.innerWidth, window.innerHeight);
      }
    } catch {}
    try {
      const renderer = get().renderer;
      if (renderer) {
        const pr = enabled ? (get().safeMode.pixelRatio || 1.0) : Math.min(2, window.devicePixelRatio || 1);
        renderer.setPixelRatio(pr);
      }
    } catch {}
    try { get().estimateVRAMUsage(); } catch {}
  // persist to environment
  try { saveEnvironmentSettingsAsync({ safeMode: { enabled: get().safeMode.enabled, pixelRatio: get().safeMode.pixelRatio } }) } catch {}
  },
  setSafeModePixelRatio: (pr) => {
    const clamped = Math.max(0.5, Math.min(2, Number(pr) || 1));
    const next = { ...get().safeMode, pixelRatio: clamped };
    set({ safeMode: next });
    try {
      const renderer = get().renderer;
      if (renderer && get().safeMode.enabled) {
        renderer.setPixelRatio(clamped);
      }
    } catch {}
    try {
      const ppm = get().postProcessingManager;
      if (ppm) ppm.handleResize(window.innerWidth, window.innerHeight);
    } catch {}
    try { get().estimateVRAMUsage(); } catch {}
  try { saveEnvironmentSettingsAsync({ safeMode: { enabled: get().safeMode.enabled, pixelRatio: clamped } }) } catch {}
  },
  // 대략적인 VRAM 사용량 추정 (MB)
  estimateVRAMUsage: (opts = {}) => {
    const width = opts.width || window.innerWidth;
    const height = opts.height || window.innerHeight;
    let pr = 1;
    try { pr = get().renderer?.getPixelRatio?.() || window.devicePixelRatio || 1; } catch {}
    const w = Math.max(1, Math.floor(width * pr));
    const h = Math.max(1, Math.floor(height * pr));
    const bppColor = 4; // RGBA8
    const bppDepth = 4; // Depth/Stencil rough
    let total = (w * h) * (bppColor + bppDepth); // default framebuffer
    try {
      const ppm = get().postProcessingManager;
      const ppOn = get().isPostProcessingEnabled;
      if (ppm && ppOn) {
        // composer default target
        total += (w * h) * (bppColor + bppDepth);
        const eff = ppm.getSettings?.() || {};
  // Outline 제거됨
        if (eff.ssao?.enabled) total += 2 * (w * h) * bppColor;
        if (eff.fxaa?.enabled) total += (w * h) * bppColor;
      }
    } catch {}
    const mb = Math.round(total / (1024 * 1024));
    set({ vramEstimateMB: mb });
    return mb;
  },
  
  // HDRI 설정 초기화 (동기 경로 제거)
  initializeHDRISettings: () => false,
  
  // HDRI 설정 저장 (localStorage에)
  saveHDRISettings: async () => {
    const { hdriSettings } = get()
    try { await saveEnvironmentSettingsAsync({ hdriSettings: { ...(hdriSettings || {}) } }) } catch {}
  },
  
  // Asset actions
  addAsset: (name, url) => set((state) => {
    const newMap = new Map(state.savedObjects)
    newMap.set(name, url)
    return { savedObjects: newMap }
  }),

  addCustomMesh: async (meshData) => {
    try {
      await idbAddCustomMesh(meshData)
      set((state) => ({ customMeshes: [...state.customMeshes, meshData] }))
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('appToast', { detail: { message: '저장에 실패했습니다 (IndexedDB).', type: 'error', duration: 3000 } })) } catch {}
    }
  },

  deleteCustomMesh: async (meshId) => {
    try {
      await idbDeleteCustomMesh(meshId)
      set((state) => ({ customMeshes: state.customMeshes.filter(mesh => mesh.id !== meshId) }))
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('appToast', { detail: { message: '삭제에 실패했습니다 (IndexedDB).', type: 'error', duration: 3000 } })) } catch {}
    }
  },

  loadCustomMeshes: (meshes) => set(() => ({
    // 커스텀 메쉬는 타입 명시적으로 부여
    customMeshes: (Array.isArray(meshes) ? meshes : []).map(m => ({ ...m, type: 'custom' }))
  })),
  
  // 객체의 transform 정보 업데이트
  updateObjectTransform: (objectId, transform) => set((state) => {
    const norm = normalizeTransformFields(transform)
    const before = state.objects.find(o => o.id === objectId)
    const after = before ? { ...before, ...norm } : null
    const next = state.objects.map(obj => 
      obj.id === objectId 
        ? { ...obj, ...norm }
        : obj
    )
    if (before) {
      const entry = {
        type: 'transform',
        id: objectId,
        before: pickTransform(before),
        after: pickTransform(after)
      }
      const { _pushHistory } = get()
      _pushHistory(entry)
    }
    return { objects: next }
  }),
  
  addObject: (object) => set((state) => {
    const normalized = normalizeTransformFields(object)
  // parentId/order 기본값 처리 및 order 자동 배정
  const parentId = Object.prototype.hasOwnProperty.call(normalized, 'parentId') ? normalized.parentId ?? null : null
  let order = normalized.order
  if (!Number.isFinite(order)) {
    const siblings = state.objects.filter(o => (o.parentId ?? null) === parentId)
    const maxOrder = siblings.reduce((m, o) => Number.isFinite(o.order) ? Math.max(m, o.order) : m, -1)
    order = maxOrder + 1
  }
  const enriched = { ...normalized, parentId, order }
  const nextObjects = [...state.objects, enriched]
  // 히스토리: add (큰 glbData, file 등 제외)
  const entry = { type: 'add', object: safeCloneForHistory(enriched) }
  const { _pushHistory } = get()
  _pushHistory(entry)
  return { objects: nextObjects }
  }),
  
  removeObject: (object) => set((state) => {
    // 시스템 객체는 삭제할 수 없음
    if (object.isSystemObject) {
      console.warn('시스템 객체는 삭제할 수 없습니다:', object.name);
      return state;
    }
    const filtered = state.objects.filter(obj => obj !== object)
    // 히스토리: remove (삭제된 객체 보관)
    const entry = { type: 'remove', object: safeCloneForHistory(object) }
    const { _pushHistory } = get()
    _pushHistory(entry)
    return {
      objects: filtered,
      selectedObject: state.selectedObject === object ? null : state.selectedObject
    };
  }),

  // ID로 객체 제거 (Three.js 연산과 연동하기 쉬운 버전)
  removeObjectById: (objectId) => set((state) => {
    const target = state.objects.find(o => o.id === objectId)
    if (!target) return {}
    if (target.isSystemObject) {
      console.warn('시스템 객체는 삭제할 수 없습니다:', target.name)
      return {}
    }
    const { _pushHistory } = get()
    // 1) 자식들을 대상의 부모로 승격 (parentId 변경) - 히스토리 reparent를 먼저 기록
    const children = state.objects.filter(o => o.parentId === objectId)
    let objectsNext = state.objects
    for (const child of children) {
      const beforeParent = child.parentId ?? null
      const afterParent = target.parentId ?? null
      if (beforeParent !== afterParent) {
        _pushHistory({ type: 'reparent', id: child.id, before: { parentId: beforeParent }, after: { parentId: afterParent } })
        objectsNext = objectsNext.map(o => o.id === child.id ? { ...o, parentId: afterParent } : o)
      }
    }
    // 2) 대상 제거 - 히스토리 remove 기록
    const entry = { type: 'remove', object: safeCloneForHistory(target) }
    _pushHistory(entry)
    const filtered = objectsNext.filter(o => o.id !== objectId)
    return {
      objects: filtered,
      selectedObject: (state.selectedObject && (typeof state.selectedObject === 'object' ? state.selectedObject.id : state.selectedObject) === objectId) ? null : state.selectedObject
    }
  }),

  // 부모 변경 (계층 재구성)
  setParent: (objectId, newParentId) => set((state) => {
    const target = state.objects.find(o => o.id === objectId)
    if (!target) return {}
    const beforeParent = target.parentId ?? null
    const afterParent = newParentId ?? null
    if (beforeParent === afterParent) return {}
    const entry = { type: 'reparent', id: objectId, before: { parentId: beforeParent }, after: { parentId: afterParent } }
    const { _pushHistory } = get();
    _pushHistory(entry)
    // 새 부모의 끝으로 order 부여
    const siblings = state.objects.filter(o => (o.parentId ?? null) === afterParent && o.id !== objectId)
    const maxOrder = siblings.reduce((m, o) => Number.isFinite(o.order) ? Math.max(m, o.order) : m, -1)
    const newOrder = maxOrder + 1
    return {
      objects: state.objects.map(o => o.id === objectId ? { ...o, parentId: afterParent, order: newOrder } : o)
    }
  }),

  // 동일 parent 내 순서 재배치
  reorderSiblings: (parentId, orderedIds) => set((state) => {
    if (!Array.isArray(orderedIds)) return {}
    const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]))
    const updated = state.objects.map(o => {
      if ((o.parentId ?? null) !== (parentId ?? null)) return o
      if (!orderMap.has(o.id)) return o
      return { ...o, order: orderMap.get(o.id) }
    })
    return { objects: updated }
  }),
  
  addWall: (wall) => set((state) => ({
    walls: [...state.walls, wall]
  })),
  
  removeWall: (wallId) => set((state) => ({
    walls: state.walls.filter(wall => wall.id !== wallId)
  })),
  
  updateObject: (id, updates) => set((state) => {
    const before = state.objects.find(o => o.id === id)
    const norm = normalizeTransformFields(updates)
    const next = state.objects.map(obj => 
      obj.id === id ? { ...obj, ...norm } : obj
    )
    if (before) {
      const entry = {
        type: 'update',
        id,
        before: snapshotForUpdate(before, norm),
        after: norm
      }
      const { _pushHistory } = get()
      _pushHistory(entry)
    }
    return { objects: next }
  }),
  
  // Clipboard actions
  copyObject: (object) => {
    if (!object) {
      console.warn('copyObject: 객체가 null 또는 undefined입니다');
      return;
    }
    
    // Three.js 객체인지 확인
  if (object.isObject3D) {
      
      // 먼저 objects 배열을 Three.js 객체의 현재 transform으로 업데이트
      const state = get();
      const objectId = object.userData?.id;
      if (objectId) {
        const { updateObjectTransform } = get();
        updateObjectTransform(objectId, {
          position: {
            x: object.position.x,
            y: object.position.y,
            z: object.position.z
          },
          rotation: {
            x: object.rotation.x,
            y: object.rotation.y,
            z: object.rotation.z
          },
          scale: {
            x: object.scale.x,
            y: object.scale.y,
            z: object.scale.z
          }
        });
      }
      
      // 업데이트된 상태에서 객체 정보 다시 가져오기
  const updatedState = get();
  const objectData = updatedState.objects.find(obj => obj.id === objectId);
      
      // Three.js 객체와 objects 배열 정보를 결합하여 클립보드용 객체 생성
      const objectCopy = {
        name: `${object.name}_copy`,
        type: objectData?.type || object.userData?.type || 'basic', // 원본 타입 유지 (glb, mesh 등)
        geometry: objectData?.geometry || object.userData?.geometry || 'BoxGeometry',
        params: objectData?.params || object.userData?.params || [1, 1, 1],
        uuid: object.uuid, // 원본 참조용
        
        // GLB 객체의 경우 추가 정보 복사
        ...(objectData?.type === 'glb' && {
          url: objectData.url,
          // glbData는 큰 바이너리이므로 보관하지 않음. 가능하면 참조 id 사용
          customMeshId: objectData.customMeshId,
          file: undefined
        }),
        
        position: {
          x: object.position.x,
          y: object.position.y,
          z: object.position.z
        },
        rotation: {
          x: object.rotation.x,
          y: object.rotation.y,
          z: object.rotation.z
        },
        scale: {
          x: object.scale.x,
          y: object.scale.y,
          z: object.scale.z
        },
        visible: object.visible,
        material: objectData?.material || object.userData?.material || {
          type: 'MeshStandardMaterial',
          color: 0xff0000
        },
        // 원본 Three.js 객체 참조 (복사 시 필요)
        originalObject: object
      };
      
  set({ clipboard: objectCopy });
      return;
    }
    
    // 시스템 객체는 복사할 수 없음
    if (object.isSystemObject) {
      console.warn('시스템 객체는 복사할 수 없습니다:', object.name);
      return;
    }
    
    // 일반 객체의 복사본을 클립보드에 저장
    const objectCopy = {
      ...object,
      id: undefined, // 새로운 ID가 부여되도록 undefined로 설정
      name: `${object.name}_copy` // 복사본임을 나타내는 접미사 추가
    };
    
  set({ clipboard: objectCopy });
  },
  
  pasteObject: () => {
    const state = get();
    
    if (!state.clipboard) {
      // 클립보드가 비어있을 때는 조용히 null 반환 (경고 메시지 제거)
      return null;
    }
    
    // 클립보드의 객체를 기반으로 새 객체 생성
    const newObject = {
      ...state.clipboard,
      id: Date.now(), // 새로운 고유 ID 생성
      position: {
        x: state.clipboard.position?.x || 0, // 복사한 위치 그대로 사용
        y: state.clipboard.position?.y || 0,
        z: state.clipboard.position?.z || 0
      },
      rotation: {
        x: state.clipboard.rotation?.x || 0, // 복사한 회전 그대로 사용
        y: state.clipboard.rotation?.y || 0,
        z: state.clipboard.rotation?.z || 0
      },
      scale: {
        x: state.clipboard.scale?.x || 1, // 복사한 크기 그대로 사용
        y: state.clipboard.scale?.y || 1,
        z: state.clipboard.scale?.z || 1
      }
    };
    
    // 새 객체를 씬에 추가
    const updatedObjects = [...state.objects, newObject];
    set({ 
      objects: updatedObjects,
      selectedObject: newObject.id // 새로 생성된 객체 선택
    });
    return newObject;
  },
  
  // 클립보드 상태 확인 헬퍼 함수
  hasClipboardData: () => get().clipboard !== null,
  
  // 클립보드 비우기 함수
  clearClipboard: () => set({ clipboard: null }),
  
  deleteSelectedObject: () => {
    const state = get();
    
    if (!state.selectedObject) {
      console.warn('선택된 객체가 없습니다.');
      return;
    }
    
    // 선택된 객체가 객체 자체인지, id인지 모두 허용
    const selectedId = typeof state.selectedObject === 'object' ? state.selectedObject.id : state.selectedObject;
    if (!selectedId) {
      console.warn('선택된 객체 ID를 확인할 수 없습니다.');
      return;
    }
    // 선택된 객체 찾기
    const objectToDelete = state.objects.find(obj => obj.id === selectedId);
    
    if (!objectToDelete) {
      console.warn('선택된 객체를 찾을 수 없습니다.');
      return;
    }
    
    // 시스템 객체는 삭제할 수 없음
    if (objectToDelete.isSystemObject) {
      console.warn('시스템 객체는 삭제할 수 없습니다:', objectToDelete.name);
      return;
    }
    
  // 객체 삭제
  const updatedObjects = state.objects.filter(obj => obj.id !== selectedId);
  // 히스토리 기록
  const entry = { type: 'remove', object: safeCloneForHistory(objectToDelete) }
  const { _pushHistory } = get();
  _pushHistory(entry)
    
    set({ 
      objects: updatedObjects,
      selectedObject: null // 선택 해제
    });
  },
  
  updateWall: (id, updates) => set((state) => ({
    walls: state.walls.map(wall => 
      wall.id === id ? { ...wall, ...updates } : wall
    )
  })),
  
  toggleObjectVisibility: (object) => set((state) => {
    const newVisibleState = object.visible !== false ? false : true
    
    // 오브젝트 배열에서 찾아서 업데이트
    const updatedObjects = state.objects.map(obj => obj.id === object.id ? { ...obj, visible: newVisibleState } : obj)
    // 히스토리
    const entry = { type: 'update', id: object.id, before: { visible: object.visible }, after: { visible: newVisibleState } }
    const { _pushHistory } = get();
    _pushHistory(entry)
    
    // 벽 배열에서 찾아서 업데이트
    const updatedWalls = state.walls.map(wall => 
      wall.id === object.id ? { ...wall, visible: newVisibleState } : wall
    )
    
    return {
      objects: updatedObjects,
      walls: updatedWalls
    }
  }),

  toggleObjectFreeze: (object) => set((state) => {
    const newFreezeState = object.frozen !== true ? true : false
    
    // 오브젝트 배열에서 찾아서 업데이트
    const updatedObjects = state.objects.map(obj => obj.id === object.id ? { ...obj, frozen: newFreezeState } : obj)
    // 히스토리
    const entry = { type: 'update', id: object.id, before: { frozen: object.frozen }, after: { frozen: newFreezeState } }
    const { _pushHistory } = get();
    _pushHistory(entry)
    
    // 벽 배열에서 찾아서 업데이트
    const updatedWalls = state.walls.map(wall => 
      wall.id === object.id ? { ...wall, frozen: newFreezeState } : wall
    )
    
    return {
      objects: updatedObjects,
      walls: updatedWalls
    }
  }),

  renameObject: (objectId, newName) => set((state) => {
    // 오브젝트 배열에서 찾아서 이름 업데이트
    const before = state.objects.find(o => o.id === objectId)
    const updatedObjects = state.objects.map(obj => obj.id === objectId ? { ...obj, name: newName } : obj)
    if (before) {
      const entry = { type: 'update', id: objectId, before: { name: before.name }, after: { name: newName } }
      const { _pushHistory } = get();
      _pushHistory(entry)
    }
    
    // 벽 배열에서 찾아서 이름 업데이트
    const updatedWalls = state.walls.map(wall => 
      wall.id === objectId ? { ...wall, name: newName } : wall
    )
    
    return {
      objects: updatedObjects,
      walls: updatedWalls
    }
  }),
  
  // 씬의 현재 상태(변환/일부 속성)를 objects에 동기화
  syncSceneToState: () => {
    const state = get();
    const scene = state.scene;
    if (!scene) return false;
    const idToObject3D = new Map();
    try {
      scene.traverse((child) => {
        const id = child?.userData?.id;
        if (id) idToObject3D.set(id, child);
      });
    } catch {}
    const updatedObjects = state.objects.map((o) => {
      const n = normalizeTransformFields(o);
      const obj3d = idToObject3D.get(o.id);
      if (!obj3d || !obj3d.isObject3D) return n;
      // 변환 동기화
      const next = {
        ...n,
        position: { x: obj3d.position.x, y: obj3d.position.y, z: obj3d.position.z },
        rotation: { x: obj3d.rotation.x, y: obj3d.rotation.y, z: obj3d.rotation.z },
        scale: { x: obj3d.scale.x, y: obj3d.scale.y, z: obj3d.scale.z },
      };
      // 라이트 속성 동기화 (가능한 경우)
      try {
        const type = o.type;
        const lightKind = type === 'light' ? o.lightType : (
          type === 'directional_light' ? 'directional' :
          type === 'point_light' ? 'point' :
          type === 'spot_light' ? 'spot' : null
        );
        if (obj3d.isLight && lightKind) {
          // 공통
          if (typeof obj3d.intensity === 'number') next.intensity = obj3d.intensity;
          if (obj3d.color && typeof obj3d.color.getHex === 'function') next.color = obj3d.color.getHex();
          next.castShadow = !!obj3d.castShadow;
          // 종류별
          if (lightKind === 'point' || lightKind === 'spot') {
            if (typeof obj3d.distance === 'number') next.distance = obj3d.distance;
            if (typeof obj3d.decay === 'number') next.decay = obj3d.decay;
          }
          if (lightKind === 'spot') {
            if (typeof obj3d.angle === 'number') next.angle = obj3d.angle;
            if (typeof obj3d.penumbra === 'number') next.penumbra = obj3d.penumbra;
          }
        }
      } catch {}
      return next;
    });
    set({ objects: updatedObjects });
    return true;
  },
  
  saveMap: (name, viewState) => {
    const state = get()
    // 저장 직전 씬의 실제 변환/속성 동기화
    try { state.syncSceneToState?.() } catch {}
    // glbData를 제거하고 참조 id만 남기는 사전 처리
    const serializedObjects = state.objects.map((o) => {
      if (o?.type === 'glb') {
        const { glbData, file, ...rest } = o || {}
        return { ...rest }
      }
      return o
    })
    // 뷰 상태 자동 캡처(인자가 없을 때)
    let autoView = viewState;
    try {
      if (!autoView) {
        const cam = state.camera;
        autoView = cam ? {
          camera: {
            type: cam.type,
            position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
            rotation: { x: cam.rotation.x, y: cam.rotation.y, z: cam.rotation.z },
            zoom: typeof cam.zoom === 'number' ? cam.zoom : undefined,
          },
          viewport: {
            isWireframe: !!state.isWireframe,
            isGridSnap: !!state.isGridSnap,
            isGridVisible: !!state.isGridVisible,
            gizmoSpace: state.gizmoSpace,
            gizmoSize: state.gizmoSize,
            snapMove: state.snapMove,
            snapRotateDeg: state.snapRotateDeg,
            snapScale: state.snapScale,
            rendererAA: state.rendererAA,
            renderMode: state.renderMode,
            isPostProcessingEnabled: !!state.isPostProcessingEnabled,
            postProcessingPreset: state.postProcessingPreset,
            safeMode: { ...state.safeMode },
            hdriSettings: { ...state.hdriSettings },
          }
        } : undefined;
      }
    } catch {}
    const mapData = {
      walls: state.walls,
      objects: serializedObjects,
      // 선택적으로 뷰 상태를 함께 저장 (없으면 자동 캡처분 사용)
      viewState: autoView || undefined
    }
    try { localStorage.setItem(`map_${name}`, JSON.stringify(mapData)) } catch {}
  },
  // 맵 원본 데이터 조회 (저장된 viewState 포함)
  getMapData: (name) => {
    try {
      const s = localStorage.getItem(`map_${name}`)
      if (!s) return null
      return JSON.parse(s)
    } catch { return null }
  },
  
  loadMap: (name) => {
    const mapDataString = localStorage.getItem(`map_${name}`)
    if (mapDataString) {
      const mapData = JSON.parse(mapDataString)
      
      // 로드 시 변환 필드 정규화 적용
      const normalizedObjects = (mapData.objects || []).map(o => {
        const n = normalizeTransformFields(o)
        // 레거시 또는 잘못 직렬화된 glbData 정리
        if (n?.type === 'glb') {
          if (n.glbData && typeof n.glbData === 'object' && !Array.isArray(n.glbData) && !(n.glbData instanceof ArrayBuffer) && !(n.glbData instanceof Uint8Array)) {
            // {} 같은 잘못된 데이터는 제거
            delete n.glbData
          }
        }
        // 레거시: 캔버스 드롭으로 생성된 기본 도형이 type 'mesh'로 저장된 경우 보정
        if (n?.type === 'mesh' && !n.geometry && !n.params && (n.userData?.type === 'basic' || n.userData?.geometry)) {
          const originalName = n.userData?.originalName || n.name || '';
          const lower = String(originalName).toLowerCase();
          let geometry = n.userData?.geometry;
          let params = n.userData?.params;
          if (!geometry) {
            if (lower.includes('정육면체') || lower.includes('box')) { geometry = 'BoxGeometry'; params = [1,1,1]; }
            else if (lower.includes('구체') || lower.includes('sphere')) { geometry = 'SphereGeometry'; params = [0.5, 32, 16]; }
            else if (lower.includes('원기둥') || lower.includes('cylinder')) { geometry = 'CylinderGeometry'; params = [0.5, 0.5, 1, 32]; }
            else if (lower.includes('원뿔') || lower.includes('cone')) { geometry = 'ConeGeometry'; params = [0.5, 1, 32]; }
            else if (lower.includes('평면') || lower.includes('plane')) { geometry = 'PlaneGeometry'; params = [1, 1]; }
            else if (lower.includes('도넛') || lower.includes('torus')) { geometry = 'TorusGeometry'; params = [0.5, 0.2, 16, 100]; }
          }
          if (geometry) {
            n.type = 'basic';
            n.geometry = geometry;
            n.params = params || [];
          }
        }
        const parentId = Object.prototype.hasOwnProperty.call(n, 'parentId') ? n.parentId ?? null : null
        let order = n.order
        if (!Number.isFinite(order)) order = 0
        return { ...n, parentId, order }
      })
      const normalizedWalls = (mapData.walls || []).map(normalizeTransformFields)
      set(() => ({
        walls: normalizedWalls,
        objects: normalizedObjects
      }))
      // 저장된 뷰 상태 적용(있을 경우): 카메라/뷰포트 설정
      try {
        const vs = mapData.viewState;
        if (vs) {
          const patch = {};
          if (vs.viewport) {
            const v = vs.viewport;
            patch.isWireframe = !!v.isWireframe;
            patch.isGridSnap = !!v.isGridSnap;
            patch.isGridVisible = !!v.isGridVisible;
            patch.gizmoSpace = v.gizmoSpace || get().gizmoSpace;
            if (Number.isFinite(v.gizmoSize)) patch.gizmoSize = v.gizmoSize;
            if (Number.isFinite(v.snapMove)) patch.snapMove = v.snapMove;
            if (Number.isFinite(v.snapRotateDeg)) patch.snapRotateDeg = v.snapRotateDeg;
            if (Number.isFinite(v.snapScale)) patch.snapScale = v.snapScale;
            if (v.rendererAA) patch.rendererAA = v.rendererAA;
            if (v.renderMode) patch.renderMode = v.renderMode;
            patch.isPostProcessingEnabled = !!v.isPostProcessingEnabled;
            if (v.postProcessingPreset) patch.postProcessingPreset = v.postProcessingPreset;
            if (v.safeMode) patch.safeMode = { ...get().safeMode, ...v.safeMode };
            if (v.hdriSettings) patch.hdriSettings = { ...get().hdriSettings, ...v.hdriSettings };
          }
          if (Object.keys(patch).length > 0) set(patch);
          // 카메라는 EditorControls가 관리하므로, 좌표는 나중에 컨트롤에서 반영
          // 여기서는 상태만 보존하고, 컨트롤 초기화 시 적용될 수 있게 유지
        }
      } catch {}
      
      return true
    }
    return false
  },
  
  clearMap: () => {
    const state = get();
    // 상태 초기화 (시스템 객체만 유지)
    set({
      objects: (state.objects || []).filter(obj => obj.isSystemObject),
      walls: [],
      selectedObject: null,
      selectedIds: []
    });
    // 씬 잔여물 강제 정리: 스토어에 없는 비시스템 오브젝트 제거
    try {
      const scene = get().scene;
      if (scene) {
        const keepIds = new Set((get().objects || []).map(o => o.id));
        const toRemove = [];
        scene.traverse((child) => {
          // 시스템/기즈모/헬퍼/오버레이는 유지
          if (child?.userData?.isSystemObject) return;
          if (child?.userData?.isSelectionOutline) return;
          // 스토어에 없는 id 기반 오브젝트 제거 대상
          const cid = child?.userData?.id;
          if (!cid || !keepIds.has(cid)) {
            toRemove.push(child);
          }
        });
        toRemove.forEach((obj) => {
          try {
            if (obj.parent) obj.parent.remove(obj);
            else scene.remove(obj);
          } catch {}
        });
      }
    } catch {}
  },

  // 스토어와 씬 싱크 안전 정리: 스토어에 없는 id의 오브젝트를 씬에서 제거
  pruneOrphanSceneObjects: () => {
    try {
      const scene = get().scene;
      if (!scene) return;
      const keepIds = new Set((get().objects || []).map(o => o.id));
      const toRemove = [];
      scene.traverse((child) => {
        if (child?.userData?.isSystemObject) return;
        if (child?.userData?.isSelectionOutline) return;
        const cid = child?.userData?.id;
        if (!cid || !keepIds.has(cid)) {
          // TransformControls/gizmo/helper는 제외
          const n = (child.name || '').toLowerCase();
          if (n.includes('transformcontrols') || n.includes('gizmo') || n.includes('helper')) return;
          toRemove.push(child);
        }
      });
      toRemove.forEach((obj) => {
        try { if (obj.parent) obj.parent.remove(obj); else scene.remove(obj); } catch {}
      });
    } catch {}
  },
  
  // Scene setup
  setScene: (scene, camera, renderer) => set({ scene, camera, renderer }),

  // ------------------------
  // History API
  // ------------------------
  _pushHistory: (entry) => {
    const { _batchActive, _historyPast } = get()
    if (_batchActive) {
      // 배치 중에는 버퍼에 누적 (스토어 상태의 배열 사용)
      set((state) => ({ _batchBuffer: [...state._batchBuffer, entry] }))
      return
    }
    const nextPast = [..._historyPast, entry]
    set({ _historyPast: nextPast, _historyFuture: [], canUndo: nextPast.length > 0, canRedo: false })
  },
  beginBatch: () => set({ _batchActive: true, _batchBuffer: [] }),
  endBatch: () => set((state) => {
    if (!state._batchActive) return {}
    const entries = state._batchBuffer
    if (entries.length === 0) return { _batchActive: false, _batchBuffer: [] }
    const batchEntry = { type: 'batch', entries }
    const nextPast = [...state._historyPast, batchEntry]
    return {
      _batchActive: false,
      _batchBuffer: [],
      _historyPast: nextPast,
      _historyFuture: [],
      canUndo: nextPast.length > 0,
      canRedo: false
    }
  }),
  undo: () => {
    const state = get()
    const past = [...state._historyPast]
    if (past.length === 0) return false
  // 선택/기즈모 안전 분리
  try { state.setSelectedObject && state.setSelectedObject(null); state.setSelectedIds && state.setSelectedIds([]) } catch {}
    const entry = past.pop()
    applyUndo(entry, set, get)
    const nextFuture = [...state._historyFuture, entry]
    set({ _historyPast: past, _historyFuture: nextFuture, canUndo: past.length > 0, canRedo: nextFuture.length > 0 })
    return true
  },
  redo: () => {
    const state = get()
    const future = [...state._historyFuture]
    if (future.length === 0) return false
  // 선택/기즈모 안전 분리
  try { state.setSelectedObject && state.setSelectedObject(null); state.setSelectedIds && state.setSelectedIds([]) } catch {}
    const entry = future.pop()
    applyRedo(entry, set, get)
    const nextPast = [...state._historyPast, entry]
    set({ _historyFuture: future, _historyPast: nextPast, canUndo: nextPast.length > 0, canRedo: future.length > 0 })
    return true
  }
  };
});

// 자동 저장 시작 (스토어 생성 후 1회)
try { startViewGizmoConfigAutoPersist(useEditorStore) } catch {}
// Persist environment (HDRI) automatically
try { startEnvironmentAutoPersist(useEditorStore) } catch {}

// Persist UI section automatically
try {
  startSettingsAutoPersist(
    useEditorStore,
    'ui',
    (s) => ({
      showLibrary: !!s.showLibrary,
      showAssets: !!s.showAssets,
      isPostProcessingPanelOpen: !!s.isPostProcessingPanelOpen,
  showHDRI: !!s.showHDRI,
  isViewGizmoSettingsOpen: !!s.isViewGizmoSettingsOpen,
  dragUseSelectionForDnD: !!s.dragUseSelectionForDnD,
    }),
    120
  )
} catch {}

// =====================
// 히스토리 헬퍼 함수들
// =====================

function safeCloneForHistory(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const clone = { ...obj }
  // 큰 바이너리/파일 제거
  if ('glbData' in clone) delete clone.glbData
  if ('file' in clone) delete clone.file
  return clone
}

function pickTransform(obj) {
  return {
    position: normalizeVec3(obj.position, { x: 0, y: 0, z: 0 }),
    rotation: normalizeVec3(obj.rotation, { x: 0, y: 0, z: 0 }),
    scale: normalizeVec3(obj.scale, { x: 1, y: 1, z: 1 })
  }
}

function snapshotForUpdate(obj, updates) {
  const snap = {}
  const fields = ['name', 'visible', 'frozen', 'parentId', 'position', 'rotation', 'scale']
  for (const k of fields) {
    if (k in updates) {
      if (k === 'position' || k === 'rotation' || k === 'scale') {
        snap[k] = normalizeVec3(obj[k], k === 'scale' ? { x: 1, y: 1, z: 1 } : { x: 0, y: 0, z: 0 })
      } else {
        snap[k] = obj[k]
      }
    }
  }
  return snap
}

// sync helpers removed (async-only persistence)

function applyUndo(entry, set, get) {
  if (!entry) return
  switch (entry.type) {
    case 'part-transform': {
      const state = get()
      const scene = state.scene
      if (!scene) break
      // 새로운 구조: parts 배열 우선
      const parts = Array.isArray(entry.parts) && entry.parts.length > 0
        ? entry.parts
        : (entry.part && entry.before && entry.after
            ? [{ uuid: entry.part.uuid, before: entry.before }]
            : []);
      for (const p of parts) {
        const uuid = p.uuid
        const before = p.before || entry.before
        if (!uuid || !before) continue
        let target = null
        scene.traverse((child)=>{ if (!target && child.uuid === uuid) target = child })
        if (target && target.isObject3D) {
          try {
            target.position.set(before.position.x, before.position.y, before.position.z)
            target.rotation.set(before.rotation.x, before.rotation.y, before.rotation.z)
            target.scale.set(before.scale.x, before.scale.y, before.scale.z)
            target.updateMatrix()
            target.updateMatrixWorld(true)
          } catch {}
        }
      }
      break
    }
    case 'batch': {
      for (let i = entry.entries.length - 1; i >= 0; i--) {
        applyUndo(entry.entries[i], set, get)
      }
      break
    }
    case 'reparent': {
      const state = get()
      const id = entry.id
      const before = entry.before
      if (!id || !before) break
      set({ objects: state.objects.map(o => o.id === id ? { ...o, parentId: before.parentId ?? null } : o) })
      break
    }
    case 'add': {
      const id = entry.object?.id
      if (!id) break
      const state = get()
      set({ objects: state.objects.filter(o => o.id !== id) })
      break
    }
    case 'remove': {
      const state = get()
      const restored = entry.object
      if (!restored) break
      set({ objects: [...state.objects, normalizeTransformFields(restored)] })
      break
    }
    case 'update':
    case 'transform': {
      const state = get()
      const id = entry.id
      const before = entry.before
      if (!id || !before) break
      set({
        objects: state.objects.map(o => o.id === id ? { ...o, ...normalizeTransformFields(before) } : o)
      })
      break
    }
    default:
      break
  }
}

function applyRedo(entry, set, get) {
  if (!entry) return
  switch (entry.type) {
    case 'part-transform': {
      const state = get()
      const scene = state.scene
      if (!scene) break
      const parts = Array.isArray(entry.parts) && entry.parts.length > 0
        ? entry.parts
        : (entry.part && entry.before && entry.after
            ? [{ uuid: entry.part.uuid, after: entry.after }]
            : []);
      for (const p of parts) {
        const uuid = p.uuid
        const after = p.after || entry.after
        if (!uuid || !after) continue
        let target = null
        scene.traverse((child)=>{ if (!target && child.uuid === uuid) target = child })
        if (target && target.isObject3D) {
          try {
            target.position.set(after.position.x, after.position.y, after.position.z)
            target.rotation.set(after.rotation.x, after.rotation.y, after.rotation.z)
            target.scale.set(after.scale.x, after.scale.y, after.scale.z)
            target.updateMatrix()
            target.updateMatrixWorld(true)
          } catch {}
        }
      }
      break
    }
    case 'batch': {
      for (let i = 0; i < entry.entries.length; i++) {
        applyRedo(entry.entries[i], set, get)
      }
      break
    }
    case 'reparent': {
      const state = get()
      const id = entry.id
      const after = entry.after
      if (!id || !after) break
      set({ objects: state.objects.map(o => o.id === id ? { ...o, parentId: after.parentId ?? null } : o) })
      break
    }
    case 'add': {
      const state = get()
      const added = entry.object
      if (!added) break
      set({ objects: [...state.objects, normalizeTransformFields(added)] })
      break
    }
    case 'remove': {
      const id = entry.object?.id
      if (!id) break
      const state = get()
      set({ objects: state.objects.filter(o => o.id !== id) })
      break
    }
    case 'update':
    case 'transform': {
      const state = get()
      const id = entry.id
      const after = entry.after
      if (!id || !after) break
      set({
        objects: state.objects.map(o => o.id === id ? { ...o, ...normalizeTransformFields(after) } : o)
      })
      break
    }
    default:
      break
  }
}
