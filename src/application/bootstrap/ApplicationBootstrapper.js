/**
 * 애플리케이션 부트스트래퍼 - 의존성 주입 및 서비스 초기화
 */

import { globalContainer, SERVICE_TOKENS, LIFECYCLE } from '../../infrastructure/di/DIContainer.js';
import { globalEventBus } from '../../infrastructure/events/EventBus.js';

// 도메인 서비스
import { SceneManagerService, ObjectFactoryService, EditorService } from '../../domain/editor/services/EditorService.js';

/**
 * 애플리케이션 부트스트래퍼
 */
export class AppBootstrapper {
  constructor() {
    this.isInitialized = false;
    this.container = globalContainer;
    this.eventBus = globalEventBus;
  }

  /**
   * 애플리케이션 초기화
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn('Application already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing ThirdPersonTreeJS Application...');

      // 1. 인프라스트럭처 서비스 등록
      this.registerInfrastructureServices();

      // 2. 도메인 서비스 등록  
      this.registerDomainServices();

      // 3. 애플리케이션 서비스 등록
      this.registerApplicationServices();

      // 4. 서비스 초기화
      await this.initializeServices();

      // 5. 이벤트 핸들러 설정
      this.setupGlobalEventHandlers();

      this.isInitialized = true;
      console.log('✅ Application initialized successfully');

      // 초기화 완료 이벤트 발행
      this.eventBus.publish('app:initialized', {
        timestamp: new Date(),
        services: this.container.getStats()
      });

    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      throw error;
    }
  }

  /**
   * 인프라스트럭처 서비스 등록
   */
  registerInfrastructureServices() {
    console.log('📦 Registering infrastructure services...');

    // 이벤트 버스 (싱글톤)
    this.container.registerInstance(SERVICE_TOKENS.EVENT_BUS, this.eventBus);

    // 저장소 서비스 (모의 구현)
    this.container.register(
      SERVICE_TOKENS.STORAGE_REPOSITORY,
      () => new LocalStorageRepository(),
      LIFECYCLE.SINGLETON
    );

    // 에셋 로더 (모의 구현)
    this.container.register(
      SERVICE_TOKENS.ASSET_LOADER,
      (container) => new MockAssetLoader(container.resolve(SERVICE_TOKENS.EVENT_BUS)),
      LIFECYCLE.SINGLETON
    );

    // 선택 관리자 (모의 구현)
    this.container.register(
      SERVICE_TOKENS.SELECTION_MANAGER,
      (container) => new MockSelectionManager(container.resolve(SERVICE_TOKENS.EVENT_BUS)),
      LIFECYCLE.SINGLETON
    );

    // 히스토리 관리자 (모의 구현)
    this.container.register(
      SERVICE_TOKENS.HISTORY_MANAGER,
      (container) => new MockHistoryManager(container.resolve(SERVICE_TOKENS.EVENT_BUS)),
      LIFECYCLE.SINGLETON
    );

    // 렌더링 관리자 (모의 구현)
    this.container.register(
      SERVICE_TOKENS.RENDER_MANAGER,
      (container) => new MockRenderManager(container.resolve(SERVICE_TOKENS.EVENT_BUS)),
      LIFECYCLE.SINGLETON
    );

    // 성능 모니터 (모의 구현)
    this.container.register(
      SERVICE_TOKENS.PERFORMANCE_MONITOR,
      (container) => new MockPerformanceMonitor(container.resolve(SERVICE_TOKENS.EVENT_BUS)),
      LIFECYCLE.SINGLETON
    );
  }

  /**
   * 도메인 서비스 등록
   */
  registerDomainServices() {
    console.log('🏗️ Registering domain services...');

    // 씬 관리자
    this.container.registerClass(
      SERVICE_TOKENS.SCENE_MANAGER,
      SceneManagerService,
      LIFECYCLE.SINGLETON,
      [SERVICE_TOKENS.EVENT_BUS, SERVICE_TOKENS.STORAGE_REPOSITORY]
    );

    // 오브젝트 팩토리
    this.container.registerClass(
      SERVICE_TOKENS.OBJECT_FACTORY,
      ObjectFactoryService,
      LIFECYCLE.SINGLETON,
      [SERVICE_TOKENS.EVENT_BUS, SERVICE_TOKENS.ASSET_LOADER]
    );

    // 에디터 서비스 (메인 조정자)
    this.container.register(
      'EditorService',
      (container) => new EditorService(
        container.resolve(SERVICE_TOKENS.EVENT_BUS),
        container.resolve(SERVICE_TOKENS.SCENE_MANAGER),
        container.resolve(SERVICE_TOKENS.OBJECT_FACTORY),
        container.resolve(SERVICE_TOKENS.SELECTION_MANAGER),
        container.resolve(SERVICE_TOKENS.HISTORY_MANAGER),
        container.resolve(SERVICE_TOKENS.RENDER_MANAGER)
      ),
      LIFECYCLE.SINGLETON
    );
  }

