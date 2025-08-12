/**
 * TransformManager.Modern - 새 아키텍처 기반 변형 관리자
 * Service Registry, Event Bus, Command System 통합
 */
import * as THREE from 'three';

export class TransformManagerModern {
  constructor(options = {}) {
    this.options = {
      mode: 'translate',
      space: 'world',
      snapEnabled: false,
      gridSize: 1.0,
      magnetEnabled: false,
      magnetRaysVisible: false,
      ...options
    };
    
    // 서비스 참조
    this.eventBus = null;
    this.commandManager = null;
    this.serviceRegistry = null;
    this.objectSelector = null;
    
    // Transform 상태 관리
    this.state = { ...this.options };
    
    // 초기화 상태
    this.isInitialized = false;
    this.isDestroyed = false;
    
    // 이벤트 핸들러 바인딩
    this.boundHandlers = {
      onObjectSelected: this.handleObjectSelected.bind(this),
      onObjectDeselected: this.handleObjectDeselected.bind(this),
      onTransformModeChanged: this.handleTransformModeChanged.bind(this),
      onKeyboardInput: this.handleKeyboardInput.bind(this)
    };
  }

  /**
   * 새 아키텍처 서비스 연결
   */
  async connectToNewArchitecture(serviceRegistry) {
    try {
      this.serviceRegistry = serviceRegistry;
      
      // 필수 서비스 가져오기
      this.eventBus = serviceRegistry.get('eventBus');
      this.commandManager = serviceRegistry.get('commandManager');
      this.objectSelector = serviceRegistry.get('objectSelector');
      
      if (!this.eventBus || !this.commandManager) {
        throw new Error('Required services not available');
      }

      console.log('🔄 TransformManager: Connected to new architecture');
      return true;
    } catch (error) {
      console.error('❌ TransformManager: Failed to connect to new architecture:', error);
      return false;
    }
  }

  /**
   * 초기화
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // 이벤트 리스너 등록
      this.setupEventListeners();
      
      // 키보드 액션 등록
      this.registerKeyboardActions();
      
      // 초기 설정 적용
      this.applyInitialSettings();
      
      this.isInitialized = true;
      console.log('✅ TransformManager.Modern: Initialized');
      
      if (this.eventBus) {
        this.eventBus.emit('TRANSFORM_MANAGER_READY', { 
          manager: this,
          state: this.state 
        });
      }
    } catch (error) {
      console.error('❌ TransformManager.Modern: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    if (!this.eventBus) return;

    // 객체 선택 관련 이벤트
    this.eventBus.on('OBJECT_SELECTED', this.boundHandlers.onObjectSelected);
    this.eventBus.on('OBJECT_DESELECTED', this.boundHandlers.onObjectDeselected);
    
    // 변형 모드 변경 이벤트
    this.eventBus.on('TRANSFORM_MODE_CHANGED', this.boundHandlers.onTransformModeChanged);
    
    // 키보드 입력 이벤트
    this.eventBus.on('KEYBOARD_INPUT', this.boundHandlers.onKeyboardInput);
  }

  /**
   * 키보드 액션 등록
   */
  registerKeyboardActions() {
    if (!this.commandManager) return;

    // Transform 모드 변경 명령들이 이미 CommandSystem에 등록되어 있음
    console.log('🎮 TransformManager: Transform commands ready in CommandSystem');
  }

  /**
   * 초기 설정 적용
   */
  applyInitialSettings() {
    // 초기 변형 모드 설정
    this.setMode(this.state.mode);
    
    // 초기 좌표계 설정
    this.setSpace(this.state.space);
    
    // 그리드 스냅 설정
    if (this.state.snapEnabled) {
      this.enableGridSnap(this.state.gridSize);
    }
  }

