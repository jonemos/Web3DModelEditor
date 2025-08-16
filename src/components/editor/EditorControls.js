import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { CameraController } from './CameraController.js';
import { ObjectSelector } from './ObjectSelector.js';
import { TransformManager } from './TransformManager.js';
import { InputManager } from './InputManager.js';
import { KeyboardController } from './KeyboardController.js';
import { MouseController } from './MouseController.js';

export class EditorControls {
  constructor(scene, camera, renderer, editorStore, onCameraChange = null) {
    this.scene = scene;
    this.renderer = renderer;
    this.editorStore = editorStore;
  this.gizmoScene = null; // gizmo 전용 씬
    
    // 입력 관리 시스템 초기화
    this.inputManager = new InputManager();
    this.keyboardController = new KeyboardController(this.inputManager);
    this.mouseController = new MouseController(this.inputManager);
    
    // 모듈 초기화
    this.cameraController = new CameraController(camera, renderer, onCameraChange);
    this.objectSelector = new ObjectSelector(scene, camera, renderer, editorStore);
  this.objectSelector.setGizmoScene?.(null);
    
    // MouseController에 ObjectSelector 설정 (기즈모 상호작용 감지용)
    this.mouseController.setObjectSelector(this.objectSelector);
    
    // Transform Manager 초기화 (KeyboardController와 연동)
    this.transformManager = new TransformManager(this.objectSelector, editorStore, this.keyboardController);
    
    // 그리드 헬퍼 초기화
    this.initializeGrid();
    
    // 마우스 이벤트 설정
    this.inputManager.setupMouseEvents(renderer.domElement);
    
    // 리사이즈 핸들러 등록
    this.inputManager.registerResizeHandler(this.onWindowResize.bind(this));
    
    // 마우스 핸들러 등록
    this.setupMouseHandlers();
    
    // 뷰포트 제어 키보드 액션 등록
    this.setupViewportActions();
    
    // 컨트롤 상태 (호환성을 위해 유지)
    this.isMouseDown = false;
    this.isPanning = false;
    this.isOrbiting = false;
    this.isDragSelecting = false;
    this.mousePosition = new THREE.Vector2();
    this.previousMousePosition = new THREE.Vector2();
    this.dragStartPosition = new THREE.Vector2();
    
    console.log('EditorControls initialized with separated input system');

    // Part Inspection state
    this.partInspector = {
      enabled: false,
    selectedPart: null,
    selectedParts: new Set(),
      solo: false,
      clipping: false,
      savedVisibility: new Map(),
    clippingPlanes: [],
    group: null,
    groupPivot: 'center', // 'center'|'first'|'last'
    groupEnabled: false
    };
    this._partRaycaster = new THREE.Raycaster();

  // Part TransformControls (서브메시 전용 기즈모)
  this._partTransformControls = null;
  this._initPartTransformControls(camera, renderer);
  }
  
  /**
   * 마우스 핸들러 설정
   */
  setupMouseHandlers() {
    // 왼쪽 클릭: 오브젝트 선택
    this.mouseController.onLeftClick((data) => {
      const { position, isMultiSelect } = data;
      this.updateMousePosition(position);
      
      // 기즈모 클릭 체크
      if (this.objectSelector.isDraggingGizmo()) {
        return;
      }
      
      // 파트 인스펙션 모드: 서브메시 직접 선택 (상위로 승격하지 않음)
      if (this.partInspector.enabled) {
        const hit = this.raycastMeshAtNDC(this.mousePosition);
        if (isMultiSelect) {
          if (hit?.object?.isMesh) {
            if (this.partInspector.selectedParts.has(hit.object)) {
              this.partInspector.selectedParts.delete(hit.object);
            } else {
              this.partInspector.selectedParts.add(hit.object);
              this.partInspector.selectedPart = hit.object; // 기준 파트 업데이트
            }
            this._updatePartOutline();
          }
        } else {
          this.selectPart(hit?.object || null, hit?.point || null);
        }
        return;
      }

      // 오브젝트 선택 처리
      this.objectSelector.handleObjectSelection(this.mousePosition, isMultiSelect);
    });

    // 중간 클릭: 팬/궤도 회전
    this.mouseController.onMiddleClick((data) => {
      const { isOrbiting, isPanning } = data;
      this.isOrbiting = isOrbiting;
      this.isPanning = isPanning;
    });

    // 중간 드래그: 카메라 제어
    this.mouseController.onMiddleDrag((data) => {
      const { type, delta } = data;
      
      if (type === 'pan') {
        this.cameraController.pan(delta.x, delta.y);
      } else if (type === 'orbit') {
        this.cameraController.orbit(delta.x, delta.y);
      }
    });

    // 드래그 선택
  this.mouseController.onDragSelect((data) => {
      const { left, top, width, height } = data;
      this.objectSelector.showSelectionBox(left, top, width, height);
    });

    // 드래그 선택 완료
    this.mouseController.onDragSelectEnd((data) => {
      const { startX, startY, endX, endY, isMultiSelect } = data;
      // 파트 모드인 경우: 서브메시 박스 선택
      if (this.partInspector.enabled) {
        this.selectPartsInRect(startX, startY, endX, endY, isMultiSelect);
        return;
      }
      this.finishDragSelection(startX, startY, endX, endY, isMultiSelect);
    });

    // 휠: 줌
    this.mouseController.onWheel((wheelInfo) => {
      if (this.objectSelector.isDraggingGizmo()) return;
      
      const zoomSpeed = 0.3;
      const direction = wheelInfo.delta > 0 ? 1 : -1;
      this.cameraController.zoom(direction * zoomSpeed);
    });

    // 드래그 종료: 회전 중심 업데이트
    this.mouseController.onDragEnd((data) => {
      if (data.type === 'pan') {
        this.cameraController.updateRotationCenterAfterPan(this.scene, this.objectSelector.getSelectableObjects());
      }
      
      // 상태 리셋
      this.isMouseDown = false;
      this.isPanning = false;
      this.isOrbiting = false;
      this.isDragSelecting = false;
      this.objectSelector.hideSelectionBox();
    });
  }

