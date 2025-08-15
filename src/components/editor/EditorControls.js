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
    
    // 입력 관리 시스템 초기화
    this.inputManager = new InputManager();
    this.keyboardController = new KeyboardController(this.inputManager);
    this.mouseController = new MouseController(this.inputManager);
    
    // 모듈 초기화
    this.cameraController = new CameraController(camera, renderer, onCameraChange);
    this.objectSelector = new ObjectSelector(scene, camera, renderer, editorStore);
    
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
      solo: false,
      clipping: false,
      savedVisibility: new Map(),
      clippingPlanes: []
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
        this.selectPart(hit?.object || null, hit?.point || null);
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
      // 파트 기즈모 드래그 상태에 따라 히스토리 기록용 before/after 저장
      this._partGizmoInitial = null;
      this._partTransformControls.addEventListener('dragging-changed', (e) => {
        const dragging = e.value;
        const mesh = this.partInspector?.selectedPart;
        if (!mesh) return;
        if (dragging) {
          this._partGizmoInitial = {
            position: mesh.position.clone(),
            rotation: mesh.rotation.clone(),
            scale: mesh.scale.clone()
          };
        } else {
          if (!this._partGizmoInitial) return;
          // after
          const after = {
            position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
            rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
            scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z }
          };
          const before = {
            position: { x: this._partGizmoInitial.position.x, y: this._partGizmoInitial.position.y, z: this._partGizmoInitial.position.z },
            rotation: { x: this._partGizmoInitial.rotation.x, y: this._partGizmoInitial.rotation.y, z: this._partGizmoInitial.rotation.z },
            scale: { x: this._partGizmoInitial.scale.x, y: this._partGizmoInitial.scale.y, z: this._partGizmoInitial.scale.z }
          };
          // 변경이 있는 경우에만 히스토리 푸시
          const changed = (
            before.position.x !== after.position.x || before.position.y !== after.position.y || before.position.z !== after.position.z ||
            before.rotation.x !== after.rotation.x || before.rotation.y !== after.rotation.y || before.rotation.z !== after.rotation.z ||
            before.scale.x !== after.scale.x || before.scale.y !== after.scale.y || before.scale.z !== after.scale.z
          );
          if (changed) {
            try {
              const api = this.editorStore?.getState?.();
              // 멀티 선택 확장 대비: parts 배열 구조를 기본으로 기록
              const entry = {
                type: 'part-transform',
                parts: [
                  {
                    uuid: mesh.uuid,
                    parentId: mesh.parent?.userData?.id ?? null,
                    before,
                    after
                  }
                ]
              };
              api?._pushHistory && api._pushHistory(entry);
            } catch {}
          }
          this._partGizmoInitial = null;
        }
      });
      this.scene.add(this._partTransformControls);
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
    if (!mesh) return false;
    // ObjectSelector 기즈모는 숨김/분리 (동시 표시는 혼란 야기)
    try { this.objectSelector?.transformControls?.detach?.(); } catch {}
    this._partTransformControls.attach(mesh);
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
    const list = mesh ? [mesh] : [];
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
  
  toggleMagnet() {
    return this.transformManager.toggleMagnet();
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

  // 자석 기능 업데이트
  updateMagnet() {
    this.objectSelector.updateMagnet();
  }

  // 자석 레이 표시 업데이트
  updateMagnetRays() {
    this.objectSelector.updateMagnetRays();
  }

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

  selectPart(mesh, point = null) {
    // 기존 강조 복원
    this._restorePartHighlight();
    this.partInspector.selectedPart = (mesh && mesh.isMesh) ? mesh : null;

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
    }
    // Outline 업데이트
    this._updatePartOutline();
  }

  clearPartSelection() {
    this._restorePartHighlight();
    this.partInspector.selectedPart = null;
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
