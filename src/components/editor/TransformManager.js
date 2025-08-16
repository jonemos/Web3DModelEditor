/**
 * TransformManager - 오브젝트 변형 및 기즈모 제어 전용 클래스
 * InputManager와 KeyboardController를 사용하여 입력 처리 분리
 */
import * as THREE from 'three';

export class TransformManager {
  constructor(objectSelector, editorStore, keyboardController) {
    this.objectSelector = objectSelector;
    this.editorStore = editorStore;
    this.keyboardController = keyboardController;
    
    // Transform 상태 관리
    this.state = {
      mode: 'translate',        // translate, rotate, scale
      space: 'world',           // world, local
      snapEnabled: false,       // 그리드 스냅 활성화
      gridSize: 1.0,           // 그리드 크기
  // 자석 기능 제거됨
    };
    
    // KeyboardController에 액션 등록
    this.registerKeyboardActions();
    
    // 초기 설정 적용
    this.applyInitialSettings();
  }

  /**
   * KeyboardController에 액션 등록
   */
  registerKeyboardActions() {
    if (!this.keyboardController) return;

    // Transform 액션 등록
    this.keyboardController.registerTransformActions({
      setMode: (mode) => this.setTransformMode(mode),
      toggleSpace: () => this.toggleSpace(),
      toggleSnap: () => this.toggleGridSnap(),
  // 자석 기능 제거됨
    });

    // 쿼터니언 회전 액션 등록
    this.keyboardController.registerRotationActions({
      rotateX: (degrees) => this.rotateSelectedX(degrees),
      rotateY: (degrees) => this.rotateSelectedY(degrees),
      rotateZ: (degrees) => this.rotateSelectedZ(degrees),
      resetRotation: () => this.resetSelectedRotation()
    });

    // 선택 액션 등록
    this.keyboardController.registerSelectionActions({
      deselectAll: () => this.deselectAll(),
      selectAll: () => this.selectAll()
    });

    // 오브젝트 액션 등록
    this.keyboardController.registerObjectActions({
      deleteSelected: () => this.deleteSelected(),
      duplicateSelected: () => this.duplicateSelected(),
      groupSelected: () => this.groupSelected(),
      ungroupSelected: () => this.ungroupSelected()
    });

    // 시스템 액션 등록
    this.keyboardController.registerSystemActions({
      undo: () => this.undo(),
      redo: () => this.redo()
    });
  }

  /**
   * Transform 모드 설정
   */
  setTransformMode(mode) {
    if (!this.isValidMode(mode) || !this.objectSelector) {
      return false;
    }

    const oldMode = this.state.mode;
    this.state.mode = mode;
    
    // ObjectSelector에 모드 적용
    this.objectSelector.setGizmoMode(mode);
    
    // 회전 모드일 때 쿼터니언 설정 적용
    if (mode === 'rotate') {
      this.setupQuaternionRotation();
    }
    
    // 에디터 스토어 업데이트
    if (this.editorStore?.getState().setTransformMode) {
      this.editorStore.getState().setTransformMode(mode);
    }

    
    return true;
  }

  /**
   * 좌표계 전환
   */
  toggleSpace() {
    if (!this.objectSelector?.transformControls) {
      return false;
    }

    const oldSpace = this.state.space;
    this.state.space = this.state.space === 'world' ? 'local' : 'world';
    
    this.objectSelector.transformControls.setSpace(this.state.space);
    
    
    return true;
  }

  /**
   * 그리드 스냅 토글
   */
  toggleGridSnap() {
    if (!this.objectSelector) {
      return false;
    }

    this.state.snapEnabled = !this.state.snapEnabled;
    this.objectSelector.setGridSnap(this.state.snapEnabled, this.state.gridSize);
    
    
    return true;
  }

  /**
   * 그리드 크기 설정
   */
  setGridSize(size) {
    if (!this.objectSelector || !this.isValidGridSize(size)) {
      return false;
    }

    const oldSize = this.state.gridSize;
    this.state.gridSize = size;
    
    if (this.state.snapEnabled) {
      this.objectSelector.setGridSnap(this.state.snapEnabled, this.state.gridSize);
    }

    
    return true;
  }

  /**
   * 자석 기능 토글
   */
  // 자석 기능 제거됨

