import { create } from 'zustand'

console.log('🔥 에디터 스토어 파일 로드됨');

// localStorage에서 HDRI 설정 로드하는 헬퍼 함수
const loadInitialHDRISettings = () => {
  try {
    const savedSettings = localStorage.getItem('hdriSettings')
    if (savedSettings) {
      const settings = JSON.parse(savedSettings)
      console.log('초기 HDRI 설정 로드됨:', settings)
      return settings
    }
  } catch (error) {
    console.error('초기 HDRI 설정 로드 실패:', error)
  }
  return null
}

const initialHDRISettings = loadInitialHDRISettings()

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
  console.log('🔥 에디터 스토어 생성 시작');
  
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
  isWireframe: false,
  isGridSnap: false,
  isGridVisible: true, // 그리드 가시성
  gridSize: 1, // 그리드 크기 (단위: Three.js 유닛)
  
  // Gizmo settings
  gizmoSpace: 'world', // 'world' or 'local'
  isMagnetEnabled: false, // 자석 기능 활성화
  showMagnetRays: false, // 자석 레이 표시

  // HDRI settings - 패널이 닫혀도 유지되는 설정 (localStorage에서 초기값 로드)
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
    ...initialHDRISettings // localStorage에서 로드된 설정으로 덮어쓰기
  },
  
  // HDRI 조명 ref - 씬에서 지속적으로 관리
  sunLightRef: null,

  // Assets
  savedObjects: new Map(),
  // 커스텀 메쉬 목록 (IndexedDB에서 앱 시작 시 로드됨)
  customMeshes: [],
  objects: [],
  walls: [],
  
  // Clipboard for copy/paste functionality
  clipboard: null, // 복사된 객체를 저장하는 클립보드
  
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
  toggleMagnet: () => set((state) => ({ isMagnetEnabled: !state.isMagnetEnabled })),
  toggleMagnetRays: () => set((state) => ({ showMagnetRays: !state.showMagnetRays })),
  
  // HDRI actions
  updateHDRISettings: (updates) => set((state) => ({
    hdriSettings: { ...state.hdriSettings, ...updates }
  })),
  
  setSunLightRef: (ref) => set({ sunLightRef: ref }),
  
  // HDRI 설정 초기화 (localStorage에서 로드)
  initializeHDRISettings: () => {
    try {
      const savedSettings = localStorage.getItem('hdriSettings')
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)
        console.log('스토어에서 HDRI 설정 초기화:', settings)
        set((state) => ({
          hdriSettings: { ...state.hdriSettings, ...settings }
        }))
        return true
      }
    } catch (error) {
      console.error('HDRI 설정 초기화 실패:', error)
    }
    return false
  },
  
  // HDRI 설정 저장 (localStorage에)
  saveHDRISettings: () => {
    const { hdriSettings } = get()
    try {
      localStorage.setItem('hdriSettings', JSON.stringify(hdriSettings))
      console.log('스토어에서 HDRI 설정 저장:', hdriSettings)
    } catch (error) {
      console.error('HDRI 설정 저장 실패:', error)
    }
  },
  
  // Asset actions
  addAsset: (name, url) => set((state) => {
    const newMap = new Map(state.savedObjects)
    newMap.set(name, url)
    return { savedObjects: newMap }
  }),

  addCustomMesh: (meshData) => set((state) => {
    console.log('에디터 스토어: 커스텀 메쉬 추가', meshData.name, '기존 개수:', state.customMeshes.length);
    const newCustomMeshes = [...state.customMeshes, meshData];
    console.log('에디터 스토어: 업데이트 후 개수:', newCustomMeshes.length);
    return { customMeshes: newCustomMeshes };
  }),

  deleteCustomMesh: (meshId) => set((state) => {
    console.log('에디터 스토어: 커스텀 메쉬 삭제', meshId);
    const filteredMeshes = state.customMeshes.filter(mesh => mesh.id !== meshId);
    console.log('에디터 스토어: 삭제 후 개수:', filteredMeshes.length);
    return { customMeshes: filteredMeshes };
  }),

  loadCustomMeshes: (meshes) => set((state) => {
    console.log('에디터 스토어: 커스텀 메쉬 로드', meshes.length, '개');
    return { customMeshes: meshes };
  }),
  
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
      selectedObject: state.selectedObject === objectId ? null : state.selectedObject
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
    console.log('copyObject 함수 호출됨:', object);
    if (!object) {
      console.warn('copyObject: 객체가 null 또는 undefined입니다');
      return;
    }
    
    // Three.js 객체인지 확인
    if (object.isObject3D) {
      console.log('Three.js 객체가 감지됨, 필요한 정보 추출 중...');
      console.log('복사할 객체의 transform:', {
        position: object.position,
        rotation: object.rotation,
        scale: object.scale
      });
      
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
      console.log('업데이트된 objects 배열에서 찾은 객체 정보:', objectData);
      
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
          glbData: objectData.glbData,
          file: objectData.file
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
      console.log('Three.js 객체가 클립보드에 복사되었습니다:', object.name);
      console.log('clipboard 설정됨:', objectCopy);
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
    console.log('객체가 클립보드에 복사되었습니다:', object.name);
  },
  
  pasteObject: () => {
    console.log('pasteObject 함수 호출됨');
    const state = get();
    console.log('현재 클립보드 상태:', state.clipboard);
    
    if (!state.clipboard) {
      // 클립보드가 비어있을 때는 조용히 null 반환 (경고 메시지 제거)
      console.log('클립보드가 비어있음');
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
    
    console.log('새로 생성될 객체:', newObject);
    
    // 새 객체를 씬에 추가
    const updatedObjects = [...state.objects, newObject];
    set({ 
      objects: updatedObjects,
      selectedObject: newObject.id // 새로 생성된 객체 선택
    });
    
    console.log('객체가 붙여넣기되었습니다:', newObject.name);
    return newObject;
  },
  
  // 클립보드 상태 확인 헬퍼 함수
  hasClipboardData: () => {
    const state = get();
    console.log('hasClipboardData 호출됨, clipboard:', state.clipboard);
    const result = state.clipboard !== null;
    console.log('hasClipboardData 결과:', result);
    return result;
  },
  
  // 클립보드 비우기 함수
  clearClipboard: () => {
    set({ clipboard: null });
    console.log('클립보드가 비워졌습니다.');
  },
  
  deleteSelectedObject: () => {
    console.log('deleteSelectedObject 함수 호출됨');
    const state = get();
    console.log('현재 선택된 객체 ID:', state.selectedObject);
    console.log('현재 객체 목록:', state.objects);
    
    if (!state.selectedObject) {
      console.warn('선택된 객체가 없습니다.');
      return;
    }
    
    // 선택된 객체 찾기
    const objectToDelete = state.objects.find(obj => obj.id === state.selectedObject);
    console.log('삭제할 객체:', objectToDelete);
    
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
  const updatedObjects = state.objects.filter(obj => obj.id !== state.selectedObject);
  // 히스토리 기록
  const entry = { type: 'remove', object: safeCloneForHistory(objectToDelete) }
  const { _pushHistory } = get();
  _pushHistory(entry)
    console.log('삭제 후 객체 목록:', updatedObjects);
    
    set({ 
      objects: updatedObjects,
      selectedObject: null // 선택 해제
    });
    
    console.log('객체가 삭제되었습니다:', objectToDelete.name);
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
  
  saveMap: (name) => {
    const state = get()
    const mapData = {
  walls: state.walls,
  objects: state.objects
    }
    localStorage.setItem(`map_${name}`, JSON.stringify(mapData))
  },
  
  loadMap: (name) => {
    const mapDataString = localStorage.getItem(`map_${name}`)
    if (mapDataString) {
      const mapData = JSON.parse(mapDataString)
      
      // 로드 시 변환 필드 정규화 적용
      const normalizedObjects = (mapData.objects || []).map(o => {
        const n = normalizeTransformFields(o)
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
      
      return true
    }
    return false
  },
  
  clearMap: () => set((state) => ({
    objects: state.objects.filter(obj => obj.isSystemObject), // 시스템 객체는 유지
    walls: [],
    selectedObject: null
  })),
  
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
