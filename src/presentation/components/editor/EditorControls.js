import * as THREE from 'three';
import { CameraController } from './CameraController.js';
import { ObjectSelector } from './ObjectSelector.js';

export class EditorControls {
  constructor(scene, camera, renderer, editorService, onCameraChange = null) {
    this.scene = scene;
    this.renderer = renderer;
    this.editorService = editorService;
    
    // 모듈 초기화
    this.cameraController = new CameraController(camera, renderer, onCameraChange);
    this.objectSelector = new ObjectSelector(scene, camera, renderer, editorService);
    
    // 컨트롤 상태
    this.isMouseDown = false;
    this.isPanning = false;
    this.isOrbiting = false;
    this.isDragSelecting = false;
    this.mousePosition = new THREE.Vector2();
    this.previousMousePosition = new THREE.Vector2();
    this.dragStartPosition = new THREE.Vector2();
    
    // Event listeners
    this.setupEventListeners();
    
    // Console output removed
  }
  
  // 카메라 접근자 (교체시을 위해 사용)
  get camera() {
    return this.cameraController.getCamera();
  }
  
  set camera(newCamera) {
    // 이 setter를 통해서 직접 카메라를 설정할 수 있음
    this.cameraController.camera = newCamera;
    this.objectSelector.updateCamera(newCamera);
  }
  
  setupEventListeners() {
    const canvas = this.renderer.domElement;
    
    // 이벤트들을 바인딩해야 함
    this.boundOnMouseDown = this.onMouseDown.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnKeyUp = this.onKeyUp.bind(this);
    this.boundOnWindowResize = this.onWindowResize.bind(this);
    
    // 마우스 이벤트 - canvas와 document에 등록
    canvas.addEventListener('mousedown', this.boundOnMouseDown);
    document.addEventListener('mousemove', this.boundOnMouseMove);
    document.addEventListener('mouseup', this.boundOnMouseUp);
    canvas.addEventListener('wheel', this.boundOnWheel);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // 키보드 이벤트
    document.addEventListener('keydown', this.boundOnKeyDown);
    document.addEventListener('keyup', this.boundOnKeyUp);
    
    // 창크기 이벤트
    window.addEventListener('resize', this.boundOnWindowResize);
    
    // Console output removed
  }
  
  onMouseDown(event) {
    // Console output removed
    
    this.isMouseDown = true;
    this.updateMousePosition(event);
    this.previousMousePosition.copy(this.mousePosition);
    this.dragStartPosition.copy(this.mousePosition);
    
    // 왼쪽 버튼: 오브젝트 선택 또는 드래그 선택 시작
    if (event.button === 0) {
      // 기즈모 클릭 체크
      if (this.objectSelector.isDraggingGizmo()) {
        // Console output removed
        return;
      }
      
      // 다중 선택 모드 확인 (Ctrl/Cmd 또는 Shift 키)
      const isMultiSelect = event.ctrlKey || event.metaKey || event.shiftKey;
      
      // 드래그 선택 모드 시작
      this.isDragSelecting = true;
      
      // 즉시 오브젝트 선택도 시도 (클릭만 할 경우를 위해)
      this.objectSelector.handleObjectSelection(this.mousePosition, isMultiSelect);
    }
    // 중간 버튼(휠 버튼): 패닝 모드
    else if (event.button === 1) {
      event.preventDefault();
      this.isPanning = true;
      
      // Alt + 중간 버튼: 궤도 회전
      if (event.altKey) {
        this.isOrbiting = true;
        this.isPanning = false;
        // Console output removed
      } else {
        // Console output removed
      }
    }
  }
  
  onMouseMove(event) {
    if (!this.isMouseDown || this.objectSelector.isDraggingGizmo()) return;
    
    this.updateMousePosition(event);
    const deltaX = this.mousePosition.x - this.previousMousePosition.x;
    const deltaY = this.mousePosition.y - this.previousMousePosition.y;
    
    // 드래그 선택 중인지 확인
    if (this.isDragSelecting && event.button === 0) {
      this.updateSelectionBox(event);
    }
    else if (this.isPanning) {
      this.cameraController.pan(deltaX, deltaY);
    } else if (this.isOrbiting) {
      this.cameraController.orbit(deltaX, deltaY);
    }
    
    this.previousMousePosition.copy(this.mousePosition);
  }
  
  onMouseUp(event) {
    // Console output removed
    
    // 드래그 선택 완료
    if (this.isDragSelecting && event.button === 0) {
      this.finishDragSelection(event);
    }
    
    // 패닝 모드 완료 시 회전 중심 업데이트
    if (this.isPanning && event.button === 1) {
      // Console output removed
      // Console output removed
      this.cameraController.updateRotationCenterAfterPan(this.scene, this.objectSelector.getSelectableObjects());
    }
    
    this.isMouseDown = false;
    this.isPanning = false;
    this.isOrbiting = false;
    this.isDragSelecting = false;
    
    // 선택 박스 숨기기
    this.objectSelector.hideSelectionBox();
  }
  
  onWheel(event) {
    event.preventDefault();
    
    if (this.objectSelector.isDraggingGizmo()) return;
    
    // 기본적으로 줌 기능 작동
    const zoomSpeed = 0.3;
    const direction = event.deltaY > 0 ? 1 : -1;
    this.cameraController.zoom(direction * zoomSpeed);
  }
  