  /**
   * 모든 오브젝트 선택 해제
   */
  deselectAll() {
    if (!this.objectSelector) {
      return false;
    }

    const selectedCount = this.objectSelector.selectedObjects?.length || 0;
    this.objectSelector.deselectAllObjects();
    
    return true;
  }

  /**
   * 모든 선택 가능한 오브젝트 선택
   */
  selectAll() {
    if (!this.objectSelector) {
      return false;
    }

    const selectableObjects = this.objectSelector.getSelectableObjects();
    if (selectableObjects && selectableObjects.length > 0) {
      this.objectSelector.selectMultipleObjects(selectableObjects);
      return true;
    }

    return false;
  }

  /**
   * 선택된 오브젝트 삭제
   */
  deleteSelected() {
    if (!this.objectSelector || !this.hasSelectedObjects()) {
      return false;
    }

  const selectedObjects = [...this.objectSelector.selectedObjects];
    const deleteCount = selectedObjects.length;
    
  // 배치 시작
  try { this.editorStore?.getState?.().beginBatch?.(); } catch {}

    // 선택 해제 전에 스토어 히스토리/상태 갱신을 위해 ID 수집
    const ids = selectedObjects.map(o => o?.userData?.id).filter(Boolean);
    const api = this.editorStore?.getState?.();

    // 선택 해제
    this.deselectAll();

    // 씬에서 제거 + 스토어에서 제거 기록
    selectedObjects.forEach(object => {
      this.removeObjectFromScene(object);
      const id = object?.userData?.id;
      if (id && api?.removeObjectById) {
        api.removeObjectById(id);
      }
    });

  // 배치 종료
  try { this.editorStore?.getState?.().endBatch?.(); } catch {}

    return true;
  }

  /**
   * 선택된 오브젝트 복제
   */
  duplicateSelected() {
    if (!this.objectSelector || !this.hasSelectedObjects()) {
      return false;
    }

    const selectedObjects = [...this.objectSelector.selectedObjects];
    const clonedObjects = [];

  // 배치 시작
  try { this.editorStore?.getState?.().beginBatch?.(); } catch {}

  const api = this.editorStore?.getState?.();
    selectedObjects.forEach(object => {
      const cloned = this.cloneObject(object);
      if (cloned) {
        clonedObjects.push(cloned);
        // 스토어 objects에도 추가 (최소 필드 세트)
        const id = cloned.userData?.id;
        if (id && api?.addObject) {
          api.addObject({
            id,
            name: cloned.name || `Object_${id}`,
            type: object?.userData?.type || 'basic',
      parentId: object?.userData?.id ? (object.parent?.userData?.id ?? null) : null,
            position: { x: cloned.position.x, y: cloned.position.y, z: cloned.position.z },
            rotation: { x: cloned.rotation.x, y: cloned.rotation.y, z: cloned.rotation.z },
            scale: { x: cloned.scale.x, y: cloned.scale.y, z: cloned.scale.z },
            visible: cloned.visible !== false,
          });
        }
      }
    });

    // 복제된 오브젝트들 선택
    if (clonedObjects.length > 0) {
      this.selectObjects(clonedObjects);
    }

  // 배치 종료
  try { this.editorStore?.getState?.().endBatch?.(); } catch {}

    return clonedObjects;
  }

  /**
   * 선택된 오브젝트들 그룹화
   */
  groupSelected() {
    if (!this.objectSelector || this.objectSelector.selectedObjects?.length < 2) {
      return false;
    }

    const selectedObjects = [...this.objectSelector.selectedObjects];
    // 배치 시작
    try { this.editorStore?.getState?.().beginBatch?.(); } catch {}
    const group = this.createGroup(selectedObjects);

    if (group) {
      this.selectObjects([group]);
      // 배치 종료
      try { this.editorStore?.getState?.().endBatch?.(); } catch {}
      return group;
    }

    // 실패 시 배치 종료 안전 처리
    try { this.editorStore?.getState?.().endBatch?.(); } catch {}
    return false;
  }

