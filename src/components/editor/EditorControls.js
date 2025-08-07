import * as THREE from 'three';
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

  /**
   * 뷰포트 제어 액션 등록
   */
  setupViewportActions() {
    this.keyboardController.registerViewportActions({
      focusOnSelected: () => {
        const selectedObject = this.editorStore.getState().selectedObject;
        if (selectedObject) {
          this.cameraController.focusOnObject(selectedObject);
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
  focusOnObject(object) {
    this.cameraController.focusOnObject(object);
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
}
