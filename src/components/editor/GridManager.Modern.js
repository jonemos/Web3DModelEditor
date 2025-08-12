/**
 * GridManager.Modern - 새 아키텍처 기반 그리드 관리자
 * Service Registry, Event Bus, Command System 통합
 */
import * as THREE from 'three';

export class GridManagerModern {
  constructor(options = {}) {
    this.options = {
      size: 10,
      divisions: 10,
      visible: true,
      colorCenter: 0x888888,
      colorGrid: 0x444444,
      snapEnabled: false,
      snapSize: 1.0,
      ...options
    };
    
    // 서비스 참조
    this.eventBus = null;
    this.commandManager = null;
    this.serviceRegistry = null;
    this.sceneService = null;
    this.configManager = null;
    
    // 그리드 상태 관리
    this.state = { ...this.options };
    
    // Three.js 객체들
    this.gridHelper = null;
    this.scene = null;
    
    // 초기화 상태
    this.isInitialized = false;
    this.isDestroyed = false;
    
    // 이벤트 핸들러 바인딩
    this.boundHandlers = {
      onSceneLoaded: this.handleSceneLoaded.bind(this),
      onSceneCleared: this.handleSceneCleared.bind(this),
      onGridToggled: this.handleGridToggled.bind(this),
      onGridVisibilityChanged: this.handleGridVisibilityChanged.bind(this),
      onGridSizeChanged: this.handleGridSizeChanged.bind(this),
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
      this.sceneService = serviceRegistry.get('sceneService');
      this.configManager = serviceRegistry.get('configManager');
      
      if (!this.eventBus || !this.commandManager) {
        throw new Error('Required services not available');
      }

      console.log('📏 GridManager: Connected to new architecture');
      return true;
    } catch (error) {
      console.error('❌ GridManager: Failed to connect to new architecture:', error);
      return false;
    }
  }

  /**
   * 초기화
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // 씬 가져오기
      if (this.sceneService) {
        this.scene = this.sceneService.getScene();
      }
      
      // 이벤트 리스너 등록
      this.setupEventListeners();
      
      // 설정 감시자 등록
      this.setupConfigWatchers();
      
      // 그리드 생성
      await this.createGrid();
      
      this.isInitialized = true;
      console.log('✅ GridManager.Modern: Initialized');
      
      if (this.eventBus) {
        this.eventBus.emit('GRID_MANAGER_READY', { 
          manager: this,
          state: this.state 
        });
      }
    } catch (error) {
      console.error('❌ GridManager.Modern: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    if (!this.eventBus) return;

    // 씬 관련 이벤트
    this.eventBus.on('SCENE_LOADED', this.boundHandlers.onSceneLoaded);
    this.eventBus.on('SCENE_CLEARED', this.boundHandlers.onSceneCleared);
    
    // 그리드 관련 이벤트
    this.eventBus.on('GRID_TOGGLED', this.boundHandlers.onGridToggled);
    this.eventBus.on('GRID_VISIBILITY_CHANGED', this.boundHandlers.onGridVisibilityChanged);
    this.eventBus.on('GRID_SIZE_CHANGED', this.boundHandlers.onGridSizeChanged);
    
    // 키보드 입력 이벤트
    this.eventBus.on('KEYBOARD_INPUT', this.boundHandlers.onKeyboardInput);
  }

  /**
   * 설정 감시자 등록
   */
  setupConfigWatchers() {
    if (!this.configManager) return;

    // 그리드 표시 설정 감시
    this.configManager.watch('editor', 'viewport.gridVisible', (newValue) => {
      this.setVisibility(newValue);
    });

    // 그리드 크기 설정 감시
    this.configManager.watch('editor', 'viewport.gridSize', (newValue) => {
      this.setSize(newValue);
    });

    // 그리드 분할 설정 감시
    this.configManager.watch('editor', 'viewport.gridDivisions', (newValue) => {
      this.setDivisions(newValue);
    });

    // 그리드 색상 설정 감시
    this.configManager.watch('editor', 'viewport.gridColors', (newValue) => {
      if (newValue.center !== undefined) this.setColorCenter(newValue.center);
      if (newValue.grid !== undefined) this.setColorGrid(newValue.grid);
    });
  }