  // =====================
  // Part Gizmo (TransformControls)
  // =====================
  _initPartTransformControls(camera, renderer) {
    try {
      this._partTransformControls = new TransformControls(camera, renderer.domElement);
      this._partTransformControls.visible = false;
      this._partTransformControls.enabled = false;
      this._partTransformControls.setSize(0.9);
      // TransformControls 자체는 Object3D가 아니므로, 헬퍼(Object3D)를 씬에 추가해야 함
      try {
        const helper = this._partTransformControls.getHelper?.();
        if (helper && helper.isObject3D) {
          const hideHelper = () => {
            try {
              const helperGroup = helper.children?.find?.((c) => c.name === 'helper');
              if (helperGroup) helperGroup.visible = false;
              // 라인류 객체 영구 제거
              const toRemove = [];
              helper.traverse?.((n) => {
                const isLineType = n.type === 'Line' || n.type === 'Line2' || n.type === 'LineSegments' || n.type === 'LineSegments2' || n.isLine;
                const isLineMat = n.material && (n.material.isLineBasicMaterial || n.material.isLineDashedMaterial);
                if (isLineType || isLineMat) toRemove.push(n);
              });
              toRemove.forEach((n) => {
                try {
                  if (n.parent) n.parent.remove(n);
                  if (n.geometry?.dispose) n.geometry.dispose();
                  const mat = n.material;
                  if (Array.isArray(mat)) mat.forEach(m => m?.dispose && m.dispose()); else if (mat?.dispose) mat.dispose();
                } catch {}
              });
            } catch {}
          };
          hideHelper();
          helper.onBeforeRender = () => { try { hideHelper(); } catch {} };
          helper.renderOrder = 999;
          const targetScene = this.gizmoScene || this.scene;
          targetScene.add(helper);
          this._partTransformControls.addEventListener('change', hideHelper);
          this._partTransformControls.addEventListener('dragging-changed', hideHelper);
          this._partTransformControls.addEventListener('mouseDown', hideHelper);
          this._partTransformControls.addEventListener('mouseUp', hideHelper);
          this._partTransformControls.addEventListener('objectChange', hideHelper);
        }
      } catch {}
      // 파트 기즈모 드래그 상태에 따라 히스토리 기록용 before/after 저장
      this._partGizmoInitial = null;
      this._partTransformControls.addEventListener('dragging-changed', (e) => {
        const dragging = e.value;
        const parts = this.getActivePartSet();
        if (parts.length === 0) return;
        if (dragging) {
          // 시작 스냅샷
          this._partGizmoInitial = parts.map(m => ({
            uuid: m.uuid,
            position: m.position.clone(),
            rotation: m.rotation.clone(),
            scale: m.scale.clone(),
            parentId: m.parent?.userData?.id ?? null
          }));
        } else {
          if (!this._partGizmoInitial) return;
          // 종료 스냅샷 및 히스토리
          const afterParts = parts.map(m => ({
            uuid: m.uuid,
            parentId: m.parent?.userData?.id ?? null,
            after: {
              position: { x: m.position.x, y: m.position.y, z: m.position.z },
              rotation: { x: m.rotation.x, y: m.rotation.y, z: m.rotation.z },
              scale: { x: m.scale.x, y: m.scale.y, z: m.scale.z }
            }
          }));
          const beforeMap = new Map(this._partGizmoInitial.map(b => [b.uuid, b]));
          const partsEntries = [];
          for (const ap of afterParts) {
            const b = beforeMap.get(ap.uuid);
            if (!b) continue;
            const before = {
              position: { x: b.position.x, y: b.position.y, z: b.position.z },
              rotation: { x: b.rotation.x, y: b.rotation.y, z: b.rotation.z },
              scale: { x: b.scale.x, y: b.scale.y, z: b.scale.z }
            };
            const a = ap.after;
            const changed = (
              before.position.x !== a.position.x || before.position.y !== a.position.y || before.position.z !== a.position.z ||
              before.rotation.x !== a.rotation.x || before.rotation.y !== a.rotation.y || before.rotation.z !== a.rotation.z ||
              before.scale.x !== a.scale.x || before.scale.y !== a.scale.y || before.scale.z !== a.scale.z
            );
            if (changed) partsEntries.push({ uuid: ap.uuid, parentId: ap.parentId, before, after: a });
          }
          if (partsEntries.length > 0) {
            try {
              const api = this.editorStore?.getState?.();
              api?._pushHistory && api._pushHistory({ type: 'part-transform', parts: partsEntries });
            } catch {}
          }
          this._partGizmoInitial = null;
        }
      });
  // 주: controls 인스턴스 자체를 씬에 add하지 않습니다.
    } catch (e) {
      console.error('Failed to initialize part TransformControls', e);
      this._partTransformControls = null;
    }
  }

