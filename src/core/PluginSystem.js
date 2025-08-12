/**
 * Plugin System - 확장 가능한 플러그인 아키텍처
 * 
 * 각 기능을 독립적인 플러그인으로 분리하여:
 * - 의존성 격리
 * - 런타임 로딩/언로딩
 * - 쉬운 기능 추가/제거
 */

export class PluginSystem {
  constructor() {
    this.plugins = new Map()
    this.hooks = new Map()
    this.eventBus = new EventTarget()
  }

  /**
   * 플러그인 등록
   */
  registerPlugin(name, plugin) {
    if (this.plugins.has(name)) {
      console.warn(`Plugin ${name} already registered`)
      return false
    }

    // 플러그인 검증
    if (!this.validatePlugin(plugin)) {
      throw new Error(`Invalid plugin: ${name}`)
    }

    this.plugins.set(name, plugin)
    
    // 플러그인 초기화
    if (plugin.init) {
      plugin.init(this.createPluginContext(name))
    }

    this.emit('plugin:registered', { name, plugin })
    return true
  }

  /**
   * 플러그인 제거
   */
  unregisterPlugin(name) {
    const plugin = this.plugins.get(name)
    if (!plugin) return false

    // 정리 작업
    if (plugin.destroy) {
      plugin.destroy()
    }

    this.plugins.delete(name)
    this.emit('plugin:unregistered', { name })
    return true
  }

  /**
   * 훅 실행 (플러그인들에게 이벤트 전달)
   */
  executeHook(hookName, ...args) {
    const results = []
    
    for (const [name, plugin] of this.plugins) {
      if (plugin.hooks && plugin.hooks[hookName]) {
        try {
          const result = plugin.hooks[hookName](...args)
          results.push({ plugin: name, result })
        } catch (error) {
          console.error(`Plugin ${name} hook ${hookName} failed:`, error)
        }
      }
    }

    return results
  }

  /**
   * 이벤트 발생
   */
  emit(eventName, data) {
    const event = new CustomEvent(eventName, { detail: data })
    this.eventBus.dispatchEvent(event)
  }

  /**
   * 이벤트 리스닝
   */
  on(eventName, callback) {
    this.eventBus.addEventListener(eventName, callback)
  }

  /**
   * 플러그인 컨텍스트 생성
   */
  createPluginContext(pluginName) {
    return {
      pluginName,
      emit: this.emit.bind(this),
      on: this.on.bind(this),
      executeHook: this.executeHook.bind(this),
      getPlugin: (name) => this.plugins.get(name),
      getAPI: () => this.createPluginAPI()
    }
  }

  /**
   * 플러그인 API (제한된 인터페이스)
   */
  createPluginAPI() {
    return {
      // 안전한 API만 노출
      registerCommand: this.registerCommand.bind(this),
      registerPanel: this.registerPanel.bind(this),
      registerTool: this.registerTool.bind(this)
    }
  }

  /**
   * 플러그인 검증
   */
  validatePlugin(plugin) {
    return (
      plugin &&
      typeof plugin === 'object' &&
      typeof plugin.name === 'string' &&
      typeof plugin.version === 'string'
    )
  }

  /**
   * 명령어 등록 (플러그인용)
   */
  registerCommand(name, handler) {
    // 명령어 시스템과 연동
  }

  /**
   * 패널 등록 (플러그인용)
   */
  registerPanel(name, component) {
    // UI 패널 시스템과 연동
  }

  /**
   * 도구 등록 (플러그인용)
   */
  registerTool(name, tool) {
    // 도구 시스템과 연동
  }
}

// 글로벌 플러그인 시스템 인스턴스
export const pluginSystem = new PluginSystem()