  /**
   * 애플리케이션 서비스 등록
   */
  registerApplicationServices() {
    console.log('🎯 Registering application services...');

    // 설정 관리자
    this.container.register(
      SERVICE_TOKENS.CONFIG_MANAGER,
      () => new ConfigManagerService(),
      LIFECYCLE.SINGLETON
    );

    // 알림 서비스
    this.container.register(
      SERVICE_TOKENS.NOTIFICATION_SERVICE,
      (container) => new NotificationService(container.resolve(SERVICE_TOKENS.EVENT_BUS)),
      LIFECYCLE.SINGLETON
    );

    // 테마 서비스
    this.container.register(
      SERVICE_TOKENS.THEME_SERVICE,
      (container) => new ThemeService(container.resolve(SERVICE_TOKENS.CONFIG_MANAGER)),
      LIFECYCLE.SINGLETON
    );
  }

  /**
   * 서비스 초기화
   */
  async initializeServices() {
    console.log('⚙️ Initializing services...');

    // 성능 모니터 시작
    const performanceMonitor = this.container.resolve(SERVICE_TOKENS.PERFORMANCE_MONITOR);
    performanceMonitor.start();

    // 설정 로드
    const configManager = this.container.resolve(SERVICE_TOKENS.CONFIG_MANAGER);
    await configManager.load();

    // 테마 적용
    const themeService = this.container.resolve(SERVICE_TOKENS.THEME_SERVICE);
    themeService.applyCurrentTheme();

    // EditorService 초기화 및 기본 씬 생성
    try {
      const editorService = this.container.resolve('EditorService');
      console.log('🏗️ Creating default scene...');
      await editorService.startNewProject('Default Scene');
      console.log('✅ Default scene created successfully');
    } catch (error) {
      console.error('⚠️ Failed to create default scene:', error);
      // 기본 씬 생성 실패는 치명적이지 않으므로 계속 진행
    }
  }

  /**
   * 전역 이벤트 핸들러 설정
   */
  setupGlobalEventHandlers() {
    console.log('🔗 Setting up global event handlers...');

    // 에러 핸들링
    this.eventBus.subscribe('error:occurred', (event) => {
      console.error('Application Error:', event.data);
      
      const notificationService = this.container.resolve(SERVICE_TOKENS.NOTIFICATION_SERVICE);
      notificationService.showError(event.data.error || 'An error occurred');
    });

    // 성능 경고
    this.eventBus.subscribe('performance:warning', (event) => {
      console.warn('Performance Warning:', event.data);
      
      const notificationService = this.container.resolve(SERVICE_TOKENS.NOTIFICATION_SERVICE);
      notificationService.showWarning(`Performance issue: ${event.data.message}`);
    });

    // 브라우저 언로드 시 정리
    window.addEventListener('beforeunload', () => {
      this.dispose();
    });
  }

  /**
   * 애플리케이션 정리
   */
  dispose() {
    if (!this.isInitialized) {
      return;
    }

    console.log('🧹 Disposing application...');

    try {
      // 모든 서비스 정리
      this.container.clear();
      
      // 이벤트 버스 정리
      this.eventBus.clear();
      
      this.isInitialized = false;
      
      console.log('✅ Application disposed successfully');
    } catch (error) {
      console.error('❌ Error during application disposal:', error);
    }
  }

  /**
   * 서비스 조회
   */
  getService(token) {
    if (!this.isInitialized) {
      throw new Error('Application not initialized');
    }
    
    return this.container.resolve(token);
  }

