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
      magnetEnabled: false,     // 자석 기능 활성화
      magnetRaysVisible: false  // 자석 레이 표시
    };
    
    // KeyboardController에 액션 등록
    this.registerKeyboardActions();
    
    // 초기 설정 적용
    this.applyInitialSettings();
    
    console.log('TransformManager initialized with separated input system');
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
      toggleMagnet: () => this.toggleMagnet(),
      toggleMagnetRays: () => this.toggleMagnetRays()
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
    
    // 에디터 스토어 업데이트
    if (this.editorStore?.getState().setTransformMode) {
      this.editorStore.getState().setTransformMode(mode);
    }

    this.logStateChange('Transform mode', oldMode, mode);
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
    
    this.logStateChange('Coordinate space', oldSpace, this.state.space);
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
    
    this.logStateChange('Grid snap', !this.state.snapEnabled, this.state.snapEnabled);
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

    this.logStateChange('Grid size', oldSize, size);
    return true;
  }

  /**
   * 자석 기능 토글
   */
  toggleMagnet() {
    if (!this.objectSelector) {
      return false;
    }

    this.state.magnetEnabled = !this.state.magnetEnabled;
    this.objectSelector.isMagnetEnabled = this.state.magnetEnabled;
    
    this.logStateChange('Magnet', !this.state.magnetEnabled, this.state.magnetEnabled);
    return true;
  }

  /**
   * 자석 레이 표시 토글
   */
  toggleMagnetRays() {
    if (!this.objectSelector) {
      return false;
    }

    this.state.magnetRaysVisible = !this.state.magnetRaysVisible;
    this.objectSelector.showMagnetRays = this.state.magnetRaysVisible;
    
    if (!this.state.magnetRaysVisible && this.objectSelector.clearRayHelpers) {
      this.objectSelector.clearRayHelpers();
    }

    this.logStateChange('Magnet rays', !this.state.magnetRaysVisible, this.state.magnetRaysVisible);
    return true;
  }

  /**
   * 모든 오브젝트 선택 해제
   */
  deselectAll() {
    if (!this.objectSelector) {
      return false;
    }

    const selectedCount = this.objectSelector.selectedObjects?.length || 0;
    this.objectSelector.deselectAllObjects();
    
    console.log(`Deselected ${selectedCount} objects`);
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
      console.log(`Selected all ${selectableObjects.length} objects`);
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
    
    // 선택 해제
    this.deselectAll();
    
    // 씬에서 제거 및 메모리 정리
    selectedObjects.forEach(object => {
      this.removeObjectFromScene(object);
    });

    console.log(`Deleted ${deleteCount} objects`);
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

    selectedObjects.forEach(object => {
      const cloned = this.cloneObject(object);
      if (cloned) {
        clonedObjects.push(cloned);
      }
    });

    // 복제된 오브젝트들 선택
    if (clonedObjects.length > 0) {
      this.selectObjects(clonedObjects);
    }

    console.log(`Duplicated ${clonedObjects.length} objects`);
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
    const group = this.createGroup(selectedObjects);

    if (group) {
      this.selectObjects([group]);
      console.log(`Grouped ${selectedObjects.length} objects`);
      return group;
    }

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

    const children = this.ungroupObject(selectedObject);
    if (children.length > 0) {
      this.selectObjects(children);
      console.log(`Ungrouped ${children.length} objects`);
      return children;
    }

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
    
    if (settings.magnetEnabled !== undefined && settings.magnetEnabled !== this.state.magnetEnabled) {
      this.toggleMagnet();
    }
    
    if (settings.magnetRaysVisible !== undefined && settings.magnetRaysVisible !== this.state.magnetRaysVisible) {
      this.toggleMagnetRays();
    }
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

    // 그룹 제거
    if (this.objectSelector.removeSelectableObject) {
      this.objectSelector.removeSelectableObject(group);
    }
    parent.remove(group);

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
  logStateChange(property, oldValue, newValue) {
    console.log(`${property} changed: ${oldValue} → ${newValue}`);
  }

  /**
   * Undo 기능 (추후 구현)
   */
  undo() {
    console.log('Undo functionality - to be implemented');
  }

  /**
   * Redo 기능 (추후 구현)
   */
  redo() {
    console.log('Redo functionality - to be implemented');
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

    console.log('TransformManager disposed');
  }
}

export default TransformManager;
