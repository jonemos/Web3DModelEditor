import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { eventBus, EventTypes } from '../../core/EventBus.js';
import { commandManager } from '../../core/CommandSystem.js';

export class ObjectSelectorModern {
  constructor(scene, camera, renderer, editorStore = null, newArchServices = null) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.editorStore = editorStore; // 레거시 호환용
    this.newArchServices = newArchServices; // 새 아키텍처 서비스들
    this.isNewArchEnabled = !!newArchServices;
    
    console.log('🎯 ObjectSelector:', this.isNewArchEnabled ? 'Modern Mode' : 'Legacy Mode');
    
    // 선택 관련 상태
    this.selectedObjects = [];
    this.lastSelectedObject = null;
    this.selectableObjects = [];
    this.raycaster = new THREE.Raycaster();
    
    // 드래그 선택 박스
    this.selectionBox = null;
    this.createSelectionBox();
    
    // Transform controls (기즈모)
    this.transformControls = null;
    this.gizmoMode = 'translate';
    this.isDragging = false;
    
    // 스냅 설정
    this.snapEnabled = false;
    this.gridSize = 1.0;
    
    // 다중 선택 임시 그룹
    this.tempGroup = null;
    this.tempGroupCenter = new THREE.Vector3();
    
    // 자석 기능 상태
    this.isMagnetEnabled = false;
    this.showMagnetRays = false;
    this.rayHelpers = [];
    
    // 다중 선택 변환을 위한 초기 상태 저장
    this.initialTransformStates = new Map();
    
    this.initializeTransformControls();
    
    // 새 아키텍처 통합 설정
    if (this.isNewArchEnabled) {
      this.setupNewArchitectureIntegration();
    }
    