  onKeyDown(event) {
    // Console output removed
    
    // 먼저 ObjectSelector에서 현재 선택된 Three.js 객체들을 확인
    const selectedObjects = this.objectSelector.getSelectedObjects();
    let selectedObject = null;
    
    // 선택된 객체가 있으면 마지막 선택된 객체 사용
    if (selectedObjects && selectedObjects.length > 0) {
      selectedObject = selectedObjects[selectedObjects.length - 1]; // 마지막 선택된 객체
    } else {
      // ObjectSelector에 선택된 객체가 없다면 EditorService에서 확인
      const selectedObjectId = this.editorService.getSelectedObject ? this.editorService.getSelectedObject() : null;
      if (selectedObjectId) {
        selectedObject = this.findObjectById(selectedObjectId);
      }
    }
    
    switch (event.code) {
      case 'KeyW':
        // Console output removed
        this.objectSelector.setGizmoMode('translate');
        break;
      case 'KeyE':
        // Console output removed
        this.objectSelector.setGizmoMode('rotate');
        break;
      case 'KeyR':
        // Console output removed
        this.objectSelector.setGizmoMode('scale');
        break;
      case 'KeyF':
        if (selectedObject) {
          console.log('F키 포커스: 선택된 객체로 포커스 이동', selectedObject);
          this.cameraController.focusOnObject(selectedObject);
        } else {
          console.log('F키 포커스: 선택된 객체가 없습니다.');
          // EditorService를 통해 포커스 요청 (이벤트 기반)
          this.editorService.focusOnSelectedObject();
        }
        break;
      case 'Escape':
        // Console output removed
        this.objectSelector.deselectAllObjects();
        break;
      // 넘패드 기능
      case 'Numpad5':
        // Console output removed
        const newCamera = this.cameraController.toggleProjection();
        this.objectSelector.updateCamera(newCamera);
        break;
      case 'Numpad1':
        // Console output removed
        this.cameraController.setView('front');
        break;
      case 'Numpad3':
        // Console output removed
        this.cameraController.setView('side');
        break;
      case 'Numpad7':
        // Console output removed
        this.cameraController.setView('top');
        break;
      case 'Numpad9':
        // Console output removed
        this.cameraController.setView('bottom');
        break;
      case 'Numpad0':
        // Console output removed
        this.cameraController.resetCamera();
        break;
    }
  }
  
  onKeyUp(event) {
    // 키업 이벤트 처리
  }
  
  onWindowResize() {
    this.cameraController.handleResize();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  updateMousePosition(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mousePosition.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mousePosition.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }
  
  updateSelectionBox(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const startX = (this.dragStartPosition.x + 1) * rect.width / 2 + rect.left;
    const startY = (-this.dragStartPosition.y + 1) * rect.height / 2 + rect.top;
    const currentX = event.clientX;
    const currentY = event.clientY;
    
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    
    // 선택 박스가 충분히 클 때만 표시
    if (width > 5 || height > 5) {
      this.objectSelector.showSelectionBox(left, top, width, height);
    }
  }
  
  finishDragSelection(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const endX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const endY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const startX = (this.dragStartPosition.x + 1) * rect.width / 2;
    const startY = (-this.dragStartPosition.y + 1) * rect.height / 2;
    const currentX = (endX + 1) * rect.width / 2;
    const currentY = (-endY + 1) * rect.height / 2;
    
    // 드래그 거리가 작으면 단일 클릭으로 간주
    const dragDistance = Math.sqrt(
      Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2)
    );
    
    if (dragDistance < 5) {
      // 단일 클릭 - 이미 handleObjectSelection에서 처리됨
      return;
    }
    
    // 드래그 선택 영역 안의 오브젝트들 찾기
    const selectedInArea = this.objectSelector.getObjectsInArea(this.dragStartPosition, { x: endX, y: endY });
    
    // 다중 선택 키를 눌렀는지 확인 (Ctrl/Cmd 또는 Shift)
    const isMultiSelect = event.ctrlKey || event.metaKey || event.shiftKey;
    
    if (selectedInArea.length > 0) {
      this.objectSelector.selectMultipleObjects(selectedInArea, isMultiSelect);
    } else if (!isMultiSelect) {
      // 빈 영역을 드래그했고 Ctrl키를 누르지 않았으면 모든 선택 해제
      this.objectSelector.deselectAllObjects();
    }
  }
  
  
  // 공개 API - ?�브?�트 ?�택 관??
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
  
  // 공개 API - 카메라 관련
  focusOnObject(object) {
    return this.cameraController.focusOnObject(object);
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

  // 변환기를 위한 속성들
  get transformControls() {
    return this.objectSelector.getTransformControls();
  }
  
  get selectedObjects() {
    return this.objectSelector.getSelectedObjects();
  }
  
  get isDragging() {
    return this.objectSelector.isDraggingGizmo();
  }
  
  // ID로 Three.js 객체 찾기
  findObjectById(objectId) {
    let foundObject = null;
    
    this.scene.traverse((child) => {
      if (child.userData && (child.userData.id === objectId || child.name === objectId)) {
        foundObject = child;
      }
    });
    
    return foundObject;
  }
  
  // 정리
  dispose() {
    // 이벤트 리스너 제거
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousedown', this.boundOnMouseDown);
    document.removeEventListener('mousemove', this.boundOnMouseMove);
    document.removeEventListener('mouseup', this.boundOnMouseUp);
    canvas.removeEventListener('wheel', this.boundOnWheel);
    
    document.removeEventListener('keydown', this.boundOnKeyDown);
    document.removeEventListener('keyup', this.boundOnKeyUp);
    window.removeEventListener('resize', this.boundOnWindowResize);
    
    // 모듈 정리
    this.objectSelector.dispose();
    
    // Console output removed
  }
}