  /**
   * 그룹 해제
   */
  ungroupSelected() {
    if (!this.objectSelector || this.objectSelector.selectedObjects?.length !== 1) {
      return false;
    }

    const selectedObject = this.objectSelector.selectedObjects[0];
    if (!this.isGroup(selectedObject)) {
      return false;
    }

    // 배치 시작
    try { this.editorStore?.getState?.().beginBatch?.(); } catch {}
    const children = this.ungroupObject(selectedObject);
    if (children.length > 0) {
      this.selectObjects(children);
      // 배치 종료
      try { this.editorStore?.getState?.().endBatch?.(); } catch {}
      return children;
    }

    // 실패 시 배치 종료 안전 처리
    try { this.editorStore?.getState?.().endBatch?.(); } catch {}
    return false;
  }

  /**
   * 초기 설정 적용
   */
  applyInitialSettings() {
    if (!this.objectSelector) return;

    this.objectSelector.setGizmoMode(this.state.mode);
    this.objectSelector.setGridSnap(this.state.snapEnabled, this.state.gridSize);
    this.objectSelector.isMagnetEnabled = this.state.magnetEnabled;
    this.objectSelector.showMagnetRays = this.state.magnetRaysVisible;

    if (this.objectSelector.transformControls) {
      this.objectSelector.transformControls.setSpace(this.state.space);
      
      // 쿼터니언 회전 모드 활성화
      this.setupQuaternionRotation();
    }
  }

  /**
   * 쿼터니언 회전 모드 설정
   */
  setupQuaternionRotation() {
    if (!this.objectSelector?.transformControls) return;

    const controls = this.objectSelector.transformControls;
    
    // 회전 모드일 때 쿼터니언 사용 설정
    if (this.state.mode === 'rotate') {
      // TransformControls의 회전 처리를 쿼터니언 기반으로 설정
      controls.rotationSnap = Math.PI / 12; // 15도 스냅
      
      // 회전 이벤트 리스너 추가
      this.setupRotationEventListeners();
    }
  }

  /**
   * 회전 이벤트 리스너 설정
   */
  setupRotationEventListeners() {
    if (!this.objectSelector?.transformControls) return;

    const controls = this.objectSelector.transformControls;
    
    // 회전 변경 이벤트 감지
    controls.addEventListener('objectChange', () => {
      if (controls.getMode() === 'rotate' && this.hasSelectedObjects()) {
        this.onQuaternionRotationChange();
      }
    });
  }

  /**
   * 쿼터니언 회전 변경 시 처리
   */
  onQuaternionRotationChange() {
    // 선택된 오브젝트들의 쿼터니언이 업데이트됨을 로깅
    const selectedObjects = this.objectSelector.selectedObjects;
    
    selectedObjects.forEach((object, index) => {
      // 쿼터니언 정규화 확인
      object.quaternion.normalize();
      
      // 변환 행렬 업데이트
      object.updateMatrix();
      object.updateMatrixWorld();
    });

    // 회전 상태 로깅
    if (selectedObjects.length > 0) {
      const rotation = this.getSelectedObjectRotation(selectedObjects[0]);
    }
  }

  /**
   * ObjectSelector 업데이트
   */
  updateObjectSelector(newObjectSelector) {
    this.objectSelector = newObjectSelector;
    this.applyInitialSettings();
  }

  /**
   * 현재 상태 반환
   */
  getState() {
    return {
      ...this.state,
      selectedObjectsCount: this.objectSelector?.selectedObjects?.length || 0,
      hasSelection: this.hasSelectedObjects()
    };
  }

  /**
   * 상태 일괄 적용
   */
  applySettings(settings) {
    if (settings.mode && settings.mode !== this.state.mode) {
      this.setTransformMode(settings.mode);
    }
    
    if (settings.space && settings.space !== this.state.space) {
      this.toggleSpace();
    }
    
    if (settings.snapEnabled !== undefined && settings.snapEnabled !== this.state.snapEnabled) {
      this.toggleGridSnap();
    }
    
    if (settings.gridSize && settings.gridSize !== this.state.gridSize) {
      this.setGridSize(settings.gridSize);
    }
    
  // 자석 기능 제거됨
  }

  // ======================
  // 쿼터니언 회전 메서드들
  // ======================

  /**
   * 선택된 오브젝트를 쿼터니언으로 회전
   */
  rotateSelectedObjects(quaternion) {
    if (!this.hasSelectedObjects()) {
      return false;
    }

    const selectedObjects = this.objectSelector.selectedObjects;
    
    selectedObjects.forEach(object => {
      this.applyQuaternionRotation(object, quaternion);
    });

    
    return true;
  }

