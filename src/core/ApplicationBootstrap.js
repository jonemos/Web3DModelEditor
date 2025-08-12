/**
 * Application Bootstrap - 새로운 아키텍처 초기화
 * 
 * 모든 시스템을 통합하여 애플리케이션을 부트스트랩합니다.
 */

import { pluginSystem } from '../core/PluginSystem.js'
import { commandManager } from '../core/CommandSystem.js'
import { serviceRegistry, setupDefaultServices } from '../core/ServiceRegistry.js'
import { eventBus, EventTypes } from '../core/EventBus.js'
import { configManager } from '../core/ConfigManager.js'

// 플러그인들
import { registerTransformPlugin } from '../plugins/TransformPlugin.js'
import { registerGridPlugin } from '../plugins/GridPlugin.js'

export class ApplicationBootstrap {
  constructor() {
    this.initialized = false
    this.services = new Map()
    this.plugins = []
  }

  /**
   * 애플리케이션 초기화
   */
  async initialize(canvas) {
    if (this.initialized) {
      console.warn('Application already initialized')
      return
    }

    console.log('🚀 Initializing Web3D Model Editor...')

    try {
      // 1. 설정 시스템 초기화
      await this.initializeConfiguration()

      // 2. 기본 서비스들 설정
      await this.initializeServices(canvas)

      // 3. 이벤트 시스템 초기화
      await this.initializeEventSystem()

      // 4. 명령어 시스템 초기화
      await this.initializeCommandSystem()

      // 5. 플러그인 시스템 초기화
      await this.initializePluginSystem()

      // 6. 기본 플러그인들 로드
      await this.loadDefaultPlugins()

      // 7. 설정 로드
      await this.loadConfiguration()

      this.initialized = true
      
      console.log('✅ Application initialized successfully')
      eventBus.emit(EventTypes.APP_INITIALIZED)

    } catch (error) {
      console.error('❌ Application initialization failed:', error)
      throw error
    }
  }

  /**
   * 설정 시스템 초기화
   */
  async initializeConfiguration() {
    console.log('📋 Initializing configuration system...')
    
    // 설정 스키마들은 이미 등록됨 (ConfigManager.js에서)
    
    // 환경별 설정 오버라이드
    if (process.env.NODE_ENV === 'development') {
      configManager.set('editor', 'rendering.backgroundColor', '#1a1a1a')
      configManager.set('editor', 'ui.theme', 'dark')
    }
  }

  /**
   * 서비스 시스템 초기화
   */
  async initializeServices(canvas) {
    console.log('🔧 Initializing services...')
    
    // 기본 서비스들 등록
    setupDefaultServices()
    
    // 서비스 인스턴스들을 맵에 저장 (빠른 접근용)
    this.services.set('scene', serviceRegistry.get('sceneService'))
    this.services.set('selection', serviceRegistry.get('selectionService'))
    this.services.set('objectManagement', serviceRegistry.get('objectManagementService'))
    this.services.set('transform', serviceRegistry.get('transformService'))

    // 씬 서비스 초기화 (캔버스 필요)
    await this.services.get('scene').init(canvas)
    
    // 다른 서비스들 초기화
    await this.services.get('selection').init()
    await this.services.get('objectManagement').init()
    await this.services.get('transform').init()
  }

  /**
   * 이벤트 시스템 초기화
   */
  async initializeEventSystem() {
    console.log('📡 Initializing event system...')
    
    // 개발 환경에서 모든 이벤트 로깅
    if (process.env.NODE_ENV === 'development') {
      eventBus.on('*', (data, eventName) => {
        console.log(`[Event] ${eventName}:`, data)
      })
    }

    // 전역 에러 핸들링
    eventBus.on('error.*', (data, eventName) => {
      console.error(`[Error] ${eventName}:`, data)
    })
  }