  /**
   * 변형 모드 설정 (명령 시스템 통합)
   */
  async setMode(mode) {
    if (!this.isValidMode(mode)) {
      console.warn(`Invalid transform mode: ${mode}`);
      return false;
    }

    if (this.commandManager) {
      try {
        await this.commandManager.execute('setTransformMode', { mode });
        return true;
      } catch (error) {
        console.error('Failed to execute setTransformMode command:', error);
      }
    }
    
    // Fallback to direct mode setting
    return this.setModeInternal(mode);
  }

  /**
   * 내부 모드 설정 (명령에서 호출됨)
   */
  setModeInternal(mode) {
    const previousMode = this.state.mode;
    this.state.mode = mode;
    
    // ObjectSelector에 모드 적용
    if (this.objectSelector && this.objectSelector.setTransformMode) {
      this.objectSelector.setTransformMode(mode);
    }
    
    console.log(`🔄 Transform mode changed: ${previousMode} → ${mode}`);
    return true;
  }

  /**
   * 좌표계 설정
   */
  setSpace(space) {
    if (!this.isValidSpace(space)) {
      console.warn(`Invalid coordinate space: ${space}`);
      return false;
    }

    const previousSpace = this.state.space;
    this.state.space = space;
    
    // ObjectSelector에 좌표계 적용
    if (this.objectSelector && this.objectSelector.setTransformSpace) {
      this.objectSelector.setTransformSpace(space);
    }
    
    console.log(`🌍 Coordinate space changed: ${previousSpace} → ${space}`);
    
    if (this.eventBus) {
      this.eventBus.emit('TRANSFORM_SPACE_CHANGED', { 
        space, 
        previousSpace 
      });
    }
    
    return true;
  }

  /**
   * 좌표계 토글
   */
  toggleSpace() {
    const newSpace = this.state.space === 'world' ? 'local' : 'world';
    return this.setSpace(newSpace);
  }

  /**
   * 그리드 스냅 활성화
   */
  enableGridSnap(gridSize = null) {
    if (gridSize !== null) {
      this.state.gridSize = gridSize;
    }
    
    this.state.snapEnabled = true;
    
    // ObjectSelector에 그리드 스냅 적용
    if (this.objectSelector && this.objectSelector.setGridSnap) {
      this.objectSelector.setGridSnap(true, this.state.gridSize);
    }
    
    console.log(`📏 Grid snap enabled: ${this.state.gridSize}`);
    
    if (this.eventBus) {
      this.eventBus.emit('GRID_SNAP_CHANGED', { 
        enabled: true, 
        gridSize: this.state.gridSize 
      });
    }
    
    return true;
  }

  /**
   * 그리드 스냅 비활성화
   */
  disableGridSnap() {
    this.state.snapEnabled = false;
    
    // ObjectSelector에 그리드 스냅 적용
    if (this.objectSelector && this.objectSelector.setGridSnap) {
      this.objectSelector.setGridSnap(false, this.state.gridSize);
    }
    
    console.log('📏 Grid snap disabled');
    
    if (this.eventBus) {
      this.eventBus.emit('GRID_SNAP_CHANGED', { 
        enabled: false, 
        gridSize: this.state.gridSize 
      });
    }
    
    return true;
  }

  /**
   * 그리드 스냅 토글
   */
  toggleGridSnap() {
    return this.state.snapEnabled ? this.disableGridSnap() : this.enableGridSnap();
  }

  /**
   * 그리드 크기 설정
   */
  setGridSize(size) {
    if (!this.isValidGridSize(size)) {
      console.warn(`Invalid grid size: ${size}`);
      return false;
    }

    const previousSize = this.state.gridSize;
    this.state.gridSize = size;
    
    // 스냅이 활성화된 경우 즉시 적용
    if (this.state.snapEnabled && this.objectSelector) {
      this.objectSelector.setGridSnap(true, size);
    }
    
    console.log(`📏 Grid size changed: ${previousSize} → ${size}`);
    
    if (this.eventBus) {
      this.eventBus.emit('GRID_SIZE_CHANGED', { 
        size, 
        previousSize 
      });
    }
    
    return true;
  }

