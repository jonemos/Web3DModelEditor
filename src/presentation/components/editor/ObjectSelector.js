import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export class ObjectSelector {
  constructor(scene, camera, renderer, editorService) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.editorService = editorService;
    
    // 선택 관련 상태
    this.selectedObjects = [];
    this.lastSelectedObject = null; // 마지막으로 선택된 오브젝트 (기즈모 위치 기준)
    this.selectableObjects = [];
    this.raycaster = new THREE.Raycaster();
    
    // 드래그 선택 박스
    this.selectionBox = null;
    this.createSelectionBox();
    
    // Transform controls (기즈모)
    this.transformControls = null;
    this.gizmoMode = 'translate'; // translate, rotate, scale
    this.isDragging = false;
    
    // 다중 선택 변형을 위한 초기 상태 저장
    this.initialTransformStates = new Map(); // object -> initial transform state
    
    this.initializeTransformControls();
    
    // ObjectSelector initialized
  }
  
  // 초기 변형 상태 저장
  saveInitialTransformStates() {
    this.initialTransformStates.clear();
    
    for (const object of this.selectedObjects) {
      if (object && object.position && object.rotation && object.scale) { // 안전성 검사
        this.initialTransformStates.set(object, {
          position: object.position.clone(),
          rotation: object.rotation.clone(),
          scale: object.scale.clone()
        });
      }
    }
  }
  
  // 다중 선택된 오브젝트들에 변형 적용
  applyTransformToSelectedObjects() {
    if (!this.lastSelectedObject || !this.transformControls.object || this.selectedObjects.length <= 1) {
      // 단일 선택인 경우에도 아웃라인 업데이트
      if (this.lastSelectedObject) {
        this.updateSelectionOutline(this.lastSelectedObject);
      }
      return;
    }
    
    const primaryObject = this.lastSelectedObject; // 기즈모와 연결된 기준 오브젝트
    const primaryInitialState = this.initialTransformStates.get(primaryObject);
    
    if (!primaryInitialState) return;
    
    // 다른 선택된 오브젝트들에 상대적 변형 적용
    for (const object of this.selectedObjects) {
      if (object && object !== primaryObject) {
        const objectInitialState = this.initialTransformStates.get(object);
        if (objectInitialState) {
          this.applyRelativeTransform(object, primaryObject, primaryInitialState, objectInitialState);
        }
      }
    }
    
    // 모든 선택된 오브젝트의 아웃라인 업데이트
    for (const object of this.selectedObjects) {
      if (object) { // undefined와 null 체크
        this.updateSelectionOutline(object);
      }
    }
  }
  
  // 상대적 변형 적용 (개선된 버전)
  applyRelativeTransform(targetObject, primaryObject, primaryInitialState, targetInitialState) {
    const mode = this.transformControls.getMode();
    
    switch (mode) {
      case 'translate':
        // 이동: 기준 오브젝트의 이동량을 대상 오브젝트에 적용
        const positionDelta = new THREE.Vector3().subVectors(primaryObject.position, primaryInitialState.position);
        targetObject.position.copy(targetInitialState.position).add(positionDelta);
        break;
        
      case 'rotate':
        // 회전: 기준 오브젝트의 회전량을 대상 오브젝트에 적용
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
        // 크기: 기준 오브젝트의 크기 비율을 대상 오브젝트에 적용
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
      
      // 이벤트 리스너 추가
      this.transformControls.addEventListener('dragging-changed', (event) => {
        this.isDragging = event.value;
        
        if (event.value) {
          // 드래그 시작 - 모든 선택된 오브젝트의 초기 상태 저장
          this.saveInitialTransformStates();
          // Transform drag started, saved initial states
        } else {
          // 드래그 종료 - 초기 상태 정리하기
          this.initialTransformStates.clear();
          // Transform drag ended, cleared initial states
        }
      });
      
      // 다중 선택된 오브젝트들의 실시 변형을 위한 이벤트 리스너
      this.transformControls.addEventListener('change', () => {
        this.applyTransformToSelectedObjects();
      });
      
      // 기즈모 설정
      this.transformControls.setSize(1.0);
      
      // TransformControls의 getHelper()를 사용해서 시각적 표현을 씬에 추가
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
    // 드래그 선택 박스 생성
    this.selectionBox = document.createElement('div');
    this.selectionBox.style.position = 'absolute';
    this.selectionBox.style.border = '2px dashed #007acc';
    this.selectionBox.style.backgroundColor = 'rgba(0, 122, 204, 0.1)';
    this.selectionBox.style.pointerEvents = 'none';
    this.selectionBox.style.display = 'none';
    this.selectionBox.style.zIndex = '1000';
    document.body.appendChild(this.selectionBox);
  }
  
  // 객체가 선택에 유효한지 검사하는 헬퍼 메서드
  isObjectValidForSelection(object) {
    return object && 
           (object.isMesh || object.isGroup) && 
           object.userData && 
           object.visible;
  }
  
  // 단일 오브젝트 선택
  selectSingleObject(object) {
    // 안전성 검사
    if (!object || !this.isObjectValidForSelection(object)) {
      // Console output removed
      return;
    }
    
    // Console output removed
    
    // 배열 정리
    this.cleanupSelectedObjects();
    
    // 모든 선택 해제
    this.deselectAllObjects();
    
    // 새 오브젝트 선택
    this.selectedObjects = [object];
    this.lastSelectedObject = object; // 마지막 선택된 오브젝트 업데이트
    this.editorService.setSelectedObject(object.uuid || object.id);
    
    // 기즈모 연결 (객체가 씬에 있는지 확인)
    if (this.transformControls && object.parent) {
      // 객체가 씬 그래프에 포함되어있는지 확인
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
    
    // 시각적 피드백
    this.addSelectionOutline(object);
    
    // Console output removed
  }
  
  // 다중 오브젝트 선택
  selectMultipleObjects(objects, isMultiSelect = false) {
    // 안전성 검사
    if (!objects || !Array.isArray(objects)) {
      // Console output removed
      return;
    }
    
    if (!isMultiSelect) {
      this.deselectAllObjects();
    }
    
    for (const object of objects) {
      // 각 오브젝트가 유효한지 검사
      if (object && !this.selectedObjects.includes(object)) {
        this.selectedObjects.push(object);
        this.lastSelectedObject = object; // 마지막으로 추가된 오브젝트를 마지막 선택으로 설정
        this.addSelectionOutline(object);
      }
    }
    
    // 마지막 선택된 오브젝트에 기즈모 위치를 설정
    if (this.lastSelectedObject && this.transformControls) {
      this.editorService.setSelectedObject(this.lastSelectedObject.uuid || this.lastSelectedObject.id);
      this.transformControls.attach(this.lastSelectedObject);
      this.setGizmoMode(this.gizmoMode);
      // Console output removed
    }
    
    // Console output removed
  }
  
  // 오브젝트 선택 토글
  toggleObjectSelection(object) {
    // 안전성 검사
    if (!object) {
      // Console output removed
      return;
    }
    
    const index = this.selectedObjects.indexOf(object);
    
    if (index > -1) {
      // 이미 선택된 오브젝트 - 선택 해제
      this.selectedObjects.splice(index, 1);
      this.removeSelectionOutline(object);
      
      // 마지막 선택된 오브젝트가 제거된 경우 업데이트
      if (this.lastSelectedObject === object) {
        this.lastSelectedObject = this.selectedObjects.length > 0 ? this.selectedObjects[this.selectedObjects.length - 1] : null;
      }
      
      // Transform controls 업데이트
      if (this.selectedObjects.length > 0 && this.transformControls) {
        const targetObject = this.lastSelectedObject || this.selectedObjects[0];
        this.editorService.setSelectedObject(targetObject.uuid || targetObject.id);
        this.transformControls.attach(targetObject);
        this.setGizmoMode(this.gizmoMode);
        // Console output removed
      } else {
        this.editorService.deselectAllObjects();
        this.lastSelectedObject = null;
        if (this.transformControls) {
          this.transformControls.detach();
        }
      }
    } else {
      // 새로운 오브젝트 선택
      this.selectedObjects.push(object);
      this.lastSelectedObject = object; // 새로 선택된 오브젝트를 마지막 선택으로 설정
      this.addSelectionOutline(object);
      
      // Transform controls를 마지막 선택된 오브젝트에 연결
      if (this.transformControls) {
        this.editorService.setSelectedObject(object.uuid || object.id);
        this.transformControls.attach(object);
        this.setGizmoMode(this.gizmoMode);
        // Console output removed
      }
    }
    
    // Console output removed
    // Console output removed
  }
  
  // 모든 오브젝트 선택 해제
  deselectAllObjects() {
    // Console output removed
    
    // 기즈모 먼저 해제 (가장 중요)
    if (this.transformControls) {
      try {
        this.transformControls.detach();
        // Console output removed
      } catch (error) {
        // Console output removed
      }
    }
    
    // 배열 정리 먼저 수행
    this.cleanupSelectedObjects();
    
    // 모든 선택된 오브젝트의 아웃라인 제거 (안전성 검사 포함)
    for (const object of this.selectedObjects) {
      if (object) { // undefined와 null 체크
        try {
          this.removeSelectionOutline(object);
        } catch (error) {
          // Console output removed
        }
      }
    }
    
    this.selectedObjects = [];
    this.lastSelectedObject = null; // 마지막 선택된 오브젝트도 초기화
    this.editorService.deselectAllObjects();
    
    // Console output removed
  }
  
  // 선택된 객체 배열에서 유효하지 않은 객체들을 제거
  cleanupSelectedObjects() {
    this.selectedObjects = this.selectedObjects.filter(obj => {
      const isValid = this.isObjectValidForSelection(obj);
      if (!isValid) {
        // Console output removed
        // 유효하지 않은 객체의 아웃라인 제거
        try {
          this.removeSelectionOutline(obj);
        } catch (error) {
          // Console output removed
        }
      }
      return isValid;
    });
    
    // 마지막 선택된 객체도 검사
    if (this.lastSelectedObject && !this.isObjectValidForSelection(this.lastSelectedObject)) {
      this.lastSelectedObject = this.selectedObjects.length > 0 ? this.selectedObjects[this.selectedObjects.length - 1] : null;
    }
  }
  
  // 마우스 위치에서 오브젝트 선택 처리
  handleObjectSelection(mousePosition, isMultiSelect = false) {
    // 기즈모 클릭 체크
    if (this.transformControls && this.transformControls.dragging) return;
    
    this.raycaster.setFromCamera(mousePosition, this.camera);
    const intersects = this.raycaster.intersectObjects(this.selectableObjects, true);
    
    if (intersects.length > 0) {
      // 첫번째 교차점의 오브젝트 선택
      let selectedObject = intersects[0].object;
      
      // 부모 오브젝트 찾기 (그룹인 경우)
      while (selectedObject.parent && !this.selectableObjects.includes(selectedObject)) {
        selectedObject = selectedObject.parent;
      }
      
      // 선택된 오브젝트가 유효한지 확인
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
      // 빈 공간 클릭 시 모든 선택 해제
      this.deselectAllObjects();
    }
  }
  
  // 드래그 선택 영역 안의 오브젝트들 찾기
  getObjectsInArea(startPos, endPos) {
    const selectedInArea = [];
    const minX = Math.min(startPos.x, endPos.x);
    const maxX = Math.max(startPos.x, endPos.x);
    const minY = Math.min(startPos.y, endPos.y);
    const maxY = Math.max(startPos.y, endPos.y);
    
    for (const object of this.selectableObjects) {
      // 오브젝트의 화면 좌표 계산
      const objectPosition = new THREE.Vector3();
      object.getWorldPosition(objectPosition);
      objectPosition.project(this.camera);
      
      // 선택 영역 안에 있는지 확인
      if (objectPosition.x >= minX && objectPosition.x <= maxX &&
          objectPosition.y >= minY && objectPosition.y <= maxY) {
        selectedInArea.push(object);
      }
    }
    
    return selectedInArea;
  }
  
  // 선택 아웃라인 추가
  addSelectionOutline(object) {
    // 안전성 검사
    if (!object) {
      // Console output removed
      return;
    }
    
    // Group인 경우 하위 메시들에 아웃라인 적용
    if (object.isGroup || (object.children && object.children.length > 0)) {
      this.addSelectionOutlineToGroup(object);
      return;
    }
    
    // 단일 메시인 경우
    if (!object.isMesh) return;
    
    // 기존 아웃라인이 있으면 제거
    this.removeSelectionOutline(object);
    
    // 원본 머티리얼 저장
    if (!object.userData.originalMaterial) {
      object.userData.originalMaterial = object.material;
    }
    
    try {
      // 1. 백페이스로 렌더링되는 아웃라인 생성
      const outlineGeometry = object.geometry.clone();
      const outlineMaterial = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.6,
        depthWrite: false
      });
      
      const outlineObject = new THREE.Mesh(outlineGeometry, outlineMaterial);
      
      // 오브젝트와 같은 transform 적용
      outlineObject.position.copy(object.position);
      outlineObject.rotation.copy(object.rotation);
      outlineObject.scale.copy(object.scale);
      
      // 아웃라인을 위해 약간 크게 스케일링
      outlineObject.scale.multiplyScalar(1.03);
      
      // 렌더 순서 설정
      outlineObject.renderOrder = object.renderOrder - 1;
      
      // 부모에 추가
      if (object.parent) {
        object.parent.add(outlineObject);
      } else {
        this.scene.add(outlineObject);
      }
      
      // 참조 저장
      object.userData.outlineObject = outlineObject;
      
      // 2. 원본 오브젝트에 미묘한 발광 효과 추가 (있는 경우에만)
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
  
  // Group 또는 복합 오브젝트의 아웃라인 추가
  addSelectionOutlineToGroup(group) {
    // 안전성 검사
    if (!group || !group.traverse) {
      // Console output removed
      return;
    }
    
    try {
      // Group의 모든 하위 메시에 아웃라인 적용
      group.traverse((child) => {
        // child가 유효한지 확인
        if (child && child.isMesh && child !== group) {
          this.addSelectionOutlineToSingleMesh(child);
        }
      });
    } catch (error) {
      // Console output removed
      // Console output removed
    }
    
    // Group의 아웃라인 정보 저장
    if (group.userData) {
      if (!group.userData.outlineChildren) {
        group.userData.outlineChildren = [];
      }
    }
    
    // Console output removed
  }
  
  // 단일 메시의 아웃라인 추가 (Group의 하위용)
  addSelectionOutlineToSingleMesh(mesh) {
    if (!mesh.isMesh) return;
    
    // 기존 아웃라인이 있으면 제거
    this.removeSelectionOutlineFromMesh(mesh);
    
    // 원본 머티리얼 저장
    if (!mesh.userData.originalMaterial) {
      mesh.userData.originalMaterial = mesh.material;
    }
    
    try {
      // 백페이스로 렌더링되는 아웃라인 생성
      const outlineGeometry = mesh.geometry.clone();
      const outlineMaterial = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.6,
        depthWrite: false
      });
      
      const outlineObject = new THREE.Mesh(outlineGeometry, outlineMaterial);
      
      // 메시와 같은 transform 적용
      outlineObject.position.copy(mesh.position);
      outlineObject.rotation.copy(mesh.rotation);
      outlineObject.scale.copy(mesh.scale);
      
      // 아웃라인을 위해 약간 크게 스케일링
      outlineObject.scale.multiplyScalar(1.03);
      
      // 렌더 순서 설정
      outlineObject.renderOrder = mesh.renderOrder - 1;
      
      // 메시의 부모에 추가
      if (mesh.parent) {
        mesh.parent.add(outlineObject);
      }
      
      // 참조 저장
      mesh.userData.outlineObject = outlineObject;
      
      // 발광 효과 추가
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
  
  // 선택 아웃라인 제거
  removeSelectionOutline(object) {
    // 안전성 검사
    if (!object) {
      // Console output removed
      return;
    }
    
    // Group인 경우 하위 메시들의 아웃라인 제거
    if (object.isGroup || (object.children && object.children.length > 0)) {
      this.removeSelectionOutlineFromGroup(object);
      return;
    }
    
    // 단일 메시인 경우
    this.removeSelectionOutlineFromMesh(object);
  }
  
  // Group에서 아웃라인 제거
  removeSelectionOutlineFromGroup(group) {
    // 안전성 검사
    if (!group || !group.traverse) {
      // Console output removed
      return;
    }
    
    try {
      // Group의 모든 하위 메시에서 아웃라인 제거
      group.traverse((child) => {
        // child가 유효한지 확인
        if (child && child.isMesh && child !== group) {
          this.removeSelectionOutlineFromMesh(child);
        }
      });
    } catch (error) {
      // Console output removed
      // Console output removed
    }
    
    // Group의 아웃라인 정보 정리
    if (group.userData) {
      delete group.userData.outlineChildren;
    }
  }
  
  // 단일 메시에서 아웃라인 제거
  removeSelectionOutlineFromMesh(object) {
    // 안전성 검사
    if (!object || !object.userData) {
      // Console output removed
      return;
    }
    
    // 아웃라인 오브젝트 제거
    if (object.userData.outlineObject) {
      if (object.userData.outlineObject.parent) {
        object.userData.outlineObject.parent.remove(object.userData.outlineObject);
      }
      
      // 메모리 정리
      if (object.userData.outlineObject.geometry) {
        object.userData.outlineObject.geometry.dispose();
      }
      if (object.userData.outlineObject.material) {
        object.userData.outlineObject.material.dispose();
      }
      
      delete object.userData.outlineObject;
    }
    
    // 원본 발광 효과 복원
    if (object.material && object.userData.originalEmissive !== undefined) {
      object.material.emissive.copy(object.userData.originalEmissive);
      object.material.emissiveIntensity = object.userData.originalEmissiveIntensity;
      
      delete object.userData.originalEmissive;
      delete object.userData.originalEmissiveIntensity;
    }
  }
  
  // 아웃라인 위치/회전/크기 업데이트
  updateSelectionOutline(object) {
    // 안전성 검사
    if (!object) {
      // Console output removed
      return;
    }
    
    // Group인 경우 하위 메시들의 아웃라인 업데이트
    if (object.isGroup || (object.children && object.children.length > 0)) {
      this.updateSelectionOutlineForGroup(object);
      return;
    }
    
    // 단일 메시인 경우
    this.updateSelectionOutlineForMesh(object);
  }
  
  // Group의 아웃라인 업데이트
  updateSelectionOutlineForGroup(group) {
    // 안전성 검사
    if (!group || !group.traverse) {
      // Console output removed
      return;
    }
    
    try {
      // Group의 모든 하위 메시의 아웃라인 업데이트
      group.traverse((child) => {
        // child가 유효한지 확인
        if (child && child.isMesh && child !== group) {
          this.updateSelectionOutlineForMesh(child);
        }
      });
    } catch (error) {
      // Console output removed
      // Console output removed
    }
  }
  
  // 단일 메시의 아웃라인 업데이트
  updateSelectionOutlineForMesh(object) {
    // 안전성 검사
    if (!object || !object.userData || !object.userData.outlineObject) {
      return;
    }
    
    const outlineObject = object.userData.outlineObject;
    
    // 원본 오브젝트의 transform을 아웃라인에 적용
    outlineObject.position.copy(object.position);
    outlineObject.rotation.copy(object.rotation);
    outlineObject.scale.copy(object.scale);
    
    // 아웃라인을 위해 약간 크게 스케일링
    outlineObject.scale.multiplyScalar(1.03);
  }
  
  // 모든 선택된 오브젝트의 아웃라인 업데이트 (애니메이션 중인 오브젝트용)
  updateAllSelectionOutlines() {
    // 배열 정리 먼저 수행
    this.cleanupSelectedObjects();
    
    for (const object of this.selectedObjects) {
      if (object) { // undefined와 null 체크
        this.updateSelectionOutline(object);
      }
    }
  }
  
  // selectedObjects 배열에서 유효하지 않은 객체들 제거
  cleanupSelectedObjects() {
    const initialLength = this.selectedObjects.length;
    this.selectedObjects = this.selectedObjects.filter(object => object != null);
    
    if (this.selectedObjects.length !== initialLength) {
      // Console output removed
      
      // lastSelectedObject도 확인
      if (!this.selectedObjects.includes(this.lastSelectedObject)) {
        this.lastSelectedObject = this.selectedObjects.length > 0 ? this.selectedObjects[this.selectedObjects.length - 1] : null;
      }
    }
  }
  
  // 기즈모 모드 설정
  setGizmoMode(mode) {
    if (!this.transformControls) {
      // Console output removed
      return;
    }
    
    // Console output removed
    
    this.gizmoMode = mode;
    this.transformControls.setMode(mode);
    
    // 에디터 서비스에 모드 설정 (만약 필요하다면)
    if (this.editorService.setTransformMode) {
      this.editorService.setTransformMode(mode);
    }
    
    // 기즈모가 선택된 오브젝트에 연결되어 있는지 확인
    const selectedObject = this.editorService.getSelectedObject ? this.editorService.getSelectedObject() : null;
    if (selectedObject && !this.transformControls.object) {
      // Console output removed
      this.transformControls.attach(selectedObject);
    }
  }
  
  // 카메라 업데이트 (카메라가 변경될 때 호출)
  updateCamera(camera) {
    this.camera = camera;
    if (this.transformControls) {
      this.transformControls.camera = camera;
    }
  }
  
  // 선택 가능한 오브젝트 관리
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
  
  // 선택 박스 표시/숨기기
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
  
  // Getter 메서드들
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
  
  // 정리
  dispose() {
    // Transform controls 해제
    if (this.transformControls) {
      this.transformControls.dispose();
      this.scene.remove(this.transformControls);
    }
    
    // 선택 박스 제거
    if (this.selectionBox && this.selectionBox.parentNode) {
      this.selectionBox.parentNode.removeChild(this.selectionBox);
    }
    
    // Console output removed
  }
}