  isPartGizmoEnabled() {
    return !!this.partInspector?.gizmo;
  }

  setPartGizmoEnabled(enabled) {
  const mesh = this.partInspector.selectedPart;
    if (!this._partTransformControls) return false;
    if (!enabled) {
      this.partInspector.gizmo = false;
      try { this._partTransformControls.detach(); } catch {}
      this._partTransformControls.visible = false;
      this._partTransformControls.enabled = false;
  // 객체 기즈모는 사용자가 직접 재활성화하도록 유지
      return true;
    }
    if (!mesh && !this.partInspector.groupEnabled) return false;
    // ObjectSelector 기즈모는 숨김/분리 (동시 표시는 혼란 야기)
    try { this.objectSelector?.transformControls?.detach?.(); } catch {}
    // 그룹 기즈모 사용 여부
    if (this.partInspector.groupEnabled) {
      this._ensurePartGroup();
      if (this.partInspector.group) this._partTransformControls.attach(this.partInspector.group);
    } else {
      this._partTransformControls.attach(mesh);
    }
    // 현재 Transform 모드/좌표계와 동기화(가능한 경우)
    try {
      const currentMode = this.transformManager?.getState?.().mode || this.objectSelector?.transformControls?.getMode?.() || 'translate';
      const currentSpace = this.editorStore?.getState?.().gizmoSpace || 'world';
      this._partTransformControls.setMode(currentMode);
      this._partTransformControls.setSpace(currentSpace);
    } catch {}
    this._partTransformControls.visible = true;
    this._partTransformControls.enabled = true;
    this.partInspector.gizmo = true;
    return true;
  }

  setPartGizmoMode(mode) {
    if (!this._partTransformControls) return false;
    if (!['translate', 'rotate', 'scale'].includes(mode)) return false;
    this._partTransformControls.setMode(mode);
    return true;
  }

  detachPartGizmo() {
    if (!this._partTransformControls) return;
    try { this._partTransformControls.detach(); } catch {}
    this._partTransformControls.visible = false;
    this._partTransformControls.enabled = false;
    this.partInspector.gizmo = false;
  }

  // =====================
  // PostProcessing (Outline) 연동
  // =====================
  setPostProcessingManager(manager) {
    this.postProcessingManager = manager;
  try { this.objectSelector?.setPostProcessingManager?.(manager); } catch {}
  }

  _updatePartOutline() {
    if (!this.postProcessingManager) return;
    // Outline 효과 활성화
    try { this.postProcessingManager.setEffectEnabled('outline', true); } catch {}
    const mesh = this.partInspector?.selectedPart;
    let list = [];
    if (this.partInspector.groupEnabled) {
      list = this.getActivePartSet();
    } else if (mesh) {
      list = [mesh];
    }
    try { this.postProcessingManager.setOutlineSelectedObjects(list); } catch {}
  }

  /**
   * 뷰포트 제어 액션 등록
   */
  setupViewportActions() {
    this.keyboardController.registerViewportActions({
      focusOnSelected: () => {
        const selected = this.editorStore.getState().selectedObject;
        // selected가 ID이거나 객체일 수 있음 → Three.js 객체로 해석
        const threeObject = this.resolveToThreeObject(selected);
        if (threeObject) {
          this.cameraController.focusOnObject(threeObject);
        }
      },
      toggleProjection: () => {
        const newCamera = this.cameraController.toggleProjection();
        this.objectSelector.updateCamera(newCamera);
        return newCamera;
      },
      setView: (viewType) => {
        this.cameraController.setView(viewType);
      },
      resetCamera: () => {
        this.cameraController.resetCamera();
      }
    });
  }

