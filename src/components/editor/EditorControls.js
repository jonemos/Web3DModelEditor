import * as THREE from 'three';
import { CameraController } from './CameraController.js';
import { ObjectSelector } from './ObjectSelector.js';

export class EditorControls {
  constructor(scene, camera, renderer, editorStore, onCameraChange = null) {
    this.scene = scene;
    this.renderer = renderer;
    this.editorStore = editorStore;
    
    // ëª¨ë“ˆ ì´ˆê¸°??
    this.cameraController = new CameraController(camera, renderer, onCameraChange);
    this.objectSelector = new ObjectSelector(scene, camera, renderer, editorStore);
    
    // ì»¨íŠ¸ë¡??íƒœ
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
  
  // ì¹´ë©”???‘ê·¼??(?¸í™˜?±ì„ ?„í•´ ? ì?)
  get camera() {
    return this.cameraController.getCamera();
  }
  
  set camera(newCamera) {
    // ??setter???¸ë??ì„œ ì§ì ‘ ì¹´ë©”?¼ë? ?¤ì •?????¬ìš©
    this.cameraController.camera = newCamera;
    this.objectSelector.updateCamera(newCamera);
  }
  
  setupEventListeners() {
    const canvas = this.renderer.domElement;
    
    // ?´ë²¤???¸ë“¤?¬ë? ë°”ì¸?œí•´???€??
    this.boundOnMouseDown = this.onMouseDown.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnKeyUp = this.onKeyUp.bind(this);
    this.boundOnWindowResize = this.onWindowResize.bind(this);
    
    // ë§ˆìš°???´ë²¤??- canvas?€ document???±ë¡
    canvas.addEventListener('mousedown', this.boundOnMouseDown);
    document.addEventListener('mousemove', this.boundOnMouseMove);
    document.addEventListener('mouseup', this.boundOnMouseUp);
    canvas.addEventListener('wheel', this.boundOnWheel);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // ?¤ë³´???´ë²¤??
    document.addEventListener('keydown', this.boundOnKeyDown);
    document.addEventListener('keyup', this.boundOnKeyUp);
    
    // ?ˆë„???´ë²¤??
    window.addEventListener('resize', this.boundOnWindowResize);
    
    // Console output removed
  }
  
  onMouseDown(event) {
    // Console output removed
    
    this.isMouseDown = true;
    this.updateMousePosition(event);
    this.previousMousePosition.copy(this.mousePosition);
    this.dragStartPosition.copy(this.mousePosition);
    
    // ?¼ìª½ ë²„íŠ¼: ?¤ë¸Œ?íŠ¸ ? íƒ ?ëŠ” ?œë˜ê·?? íƒ ?œì‘
    if (event.button === 0) {
      // ê¸°ì¦ˆëª??´ë¦­ ì²´í¬
      if (this.objectSelector.isDraggingGizmo()) {
        // Console output removed
        return;
      }
      
      // ?¤ì¤‘ ? íƒ ëª¨ë“œ ?•ì¸ (Ctrl/Cmd ?ëŠ” Shift ??
      const isMultiSelect = event.ctrlKey || event.metaKey || event.shiftKey;
      
      // ?œë˜ê·?? íƒ ëª¨ë“œ ?œì‘
      this.isDragSelecting = true;
      
      // ì¦‰ì‹œ ?¤ë¸Œ?íŠ¸ ? íƒ???œë„ (?´ë¦­ë§??ˆì„ ?Œë? ?„í•´)
      this.objectSelector.handleObjectSelection(this.mousePosition, isMultiSelect);
    }
    // ì¤‘ê°„ ë²„íŠ¼(??ë²„íŠ¼): ??ëª¨ë“œ
    else if (event.button === 1) {
      event.preventDefault();
      this.isPanning = true;
      
      // Alt + ì¤‘ê°„ ë²„íŠ¼: ê¶¤ë„ ?Œì „
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
    
    // ?œë˜ê·?? íƒ ì¤‘ì¸ì§€ ?•ì¸
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
    
    // ?œë˜ê·?? íƒ ?„ë£Œ
    if (this.isDragSelecting && event.button === 0) {
      this.finishDragSelection(event);
    }
    
    // ??ëª¨ë“œ ?„ë£Œ ???Œì „ ì¤‘ì‹¬ ?…ë°?´íŠ¸
    if (this.isPanning && event.button === 1) {
      // Console output removed
      // Console output removed
      this.cameraController.updateRotationCenterAfterPan(this.scene, this.objectSelector.getSelectableObjects());
    }
    
    this.isMouseDown = false;
    this.isPanning = false;
    this.isOrbiting = false;
    this.isDragSelecting = false;
    
    // ? íƒ ë°•ìŠ¤ ?¨ê¸°ê¸?
    this.objectSelector.hideSelectionBox();
  }
  
  onWheel(event) {
    event.preventDefault();
    
    if (this.objectSelector.isDraggingGizmo()) return;
    
    // ê¸°ë³¸?ìœ¼ë¡?? ì? ì¤??™ì‘
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
      // ?¤íŒ¨??ê¸°ëŠ¥
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
    // ?????´ë²¤??ì²˜ë¦¬
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
    
    // ? íƒ ë°•ìŠ¤ê°€ ì¶©ë¶„?????Œë§Œ ?œì‹œ
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
    
    // ?œë˜ê·?ê±°ë¦¬ê°€ ?‘ìœ¼ë©??¨ì¼ ?´ë¦­?¼ë¡œ ê°„ì£¼
    const dragDistance = Math.sqrt(
      Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2)
    );
    
    if (dragDistance < 5) {
      // ?¨ì¼ ?´ë¦­ - ?´ë? handleObjectSelection?ì„œ ì²˜ë¦¬??
      return;
    }
    
    // ?œë˜ê·?? íƒ ?ì—­ ?´ì˜ ?¤ë¸Œ?íŠ¸??ì°¾ê¸°
    const selectedInArea = this.objectSelector.getObjectsInArea(this.dragStartPosition, { x: endX, y: endY });
    
    // ?¤ì¤‘ ? íƒ ?¤ê? ?Œë ¸?”ì? ?•ì¸ (Ctrl/Cmd ?ëŠ” Shift)
    const isMultiSelect = event.ctrlKey || event.metaKey || event.shiftKey;
    
    if (selectedInArea.length > 0) {
      this.objectSelector.selectMultipleObjects(selectedInArea, isMultiSelect);
    } else if (!isMultiSelect) {
      // ë¹??ì—­???œë˜ê·¸í–ˆê³?Ctrl?????Œë ¸?¼ë©´ ëª¨ë“  ? íƒ ?´ì œ
      this.objectSelector.deselectAllObjects();
    }
  }
  
  
  // ê³µê°œ API - ?¤ë¸Œ?íŠ¸ ? íƒ ê´€??
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
  
  // IDë¡??¤ë¸Œ?íŠ¸ë¥?ì°¾ëŠ” ë©”ì„œ??
  findObjectById(id) {
    // ?¬ì—???´ë‹¹ IDë¥?ê°€ì§??¤ë¸Œ?íŠ¸ ì°¾ê¸°
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
  
  // ê³µê°œ API - ì¹´ë©”??ê´€??
  focusOnObject(object) {
    this.cameraController.focusOnObject(object);
  }
  
  // ? íƒ???¤ë¸Œ?íŠ¸?¤ì˜ ?„ì›ƒ?¼ì¸ ?…ë°?´íŠ¸ (? ë‹ˆë©”ì´?˜ìš©)
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

  // ?¸í™˜?±ì„ ?„í•œ ?ì„±??
  get transformControls() {
    return this.objectSelector.getTransformControls();
  }
  
  get selectedObjects() {
    return this.objectSelector.getSelectedObjects();
  }
  
  get isDragging() {
    return this.objectSelector.isDraggingGizmo();
  }
  
  // ?•ë¦¬
  dispose() {
    // ?´ë²¤??ë¦¬ìŠ¤???œê±°
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousedown', this.boundOnMouseDown);
    document.removeEventListener('mousemove', this.boundOnMouseMove);
    document.removeEventListener('mouseup', this.boundOnMouseUp);
    canvas.removeEventListener('wheel', this.boundOnWheel);
    
    document.removeEventListener('keydown', this.boundOnKeyDown);
    document.removeEventListener('keyup', this.boundOnKeyUp);
    window.removeEventListener('resize', this.boundOnWindowResize);
    
    // ëª¨ë“ˆ ?•ë¦¬
    this.objectSelector.dispose();
    
    // Console output removed
  }
}
