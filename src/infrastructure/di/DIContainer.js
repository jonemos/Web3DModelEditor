/**
 * 의존성 주입 컨테이너 - IoC(Inversion of Control) 구현
 */

export const LIFECYCLE = {
  SINGLETON: 'singleton',
  TRANSIENT: 'transient',
  SCOPED: 'scoped'
};

export const SERVICE_TOKENS = {
  // 핵심 서비스
  EVENT_BUS: 'EventBus',
  SCENE_MANAGER: 'SceneManager',
  OBJECT_FACTORY: 'ObjectFactory',
  SELECTION_MANAGER: 'SelectionManager',
  HISTORY_MANAGER: 'HistoryManager',
  
  // 렌더링 관련
  RENDER_MANAGER: 'RenderManager',
  CAMERA_CONTROLLER: 'CameraController',
  PERFORMANCE_MONITOR: 'PerformanceMonitor',
  
  // 저장소 관련
  STORAGE_REPOSITORY: 'StorageRepository',
  ASSET_LOADER: 'AssetLoader',
  CONFIG_MANAGER: 'ConfigManager',
  
  // UI 관련
  NOTIFICATION_SERVICE: 'NotificationService',
  MODAL_SERVICE: 'ModalService',
  THEME_SERVICE: 'ThemeService'
};

/**
 * 서비스 등록 정보
 */
class ServiceRegistration {
  constructor(token, factory, lifecycle = LIFECYCLE.SINGLETON, dependencies = []) {
    this.token = token;
    this.factory = factory;
    this.lifecycle = lifecycle;
    this.dependencies = dependencies;
    this.instance = null;
    this.creating = false; // 순환 참조 방지
  }
}

/**
 * 의존성 주입 컨테이너
 */
export class DIContainer {
  constructor() {
    this.services = new Map();
    this.scopedInstances = new Map();
    this.debugMode = false;
    this.metrics = {
      resolutions: 0,
      creations: 0,
      circularDetections: 0
    };
  }

  /**
   * 서비스 등록 (팩토리 함수)
   */
  register(token, factory, lifecycle = LIFECYCLE.SINGLETON, dependencies = []) {
    if (typeof factory !== 'function') {
      throw new Error(`Factory for ${token} must be a function`);
    }

    const registration = new ServiceRegistration(token, factory, lifecycle, dependencies);
    this.services.set(token, registration);

    if (this.debugMode) {
      console.log(`[DIContainer] Registered ${token} with lifecycle ${lifecycle}`);
    }

    return this;
  }

  /**
   * 서비스 등록 (클래스)
   */
  registerClass(token, ServiceClass, lifecycle = LIFECYCLE.SINGLETON, dependencies = []) {
    const factory = (container) => {
      const resolvedDeps = dependencies.map(dep => container.resolve(dep));
      return new ServiceClass(...resolvedDeps);
    };

    return this.register(token, factory, lifecycle, dependencies);
  }

  /**
   * 서비스 등록 (인스턴스)
   */
  registerInstance(token, instance) {
    const factory = () => instance;
    const registration = new ServiceRegistration(token, factory, LIFECYCLE.SINGLETON, []);
    registration.instance = instance;
    
    this.services.set(token, registration);

    if (this.debugMode) {
      console.log(`[DIContainer] Registered instance ${token}`);
    }

    return this;
  }

  /**
   * 서비스 해결
   */
  resolve(token) {
    this.metrics.resolutions++;

    const registration = this.services.get(token);
    if (!registration) {
      throw new Error(`Service ${token} is not registered`);
    }

    // 순환 참조 검사
    if (registration.creating) {
      this.metrics.circularDetections++;
      throw new Error(`Circular dependency detected while creating ${token}`);
    }

    switch (registration.lifecycle) {
      case LIFECYCLE.SINGLETON:
        return this.resolveSingleton(registration);
      
      case LIFECYCLE.TRANSIENT:
        return this.resolveTransient(registration);
      
      case LIFECYCLE.SCOPED:
        return this.resolveScoped(registration);
      
      default:
        throw new Error(`Unknown lifecycle: ${registration.lifecycle}`);
    }
  }

  /**
   * 싱글톤 해결
   */
  resolveSingleton(registration) {
    if (registration.instance === null) {
      registration.creating = true;
      
      try {
        registration.instance = registration.factory(this);
        this.metrics.creations++;
        
        if (this.debugMode) {
          console.log(`[DIContainer] Created singleton ${registration.token}`);
        }
      } finally {
        registration.creating = false;
      }
    }

    return registration.instance;
  }

  /**
   * 일시적 해결
   */
  resolveTransient(registration) {
    registration.creating = true;
    
    try {
      const instance = registration.factory(this);
      this.metrics.creations++;
      
      if (this.debugMode) {
        console.log(`[DIContainer] Created transient ${registration.token}`);
      }
      
      return instance;
    } finally {
      registration.creating = false;
    }
  }

  /**
   * 범위 해결
   */
  resolveScoped(registration) {
    const scopeKey = this.getCurrentScope();
    const scopeMap = this.scopedInstances.get(scopeKey) || new Map();
    
    if (!scopeMap.has(registration.token)) {
      registration.creating = true;
      
      try {
        const instance = registration.factory(this);
        scopeMap.set(registration.token, instance);
        this.scopedInstances.set(scopeKey, scopeMap);
        this.metrics.creations++;
        
        if (this.debugMode) {
          console.log(`[DIContainer] Created scoped ${registration.token} for scope ${scopeKey}`);
        }
      } finally {
        registration.creating = false;
      }
    }

    return scopeMap.get(registration.token);
  }