  /**
   * 마우스 위치 업데이트 (호환성을 위해 유지)
   */
  updateMousePosition(position) {
    if (position.x !== undefined && position.y !== undefined) {
      this.mousePosition.x = position.x;
      this.mousePosition.y = position.y;
    }
  }

  /**
   * 드래그 선택 완료 처리
   */
  finishDragSelection(startX, startY, endX, endY, isMultiSelect) {
    // 화면 좌표를 정규화된 좌표로 변환
    const rect = this.renderer.domElement.getBoundingClientRect();
    
    const normalizedStart = {
      x: ((startX - rect.left) / rect.width) * 2 - 1,
      y: -((startY - rect.top) / rect.height) * 2 + 1
    };
    
    const normalizedEnd = {
      x: ((endX - rect.left) / rect.width) * 2 - 1,
      y: -((endY - rect.top) / rect.height) * 2 + 1
    };

    // 드래그 선택 영역 내의 오브젝트들 찾기
    const selectedInArea = this.objectSelector.getObjectsInArea(normalizedStart, normalizedEnd);
    
    if (selectedInArea.length > 0) {
      this.objectSelector.selectMultipleObjects(selectedInArea, isMultiSelect);
    } else if (!isMultiSelect) {
      // 빈 영역을 드래그했고 Ctrl을 안눌렀으면 모든 선택 해제
      this.objectSelector.deselectAllObjects();
    }

    this.objectSelector.hideSelectionBox();
  }
  
  // 카메라 접근자(호환성을 위해 유지)
  get camera() {
    return this.cameraController.getCamera();
  }
  
  set camera(newCamera) {
    // 이 setter는 호환성을 위해서 직접 카메라를 설정하지 않도록
    this.cameraController.camera = newCamera;
    this.objectSelector.updateCamera(newCamera);
  }

  /**
   * 윈도우 리사이즈 처리 (InputManager가 호출)
   */
  onWindowResize() {
    this.cameraController.handleResize();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  
  // 공개 API - 오브젝트 선택 관련
  addSelectableObject(object) {
    this.objectSelector.addSelectableObject(object);
  }
  
  removeSelectableObject(object) {
    this.objectSelector.removeSelectableObject(object);
  }
  
  updateSelectableObjects(objects) {
    this.objectSelector.updateSelectableObjects(objects);
  }
  
  getSelectedObjects() {
    return this.objectSelector.getSelectedObjects();
  }

  getSelectableObjects() {
    return this.objectSelector.getSelectableObjects();
  }

  selectObject(object) {
    this.objectSelector.selectSingleObject(object);
  }
  
  // ID로 오브젝트를 찾는 메서드
  findObjectById(id) {
    // 씬에서 해당 ID를 가진 오브젝트 찾기
    let foundObject = null;
    this.scene.traverse((child) => {
      if (child.userData && child.userData.id === id) {
        foundObject = child;
      }
    });
    return foundObject;
  }
  
  deselectAllObjects() {
    this.objectSelector.deselectAllObjects();
  }
  
  setGizmoMode(mode) {
    this.objectSelector.setGizmoMode(mode);
  }
  
  // Transform Manager 관련 공개 API
  getTransformState() {
    return this.transformManager.getState();
  }
  
  setTransformMode(mode) {
    return this.transformManager.setTransformMode(mode);
  }
  
  toggleTransformSpace() {
    return this.transformManager.toggleSpace();
  }
  
  toggleGridSnap() {
    return this.transformManager.toggleGridSnap();
  }
  
  setGridSize(size) {
    return this.transformManager.setGridSize(size);
  }
  
  
  duplicateSelectedObjects() {
    return this.transformManager.duplicateSelected();
  }
  
  deleteSelectedObjects() {
    return this.transformManager.deleteSelected();
  }
  
  groupSelectedObjects() {
    return this.transformManager.groupSelected();
  }
  
  ungroupSelectedObjects() {
    return this.transformManager.ungroupSelected();
  }
  
  // 공개 API - 카메라 관련
  focusOnObject(objectOrId) {
    const threeObject = this.resolveToThreeObject(objectOrId);
    if (threeObject) {
      this.cameraController.focusOnObject(threeObject);
    }
  }
  
  // 선택된 오브젝트들의 아웃라인 업데이트 (애니메이션용)
  updateSelectedOutlines() {
    this.objectSelector.updateAllSelectionOutlines();
  }
  
  setCameraView(viewType) {
    this.cameraController.setView(viewType);
  }
  
  toggleCameraProjection() {
    const newCamera = this.cameraController.toggleProjection();
    this.objectSelector.updateCamera(newCamera);
    return newCamera;
  }
  
  getCameraTarget() {
    return this.cameraController.getTarget();
  }
  
  setCameraTarget(target) {
    this.cameraController.setTarget(target);
  }

  resetCamera() {
    this.cameraController.resetCamera();
  }

  // 하환성을 위한 속성들
  get transformControls() {
    return this.objectSelector.getTransformControls();
  }
  
  get selectedObjects() {
    return this.objectSelector.getSelectedObjects();
  }
  
  get isDragging() {
    return this.objectSelector.isDraggingGizmo();
  }
  
  // 정리
  dispose() {
    // 입력 관리 시스템 정리
    this.inputManager.dispose();
    this.keyboardController.dispose();
    this.mouseController.dispose();
    
    // 모듈 정리
    this.objectSelector.dispose();
    this.transformManager.dispose();
    
    // 그리드 헬퍼 정리
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.dispose();
      this.gridHelper = null;
    }
    
    console.log('EditorControls disposed');
  }