  /**
   * 그리드 생성
   */
  async createGrid() {
    if (!this.scene) {
      console.warn('GridManager: No scene available for grid creation');
      return false;
    }

    // 기존 그리드 제거
    this.removeGrid();

    // 새 그리드 생성
    this.gridHelper = new THREE.GridHelper(
      this.state.size,
      this.state.divisions,
      this.state.colorCenter,
      this.state.colorGrid
    );

    this.gridHelper.name = 'GridHelper';
    this.gridHelper.userData.isEditorHelper = true;
    this.gridHelper.visible = this.state.visible;

    this.scene.add(this.gridHelper);

    console.log(`📏 Grid created: size=${this.state.size}, divisions=${this.state.divisions}, visible=${this.state.visible}`);

    // 이벤트 발행
    if (this.eventBus) {
      this.eventBus.emit('GRID_CREATED', {
        grid: this.gridHelper,
        state: this.getState()
      });
    }

    return true;
  }

  /**
   * 그리드 제거
   */
  removeGrid() {
    if (this.gridHelper && this.scene) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.dispose?.();
      this.gridHelper = null;

      console.log('📏 Grid removed');

      // 이벤트 발행
      if (this.eventBus) {
        this.eventBus.emit('GRID_REMOVED', {});
      }
    }
  }

  /**
   * 그리드 표시/숨김 (명령 시스템 통합)
   */
  async setVisibility(visible) {
    if (this.commandManager) {
      try {
        await this.commandManager.execute('setGridVisibility', { visible });
        return true;
      } catch (error) {
        console.error('Failed to execute setGridVisibility command:', error);
      }
    }
    
    // Fallback to direct visibility setting
    return this.setVisibilityInternal(visible);
  }

  /**
   * 내부 표시/숨김 설정 (명령에서 호출됨)
   */
  setVisibilityInternal(visible) {
    const previousVisible = this.state.visible;
    this.state.visible = visible;

    if (this.gridHelper) {
      this.gridHelper.visible = visible;
    }

    console.log(`📏 Grid visibility changed: ${previousVisible} → ${visible}`);

    // 설정 저장
    if (this.configManager) {
      this.configManager.set('editor', 'viewport.gridVisible', visible);
    }

    // 이벤트 발행
    if (this.eventBus) {
      this.eventBus.emit('GRID_VISIBILITY_CHANGED', {
        visible,
        previousVisible
      });
    }

    return true;
  }

  /**
   * 그리드 토글
   */
  async toggleVisibility() {
    return this.setVisibility(!this.state.visible);
  }

  /**
   * 그리드 크기 설정
   */
  async setSize(size) {
    if (typeof size !== 'number' || size <= 0) {
      console.warn(`Invalid grid size: ${size}`);
      return false;
    }

    if (this.commandManager) {
      try {
        await this.commandManager.execute('setGridSize', { size });
        return true;
      } catch (error) {
        console.error('Failed to execute setGridSize command:', error);
      }
    }

    // Fallback to direct size setting
    return this.setSizeInternal(size);
  }

  /**
   * 내부 크기 설정 (명령에서 호출됨)
   */
  setSizeInternal(size) {
    const previousSize = this.state.size;
    this.state.size = size;

    // 그리드 재생성
    this.createGrid();

    console.log(`📏 Grid size changed: ${previousSize} → ${size}`);

    // 설정 저장
    if (this.configManager) {
      this.configManager.set('editor', 'viewport.gridSize', size);
    }

    // 이벤트 발행
    if (this.eventBus) {
      this.eventBus.emit('GRID_SIZE_CHANGED', {
        size,
        previousSize
      });
    }

    return true;
  }

  /**
   * 그리드 분할 수 설정
   */
  async setDivisions(divisions) {
    if (typeof divisions !== 'number' || divisions <= 0) {
      console.warn(`Invalid grid divisions: ${divisions}`);
      return false;
    }

    if (this.commandManager) {
      try {
        await this.commandManager.execute('setGridDivisions', { divisions });
        return true;
      } catch (error) {
        console.error('Failed to execute setGridDivisions command:', error);
      }
    }

    // Fallback to direct divisions setting
    return this.setDivisionsInternal(divisions);
  }

  /**
   * 내부 분할 수 설정 (명령에서 호출됨)
   */
  setDivisionsInternal(divisions) {
    const previousDivisions = this.state.divisions;
    this.state.divisions = divisions;

    // 그리드 재생성
    this.createGrid();

    console.log(`📏 Grid divisions changed: ${previousDivisions} → ${divisions}`);

    // 설정 저장
    if (this.configManager) {
      this.configManager.set('editor', 'viewport.gridDivisions', divisions);
    }

    // 이벤트 발행
    if (this.eventBus) {
      this.eventBus.emit('GRID_DIVISIONS_CHANGED', {
        divisions,
        previousDivisions
      });
    }

    return true;
  }

  /**
   * 중심선 색상 설정
   */
  setColorCenter(color) {
    const previousColor = this.state.colorCenter;
    this.state.colorCenter = color;

    // 그리드 재생성
    this.createGrid();

    console.log(`📏 Grid center color changed: ${previousColor.toString(16)} → ${color.toString(16)}`);

    // 설정 저장
    if (this.configManager) {
      this.configManager.set('editor', 'viewport.gridColors.center', color);
    }

    return true;
  }

  /**
   * 그리드 선 색상 설정
   */
  setColorGrid(color) {
    const previousColor = this.state.colorGrid;
    this.state.colorGrid = color;

    // 그리드 재생성
    this.createGrid();

    console.log(`📏 Grid line color changed: ${previousColor.toString(16)} → ${color.toString(16)}`);

    // 설정 저장
    if (this.configManager) {
      this.configManager.set('editor', 'viewport.gridColors.grid', color);
    }

    return true;
  }

  /**
   * 그리드 스냅 활성화/비활성화
   */
  setSnapEnabled(enabled) {
    this.state.snapEnabled = enabled;

    console.log(`📏 Grid snap ${enabled ? 'enabled' : 'disabled'}`);

    // 이벤트 발행
    if (this.eventBus) {
      this.eventBus.emit('GRID_SNAP_CHANGED', {
        enabled,
        snapSize: this.state.snapSize
      });
    }

    return true;
  }

  /**
   * 그리드 스냅 크기 설정
   */
  setSnapSize(snapSize) {
    if (typeof snapSize !== 'number' || snapSize <= 0) {
      console.warn(`Invalid snap size: ${snapSize}`);
      return false;
    }

    const previousSnapSize = this.state.snapSize;
    this.state.snapSize = snapSize;

    console.log(`📏 Grid snap size changed: ${previousSnapSize} → ${snapSize}`);

    // 이벤트 발행
    if (this.eventBus) {
      this.eventBus.emit('GRID_SNAP_SIZE_CHANGED', {
        snapSize,
        previousSnapSize
      });
    }

    return true;
  }

  /**
   * 위치를 그리드에 스냅
   */
  snapToGrid(position) {
    if (!this.state.snapEnabled) {
      return position;
    }

    const snapSize = this.state.snapSize;
    return {
      x: Math.round(position.x / snapSize) * snapSize,
      y: position.y, // Y축은 보통 스냅하지 않음
      z: Math.round(position.z / snapSize) * snapSize
    };
  }

  // ==================== 이벤트 핸들러 ====================

  /**
   * 씬 로드 이벤트 핸들러
   */
  handleSceneLoaded(event) {
    console.log('📏 GridManager: Scene loaded, recreating grid');
    
    // 새 씬 가져오기
    if (this.sceneService) {
      this.scene = this.sceneService.getScene();
    }
    
    this.createGrid();
  }

  /**
   * 씬 클리어 이벤트 핸들러
   */
  handleSceneCleared(event) {
    console.log('📏 GridManager: Scene cleared, recreating grid');
    this.createGrid();
  }

  /**
   * 그리드 토글 이벤트 핸들러
   */
  handleGridToggled(event) {
    const eventDetail = event.detail || {};
    const { visible } = eventDetail;
    
    if (typeof visible === 'boolean') {
      this.setVisibilityInternal(visible);
    } else {
      this.toggleVisibility();
    }
  }

  /**
   * 그리드 표시 변경 이벤트 핸들러
   */
  handleGridVisibilityChanged(event) {
    const eventDetail = event.detail || {};
    const { visible } = eventDetail;
    
    if (typeof visible === 'boolean' && visible !== this.state.visible) {
      this.setVisibilityInternal(visible);
    }
  }

  /**
   * 그리드 크기 변경 이벤트 핸들러
   */
  handleGridSizeChanged(event) {
    const eventDetail = event.detail || {};
    const { size } = eventDetail;
    
    if (typeof size === 'number' && size !== this.state.size) {
      this.setSizeInternal(size);
    }
  }

  /**
   * 키보드 입력 이벤트 핸들러
   */
  handleKeyboardInput(event) {
    const eventDetail = event.detail || {};
    const { key, action, altKey, ctrlKey, shiftKey } = eventDetail;
    
    // 그리드 관련 키보드 단축키 처리
    switch (action) {
      case 'toggle_grid':
        this.toggleVisibility();
        break;
      case 'grid_size_increase':
        this.setSize(this.state.size + 1);
        break;
      case 'grid_size_decrease':
        this.setSize(Math.max(1, this.state.size - 1));
        break;
      case 'toggle_grid_snap':
        this.setSnapEnabled(!this.state.snapEnabled);
        break;
    }
  }

  // ==================== 유틸리티 메서드 ====================

  /**
   * 그리드가 표시 중인지 확인
   */
  isVisible() {
    return this.state.visible;
  }

  /**
   * 그리드 헬퍼 객체 가져오기
   */
  getGridHelper() {
    return this.gridHelper;
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
      this.eventBus.emit('GRID_STATE_CHANGED', { 
        state: this.state, 
        previousState 
      });
    }
  }

  /**
   * 설정을 ConfigManager에 저장
   */
  saveToConfig() {
    if (!this.configManager) return;

    this.configManager.set('editor', 'viewport.gridVisible', this.state.visible);
    this.configManager.set('editor', 'viewport.gridSize', this.state.size);
    this.configManager.set('editor', 'viewport.gridDivisions', this.state.divisions);
    this.configManager.set('editor', 'viewport.gridColors', {
      center: this.state.colorCenter,
      grid: this.state.colorGrid
    });

    console.log('📏 Grid settings saved to config');
  }

  /**
   * ConfigManager에서 설정 로드
   */
  loadFromConfig() {
    if (!this.configManager) return;

    const visible = this.configManager.get('editor', 'viewport.gridVisible');
    const size = this.configManager.get('editor', 'viewport.gridSize');
    const divisions = this.configManager.get('editor', 'viewport.gridDivisions');
    const colors = this.configManager.get('editor', 'viewport.gridColors');

    if (visible !== undefined) this.state.visible = visible;
    if (size !== undefined) this.state.size = size;
    if (divisions !== undefined) this.state.divisions = divisions;
    if (colors) {
      if (colors.center !== undefined) this.state.colorCenter = colors.center;
      if (colors.grid !== undefined) this.state.colorGrid = colors.grid;
    }

    console.log('📏 Grid settings loaded from config');
  }

  /**
   * 정리
   */
  destroy() {
    if (this.isDestroyed) return;

    // 그리드 제거
    this.removeGrid();

    // 이벤트 리스너 제거
    if (this.eventBus) {
      this.eventBus.off('SCENE_LOADED', this.boundHandlers.onSceneLoaded);
      this.eventBus.off('SCENE_CLEARED', this.boundHandlers.onSceneCleared);
      this.eventBus.off('GRID_TOGGLED', this.boundHandlers.onGridToggled);
      this.eventBus.off('GRID_VISIBILITY_CHANGED', this.boundHandlers.onGridVisibilityChanged);
      this.eventBus.off('GRID_SIZE_CHANGED', this.boundHandlers.onGridSizeChanged);
      this.eventBus.off('KEYBOARD_INPUT', this.boundHandlers.onKeyboardInput);
    }

    // 참조 정리
    this.eventBus = null;
    this.commandManager = null;
    this.serviceRegistry = null;
    this.sceneService = null;
    this.configManager = null;
    this.scene = null;

    this.isDestroyed = true;
    console.log('🧹 GridManager.Modern: Destroyed');
  }
}

export default GridManagerModern;