  /**
   * 자석 기능 토글
   */
  toggleMagnet() {
    this.state.magnetEnabled = !this.state.magnetEnabled;
    
    console.log(`🧲 Magnet ${this.state.magnetEnabled ? 'enabled' : 'disabled'}`);
    
    if (this.eventBus) {
      this.eventBus.emit('MAGNET_CHANGED', { 
        enabled: this.state.magnetEnabled 
      });
    }
    
    return true;
  }

  /**
   * 자석 레이 표시 토글
   */
  toggleMagnetRays() {
    this.state.magnetRaysVisible = !this.state.magnetRaysVisible;
    
    console.log(`🔍 Magnet rays ${this.state.magnetRaysVisible ? 'visible' : 'hidden'}`);
    
    if (this.eventBus) {
      this.eventBus.emit('MAGNET_RAYS_CHANGED', { 
        visible: this.state.magnetRaysVisible 
      });
    }
    
    return true;
  }

  /**
   * 선택된 객체 회전 (X축)
   */
  async rotateSelectedX(degrees) {
    return this.rotateSelected('x', degrees);
  }

  /**
   * 선택된 객체 회전 (Y축)
   */
  async rotateSelectedY(degrees) {
    return this.rotateSelected('y', degrees);
  }

  /**
   * 선택된 객체 회전 (Z축)
   */
  async rotateSelectedZ(degrees) {
    return this.rotateSelected('z', degrees);
  }