    console.log('✅ ObjectSelector initialized');
  }

  /**
   * 새 아키텍처 통합 설정
   */
  setupNewArchitectureIntegration() {
    // 선택 서비스와 통합
    if (this.newArchServices.selection) {
      this.selectionService = this.newArchServices.selection;
    }

    // 객체 관리 서비스와 통합
    if (this.newArchServices.objectManagement) {
      this.objectManagementService = this.newArchServices.objectManagement;
    }

    // 새 아키텍처 이벤트 리스너 설정
    this.setupNewArchitectureEvents();

    console.log('🔗 ObjectSelector: New architecture integration complete');
  }

  /**
   * 새 아키텍처 이벤트 설정
   */
  setupNewArchitectureEvents() {
    // 객체 선택 명령 처리
    eventBus.on(EventTypes.OBJECT_SELECTED, (event) => {
      const { object } = event.detail;
      this.handleNewArchObjectSelection(object);
    });

    // 객체 해제 명령 처리
    eventBus.on(EventTypes.OBJECT_DESELECTED, (event) => {
      this.handleNewArchObjectDeselection();
    });

    // 변형 모드 변경 처리
    eventBus.on(EventTypes.TRANSFORM_MODE_CHANGED, (event) => {
      const { mode } = event.detail;
      this.setGizmoMode(mode);
    });
  }

  /**
   * 새 아키텍처에서의 객체 선택 처리
   */
  handleNewArchObjectSelection(object) {
    if (!object) return;

    // 기존 선택 해제
    this.clearSelection();

    // 새 객체 선택
    this.selectedObjects = [object];
    this.lastSelectedObject = object;

    // 선택된 객체 시각화
    this.highlightSelectedObjects();

    // 기즈모 업데이트
    this.updateGizmo();

    // 레거시 스토어와 동기화 (호환성)
    if (this.editorStore) {
      this.editorStore.getState().setSelectedObject(object);
    }

    console.log('🎯 Modern ObjectSelector: Object selected:', object);
  }

  /**
   * 새 아키텍처에서의 객체 선택 해제 처리
   */
  handleNewArchObjectDeselection() {
    this.clearSelection();

    // 레거시 스토어와 동기화 (호compatible)
    if (this.editorStore) {
      this.editorStore.getState().setSelectedObject(null);
    }

    console.log('🎯 Modern ObjectSelector: Selection cleared');
  }

  /**
   * 드래그 선택 박스 생성
   */
  createSelectionBox() {
    // 선택 박스 지오메트리 및 머티리얼
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide
    });
    
    this.selectionBox = new THREE.Mesh(geometry, material);
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);
  }

  /**
   * Transform Controls 초기화
   */
  initializeTransformControls() {
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.setMode('translate');
    this.transformControls.setSpace('world');
    this.transformControls.setSize(0.8);
    
    // Transform Controls 이벤트
    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.isDragging = event.value;
      
      // 새 아키텍처 이벤트 발행
      if (this.isNewArchEnabled) {
        eventBus.emit(EventTypes.TRANSFORM_DRAGGING_CHANGED, { 
          isDragging: event.value 
        });
      }
    });

    this.transformControls.addEventListener('change', () => {
      this.onTransformChange();
    });

    this.transformControls.addEventListener('objectChange', () => {
      this.onObjectChange();
    });

    this.scene.add(this.transformControls);
  }

  /**
   * 객체 선택 (레이캐스팅)
   */
  selectObject(event, addToSelection = false) {
    // 마우스 위치를 NDC로 변환
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // 레이캐스팅
    this.raycaster.setFromCamera(mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.getSelectableObjects(), true);

    if (intersects.length > 0) {
      const selectedObject = this.findSelectableParent(intersects[0].object);
      
      if (selectedObject) {
        if (this.isNewArchEnabled) {
          // 새 아키텍처에서는 명령 시스템 사용
          commandManager.execute('selectObject', { 
            object: selectedObject, 
            addToSelection 
          });
        } else {
          // 레거시 모드
          this.selectObjectLegacy(selectedObject, addToSelection);
        }
        
        return selectedObject;
      }
    } else {
      // 빈 공간 클릭 - 선택 해제
      if (this.isNewArchEnabled) {
        commandManager.execute('deselectAll');
      } else {
        this.clearSelection();
      }
    }

    return null;
  }

  /**
   * 레거시 객체 선택 처리
   */
  selectObjectLegacy(object, addToSelection = false) {
    if (!addToSelection) {
      this.clearSelection();
    }

    if (!this.selectedObjects.includes(object)) {
      this.selectedObjects.push(object);
      this.lastSelectedObject = object;
      
      // 스토어 업데이트
      if (this.editorStore) {
        this.editorStore.getState().setSelectedObject(object);
      }
    }

    this.highlightSelectedObjects();
    this.updateGizmo();
  }

  /**
   * 선택 가능한 부모 객체 찾기
   */
  findSelectableParent(object) {
    let current = object;
    
    while (current) {
      if (this.isSelectableObject(current)) {
        return current;
      }
      current = current.parent;
    }
    
    return null;
  }

  /**
   * 객체가 선택 가능한지 확인
   */
  isSelectableObject(object) {
    // 시스템 객체들은 선택 불가
    if (object.name === 'EditorGrid' || 
        object.name === 'TransformControls' ||
        object.userData.isSystemObject) {
      return false;
    }

    // 기즈모 관련 객체들은 선택 불가
    if (object.userData.isGizmo || 
        object.userData.isTransformControls) {
      return false;
    }

    return true;
  }

  /**
   * 선택 가능한 객체들 가져오기
   */
  getSelectableObjects() {
    return this.scene.children.filter(child => this.isSelectableObject(child));
  }

  /**
   * 선택된 객체들 하이라이트
   */
  highlightSelectedObjects() {
    // 모든 객체의 하이라이트 제거
    this.scene.traverse((object) => {
      if (object.userData.originalMaterial) {
        object.material = object.userData.originalMaterial;
        delete object.userData.originalMaterial;
      }
    });

    // 선택된 객체들 하이라이트
    this.selectedObjects.forEach(object => {
      this.highlightObject(object, true);
    });
  }

  /**
   * 개별 객체 하이라이트
   */
  highlightObject(object, highlight = true) {
    object.traverse((child) => {
      if (child.isMesh) {
        if (highlight) {
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = child.material;
            
            // 하이라이트 머티리얼 생성
            const highlightMaterial = child.material.clone();
            highlightMaterial.emissive = new THREE.Color(0x444444);
            highlightMaterial.emissiveIntensity = 0.3;
            
            child.material = highlightMaterial;
          }
        } else {
          if (child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial;
            delete child.userData.originalMaterial;
          }
        }
      }
    });
  }

  /**
   * 기즈모 업데이트
   */
  updateGizmo() {
    if (this.selectedObjects.length === 1) {
      // 단일 선택 - 객체에 기즈모 연결
      this.transformControls.attach(this.lastSelectedObject);
      this.transformControls.visible = true;
    } else if (this.selectedObjects.length > 1) {
      // 다중 선택 - 임시 그룹 센터에 기즈모 연결
      this.createTempGroup();
      if (this.tempGroup) {
        this.transformControls.attach(this.tempGroup);
        this.transformControls.visible = true;
      }
    } else {
      // 선택된 객체 없음 - 기즈모 숨김
      this.transformControls.detach();
      this.transformControls.visible = false;
    }
  }

  /**
   * 임시 그룹 생성 (다중 선택용)
   */
  createTempGroup() {
    this.clearTempGroup();
    
    if (this.selectedObjects.length > 1) {
      this.tempGroup = new THREE.Group();
      this.tempGroup.userData.isTemporary = true;
      
      // 선택된 객체들의 중심 계산
      const box = new THREE.Box3();
      this.selectedObjects.forEach(obj => {
        box.expandByObject(obj);
      });
      
      box.getCenter(this.tempGroupCenter);
      this.tempGroup.position.copy(this.tempGroupCenter);
      
      this.scene.add(this.tempGroup);
    }
  }

  /**
   * 임시 그룹 정리
   */
  clearTempGroup() {
    if (this.tempGroup) {
      this.scene.remove(this.tempGroup);
      this.tempGroup = null;
    }
  }

  /**
   * 기즈모 모드 설정
   */
  setGizmoMode(mode) {
    this.gizmoMode = mode;
    this.transformControls.setMode(mode);
    
    console.log(`🔄 Gizmo mode changed to: ${mode}`);
  }

  /**
   * Transform 변경 처리
   */
  onTransformChange() {
    if (this.selectedObjects.length > 1 && this.tempGroup) {
      // 다중 선택시 모든 객체를 함께 변형
      this.applyTempGroupTransformToSelected();
    }

    // 새 아키텍처 이벤트 발행
    if (this.isNewArchEnabled) {
      eventBus.emit(EventTypes.TRANSFORM_CHANGED, {
        objects: this.selectedObjects,
        mode: this.gizmoMode
      });
    }
  }

  /**
   * 객체 변형 완료 처리
   */
  onObjectChange() {
    // 새 아키텍처에서는 명령으로 기록
    if (this.isNewArchEnabled && this.selectedObjects.length > 0) {
      commandManager.execute('transformObjects', {
        objects: this.selectedObjects,
        transformData: this.getTransformData()
      });
    }

    // 레거시 스토어 업데이트
    if (this.editorStore && this.lastSelectedObject) {
      // 스토어에 변경 사항 반영 (필요에 따라)
    }
  }

  /**
   * 현재 변형 데이터 가져오기
   */
  getTransformData() {
    return this.selectedObjects.map(obj => ({
      object: obj,
      position: obj.position.clone(),
      rotation: obj.rotation.clone(),
      scale: obj.scale.clone()
    }));
  }

  /**
   * 임시 그룹 변형을 선택된 객체들에 적용
   */
  applyTempGroupTransformToSelected() {
    if (!this.tempGroup || this.selectedObjects.length <= 1) return;

    // 각 객체에 대해 상대적 변형 적용
    this.selectedObjects.forEach(obj => {
      if (this.initialTransformStates.has(obj)) {
        const initialState = this.initialTransformStates.get(obj);
        
        // 임시 그룹의 변형을 각 객체에 적용
        const deltaPosition = new THREE.Vector3().subVectors(
          this.tempGroup.position, 
          this.tempGroupCenter
        );
        
        obj.position.copy(initialState.position).add(deltaPosition);
      }
    });
  }

  /**
   * 선택 해제
   */
  clearSelection() {
    // 하이라이트 제거
    this.selectedObjects.forEach(object => {
      this.highlightObject(object, false);
    });

    this.selectedObjects = [];
    this.lastSelectedObject = null;
    this.clearTempGroup();
    
    // 기즈모 숨김
    this.transformControls.detach();
    this.transformControls.visible = false;

    // 초기 상태 정리
    this.initialTransformStates.clear();
  }

  /**
   * 선택된 객체 가져오기
   */
  getSelectedObject() {
    return this.lastSelectedObject;
  }

  /**
   * 선택된 객체들 가져오기
   */
  getSelectedObjects() {
    return [...this.selectedObjects];
  }

  /**
   * 업데이트 (매 프레임 호출)
   */
  update() {
    // 필요한 경우 업데이트 로직 추가
  }

  /**
   * 리소스 정리
   */
  dispose() {
    // Transform Controls 정리
    if (this.transformControls) {
      this.transformControls.dispose();
      this.scene.remove(this.transformControls);
    }

    // 선택 박스 정리
    if (this.selectionBox) {
      this.scene.remove(this.selectionBox);
    }

    // 임시 그룹 정리
    this.clearTempGroup();

    // 하이라이트 제거
    this.clearSelection();

    // 새 아키텍처 이벤트 리스너 정리
    if (this.isNewArchEnabled) {
      eventBus.off(EventTypes.OBJECT_SELECTED);
      eventBus.off(EventTypes.OBJECT_DESELECTED);
      eventBus.off(EventTypes.TRANSFORM_MODE_CHANGED);
    }

    console.log('🧹 ObjectSelector disposed');
  }

  // 호환성을 위한 메서드들
  selectObjects(objects) {
    this.selectedObjects = [...objects];
    this.lastSelectedObject = objects[objects.length - 1] || null;
    this.highlightSelectedObjects();
    this.updateGizmo();
  }

  isObjectSelected(object) {
    return this.selectedObjects.includes(object);
  }

  toggleObjectSelection(object) {
    const index = this.selectedObjects.indexOf(object);
    if (index > -1) {
      this.selectedObjects.splice(index, 1);
      if (this.lastSelectedObject === object) {
        this.lastSelectedObject = this.selectedObjects[this.selectedObjects.length - 1] || null;
      }
    } else {
      this.selectedObjects.push(object);
      this.lastSelectedObject = object;
    }
    
    this.highlightSelectedObjects();
    this.updateGizmo();
  }
}

// 기존 클래스와의 호환성을 위한 alias
export const ObjectSelector = ObjectSelectorModern;