  /**
   * 명령어 시스템 초기화
   */
  async initializeCommandSystem() {
    console.log('⚡ Initializing command system...')
    
    // 기본 명령어들 등록
    commandManager.registerCommand('scene.clear', () => {
      const sceneService = this.services.get('scene')
      const scene = sceneService.getScene()
      
      return {
        execute: () => {
          // 씬의 모든 오브젝트 제거 (라이트, 카메라 제외)
          const objectsToRemove = []
          scene.traverse((object) => {
            if (object.userData.isEditorObject) {
              objectsToRemove.push(object)
            }
          })
          
          objectsToRemove.forEach(obj => scene.remove(obj))
          eventBus.emit(EventTypes.SCENE_CLEARED)
        },
        undo: () => {
          // 실행 취소 로직
        }
      }
    })

    // 명령어 실행 이벤트를 이벤트 버스로 연결
    commandManager.on('command:executed', (event) => {
      eventBus.emit(EventTypes.COMMAND_EXECUTED, event.detail)
    })

    commandManager.on('command:undone', (event) => {
      eventBus.emit(EventTypes.COMMAND_UNDONE, event.detail)
    })

    commandManager.on('command:redone', (event) => {
      eventBus.emit(EventTypes.COMMAND_REDONE, event.detail)
    })
  }

  /**
   * 플러그인 시스템 초기화
   */
  async initializePluginSystem() {
    console.log('🔌 Initializing plugin system...')
    
    // 플러그인 시스템에 서비스 접근 컨텍스트 제공
    pluginSystem.createPluginContext = (pluginName) => {
      return {
        pluginName,
        emit: eventBus.emit.bind(eventBus),
        on: eventBus.on.bind(eventBus),
        executeHook: pluginSystem.executeHook.bind(pluginSystem),
        getPlugin: (name) => pluginSystem.plugins.get(name),
        getService: (name) => serviceRegistry.get(name),
        getConfig: (namespace, key) => configManager.get(namespace, key),
        setConfig: (namespace, key, value) => configManager.set(namespace, key, value),
        registerCommand: commandManager.registerCommand.bind(commandManager),
        executeCommand: commandManager.executeCommand.bind(commandManager)
      }
    }
  }

  /**
   * 기본 플러그인들 로드
   */
  async loadDefaultPlugins() {
    console.log('🧩 Loading default plugins...')
    
    const defaultPlugins = [
      () => registerTransformPlugin(pluginSystem),
      () => registerGridPlugin(pluginSystem),
      // 여기에 다른 기본 플러그인들 추가
    ]

    for (const loadPlugin of defaultPlugins) {
      try {
        await loadPlugin()
        console.log(`✅ Plugin loaded successfully`)
      } catch (error) {
        console.error(`❌ Failed to load plugin:`, error)
      }
    }
  }

  /**
   * 설정 로드
   */
  async loadConfiguration() {
    console.log('📖 Loading configuration...')
    
    // 로컬스토리지에서 설정 로드
    configManager.load()
    
    // 설정 변경사항을 서비스들에 적용
    this.applyConfigurationToServices()
  }

  /**
   * 설정을 서비스들에 적용
   */
  async applyConfigurationToServices() {
    // 렌더링 설정 적용
    const renderingConfig = configManager.get('editor', 'rendering')
    const sceneService = this.services.get('scene')
    const scene = sceneService.getScene()
    
    if (renderingConfig.backgroundColor && scene) {
      const THREE = await import('three')
      scene.background = new THREE.Color(renderingConfig.backgroundColor)
    }

    // 다른 설정들도 적용...
  }

  /**
   * 애플리케이션 정리
   */
  async destroy() {
    if (!this.initialized) return

    console.log('🧹 Cleaning up application...')

    try {
      // 플러그인들 정리
      for (const [name] of pluginSystem.plugins) {
        pluginSystem.unregisterPlugin(name)
      }

      // 서비스들 정리
      serviceRegistry.clear()

      // 이벤트 버스 정리
      eventBus.clear()

      // 명령어 히스토리 정리
      commandManager.clearHistory()

      this.initialized = false
      console.log('✅ Application cleaned up successfully')

    } catch (error) {
      console.error('❌ Error during cleanup:', error)
    }
  }

  /**
   * 현재 상태 정보
   */
  getStatus() {
    return {
      initialized: this.initialized,
      services: this.services.size,
      plugins: pluginSystem.plugins.size,
      commands: commandManager.getHistory(),
      events: eventBus.getEvents()
    }
  }
}

// 글로벌 애플리케이션 인스턴스
export const app = new ApplicationBootstrap()

// 개발 환경에서 전역 접근 가능하도록
if (process.env.NODE_ENV === 'development') {
  window.app = app
  window.pluginSystem = pluginSystem
  window.commandManager = commandManager
  window.serviceRegistry = serviceRegistry
  window.eventBus = eventBus
  window.configManager = configManager
}