  /**
   * 개별 오브젝트에 쿼터니언 회전 적용
   */
  applyQuaternionRotation(object, quaternion) {
    if (!object) return;

    // 현재 쿼터니언에 새 회전 적용
    object.quaternion.multiplyQuaternions(quaternion, object.quaternion);
    
    // 변환 행렬 업데이트
    object.updateMatrix();
  }

  /**
   * X축 기준 회전 (도 단위)
   */
  rotateSelectedX(degrees) {
    const radians = THREE.MathUtils.degToRad(degrees);
    const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), radians);
    return this.rotateSelectedObjects(quaternion);
  }

  /**
   * Y축 기준 회전 (도 단위)
   */
  rotateSelectedY(degrees) {
    const radians = THREE.MathUtils.degToRad(degrees);
    const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), radians);
    return this.rotateSelectedObjects(quaternion);
  }

  /**
   * Z축 기준 회전 (도 단위)
   */
  rotateSelectedZ(degrees) {
    const radians = THREE.MathUtils.degToRad(degrees);
    const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), radians);
    return this.rotateSelectedObjects(quaternion);
  }

  /**
   * 임의 축 기준 회전 (도 단위)
   */
  rotateSelectedAroundAxis(axis, degrees) {
    if (!axis || axis.length() === 0) {
      console.warn('Invalid rotation axis');
      return false;
    }

    const normalizedAxis = axis.clone().normalize();
    const radians = THREE.MathUtils.degToRad(degrees);
    const quaternion = new THREE.Quaternion().setFromAxisAngle(normalizedAxis, radians);
    
    return this.rotateSelectedObjects(quaternion);
  }

  /**
   * 오일러 각도를 쿼터니언으로 변환 후 적용 (도 단위)
   */
  rotateSelectedByEuler(x, y, z, order = 'XYZ') {
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(x),
      THREE.MathUtils.degToRad(y),
      THREE.MathUtils.degToRad(z),
      order
    );
    
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    return this.rotateSelectedObjects(quaternion);
  }

  /**
   * 특정 방향을 향하도록 회전 (Look At 기능)
   */
  rotateSelectedToLookAt(targetPosition) {
    if (!this.hasSelectedObjects() || !targetPosition) {
      return false;
    }

    const selectedObjects = this.objectSelector.selectedObjects;
    
    selectedObjects.forEach(object => {
      // 현재 위치에서 타겟 위치를 향하는 방향 계산
      const direction = new THREE.Vector3().subVectors(targetPosition, object.position).normalize();
      
      // Look At 매트릭스 생성
      const lookAtMatrix = new THREE.Matrix4();
      lookAtMatrix.lookAt(object.position, targetPosition, new THREE.Vector3(0, 1, 0));
      
      // 매트릭스에서 쿼터니언 추출
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(lookAtMatrix);
      
      // 오브젝트에 회전 적용
      object.quaternion.copy(quaternion);
      object.updateMatrix();
    });

    
    return true;
  }

  /**
   * 선택된 오브젝트들의 회전 초기화
   */
  resetSelectedRotation() {
    if (!this.hasSelectedObjects()) {
      return false;
    }

    const selectedObjects = this.objectSelector.selectedObjects;
    
    selectedObjects.forEach(object => {
      object.quaternion.set(0, 0, 0, 1); // 기본 쿼터니언 (무회전)
      object.updateMatrix();
    });

    
    return true;
  }

  /**
   * 쿼터니언을 오일러 각도로 변환하여 반환 (도 단위)
   */
  getSelectedObjectRotation(object = null) {
    const targetObject = object || this.objectSelector.selectedObjects[0];
    
    if (!targetObject) {
      return null;
    }

    const euler = new THREE.Euler().setFromQuaternion(targetObject.quaternion, 'XYZ');
    
    return {
      x: THREE.MathUtils.radToDeg(euler.x),
      y: THREE.MathUtils.radToDeg(euler.y),
      z: THREE.MathUtils.radToDeg(euler.z),
      quaternion: targetObject.quaternion.clone()
    };
  }

  /**
   * 월드 공간에서의 회전 적용
   */
  rotateSelectedInWorldSpace(quaternion) {
    if (!this.hasSelectedObjects()) {
      return false;
    }

    const selectedObjects = this.objectSelector.selectedObjects;
    
    selectedObjects.forEach(object => {
      // 월드 공간에서 회전 적용
      const worldQuaternion = new THREE.Quaternion();
      object.getWorldQuaternion(worldQuaternion);
      
      // 새 월드 쿼터니언 = 회전 쿼터니언 * 현재 월드 쿼터니언
      worldQuaternion.premultiply(quaternion);
      
      // 부모의 역변환을 적용하여 로컬 쿼터니언 계산
      if (object.parent) {
        const parentWorldQuaternion = new THREE.Quaternion();
        object.parent.getWorldQuaternion(parentWorldQuaternion);
        parentWorldQuaternion.invert();
        
        object.quaternion.multiplyQuaternions(parentWorldQuaternion, worldQuaternion);
      } else {
        object.quaternion.copy(worldQuaternion);
      }
      
      object.updateMatrix();
    });

    
    return true;
  }

  /**
   * 중심점을 기준으로 오브젝트들 회전
   */
  rotateSelectedAroundPoint(center, quaternion) {
    if (!this.hasSelectedObjects() || !center) {
      return false;
    }

    const selectedObjects = this.objectSelector.selectedObjects;
    
    selectedObjects.forEach(object => {
      // 중심점으로부터의 상대 위치 계산
      const relativePosition = object.position.clone().sub(center);
      
      // 상대 위치를 회전
      relativePosition.applyQuaternion(quaternion);
      
      // 새 위치 설정
      object.position.copy(center).add(relativePosition);
      
      // 오브젝트 자체도 회전
      object.quaternion.multiplyQuaternions(quaternion, object.quaternion);
      
      object.updateMatrix();
    });

    
    return true;
  }

  // ======================
  // 헬퍼 메서드들
  // ======================

  /**
   * 유효한 Transform 모드인지 확인
   */
  isValidMode(mode) {
    return ['translate', 'rotate', 'scale'].includes(mode);
  }

  /**
   * 유효한 그리드 크기인지 확인
   */
  isValidGridSize(size) {
    return typeof size === 'number' && size > 0 && size <= 100;
  }

  /**
   * 선택된 오브젝트가 있는지 확인
   */
  hasSelectedObjects() {
    return this.objectSelector?.selectedObjects?.length > 0;
  }

  /**
   * 오브젝트가 그룹인지 확인
   */
  isGroup(object) {
    return object?.userData?.isGroup === true || object?.type === 'Group';
  }

  /**
   * 씬에서 오브젝트 제거 및 메모리 정리
   */
  removeObjectFromScene(object) {
    if (!object || !object.parent) return;

    object.parent.remove(object);
    
    // 메모리 정리
    if (object.geometry) {
      object.geometry.dispose();
    }
    
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(mat => mat.dispose());
      } else {
        object.material.dispose();
      }
    }
  }

  /**
   * 오브젝트 복제
   */
  cloneObject(object) {
    if (!object) return null;

    const cloned = object.clone();
    
    // 위치 조정
    cloned.position.x += 1;
    cloned.position.z += 1;
    
    // 새 ID 생성
    cloned.userData = {
      ...object.userData,
      id: `${object.userData.id}_copy_${Date.now()}`
    };
    
    // 씬에 추가
    object.parent.add(cloned);
    
    // 선택 가능한 오브젝트로 등록
    if (this.objectSelector.addSelectableObject) {
      this.objectSelector.addSelectableObject(cloned);
    }
    
    return cloned;
  }

  /**
   * 그룹 생성
   */
  createGroup(objects) {
    if (!objects || objects.length < 2) return null;

  const group = new THREE.Group();
    group.name = `Group_${Date.now()}`;
    group.userData = {
      id: `group_${Date.now()}`,
      type: 'group',
      isGroup: true
    };

    const parent = objects[0].parent;
    parent.add(group);

  // 오브젝트들을 그룹에 추가 (월드 변환 유지)
    objects.forEach(object => {
      if (object && object.parent) {
        const worldMatrix = object.matrixWorld.clone();
        group.add(object);
        object.matrix.copy(worldMatrix);
        object.matrix.premultiply(group.matrixWorld.clone().invert());
        object.matrix.decompose(object.position, object.quaternion, object.scale);
      }
    });

    // 선택 가능한 오브젝트로 등록
    if (this.objectSelector.addSelectableObject) {
      this.objectSelector.addSelectableObject(group);
    }

    // 스토어에 그룹 추가 기록
    try {
      const api = this.editorStore?.getState?.();
      api?.addObject && api.addObject({
        id: group.userData.id,
        name: group.name,
        type: 'group',
        position: { x: group.position.x, y: group.position.y, z: group.position.z },
        rotation: { x: group.rotation.x, y: group.rotation.y, z: group.rotation.z },
        scale: { x: group.scale.x, y: group.scale.y, z: group.scale.z },
        visible: true
      });

      // 선택된 각 오브젝트의 parentId를 그룹으로 변경
      if (api?.setParent) {
        for (const obj of objects) {
          const childId = obj?.userData?.id;
          if (!childId) continue;
          api.setParent(childId, group.userData.id);
        }
      }
    } catch {}

    return group;
  }

  /**
   * 그룹 해제
   */
  ungroupObject(group) {
    if (!this.isGroup(group)) return [];

    const children = [...group.children];
    const parent = group.parent;

    // 자식들을 부모로 이동 (월드 변환 유지)
    children.forEach(child => {
      if (child) {
        const worldMatrix = child.matrixWorld.clone();
        parent.add(child);
        child.matrix.copy(worldMatrix);
        child.matrix.premultiply(parent.matrixWorld.clone().invert());
        child.matrix.decompose(child.position, child.quaternion, child.scale);

        // 선택 가능한 오브젝트로 등록
        if (this.objectSelector.addSelectableObject) {
          this.objectSelector.addSelectableObject(child);
        }
      }
    });

    // 스토어에서 자식들의 parentId를 그룹의 parentId로 변경
    try {
      const api = this.editorStore?.getState?.();
      if (api?.setParent) {
        const newParentId = parent?.userData?.id ?? null;
        for (const child of children) {
          const childId = child?.userData?.id;
          if (!childId) continue;
          api.setParent(childId, newParentId);
          // 현재 씬 상의 transform을 그대로 베이크해서 스토어에 저장
          if (api.updateObjectTransform) {
            api.updateObjectTransform(childId, {
              position: { x: child.position.x, y: child.position.y, z: child.position.z },
              rotation: { x: child.rotation.x, y: child.rotation.y, z: child.rotation.z },
              scale: { x: child.scale.x, y: child.scale.y, z: child.scale.z }
            });
          }
        }
      }
    } catch {}

    // 그룹 제거
    if (this.objectSelector.removeSelectableObject) {
      this.objectSelector.removeSelectableObject(group);
    }
    parent.remove(group);

    // 스토어에서 그룹 제거 기록
    try {
      const api = this.editorStore?.getState?.();
      const groupId = group?.userData?.id;
      if (groupId && api?.removeObjectById) api.removeObjectById(groupId);
    } catch {}

    return children;
  }

  /**
   * 오브젝트들 선택
   */
  selectObjects(objects) {
    if (!this.objectSelector || !objects || objects.length === 0) return;

    this.objectSelector.deselectAllObjects();
    
    if (objects.length === 1) {
      this.objectSelector.selectSingleObject(objects[0]);
    } else {
      this.objectSelector.selectMultipleObjects(objects);
    }
  }

  /**
   * 상태 변경 로그
   */
  logStateChange(property, oldValue, newValue) {}

  /**
   * Undo 기능 (추후 구현)
   */
  undo() {
    try {
      const api = this.editorStore?.getState();
      if (api?.undo) api.undo();
    } catch (err) {
      console.error('Undo failed:', err);
    }
  }

  /**
   * Redo 기능 (추후 구현)
   */
  redo() {
    try {
      const api = this.editorStore?.getState();
      if (api?.redo) api.redo();
    } catch (err) {
      console.error('Redo failed:', err);
    }
  }

  /**
   * 정리
   */
  dispose() {
    // KeyboardController는 별도로 관리되므로 여기서 정리하지 않음
    
    // 참조 정리
    this.objectSelector = null;
    this.editorStore = null;
    this.keyboardController = null;
  }
}

export default TransformManager;