  // 내부 유틸: 입력을 Three.js Object3D로 해석
  resolveToThreeObject(input) {
    if (!input) return null;
    // 이미 Object3D인 경우
    if (input.isObject3D) return input;
    // store에 id 또는 객체가 들어올 수 있음
    const tryId = typeof input === 'object' ? (input.id ?? input.userData?.id ?? input) : input;
    return this.findObjectById(tryId);
  }
  
  // 그리드 스냅 업데이트
  updateGridSnap() {
    this.objectSelector.updateGridSnap();
  }
  
  // 와이어프레임 모드 업데이트
  updateWireframe() {
    const editorState = this.editorStore.getState();
    if (editorState.scene) {
      editorState.scene.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.wireframe = editorState.isWireframe;
            });
          } else {
            child.material.wireframe = editorState.isWireframe;
          }
        }
      });
    }
  }

  // 기즈모 좌표계 업데이트
  updateGizmoSpace() {
    this.objectSelector.updateGizmoSpace();
  }

  // 자석 기능 제거됨

  // 그리드 헬퍼 초기화
  initializeGrid() {
    const size = 20; // 그리드 크기
    const divisions = 20; // 그리드 분할 수
    
    console.log('Initializing grid helper...');
    
    // 더 밝은 색상으로 그리드 생성
    this.gridHelper = new THREE.GridHelper(size, divisions, 0x888888, 0x444444);
    this.gridHelper.name = 'EditorGrid';
    this.gridHelper.position.y = 0; // 정확히 바닥(y=0)에 위치
    
    // 그리드 머티리얼 설정 개선
    this.gridHelper.material.opacity = 0.8;
    this.gridHelper.material.transparent = true;
    this.gridHelper.material.depthWrite = false; // 깊이 쓰기 비활성화로 Z-fighting 방지
    
    // 스토어에서 초기 그리드 가시성 상태 가져오기
    const currentState = this.editorStore.getState();
    const isGridVisible = currentState.isGridVisible;
    this.gridHelper.visible = isGridVisible;
    this.scene.add(this.gridHelper);
    
    console.log('Grid helper initialized:', {
      size,
      divisions,
      visible: this.gridHelper.visible,
      position: this.gridHelper.position,
      name: this.gridHelper.name,
      material: {
        opacity: this.gridHelper.material.opacity,
        transparent: this.gridHelper.material.transparent,
        depthWrite: this.gridHelper.material.depthWrite
      }
    });
    console.log('Grid helper added to scene. Scene children count:', this.scene.children.length);
  }

  // 그리드 표시/숨기기 토글
  toggleGrid() {
    console.log('toggleGrid called, gridHelper:', this.gridHelper);
    
    if (!this.gridHelper) {
      console.error('Grid helper not initialized!');
      return false;
    }
    
    // 스토어에서 현재 상태 가져오기
    const currentState = this.editorStore.getState();
    const isGridVisible = currentState.isGridVisible;
    
    // 그리드 헬퍼의 가시성 설정
    this.gridHelper.visible = isGridVisible;
    
    // 강제로 씬 업데이트
    this.gridHelper.updateMatrixWorld(true);
    
    console.log(`Grid ${isGridVisible ? 'shown' : 'hidden'}`);
    console.log('Grid helper visible property:', this.gridHelper.visible);
    console.log('Grid helper in scene:', this.scene.children.includes(this.gridHelper));
    
    return isGridVisible;
  }

  // 그리드 표시 상태 확인
  isGridShown() {
    const currentState = this.editorStore.getState();
    return currentState.isGridVisible;
  }

  // 그리드 크기 설정
  setGridSize(size, divisions = 20) {
    if (!this.gridHelper) return;
    
    // 기존 그리드 제거
    this.scene.remove(this.gridHelper);
    this.gridHelper.dispose();
    
    // 스토어에서 현재 그리드 가시성 상태 가져오기
    const currentState = this.editorStore.getState();
    const isGridVisible = currentState.isGridVisible;
    
    // 새 그리드 생성 (더 밝은 색상과 개선된 설정으로)
    this.gridHelper = new THREE.GridHelper(size, divisions, 0x888888, 0x444444);
    this.gridHelper.name = 'EditorGrid';
    this.gridHelper.position.y = 0; // 정확히 바닥(y=0)에 위치
    this.gridHelper.visible = isGridVisible;
    
    // 머티리얼 설정 개선
    this.gridHelper.material.opacity = 0.8;
    this.gridHelper.material.transparent = true;
    this.gridHelper.material.depthWrite = false;
    
    this.scene.add(this.gridHelper);
    console.log(`Grid size updated: ${size}x${size}, divisions: ${divisions}`);
  }

  // =====================
  // Part Inspection APIs
  // =====================
  enablePartInspect(enabled) {
    if (enabled === this.partInspector.enabled) return;
    this.partInspector.enabled = !!enabled;
    if (!enabled) {
      // 모드 종료 시 강조/선택 및 솔로/클리핑 해제
      this.clearPartSelection();
      this.setPartSolo(false);
      this.setPartClipping(false);
  this.detachPartGizmo();
    }
  }

  getSelectedPart() {
    return this.partInspector.selectedPart;
  }

  getSelectedPartInfo() {
    const mesh = this.partInspector.selectedPart;
    if (!mesh || !mesh.isMesh || !mesh.geometry) return null;
    const geom = mesh.geometry;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

    // 보정: 바운딩 박스/스피어 계산
    if (!geom.boundingBox) geom.computeBoundingBox();
    if (!geom.boundingSphere) geom.computeBoundingSphere();

    const pos = geom.attributes?.position;
    const idx = geom.index;
    const uv = geom.attributes?.uv;
    const uv2 = geom.attributes?.uv2;

    // 월드 기준 바운딩
    const worldBox = new THREE.Box3().setFromObject(mesh);
    const size = worldBox.getSize(new THREE.Vector3());
    const center = worldBox.getCenter(new THREE.Vector3());

    const triCount = idx ? Math.floor(idx.count / 3) : (pos ? Math.floor(pos.count / 3) : 0);
    const vertCount = pos ? pos.count : 0;

    return {
      name: mesh.name || '(unnamed mesh)',
      uuid: mesh.uuid,
      drawMode: mesh.drawMode,
      geometry: {
        type: geom.type,
        hasIndex: !!idx,
        attributes: Object.keys(geom.attributes || {}),
        vertices: vertCount,
        triangles: triCount,
        bbox: {
          min: geom.boundingBox?.min?.toArray?.() || null,
          max: geom.boundingBox?.max?.toArray?.() || null
        },
        world: {
          size: size.toArray(),
          center: center.toArray()
        },
        uv: uv ? { count: uv.count, itemSize: uv.itemSize } : null,
        uv2: uv2 ? { count: uv2.count, itemSize: uv2.itemSize } : null
      },
      material: mat ? {
        type: mat.type,
        name: mat.name,
        color: mat.color ? `#${mat.color.getHexString()}` : null,
        opacity: mat.opacity ?? 1,
        transparent: !!mat.transparent,
        metalness: mat.metalness ?? null,
        roughness: mat.roughness ?? null,
        maps: {
          map: !!mat.map,
          normalMap: !!mat.normalMap,
          aoMap: !!mat.aoMap,
          roughnessMap: !!mat.roughnessMap,
          metalnessMap: !!mat.metalnessMap,
          emissiveMap: !!mat.emissiveMap,
          alphaMap: !!mat.alphaMap
        }
      } : null
    };
  }

  raycastMeshAtNDC(ndc) {
    const cam = this.cameraController.getCamera();
    this._partRaycaster.setFromCamera(ndc, cam);
    // 전체 씬에서 메쉬만 교차 검사
    const hits = [];
    this.scene.traverse((child) => {
      if (child.isMesh && child.visible) hits.push(child);
    });
    const intersects = this._partRaycaster.intersectObjects(hits, true);
    if (!intersects || intersects.length === 0) return null;
    // TransformControls gizmo 등은 제외 (isRayHelper/userData 플래그 사용)
    const hit = intersects.find(i => i.object?.isMesh && !i.object.userData?.isRayHelper);
    return hit || intersects[0];
  }

  selectPartsInRect(startX, startY, endX, endY, isMultiSelect) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const minX = Math.min(startX, endX);
    const minY = Math.min(startY, endY);
    const maxX = Math.max(startX, endX);
    const maxY = Math.max(startY, endY);
    const cam = this.cameraController.getCamera();
    const ray = new THREE.Raycaster();
    const candidates = [];
    this.scene.traverse((c)=>{ if (c.isMesh && c.visible) candidates.push(c); });
    // 샘플링 기반: 그리드 샘플로 사각형 내부 픽킹(간단/성능 절충)
    const cols = 6, rows = 6;
    const hitSet = new Set();
    for (let i=0;i<cols;i++) {
      for (let j=0;j<rows;j++) {
        const sx = minX + ((i+0.5)/cols) * (maxX-minX);
        const sy = minY + ((j+0.5)/rows) * (maxY-minY);
        const ndc = new THREE.Vector2(
          ((sx - rect.left) / rect.width) * 2 - 1,
          -((sy - rect.top) / rect.height) * 2 + 1
        );
        ray.setFromCamera(ndc, cam);
        const hits = ray.intersectObjects(candidates, true);
        if (hits && hits.length) {
          const m = hits[0].object;
          if (m?.isMesh) hitSet.add(m);
        }
      }
    }
    if (!isMultiSelect) this.partInspector.selectedParts.clear();
    hitSet.forEach(m => this.partInspector.selectedParts.add(m));
    // 한 개라도 있으면 기준 파트 갱신
    this.partInspector.selectedPart = (this.partInspector.selectedParts.values().next().value) || null;
    this._updatePartOutline();
  }

  selectPart(mesh, point = null) {
    // 기존 강조 복원
    this._restorePartHighlight();
    this.partInspector.selectedPart = (mesh && mesh.isMesh) ? mesh : null;
    if (this.partInspector.selectedPart) {
      this.partInspector.selectedParts.add(this.partInspector.selectedPart);
    }

    // 새 강조 적용 (가능한 경우 emissive 이용)
    if (this.partInspector.selectedPart) {
      const m = this.partInspector.selectedPart.material;
      const targetMat = Array.isArray(m) ? m[0] : m;
      if (targetMat && 'emissive' in targetMat) {
        if (!targetMat.userData) targetMat.userData = {};
        targetMat.userData._origEmissive = targetMat.emissive.clone();
        targetMat.userData._origEmissiveIntensity = targetMat.emissiveIntensity ?? 1;
        targetMat.emissive = new THREE.Color(0x00ffff);
        targetMat.emissiveIntensity = 0.6;
        targetMat.needsUpdate = true;
      }
      // 선택 변경 시 클리핑이 켜져있다면 새 기준으로 갱신
      if (this.partInspector.clipping) {
        this.setPartClipping(true);
      }
      // 솔로 모드도 갱신
      if (this.partInspector.solo) {
        this.setPartSolo(true);
      }
      // 파트 기즈모가 켜져 있으면 새 파트에 즉시 부착
      if (this.partInspector.gizmo) {
        this.setPartGizmoEnabled(true);
      }
    } else {
      // 선택 없음 → 솔로/클리핑도 해제
      this.setPartSolo(false);
      this.setPartClipping(false);
      this.detachPartGizmo();
      this.partInspector.selectedParts.clear();
    }
    // Outline 업데이트
    this._updatePartOutline();
  }

  clearPartSelection() {
    this._restorePartHighlight();
    this.partInspector.selectedPart = null;
  this.partInspector.selectedParts.clear();
  }

  _restorePartHighlight() {
    const mesh = this.partInspector.selectedPart;
    if (!mesh) return;
    const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (m && m.userData && m.userData._origEmissive) {
      m.emissive.copy(m.userData._origEmissive);
      m.emissiveIntensity = m.userData._origEmissiveIntensity ?? 1;
      delete m.userData._origEmissive;
      delete m.userData._origEmissiveIntensity;
      m.needsUpdate = true;
    }
  }

  // ===== 멀티 파트 유틸/그룹 기즈모 =====
  getActivePartSet() {
    if (this.partInspector.groupEnabled && this.partInspector.selectedParts.size > 0) {
      return Array.from(this.partInspector.selectedParts);
    }
    return this.partInspector.selectedPart ? [this.partInspector.selectedPart] : [];
  }

  selectAllChildParts() {
    const base = this.partInspector.selectedPart;
    if (!base) return 0;
    const set = this.partInspector.selectedParts;
    const added = [];
    const root = base.parent || base;
    root.traverse((child) => {
      if (child.isMesh) { set.add(child); added.push(child); }
    });
    // 아웃라인 갱신
    this._updatePartOutline();
    return added.length;
  }

  clearAllPartSelections() {
    this.partInspector.selectedParts.clear();
    this._updatePartOutline();
  }

  isPartGroupGizmoEnabled() { return !!this.partInspector.groupEnabled; }
  setPartGroupGizmoEnabled(enabled) {
    this.partInspector.groupEnabled = !!enabled;
    if (!enabled) {
      this._detachPartGroup();
      if (this.partInspector.selectedPart) this.setPartGizmoEnabled(true);
    } else {
      this._ensurePartGroup();
      this.setPartGizmoEnabled(true);
    }
    this._updatePartOutline();
  }

  getPartGroupPivot() { return this.partInspector.groupPivot; }
  setPartGroupPivot(mode) {
    if (!['center','first','last'].includes(mode)) return;
    this.partInspector.groupPivot = mode;
    if (this.partInspector.groupEnabled) this._ensurePartGroup(true);
  }

  _ensurePartGroup(recenter = false) {
    const parts = this.getActivePartSet();
    if (parts.length === 0) return;
    // 그룹 생성/갱신
    if (!this.partInspector.group) {
      this.partInspector.group = new THREE.Group();
      this.partInspector.group.name = 'PartGroupPivot';
      this.partInspector.group.userData.isSystemObject = true;
      this.scene.add(this.partInspector.group);
    }
    const g = this.partInspector.group;
    // 피벗 위치 계산
    let pivot = new THREE.Vector3();
    if (this.partInspector.groupPivot === 'first') {
      pivot.copy(parts[0].getWorldPosition(new THREE.Vector3()));
    } else if (this.partInspector.groupPivot === 'last') {
      pivot.copy(parts[parts.length-1].getWorldPosition(new THREE.Vector3()));
    } else {
      // center of selection bounds
      const box = new THREE.Box3();
      for (const m of parts) box.expandByObject(m);
      box.getCenter(pivot);
    }
    // 그룹을 피벗 위치로 이동
    g.position.copy(pivot);
    // 그룹에 파트들을 부모 유지한 채로 기즈모만 그룹에 붙이기 위해
    // TransformControls는 대상 Object의 transform을 직접 변경함 → 그룹에 attach 시 그룹의 transform이 변경
    // 여기서는 그룹을 기즈모 타겟으로만 사용하고, 드래그 시 파트들에 델타를 분배하는 접근이 이상적이지만
    // 간단화를 위해 그룹 위치만 피벗으로 두고, 실제 드래그로 인한 변경은 파트 자체에서 발생(Three의 기본 동작)하게 둡니다.
  }

  _detachPartGroup() {
    if (this.partInspector.group) {
      try { this._partTransformControls?.detach?.(); } catch {}
      try { this.scene.remove(this.partInspector.group); } catch {}
      this.partInspector.group = null;
    }
  }

  setPartSolo(enabled) {
    const state = this.partInspector;
    if (!enabled) {
      // 복원
      state.savedVisibility.forEach((visible, obj) => { obj.visible = visible; });
      state.savedVisibility.clear();
      state.solo = false;
      return;
    }
    const target = state.selectedPart;
    if (!target) return;
    // 현재 가시성 저장 후 target만 보이도록 설정
    state.savedVisibility.clear();
    this.scene.traverse((child) => {
      if (!child.isObject3D) return;
      if (child.userData?.isSystemObject || child === this.gridHelper) return; // 시스템 오브젝트 제외
      state.savedVisibility.set(child, child.visible);
      child.visible = (child === target) || child.isBone || this._isAncestorOf(child, target) || this._isAncestorOf(target, child);
    });
    state.solo = true;
  }

  _isAncestorOf(a, b) {
    // a 가 b의 조상인가
    let cur = b?.parent;
    while (cur) { if (cur === a) return true; cur = cur.parent; }
    return false;
  }

  setPartClipping(enabled, padding = 0.01) {
    const r = this.renderer;
    const state = this.partInspector;
    if (!enabled) {
      r.clippingPlanes = [];
      r.localClippingEnabled = false;
      state.clippingPlanes = [];
      state.clipping = false;
      return;
    }
    const mesh = state.selectedPart;
    if (!mesh) return;
    const box = new THREE.Box3().setFromObject(mesh);
    // 패딩 적용
    box.expandByScalar(padding);
    const min = box.min, max = box.max;
    const planes = [
      new THREE.Plane(new THREE.Vector3( 1, 0, 0), -max.x), // x <= max.x
      new THREE.Plane(new THREE.Vector3(-1, 0, 0),  min.x), // x >= min.x
      new THREE.Plane(new THREE.Vector3( 0, 1, 0), -max.y), // y <= max.y
      new THREE.Plane(new THREE.Vector3( 0,-1, 0),  min.y), // y >= min.y
      new THREE.Plane(new THREE.Vector3( 0, 0, 1), -max.z), // z <= max.z
      new THREE.Plane(new THREE.Vector3( 0, 0,-1),  min.z)  // z >= min.z
    ];
    r.clippingPlanes = planes;
    r.localClippingEnabled = true;
    state.clippingPlanes = planes;
    state.clipping = true;
  }
}
