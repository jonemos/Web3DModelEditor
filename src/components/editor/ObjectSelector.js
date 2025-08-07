import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export class ObjectSelector {
  constructor(scene, camera, renderer, editorStore) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.editorStore = editorStore;
    
    // ?�택 관???�태
    this.selectedObjects = [];
    this.lastSelectedObject = null; // 마�?막으�??�택???�브?�트 (기즈�??�치 기�?)
    this.selectableObjects = [];
    this.raycaster = new THREE.Raycaster();
    
    // ?�래�??�택 박스
    this.selectionBox = null;
    this.createSelectionBox();
    
    // Transform controls (기즈�?
    this.transformControls = null;
    this.gizmoMode = 'translate'; // translate, rotate, scale
    this.isDragging = false;
    
    // 자석 기능 상태
    this.isMagnetEnabled = false;
    this.showMagnetRays = false;
    this.rayHelpers = []; // 레이 시각화를 위한 헬퍼들
    
    // ?�중 ?�택 변?�을 ?�한 초기 ?�태 ?�??
    this.initialTransformStates = new Map(); // object -> initial transform state
    
    this.initializeTransformControls();
    
    // ObjectSelector initialized
  }
  
  // 초기 변???�태 ?�??
  saveInitialTransformStates() {
    this.initialTransformStates.clear();
    
    for (const object of this.selectedObjects) {
      if (object && object.position && object.rotation && object.scale) { // ?�전??검??
        this.initialTransformStates.set(object, {
          position: object.position.clone(),
          rotation: object.rotation.clone(),
          scale: object.scale.clone()
        });
      }
    }
  }
  
  // ?�중 ?�택???�브?�트?�에 변???�용
  applyTransformToSelectedObjects() {
    if (!this.lastSelectedObject || !this.transformControls.object || this.selectedObjects.length <= 1) {
      // ?�일 ?�택??경우?�도 ?�웃?�인 ?�데?�트
      if (this.lastSelectedObject) {
        this.updateSelectionOutline(this.lastSelectedObject);
      }
      return;
    }
    
    const primaryObject = this.lastSelectedObject; // 기즈모�? ?�결??기�? ?�브?�트
    const primaryInitialState = this.initialTransformStates.get(primaryObject);
    
    if (!primaryInitialState) return;
    
    // ?�른 ?�택???�브?�트?�에 ?��???변???�용
    for (const object of this.selectedObjects) {
      if (object && object !== primaryObject) {
        const objectInitialState = this.initialTransformStates.get(object);
        if (objectInitialState) {
          this.applyRelativeTransform(object, primaryObject, primaryInitialState, objectInitialState);
        }
      }
    }
    
    // 모든 ?�택???�브?�트???�웃?�인 ?�데?�트
    for (const object of this.selectedObjects) {
      if (object) { // undefined??null 체크
        this.updateSelectionOutline(object);
      }
    }
  }
  
  // ?��???변???�용 (개선??버전)
  applyRelativeTransform(targetObject, primaryObject, primaryInitialState, targetInitialState) {
    const mode = this.transformControls.getMode();
    
    switch (mode) {
      case 'translate':
        // ?�동: 기�? ?�브?�트???�동?�을 ?��??�브?�트???�용
        const positionDelta = new THREE.Vector3().subVectors(primaryObject.position, primaryInitialState.position);
        targetObject.position.copy(targetInitialState.position).add(positionDelta);
        break;
        
      case 'rotate':
        // ?�전: 기�? ?�브?�트???�전?�을 ?��??�브?�트???�용
        const rotationDelta = new THREE.Euler(
          primaryObject.rotation.x - primaryInitialState.rotation.x,
          primaryObject.rotation.y - primaryInitialState.rotation.y,
          primaryObject.rotation.z - primaryInitialState.rotation.z
        );
        targetObject.rotation.copy(targetInitialState.rotation);
        targetObject.rotation.x += rotationDelta.x;
        targetObject.rotation.y += rotationDelta.y;
        targetObject.rotation.z += rotationDelta.z;
        break;
        
      case 'scale':
        // ?�기: 기�? ?�브?�트???�기 비율???��??�브?�트???�용
        const scaleRatio = new THREE.Vector3(
          primaryObject.scale.x / primaryInitialState.scale.x,
          primaryObject.scale.y / primaryInitialState.scale.y,
          primaryObject.scale.z / primaryInitialState.scale.z
        );
        targetObject.scale.copy(targetInitialState.scale).multiply(scaleRatio);
        break;
    }
  }
  
  initializeTransformControls() {
    try {
      // Creating TransformControls
      
      this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
      
      // ?�벤??리스??추�?
      this.transformControls.addEventListener('dragging-changed', (event) => {
        this.isDragging = event.value;
        
        if (event.value) {
          // ?�래�??�작 - 모든 ?�택???�브?�트??초기 ?�태 ?�??
          this.saveInitialTransformStates();
          // Transform drag started, saved initial states
        } else {
          // ?�래�?종료 - 자석 기능 적용 후 초기 ?�태 ?�리??
          if (this.transformControls.getMode() === 'translate' && this.lastSelectedObject) {
            this.applyMagnetToSelectedObjects();
          }
          this.initialTransformStates.clear();
          // Transform drag ended, cleared initial states
        }
      });
      
      // ?�중 ?�택???�브?�트?�의 ?�시 변?�을 ?�한 ?�벤??리스??
      this.transformControls.addEventListener('change', () => {
        this.applyTransformToSelectedObjects();
      });
      
      // 기즈�??�정
      this.transformControls.setSize(1.0);
      
      // TransformControls??getHelper()�??�용?�서 ?�각???�현???�에 추�?
      const gizmoHelper = this.transformControls.getHelper();
      
      if (gizmoHelper instanceof THREE.Object3D) {
        // Gizmo helper is Object3D, adding to scene
        gizmoHelper.renderOrder = 999;
        this.scene.add(gizmoHelper);
        // Gizmo helper successfully added to scene
      } else {
        // Gizmo helper is not Object3D
      }
      
    } catch (error) {
      // Failed to initialize TransformControls
      this.transformControls = null;
    }
  }
  
  createSelectionBox() {
    // ?�래�??�택 박스 ?�성
    this.selectionBox = document.createElement('div');
    this.selectionBox.style.position = 'absolute';
    this.selectionBox.style.border = '2px dashed #007acc';
    this.selectionBox.style.backgroundColor = 'rgba(0, 122, 204, 0.1)';
    this.selectionBox.style.pointerEvents = 'none';
    this.selectionBox.style.display = 'none';
    this.selectionBox.style.zIndex = '1000';
    document.body.appendChild(this.selectionBox);
  }
  
  // 객체가 ?�택???�효?��? 검?�하???�퍼 메서??
  isObjectValidForSelection(object) {
    return object && 
           (object.isMesh || object.isGroup) && 
           object.userData && 
           object.visible;
  }
  
  // ?�일 ?�브?�트 ?�택
  selectSingleObject(object) {
    // ?�전??검??
    if (!object || !this.isObjectValidForSelection(object)) {
      // Console output removed
      return;
    }
    
    // Console output removed
    
    // 배열 ?�리
    this.cleanupSelectedObjects();
    
    // 모든 ?�택 ?�제
    this.deselectAllObjects();
    
    // ???�브?�트 ?�택
    this.selectedObjects = [object];
    this.lastSelectedObject = object; // 마�?�??�택???�브?�트 ?�데?�트
    this.editorStore.getState().setSelectedObject(object);
    
    // 기즈�??�결 (객체가 ?�에 ?�는지 ?�인)
    if (this.transformControls && object.parent) {
      // 객체가 ??그래?�에 ?�해?�는지 ?�인
      let isInScene = false;
      let current = object;
      while (current.parent) {
        current = current.parent;
        if (current === this.scene) {
          isInScene = true;
          break;
        }
      }
      
      if (isInScene) {
        // Console output removed
        this.transformControls.attach(object);
        this.setGizmoMode(this.gizmoMode);
      } else {
        // Console output removed
      }
    }
    
    // ?�각???�드�?
    this.addSelectionOutline(object);
    
    // Console output removed
  }
  
  // ?�중 ?�브?�트 ?�택
  selectMultipleObjects(objects, isMultiSelect = false) {
    // ?�전??검??
    if (!objects || !Array.isArray(objects)) {
      // Console output removed
      return;
    }
    
    if (!isMultiSelect) {
      this.deselectAllObjects();
    }
    
    for (const object of objects) {
      // �??�브?�트???�효??검??
      if (object && !this.selectedObjects.includes(object)) {
        this.selectedObjects.push(object);
        this.lastSelectedObject = object; // 마�?막으�?추�????�브?�트�?마�?�??�택?�로 ?�정
        this.addSelectionOutline(object);
      }
    }
    
    // 마�?�??�택???�브?�트�?기즈�??�치�??�정
    if (this.lastSelectedObject && this.transformControls) {
      this.editorStore.getState().setSelectedObject(this.lastSelectedObject);
      this.transformControls.attach(this.lastSelectedObject);
      this.setGizmoMode(this.gizmoMode);
      // Console output removed
    }
    
    // Console output removed
  }
  
  // ?�브?�트 ?�택 ?��?
  toggleObjectSelection(object) {
    // ?�전??검??
    if (!object) {
      // Console output removed
      return;
    }
    
    const index = this.selectedObjects.indexOf(object);
    
    if (index > -1) {
      // ?��? ?�택???�브?�트 - ?�택 ?�제
      this.selectedObjects.splice(index, 1);
      this.removeSelectionOutline(object);
      
      // 마�?�??�택???�브?�트가 ?�거??경우 ?�데?�트
      if (this.lastSelectedObject === object) {
        this.lastSelectedObject = this.selectedObjects.length > 0 ? this.selectedObjects[this.selectedObjects.length - 1] : null;
      }
      
      // Transform controls ?�데?�트
      if (this.selectedObjects.length > 0 && this.transformControls) {
        const targetObject = this.lastSelectedObject || this.selectedObjects[0];
        this.editorStore.getState().setSelectedObject(targetObject);
        this.transformControls.attach(targetObject);
        this.setGizmoMode(this.gizmoMode);
        // Console output removed
      } else {
        this.editorStore.getState().setSelectedObject(null);
        this.lastSelectedObject = null;
        if (this.transformControls) {
          this.transformControls.detach();
        }
      }
    } else {
      // ?�로???�브?�트 ?�택
      this.selectedObjects.push(object);
      this.lastSelectedObject = object; // ?�로 ?�택???�브?�트�?마�?�??�택?�로 ?�정
      this.addSelectionOutline(object);
      
      // Transform controls�?마�?�??�택???�브?�트???�결
      if (this.transformControls) {
        this.editorStore.getState().setSelectedObject(object);
        this.transformControls.attach(object);
        this.setGizmoMode(this.gizmoMode);
        // Console output removed
      }
    }
    
    // Console output removed
    // Console output removed
  }
  
  // 모든 ?�브?�트 ?�택 ?�제
  deselectAllObjects() {
    // Console output removed
    
    // 기즈�?먼�? ?�제 (가??중요)
    if (this.transformControls) {
      try {
        this.transformControls.detach();
        // Console output removed
      } catch (error) {
        // Console output removed
      }
    }
    
    // 배열 ?�리 먼�? ?�행
    this.cleanupSelectedObjects();
    
    // 모든 ?�택???�브?�트???�웃?�인 ?�거 (?�전??검???�함)
    for (const object of this.selectedObjects) {
      if (object) { // undefined??null 체크
        try {
          this.removeSelectionOutline(object);
        } catch (error) {
          // Console output removed
        }
      }
    }
    
    this.selectedObjects = [];
    this.lastSelectedObject = null; // 마�?�??�택???�브?�트??초기??
    this.editorStore.getState().setSelectedObject(null);
    
    // Console output removed
  }
  
  // ?�택??객체 배열?�서 ?�효?��? ?��? 객체?�을 ?�거
  cleanupSelectedObjects() {
    this.selectedObjects = this.selectedObjects.filter(obj => {
      const isValid = this.isObjectValidForSelection(obj);
      if (!isValid) {
        // Console output removed
        // ?�효?��? ?��? 객체???�웃?�인 ?�거
        try {
          this.removeSelectionOutline(obj);
        } catch (error) {
          // Console output removed
        }
      }
      return isValid;
    });
    
    // 마�?�??�택??객체??검??
    if (this.lastSelectedObject && !this.isObjectValidForSelection(this.lastSelectedObject)) {
      this.lastSelectedObject = this.selectedObjects.length > 0 ? this.selectedObjects[this.selectedObjects.length - 1] : null;
    }
  }
  
  // 마우???�치?�서 ?�브?�트 ?�택 처리
  handleObjectSelection(mousePosition, isMultiSelect = false) {
    // 기즈�??�릭 체크
    if (this.transformControls && this.transformControls.dragging) return;
    
    this.raycaster.setFromCamera(mousePosition, this.camera);
    const intersects = this.raycaster.intersectObjects(this.selectableObjects, true);
    
    if (intersects.length > 0) {
      // �?번째 교차?�의 ?�브?�트 ?�택
      let selectedObject = intersects[0].object;
      
      // 부�??�브?�트 찾기 (그룹??경우)
      while (selectedObject.parent && !this.selectableObjects.includes(selectedObject)) {
        selectedObject = selectedObject.parent;
      }
      
      // ?�택???�브?�트가 ?�효?��? ?�인
      if (!selectedObject || !this.selectableObjects.includes(selectedObject) || !this.isObjectValidForSelection(selectedObject)) {
        // Console output removed
        return;
      }
      
      if (isMultiSelect) {
        this.toggleObjectSelection(selectedObject);
      } else {
        this.selectSingleObject(selectedObject);
      }
    } else if (!isMultiSelect) {
      // �?공간 ?�릭 ??모든 ?�택 ?�제
      this.deselectAllObjects();
    }
  }
  
  // ?�래�??�택 ?�역 ???�브?�트??찾기
  getObjectsInArea(startPos, endPos) {
    const selectedInArea = [];
    const minX = Math.min(startPos.x, endPos.x);
    const maxX = Math.max(startPos.x, endPos.x);
    const minY = Math.min(startPos.y, endPos.y);
    const maxY = Math.max(startPos.y, endPos.y);
    
    for (const object of this.selectableObjects) {
      // ?�브?�트???�면 좌표 계산
      const objectPosition = new THREE.Vector3();
      object.getWorldPosition(objectPosition);
      objectPosition.project(this.camera);
      
      // ?�택 ?�역 ?�에 ?�는지 ?�인
      if (objectPosition.x >= minX && objectPosition.x <= maxX &&
          objectPosition.y >= minY && objectPosition.y <= maxY) {
        selectedInArea.push(object);
      }
    }
    
    return selectedInArea;
  }
  
  // ?�택 ?�웃?�인 추�?
  addSelectionOutline(object) {
    // ?�전??검??
    if (!object) {
      // Console output removed
      return;
    }
    
    // Group??경우 ?�식 메시?�에 ?�웃?�인 ?�용
    if (object.isGroup || (object.children && object.children.length > 0)) {
      this.addSelectionOutlineToGroup(object);
      return;
    }
    
    // ?�일 메시??경우
    if (!object.isMesh) return;
    
    // ?��? ?�웃?�인???�으�??�거
    this.removeSelectionOutline(object);
    
    // ?�본 머티리얼 ?�??
    if (!object.userData.originalMaterial) {
      object.userData.originalMaterial = object.material;
    }
    
    try {
      // 1. 백페?�스�??�더링되???�웃?�인 ?�성
      const outlineGeometry = object.geometry.clone();
      const outlineMaterial = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.6,
        depthWrite: false
      });
      
      const outlineObject = new THREE.Mesh(outlineGeometry, outlineMaterial);
      
      // ?�브?�트?� 같�? transform ?�용
      outlineObject.position.copy(object.position);
      outlineObject.rotation.copy(object.rotation);
      outlineObject.scale.copy(object.scale);
      
      // ?�웃?�인???�해 ?�간 ?�게 ?��??�링
      outlineObject.scale.multiplyScalar(1.03);
      
      // ?�더 ?�서 ?�정
      outlineObject.renderOrder = object.renderOrder - 1;
      
      // 부모에 추�?
      if (object.parent) {
        object.parent.add(outlineObject);
      } else {
        this.scene.add(outlineObject);
      }
      
      // 참조 ?�??
      object.userData.outlineObject = outlineObject;
      
      // 2. ?�본 ?�브?�트??미묘??발광 ?�과 추�? (?�는 경우?�만)
      if (object.material && object.material.emissive !== undefined) {
        object.userData.originalEmissive = object.material.emissive.clone();
        object.userData.originalEmissiveIntensity = object.material.emissiveIntensity || 0;
        
        object.material.emissive.setHex(0x001122);
        object.material.emissiveIntensity = 0.1;
      }
      
      // Console output removed
    } catch (error) {
      // Console output removed
    }
  }
  
  // Group ?�는 복합 ?�브?�트???�웃?�인 추�?
  addSelectionOutlineToGroup(group) {
    // ?�전??검??
    if (!group || !group.traverse) {
      // Console output removed
      return;
    }
    
    try {
      // Group??모든 ?�식 메시???�웃?�인 ?�용
      group.traverse((child) => {
        // child가 ?�효?��? ?�인
        if (child && child.isMesh && child !== group) {
          this.addSelectionOutlineToSingleMesh(child);
        }
      });
    } catch (error) {
      // Console output removed
      // Console output removed
    }
    
    // Group???�웃?�인 ?�보 ?�??
    if (group.userData) {
      if (!group.userData.outlineChildren) {
        group.userData.outlineChildren = [];
      }
    }
    
    // Console output removed
  }
  
  // ?�일 메시???�웃?�인 추�? (Group???�식??
  addSelectionOutlineToSingleMesh(mesh) {
    if (!mesh.isMesh) return;
    
    // ?��? ?�웃?�인???�으�??�거
    this.removeSelectionOutlineFromMesh(mesh);
    
    // ?�본 머티리얼 ?�??
    if (!mesh.userData.originalMaterial) {
      mesh.userData.originalMaterial = mesh.material;
    }
    
    try {
      // 백페?�스�??�더링되???�웃?�인 ?�성
      const outlineGeometry = mesh.geometry.clone();
      const outlineMaterial = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.6,
        depthWrite: false
      });
      
      const outlineObject = new THREE.Mesh(outlineGeometry, outlineMaterial);
      
      // 메시?� 같�? transform ?�용
      outlineObject.position.copy(mesh.position);
      outlineObject.rotation.copy(mesh.rotation);
      outlineObject.scale.copy(mesh.scale);
      
      // ?�웃?�인???�해 ?�간 ?�게 ?��??�링
      outlineObject.scale.multiplyScalar(1.03);
      
      // ?�더 ?�서 ?�정
      outlineObject.renderOrder = mesh.renderOrder - 1;
      
      // 메시??부모에 추�?
      if (mesh.parent) {
        mesh.parent.add(outlineObject);
      }
      
      // 참조 ?�??
      mesh.userData.outlineObject = outlineObject;
      
      // 발광 ?�과 추�?
      if (mesh.material && mesh.material.emissive !== undefined) {
        mesh.userData.originalEmissive = mesh.material.emissive.clone();
        mesh.userData.originalEmissiveIntensity = mesh.material.emissiveIntensity || 0;
        
        mesh.material.emissive.setHex(0x001122);
        mesh.material.emissiveIntensity = 0.1;
      }
    } catch (error) {
      // Console output removed
    }
  }
  
  // ?�택 ?�웃?�인 ?�거
  removeSelectionOutline(object) {
    // ?�전??검??
    if (!object) {
      // Console output removed
      return;
    }
    
    // Group??경우 ?�식 메시?�의 ?�웃?�인 ?�거
    if (object.isGroup || (object.children && object.children.length > 0)) {
      this.removeSelectionOutlineFromGroup(object);
      return;
    }
    
    // ?�일 메시??경우
    this.removeSelectionOutlineFromMesh(object);
  }
  
  // Group?�서 ?�웃?�인 ?�거
  removeSelectionOutlineFromGroup(group) {
    // ?�전??검??
    if (!group || !group.traverse) {
      // Console output removed
      return;
    }
    
    try {
      // Group??모든 ?�식 메시?�서 ?�웃?�인 ?�거
      group.traverse((child) => {
        // child가 ?�효?��? ?�인
        if (child && child.isMesh && child !== group) {
          this.removeSelectionOutlineFromMesh(child);
        }
      });
    } catch (error) {
      // Console output removed
      // Console output removed
    }
    
    // Group???�웃?�인 ?�보 ?�리
    if (group.userData) {
      delete group.userData.outlineChildren;
    }
  }
  
  // ?�일 메시?�서 ?�웃?�인 ?�거
  removeSelectionOutlineFromMesh(object) {
    // ?�전??검??
    if (!object || !object.userData) {
      // Console output removed
      return;
    }
    
    // ?�웃?�인 ?�브?�트 ?�거
    if (object.userData.outlineObject) {
      if (object.userData.outlineObject.parent) {
        object.userData.outlineObject.parent.remove(object.userData.outlineObject);
      }
      
      // 메모�??�리
      if (object.userData.outlineObject.geometry) {
        object.userData.outlineObject.geometry.dispose();
      }
      if (object.userData.outlineObject.material) {
        object.userData.outlineObject.material.dispose();
      }
      
      delete object.userData.outlineObject;
    }
    
    // ?�본 발광 ?�과 복원
    if (object.material && object.userData.originalEmissive !== undefined) {
      object.material.emissive.copy(object.userData.originalEmissive);
      object.material.emissiveIntensity = object.userData.originalEmissiveIntensity;
      
      delete object.userData.originalEmissive;
      delete object.userData.originalEmissiveIntensity;
    }
  }
  
  // ?�웃?�인 ?�치/?�전/?��????�데?�트
  updateSelectionOutline(object) {
    // ?�전??검??
    if (!object) {
      // Console output removed
      return;
    }
    
    // Group??경우 ?�식 메시?�의 ?�웃?�인 ?�데?�트
    if (object.isGroup || (object.children && object.children.length > 0)) {
      this.updateSelectionOutlineForGroup(object);
      return;
    }
    
    // ?�일 메시??경우
    this.updateSelectionOutlineForMesh(object);
  }
  
  // Group???�웃?�인 ?�데?�트
  updateSelectionOutlineForGroup(group) {
    // ?�전??검??
    if (!group || !group.traverse) {
      // Console output removed
      return;
    }
    
    try {
      // Group??모든 ?�식 메시???�웃?�인 ?�데?�트
      group.traverse((child) => {
        // child가 ?�효?��? ?�인
        if (child && child.isMesh && child !== group) {
          this.updateSelectionOutlineForMesh(child);
        }
      });
    } catch (error) {
      // Console output removed
      // Console output removed
    }
  }
  
  // ?�일 메시???�웃?�인 ?�데?�트
  updateSelectionOutlineForMesh(object) {
    // ?�전??검??
    if (!object || !object.userData || !object.userData.outlineObject) {
      return;
    }
    
    const outlineObject = object.userData.outlineObject;
    
    // ?�본 ?�브?�트??transform???�웃?�인???�용
    outlineObject.position.copy(object.position);
    outlineObject.rotation.copy(object.rotation);
    outlineObject.scale.copy(object.scale);
    
    // ?�웃?�인???�해 ?�간 ?�게 ?��??�링
    outlineObject.scale.multiplyScalar(1.03);
  }
  
  // 모든 ?�택???�브?�트???�웃?�인 ?�데?�트 (?�니메이??중인 ?�브?�트??
  updateAllSelectionOutlines() {
    // 배열 ?�리 먼�? ?�행
    this.cleanupSelectedObjects();
    
    for (const object of this.selectedObjects) {
      if (object) { // undefined??null 체크
        this.updateSelectionOutline(object);
      }
    }
  }
  
  // selectedObjects 배열?�서 ?�효?��? ?��? 객체???�거
  cleanupSelectedObjects() {
    const initialLength = this.selectedObjects.length;
    this.selectedObjects = this.selectedObjects.filter(object => object != null);
    
    if (this.selectedObjects.length !== initialLength) {
      // Console output removed
      
      // lastSelectedObject???�인
      if (!this.selectedObjects.includes(this.lastSelectedObject)) {
        this.lastSelectedObject = this.selectedObjects.length > 0 ? this.selectedObjects[this.selectedObjects.length - 1] : null;
      }
    }
  }
  
  // 기즈�?모드 ?�정
  setGizmoMode(mode) {
    if (!this.transformControls) {
      // Console output removed
      return;
    }
    
    // Console output removed
    
    this.gizmoMode = mode;
    this.transformControls.setMode(mode);
    
    // ?�디???�토?�에 모드 ?�정
    const editorState = this.editorStore.getState();
    if (editorState.setTransformMode) {
      editorState.setTransformMode(mode);
    }
    
    // 기즈모�? ?�택???�브?�트???�결?�어 ?�는지 ?�인
    const selectedObject = this.editorStore.getState().selectedObject;
    if (selectedObject && !this.transformControls.object) {
      // Console output removed
      this.transformControls.attach(selectedObject);
    }
  }
  
  // 그리드 스냅 설정
  setGridSnap(enabled, gridSize = 1) {
    if (!this.transformControls) return;
    
    if (enabled) {
      this.transformControls.setTranslationSnap(gridSize);
      this.transformControls.setRotationSnap(THREE.MathUtils.degToRad(15)); // 15도 단위
      this.transformControls.setScaleSnap(0.1); // 0.1 단위
    } else {
      this.transformControls.setTranslationSnap(null);
      this.transformControls.setRotationSnap(null);
      this.transformControls.setScaleSnap(null);
    }
  }
  
  // 그리드 스냅 상태 업데이트
  updateGridSnap() {
    const editorState = this.editorStore.getState();
    this.setGridSnap(editorState.isGridSnap, editorState.gridSize);
  }

  // 기즈모 좌표계 업데이트
  updateGizmoSpace() {
    const editorState = this.editorStore.getState();
    if (this.transformControls) {
      this.transformControls.setSpace(editorState.gizmoSpace);
    }
  }

  // 자석 기능 업데이트
  updateMagnet() {
    const editorState = this.editorStore.getState();
    this.isMagnetEnabled = editorState.isMagnetEnabled;
  }

  // 자석 레이 표시 업데이트
  updateMagnetRays() {
    const editorState = this.editorStore.getState();
    this.showMagnetRays = editorState.showMagnetRays;
    
    if (!this.showMagnetRays) {
      this.clearRayHelpers();
    }
  }

  // 레이 헬퍼 생성
  createRayHelper(origin, direction, distance, color = 0xff0000) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      origin,
      origin.clone().add(direction.clone().multiplyScalar(distance))
    ]);
    const material = new THREE.LineBasicMaterial({ color: color });
    const line = new THREE.Line(geometry, material);
    line.userData.isRayHelper = true;
    return line;
  }

  // 레이 헬퍼들 제거
  clearRayHelpers() {
    this.rayHelpers.forEach(helper => {
      this.scene.remove(helper);
      helper.geometry.dispose();
      helper.material.dispose();
    });
    this.rayHelpers = [];
  }

  // 오브젝트가 다른 오브젝트의 자식인지 확인
  isChildOf(child, parent) {
    let currentParent = child.parent;
    while (currentParent) {
      if (currentParent === parent) {
        return true;
      }
      currentParent = currentParent.parent;
    }
    return false;
  }

  // 자석 기능: 메쉬 표면에 스냅
  snapToMeshSurface(object, targetPosition) {
    if (!this.isMagnetEnabled || !object) return targetPosition;

    // 이전 레이 헬퍼들 제거
    if (this.showMagnetRays) {
      this.clearRayHelpers();
    }

    const raycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3(0, -1, 0); // 아래쪽 방향으로 레이캐스팅
    
    // 오브젝트의 바운딩 박스 계산
    const boundingBox = new THREE.Box3().setFromObject(object);
    const objectHeight = boundingBox.max.y - boundingBox.min.y;
    const objectBottomY = boundingBox.min.y; // 오브젝트 바닥 Y 좌표
    const pivotToBottomOffset = object.position.y - objectBottomY; // 피봇에서 바닥까지의 거리
    
    // 씬의 모든 메쉬 오브젝트들과 교차점 검사 (현재 오브젝트와 선택된 오브젝트들 제외)
    const intersectableObjects = [];
    this.scene.traverse((child) => {
      if (child.isMesh && child.visible && !child.userData.isRayHelper) {
        // 현재 오브젝트 제외
        if (child === object) return;
        
        // 선택된 오브젝트들과 그 자식들 제외
        let isSelected = false;
        for (const selectedObj of this.selectedObjects) {
          if (child === selectedObj || 
              child.parent === selectedObj || 
              this.isChildOf(child, selectedObj) ||
              this.isChildOf(selectedObj, child)) {
            isSelected = true;
            break;
          }
        }
        
        // 현재 드래그 중인 오브젝트와 관련된 것들도 제외
        if (this.lastSelectedObject && 
            (child === this.lastSelectedObject || 
             child.parent === this.lastSelectedObject || 
             this.isChildOf(child, this.lastSelectedObject) ||
             this.isChildOf(this.lastSelectedObject, child))) {
          isSelected = true;
        }
        
        if (!isSelected) {
          intersectableObjects.push(child);
        }
      }
    });
    
    if (intersectableObjects.length === 0) return targetPosition;
    
    // 여러 지점에서 레이캐스팅을 시도 (중심, 앞/뒤/좌/우)
    const testPoints = [
      new THREE.Vector3(0, 0, 0), // 중심
      new THREE.Vector3(0.5, 0, 0), // 우
      new THREE.Vector3(-0.5, 0, 0), // 좌
      new THREE.Vector3(0, 0, 0.5), // 앞
      new THREE.Vector3(0, 0, -0.5), // 뒤
    ];
    
    let bestIntersect = null;
    let shortestDistance = Infinity;
    
    for (let i = 0; i < testPoints.length; i++) {
      const offset = testPoints[i];
      const rayOrigin = new THREE.Vector3(
        targetPosition.x + offset.x, 
        targetPosition.y - pivotToBottomOffset + 2, // 오브젝트 바닥에서 약간 위에서 시작
        targetPosition.z + offset.z
      );
      
      raycaster.set(rayOrigin, direction);
      const intersects = raycaster.intersectObjects(intersectableObjects, true);
      
      // 레이 시각화
      if (this.showMagnetRays) {
        const rayDistance = intersects.length > 0 ? rayOrigin.distanceTo(intersects[0].point) : 10;
        const rayColor = intersects.length > 0 ? (i === 0 ? 0x00ff00 : 0x0000ff) : 0xff0000; // 중심: 녹색, 다른점: 파란색, 충돌없음: 빨간색
        const rayHelper = this.createRayHelper(rayOrigin, direction, rayDistance, rayColor);
        this.scene.add(rayHelper);
        this.rayHelpers.push(rayHelper);
        
        // 교차점 표시
        if (intersects.length > 0) {
          const sphereGeometry = new THREE.SphereGeometry(0.1, 8, 8);
          const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
          const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
          sphere.position.copy(intersects[0].point);
          sphere.userData.isRayHelper = true;
          this.scene.add(sphere);
          this.rayHelpers.push(sphere);
        }
      }
      
      if (intersects.length > 0) {
        const intersect = intersects[0];
        const distance = rayOrigin.distanceTo(intersect.point);
        
        // 가장 가까운 교차점 선택
        if (distance < shortestDistance) {
          shortestDistance = distance;
          bestIntersect = intersect;
        }
      }
    }
    
    if (bestIntersect) {
      // 교차점이 현재 위치보다 너무 높거나 낮지 않은지 확인
      const heightDifference = Math.abs(bestIntersect.point.y - (targetPosition.y - pivotToBottomOffset));
      if (heightDifference > 20) { // 20 유닛 이상 차이나면 스냅하지 않음
        return targetPosition;
      }
      
      // 피봇을 바닥 표면 + 피봇 오프셋만큼 위로 이동
      // 이렇게 하면 오브젝트 바닥이 정확히 표면에 닿게 됨
      return new THREE.Vector3(
        targetPosition.x,
        bestIntersect.point.y + pivotToBottomOffset, // 표면 + 피봇 오프셋
        targetPosition.z
      );
    }
    
    return targetPosition;
  }

  // 선택된 모든 오브젝트에 자석 기능 적용
  applyMagnetToSelectedObjects() {
    if (!this.isMagnetEnabled) return;
    
    // 기본 오브젝트에 자석 기능 적용
    if (this.lastSelectedObject) {
      const currentPosition = this.lastSelectedObject.position.clone();
      const snappedPosition = this.snapToMeshSurface(this.lastSelectedObject, currentPosition);
      this.lastSelectedObject.position.copy(snappedPosition);
    }
    
    // 다른 선택된 오브젝트들에도 자석 기능 적용
    for (const object of this.selectedObjects) {
      if (object && object !== this.lastSelectedObject) {
        const currentPosition = object.position.clone();
        const snappedPosition = this.snapToMeshSurface(object, currentPosition);
        object.position.copy(snappedPosition);
      }
    }
  }
  
  // 카메???�데?�트 (카메?��? 변경될 ???�출)
  updateCamera(camera) {
    this.camera = camera;
    if (this.transformControls) {
      this.transformControls.camera = camera;
    }
  }
  
  // ?�택 가?�한 ?�브?�트 관�?
  addSelectableObject(object) {
    if (!this.selectableObjects.includes(object)) {
      this.selectableObjects.push(object);
    }
  }
  
  removeSelectableObject(object) {
    const index = this.selectableObjects.indexOf(object);
    if (index > -1) {
      this.selectableObjects.splice(index, 1);
    }
  }
  
  updateSelectableObjects(objects) {
    this.selectableObjects = [...objects];
  }
  
  // ?�택 박스 ?�시/?�기�?
  showSelectionBox(left, top, width, height) {
    this.selectionBox.style.display = 'block';
    this.selectionBox.style.left = left + 'px';
    this.selectionBox.style.top = top + 'px';
    this.selectionBox.style.width = width + 'px';
    this.selectionBox.style.height = height + 'px';
  }
  
  hideSelectionBox() {
    this.selectionBox.style.display = 'none';
  }
  
  // Getter 메서?�들
  getSelectedObjects() {
    return [...this.selectedObjects];
  }

  getSelectableObjects() {
    return [...this.selectableObjects];
  }
  
  getTransformControls() {
    return this.transformControls;
  }
  
  isDraggingGizmo() {
    return this.isDragging;
  }
  
  // ?�리
  dispose() {
    // Ray helpers 정리
    this.clearRayHelpers();
    
    // Transform controls ?�제
    if (this.transformControls) {
      this.transformControls.dispose();
      this.scene.remove(this.transformControls);
    }
    
    // ?�택 박스 ?�거
    if (this.selectionBox && this.selectionBox.parentNode) {
      this.selectionBox.parentNode.removeChild(this.selectionBox);
    }
    
    // Console output removed
  }
}