  /**
   * 애플리케이션 상태 조회
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      services: this.container.getStats(),
      events: this.eventBus.getStats()
    };
  }
}

// 모의 구현들 (실제 구현은 별도 파일에)
class LocalStorageRepository {
  async save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  async load(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  async delete(key) {
    localStorage.removeItem(key);
    return true;
  }

  async exists(key) {
    return localStorage.getItem(key) !== null;
  }

  async list() {
    return Object.keys(localStorage);
  }

  async clear() {
    localStorage.clear();
  }
}

class MockAssetLoader {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }

  async loadModel(url) {
    console.log(`Loading model: ${url}`);
    return { url, loaded: true };
  }

  async loadTexture(url) {
    console.log(`Loading texture: ${url}`);
    return { url, loaded: true };
  }

  getProgress() {
    return { loaded: 1, total: 1 };
  }
}

class MockSelectionManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.selectedObjects = new Set();
  }

  selectObject(objectId) {
    this.selectedObjects.add(objectId);
    this.eventBus.publish('object:selected', { objectId });
  }

  deselectObject(objectId) {
    this.selectedObjects.delete(objectId);
    this.eventBus.publish('object:deselected', { objectId });
  }

  getSelectedObjects() {
    return Array.from(this.selectedObjects);
  }

  isSelected(objectId) {
    return this.selectedObjects.has(objectId);
  }

  clearSelection() {
    this.selectedObjects.clear();
  }
}

class MockHistoryManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.undoStack = [];
    this.redoStack = [];
  }

  execute(command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
  }

  undo() {
    if (this.canUndo()) {
      const command = this.undoStack.pop();
      command.undo();
      this.redoStack.push(command);
      return true;
    }
    return false;
  }

  redo() {
    if (this.canRedo()) {
      const command = this.redoStack.pop();
      command.execute();
      this.undoStack.push(command);
      return true;
    }
    return false;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

class MockRenderManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }

  async initializeScene(scene) {
    console.log('Initializing scene for rendering');
  }

  async addObject(object) {
    console.log(`Adding object to render: ${object.name}`);
  }

  removeObject(objectId) {
    console.log(`Removing object from render: ${objectId}`);
  }

  highlightObject(objectId) {
    console.log(`Highlighting object: ${objectId}`);
  }

  updateObject(objectId) {
    console.log(`Updating object: ${objectId}`);
  }

  setGridVisible(visible) {
    console.log(`Grid visibility: ${visible}`);
  }
}

class MockPerformanceMonitor {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }

  start() {
    console.log('Performance monitoring started');
  }

  getStats() {
    return { fps: 60, memory: 50 };
  }
}

/**
 * 설정 관리자
 */
class ConfigManagerService {
  constructor() {
    this.config = {
      rendering: {
        antialias: true,
        shadows: true,
        shadowMapSize: 2048,
        pixelRatio: Math.min(window.devicePixelRatio, 2)
      },
      editor: {
        gridSize: 1,
        snapToGrid: false,
        autoSave: true,
        autoSaveInterval: 30000
      },
      performance: {
        targetFPS: 60,
        enableMonitoring: true,
        warningThreshold: 50
      },
      ui: {
        theme: 'dark',
        panelSizes: {},
        shortcuts: {}
      }
    };
  }

  async load() {
    try {
      const saved = localStorage.getItem('app_config');
      if (saved) {
        const parsedConfig = JSON.parse(saved);
        this.config = { ...this.config, ...parsedConfig };
      }
    } catch (error) {
      console.warn('Failed to load config:', error);
    }
  }

  async save() {
    try {
      localStorage.setItem('app_config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  get(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  set(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let target = this.config;
    
    for (const k of keys) {
      if (!(k in target) || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }
    
    target[lastKey] = value;
    this.save();
  }
}

/**
 * 알림 서비스
 */
class NotificationService {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }

  showError(message, duration = 5000) {
    this.eventBus.publish('ui:notification', {
      type: 'error',
      message,
      duration
    });
  }

  showWarning(message, duration = 3000) {
    this.eventBus.publish('ui:notification', {
      type: 'warning',
      message,
      duration
    });
  }

  showSuccess(message, duration = 2000) {
    this.eventBus.publish('ui:notification', {
      type: 'success',
      message,
      duration
    });
  }

  showInfo(message, duration = 3000) {
    this.eventBus.publish('ui:notification', {
      type: 'info',
      message,
      duration
    });
  }
}

/**
 * 테마 서비스
 */
class ThemeService {
  constructor(configManager) {
    this.configManager = configManager;
    this.themes = {
      light: {
        background: '#f5f5f5',
        surface: '#ffffff',
        primary: '#1976d2',
        text: '#333333'
      },
      dark: {
        background: '#121212',
        surface: '#1e1e1e',
        primary: '#90caf9',
        text: '#ffffff'
      }
    };
  }

  applyCurrentTheme() {
    const themeName = this.configManager.get('ui.theme', 'dark');
    this.applyTheme(themeName);
  }

  applyTheme(themeName) {
    const theme = this.themes[themeName];
    if (!theme) {
      console.warn(`Unknown theme: ${themeName}`);
      return;
    }

    const root = document.documentElement;
    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    this.configManager.set('ui.theme', themeName);
  }

  getAvailableThemes() {
    return Object.keys(this.themes);
  }
}

// 전역 부트스트래퍼 인스턴스
export const appBootstrapper = new AppBootstrapper();