  /**
   * 현재 범위 키 가져오기 (기본적으로 현재 시간 기반)
   */
  getCurrentScope() {
    // 실제 구현에서는 React Context나 다른 범위 메커니즘 사용
    return 'default';
  }

  /**
   * 서비스 등록 여부 확인
   */
  isRegistered(token) {
    return this.services.has(token);
  }

  /**
   * 서비스 등록 해제
   */
  unregister(token) {
    const registration = this.services.get(token);
    if (registration) {
      // 인스턴스 정리
      if (registration.instance && typeof registration.instance.dispose === 'function') {
        registration.instance.dispose();
      }
      
      this.services.delete(token);
      
      if (this.debugMode) {
        console.log(`[DIContainer] Unregistered ${token}`);
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * 모든 서비스 정리
   */
  clear() {
    // 싱글톤 인스턴스 정리
    for (const registration of this.services.values()) {
      if (registration.instance && typeof registration.instance.dispose === 'function') {
        try {
          registration.instance.dispose();
        } catch (error) {
          console.error(`[DIContainer] Error disposing ${registration.token}:`, error);
        }
      }
    }

    // 범위 인스턴스 정리
    for (const scopeMap of this.scopedInstances.values()) {
      for (const instance of scopeMap.values()) {
        if (typeof instance.dispose === 'function') {
          try {
            instance.dispose();
          } catch (error) {
            console.error('[DIContainer] Error disposing scoped instance:', error);
          }
        }
      }
    }

    this.services.clear();
    this.scopedInstances.clear();
    
    if (this.debugMode) {
      console.log('[DIContainer] Container cleared');
    }
  }

  /**
   * 범위 정리
   */
  clearScope(scopeKey = null) {
    const targetScope = scopeKey || this.getCurrentScope();
    const scopeMap = this.scopedInstances.get(targetScope);
    
    if (scopeMap) {
      for (const instance of scopeMap.values()) {
        if (typeof instance.dispose === 'function') {
          try {
            instance.dispose();
          } catch (error) {
            console.error('[DIContainer] Error disposing scoped instance:', error);
          }
        }
      }
      
      this.scopedInstances.delete(targetScope);
      
      if (this.debugMode) {
        console.log(`[DIContainer] Cleared scope ${targetScope}`);
      }
    }
  }

  /**
   * 컨테이너 상태 조회
   */
  getStats() {
    const stats = {
      totalServices: this.services.size,
      singletonInstances: 0,
      scopedInstances: 0,
      lifecycleBreakdown: {
        singleton: 0,
        transient: 0,
        scoped: 0
      },
      metrics: { ...this.metrics }
    };

    for (const registration of this.services.values()) {
      stats.lifecycleBreakdown[registration.lifecycle]++;
      
      if (registration.lifecycle === LIFECYCLE.SINGLETON && registration.instance) {
        stats.singletonInstances++;
      }
    }

    for (const scopeMap of this.scopedInstances.values()) {
      stats.scopedInstances += scopeMap.size;
    }

    return stats;
  }

  /**
   * 의존성 그래프 생성
   */
  getDependencyGraph() {
    const graph = {
      nodes: [],
      edges: []
    };

    for (const [token, registration] of this.services) {
      graph.nodes.push({
        id: token,
        lifecycle: registration.lifecycle,
        hasInstance: registration.instance !== null
      });

      for (const dependency of registration.dependencies) {
        graph.edges.push({
          from: dependency,
          to: token
        });
      }
    }

    return graph;
  }

  /**
   * 디버그 모드 설정
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log(`[DIContainer] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 서비스 등록 체인 (Fluent API)
   */
  batch() {
    return new DIContainerBatch(this);
  }
}

/**
 * 배치 등록을 위한 헬퍼 클래스
 */
class DIContainerBatch {
  constructor(container) {
    this.container = container;
    this.operations = [];
  }

  register(token, factory, lifecycle, dependencies) {
    this.operations.push(() => 
      this.container.register(token, factory, lifecycle, dependencies)
    );
    return this;
  }

  registerClass(token, ServiceClass, lifecycle, dependencies) {
    this.operations.push(() => 
      this.container.registerClass(token, ServiceClass, lifecycle, dependencies)
    );
    return this;
  }

  registerInstance(token, instance) {
    this.operations.push(() => 
      this.container.registerInstance(token, instance)
    );
    return this;
  }

  execute() {
    this.operations.forEach(operation => operation());
    return this.container;
  }
}

// 전역 컨테이너 인스턴스
export const globalContainer = new DIContainer();

/**
 * 의존성 주입 데코레이터
 */
export function inject(token) {
  return function(target, propertyKey) {
    // 프로퍼티 getter 정의
    Object.defineProperty(target, propertyKey, {
      get() {
        if (!this._diContainer) {
          this._diContainer = globalContainer;
        }
        return this._diContainer.resolve(token);
      },
      configurable: true,
      enumerable: true
    });
  };
}
