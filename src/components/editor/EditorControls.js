import * as THREE from 'three';
import { CameraController } from './CameraController.js';
import { ObjectSelector } from './ObjectSelector.js';

export class EditorControls {
  constructor(scene, camera, renderer, editorStore, onCameraChange = null) {
    this.scene = scene;
    this.renderer = renderer;
    this.editorStore = editorStore;
    
    // 모듈 초기??
    this.cameraController = new CameraController(camera, renderer, onCameraChange);
    this.objectSelector = new ObjectSelector(scene, camera, renderer, editorStore);
    
    // 컨트�??�태
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
  
  // 카메???�근??(?�환?�을 ?�해 ?��?)
  get camera() {
    return this.cameraController.getCamera();
  }
  
  set camera(newCamera) {
    // ??setter???��??�서 직접 카메?��? ?�정?????�용
    this.cameraController.camera = newCamera;
    this.objectSelector.updateCamera(newCamera);
  }
  
  setupEventListeners() {
    const canvas = this.renderer.domElement;
    
    // ?�벤???�들?��? 바인?�해???�??
    this.boundOnMouseDown = this.onMouseDown.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnKeyUp = this.onKeyUp.bind(this);
    this.boundOnWindowResize = this.onWindowResize.bind(this);
    
    // 마우???�벤??- canvas?� document???�록
    canvas.addEventListener('mousedown', this.boundOnMouseDown);
    document.addEventListener('mousemove', this.boundOnMouseMove);
    document.addEventListener('mouseup', this.boundOnMouseUp);
    canvas.addEventListener('wheel', this.boundOnWheel);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // ?�보???�벤??
    document.addEventListener('keydown', this.boundOnKeyDown);
    document.addEventListener('keyup', this.boundOnKeyUp);
    
    // ?�도???�벤??
    window.addEventListener('resize', this.boundOnWindowResize);
    
    // Console output removed
  }
  
  onMouseDown(event) {
    // Console output removed
    
    this.isMouseDown = true;
    this.updateMousePosition(event);
    this.previousMousePosition.copy(this.mousePosition);
    this.dragStartPosition.copy(this.mousePosition);
    
    // ?�쪽 버튼: ?�브?�트 ?�택 ?�는 ?�래�??�택 ?�작
    if (event.button === 0) {
      // 기즈�??�릭 체크
      if (this.objectSelector.isDraggingGizmo()) {
        // Console output removed
        return;
      }
      
      // ?�중 ?�택 모드 ?�인 (Ctrl/Cmd ?�는 Shift ??
      const isMultiSelect = event.ctrlKey || event.metaKey || event.shiftKey;
      
      // ?�래�??�택 모드 ?�작
      this.isDragSelecting = true;
      
      // 즉시 ?�브?�트 ?�택???�도 (?�릭�??�을 ?��? ?�해)
      this.objectSelector.handleObjectSelection(this.mousePosition, isMultiSelect);
    }
    // 중간 버튼(??버튼): ??모드
    else if (event.button === 1) {
      event.preventDefault();
      this.isPanning = true;
      
      // Alt + 중간 버튼: 궤도 ?�전
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
    
    // ?�래�??�택 중인지 ?�인
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
    
    // ?�래�??�택 ?�료
    if (this.isDragSelecting && event.button === 0) {
      this.finishDragSelection(event);
    }
    
    // ??모드 ?�료 ???�전 중심 ?�데?�트
    if (this.isPanning && event.button === 1) {
      // Console output removed
      // Console output removed
      this.cameraController.updateRotationCenterAfterPan(this.scene, this.objectSelector.getSelectableObjects());
    }
    
    this.isMouseDown = false;
    this.isPanning = false;
    this.isOrbiting = false;
    this.isDragSelecting = false;
    
    // ?�택 박스 ?�기�?
    this.objectSelector.hideSelectionBox();
  }
  
  onWheel(event) {
    event.preventDefault();
    
    if (this.objectSelector.isDraggingGizmo()) return;
    
    // 기본?�으�??��? �??�작
    const zoomSpeed = 0.3;
    const direction = event.deltaY > 0 ? 1 : -1;
    this.cameraController.zoom(direction * zoomSpeed);
  }
  
  onKeyDown(event) {
    // Console output removed
    
    const selectedObject = this.editorStore.getState().selectedObject;
    
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
          // Console output removed
          this.cameraController.focusOnObject(selectedObject);
        }
        break;
      case 'Escape':
        // Console output removed
        this.objectSelector.deselectAllObjects();
        break;
      // ?�패??기능
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
    // ?????�벤??처리
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
    
    // ?�택 박스가 충분?????�만 ?�시
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
    
    // ?�래�?거리가 ?�으�??�일 ?�릭?�로 간주
    const dragDistance = Math.sqrt(
      Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2)
    );
    
    if (dragDistance < 5) {
      // ?�일 ?�릭 - ?��? handleObjectSelection?�서 처리??
      return;
    }
    
    // ?�래�??�택 ?�역 ?�의 ?�브?�트??찾기
    const selectedInArea = this.objectSelector.getObjectsInArea(this.dragStartPosition, { x: endX, y: endY });
    
    // ?�중 ?�택 ?��? ?�렸?��? ?�인 (Ctrl/Cmd ?�는 Shift)
    const isMultiSelect = event.ctrlKey || event.metaKey || event.shiftKey;
    
    if (selectedInArea.length > 0) {
      this.objectSelector.selectMultipleObjects(selectedInArea, isMultiSelect);
    } else if (!isMultiSelect) {
      // �??�역???�래그했�?Ctrl?????�렸?�면 모든 ?�택 ?�제
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
  
  // ID�??�브?�트�?찾는 메서??
  findObjectById(id) {
    // ?�에???�당 ID�?가�??�브?�트 찾기
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
  
  // 공개 API - 카메??관??
  focusOnObject(object) {
    this.cameraController.focusOnObject(object);
  }
  
  // ?�택???�브?�트?�의 ?�웃?�인 ?�데?�트 (?�니메이?�용)
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

  // ?�환?�을 ?�한 ?�성??
  get transformControls() {
    return this.objectSelector.getTransformControls();
  }
  
  get selectedObjects() {
    return this.objectSelector.getSelectedObjects();
  }
  
  get isDragging() {
    return this.objectSelector.isDraggingGizmo();
  }
  
  // ?�리
  dispose() {
    // ?�벤??리스???�거
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousedown', this.boundOnMouseDown);
    document.removeEventListener('mousemove', this.boundOnMouseMove);
    document.removeEventListener('mouseup', this.boundOnMouseUp);
    canvas.removeEventListener('wheel', this.boundOnWheel);
    
    document.removeEventListener('keydown', this.boundOnKeyDown);
    document.removeEventListener('keyup', this.boundOnKeyUp);
    window.removeEventListener('resize', this.boundOnWindowResize);
    
    // 모듈 ?�리
    this.objectSelector.dispose();
    
    // Console output removed
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
}