  /**
   * 선택된 객체 회전 (일반)
   */
  async rotateSelected(axis, degrees) {
    if (!this.objectSelector) {
      console.warn('No object selector available');
      return false;
    }

    const selectedObjects = this.objectSelector.getSelectedObjects?.() || [];
    if (selectedObjects.length === 0) {
      console.warn('No objects selected for rotation');
      return false;
    }

    try {
      // 회전 명령이 있다면 사용, 없으면 직접 처리
      if (this.commandManager) {
        for (const object of selectedObjects) {
          await this.commandManager.execute('rotateObject', { 
            object, 
            axis, 
            degrees 
          });
        }
      } else {
        // Direct rotation fallback
        this.rotateObjectsDirect(selectedObjects, axis, degrees);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to rotate selected objects:', error);
      return false;
    }
  }

  /**
   * 직접 객체 회전 (fallback)
   */
  rotateObjectsDirect(objects, axis, degrees) {
    const radians = THREE.MathUtils.degToRad(degrees);
    
    for (const object of objects) {
      const rotation = new THREE.Euler();
      rotation.copy(object.rotation);
      
      switch (axis.toLowerCase()) {
        case 'x':
          rotation.x += radians;
          break;
        case 'y':
          rotation.y += radians;
          break;
        case 'z':
          rotation.z += radians;
          break;
      }
      
      object.rotation.copy(rotation);
    }
    
    if (this.eventBus) {
      this.eventBus.emit('OBJECTS_ROTATED', { 
        objects, 
        axis, 
        degrees 
      });
    }
  }

  /**
   * 선택된 객체 회전 초기화
   */
  async resetSelectedRotation() {
    if (!this.objectSelector) {
      console.warn('No object selector available');
      return false;
    }

    const selectedObjects = this.objectSelector.getSelectedObjects?.() || [];
    if (selectedObjects.length === 0) {
      console.warn('No objects selected for rotation reset');
      return false;
    }

    try {
      if (this.commandManager) {
        for (const object of selectedObjects) {
          await this.commandManager.execute('resetObjectRotation', { object });
        }
      } else {
        // Direct reset fallback
        this.resetObjectsRotationDirect(selectedObjects);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to reset rotation for selected objects:', error);
      return false;
    }
  }

  /**
   * 직접 객체 회전 초기화 (fallback)
   */
  resetObjectsRotationDirect(objects) {
    for (const object of objects) {
      object.rotation.set(0, 0, 0);
    }
    
    if (this.eventBus) {
      this.eventBus.emit('OBJECTS_ROTATION_RESET', { objects });
    }
  }

  // ==================== 이벤트 핸들러 ====================

  /**
   * 객체 선택 이벤트 핸들러
   */
  handleObjectSelected(event) {
    const { object } = event.detail || event;
    console.log('🎯 TransformManager: Object selected:', object?.name || 'Unknown');
    
    // 선택된 객체에 Transform Controls 적용
    this.applyTransformControls(object);
  }

  /**
   * 객체 선택 해제 이벤트 핸들러
   */
  handleObjectDeselected(event) {
    console.log('❌ TransformManager: Object deselected');
    
    // Transform Controls 제거
    this.removeTransformControls();
  }

  /**
   * 변형 모드 변경 이벤트 핸들러
   */
  handleTransformModeChanged(event) {
    const { mode } = event.detail || event;
    if (mode && mode !== this.state.mode) {
      this.setModeInternal(mode);
    }
  }

  /**
   * 키보드 입력 이벤트 핸들러
   */
  handleKeyboardInput(event) {
    const { key, action, altKey, ctrlKey, shiftKey } = event.detail || event;
    
    // Transform 관련 키보드 단축키 처리
    switch (action) {
      case 'transform_translate':
        this.setMode('translate');
        break;
      case 'transform_rotate':
        this.setMode('rotate');
        break;
      case 'transform_scale':
        this.setMode('scale');
        break;
      case 'toggle_space':
        this.toggleSpace();
        break;
      case 'toggle_snap':
        this.toggleGridSnap();
        break;
      case 'toggle_magnet':
        this.toggleMagnet();
        break;
    }
  }

  /**
   * Transform Controls 적용
   */
  applyTransformControls(object) {
    if (!object || !this.objectSelector) return;
    
    // ObjectSelector에서 Transform Controls 처리
    if (this.objectSelector.attachTransformControls) {
      this.objectSelector.attachTransformControls(object);
    }
  }

  /**
   * Transform Controls 제거
   */
  removeTransformControls() {
    if (this.objectSelector && this.objectSelector.detachTransformControls) {
      this.objectSelector.detachTransformControls();
    }
  }

  // ==================== 유틸리티 메서드 ====================

  /**
   * 유효한 변형 모드인지 확인
   */
  isValidMode(mode) {
    return ['translate', 'rotate', 'scale'].includes(mode);
  }

  /**
   * 유효한 좌표계인지 확인
   */
  isValidSpace(space) {
    return ['world', 'local'].includes(space);
  }

  /**
   * 유효한 그리드 크기인지 확인
   */
  isValidGridSize(size) {
    return typeof size === 'number' && size > 0 && size <= 100;
  }

  /**
   * 현재 상태 가져오기
   */
  getState() {
    return { ...this.state };
  }

  /**
   * 상태 업데이트
   */
  setState(newState) {
    const previousState = { ...this.state };
    this.state = { ...this.state, ...newState };
    
    if (this.eventBus) {
      this.eventBus.emit('TRANSFORM_STATE_CHANGED', { 
        state: this.state, 
        previousState 
      });
    }
  }

  /**
   * 정리
   */
  destroy() {
    if (this.isDestroyed) return;

    // 이벤트 리스너 제거
    if (this.eventBus) {
      this.eventBus.off('OBJECT_SELECTED', this.boundHandlers.onObjectSelected);
      this.eventBus.off('OBJECT_DESELECTED', this.boundHandlers.onObjectDeselected);
      this.eventBus.off('TRANSFORM_MODE_CHANGED', this.boundHandlers.onTransformModeChanged);
      this.eventBus.off('KEYBOARD_INPUT', this.boundHandlers.onKeyboardInput);
    }

    // Transform Controls 정리
    this.removeTransformControls();

    // 참조 정리
    this.eventBus = null;
    this.commandManager = null;
    this.serviceRegistry = null;
    this.objectSelector = null;

    this.isDestroyed = true;
    console.log('🧹 TransformManager.Modern: Destroyed');
  }
}

export default TransformManagerModern;
