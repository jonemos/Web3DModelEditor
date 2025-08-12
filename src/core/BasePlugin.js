/**
 * Base Plugin - 모든 플러그인의 기본 클래스
 * 
 * 플러그인 시스템의 표준 인터페이스를 제공합니다.
 * - 라이프사이클 관리
 * - 이벤트 시스템 통합
 * - 서비스 레지스트리 접근
 */

export class BasePlugin {
  constructor(name) {
    this.name = name;
    this.context = null;
    this.initialized = false;
    this.eventListeners = new Map();
  }

  /**
   * 플러그인 초기화
   */
  async init(context) {
    if (this.initialized) {
      console.warn(`Plugin ${this.name} is already initialized`);
      return;
    }

    this.context = context;
    this.initialized = true;
    
    console.log(`✅ Plugin ${this.name} initialized`);
  }

  /**
   * 이벤트 리스너 등록 (자동 정리 지원)
   */
  on(event, handler) {
    if (!this.context) {
      console.error(`Plugin ${this.name} is not initialized`);
      return;
    }

    // 이벤트 리스너 추가
    this.context.on(event, handler);
    
    // 정리를 위해 추적
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(handler);
  }

  /**
   * 이벤트 발생
   */
  emit(event, data) {
    if (!this.context) {
      console.error(`Plugin ${this.name} is not initialized`);
      return;
    }

    return this.context.emit(event, data);
  }

  /**
   * 서비스 가져오기
   */
  getService(serviceName) {
    if (!this.context) {
      console.error(`Plugin ${this.name} is not initialized`);
      return null;
    }

    return this.context.getService(serviceName);
  }

  /**
   * 플러그인이 초기화되었는지 확인
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * 플러그인 이름 가져오기
   */
  getName() {
    return this.name;
  }

  /**
   * 플러그인 정리
   */
  destroy() {
    // 이벤트 리스너 정리
    for (const [event, handlers] of this.eventListeners) {
      for (const handler of handlers) {
        if (this.context && this.context.off) {
          this.context.off(event, handler);
        }
      }
    }
    
    this.eventListeners.clear();
    this.context = null;
    this.initialized = false;
    
    console.log(`🗑️ Plugin ${this.name} destroyed`);
  }
}

/**
 * 플러그인 시스템 - 플러그인 관리
 */
export class PluginSystem {
  constructor() {
    this.plugins = new Map();
    this.context = null;
  }

  /**
   * 플러그인 시스템 초기화
   */
  init(context) {
    this.context = context;
    console.log('✅ Plugin System initialized');
  }

  /**
   * 플러그인 등록
   */
  async registerPlugin(name, plugin) {
    if (this.plugins.has(name)) {
      console.warn(`Plugin ${name} is already registered`);
      return false;
    }

    try {
      await plugin.init(this.context);
      this.plugins.set(name, plugin);
      console.log(`✅ Plugin ${name} registered successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to register plugin ${name}:`, error);
      return false;
    }
  }

  /**
   * 플러그인 가져오기
   */
  getPlugin(name) {
    return this.plugins.get(name);
  }

  /**
   * 모든 플러그인 가져오기
   */
  getAllPlugins() {
    return Array.from(this.plugins.values());
  }

  /**
   * 플러그인 해제
   */
  unregisterPlugin(name) {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.destroy();
      this.plugins.delete(name);
      console.log(`🗑️ Plugin ${name} unregistered`);
      return true;
    }
    return false;
  }

  /**
   * 모든 플러그인 정리
   */
  destroy() {
    for (const [name, plugin] of this.plugins) {
      plugin.destroy();
    }
    this.plugins.clear();
    console.log('🗑️ Plugin System destroyed');
  }
}
