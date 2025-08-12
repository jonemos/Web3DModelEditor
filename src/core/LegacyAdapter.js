/**
 * Legacy Adapter - 기존 코드와 새 아키텍처 간의 브릿지
 * 
 * 기존의 Zustand 스토어와 새로운 서비스 시스템을 연결하여
 * 단계적 마이그레이션을 가능하게 합니다.
 */

import { app } from '../core/ApplicationBootstrap.js'
import { eventBus, EventTypes } from '../core/EventBus.js'
import { commandManager } from '../core/CommandSystem.js'
import { configManager } from '../core/ConfigManager.js'
import { registerStoreMigrationService } from './StoreMigrationService.js'
import { editorStoreInstance } from '../store/editorStore.js'

export class LegacyAdapter {
  constructor(editorStore) {
    this.editorStore = editorStore
    this.editorStoreInstance = editorStoreInstance // getState() 접근 가능한 인스턴스
    this.isNewArchitectureEnabled = false
    this.services = new Map()
    this.storeMigrationService = null
    
    this.setupEventBridge()
  }

  /**
   * 새 아키텍처 초기화 (선택적)
   */
  async enableNewArchitecture(canvas) {
    if (this.isNewArchitectureEnabled) return

    try {
      console.log('🔄 Enabling new architecture alongside legacy system...')
      
      // 새 시스템 초기화
      await app.initialize(canvas)
      
      // 서비스들 캐시
      this.services.set('scene', app.services.get('scene'))
      this.services.set('selection', app.services.get('selection'))
      this.services.set('objectManagement', app.services.get('objectManagement'))
      this.services.set('transform', app.services.get('transform'))

      // 스토어 마이그레이션 서비스 설정
      this.storeMigrationService = registerStoreMigrationService(
        app.serviceRegistry, 
        eventBus, 
        commandManager, 
        configManager
      )
      await this.storeMigrationService.init(this.editorStoreInstance)

      // 양방향 동기화 설정
      this.setupBidirectionalSync()
      
      this.isNewArchitectureEnabled = true
      console.log('✅ New architecture enabled successfully')
      
    } catch (error) {
      console.error('❌ Failed to enable new architecture:', error)
      // 실패해도 기존 시스템은 계속 동작
    }
  }

  /**
   * 이벤트 브릿지 설정 (기존 → 새 시스템)
   */
  setupEventBridge() {
    // Zustand 스토어 변경사항을 새 시스템으로 전달
    if (this.editorStore.subscribe) {
      this.editorStore.subscribe((state, prevState) => {
        if (!this.isNewArchitectureEnabled) return

        // 선택된 객체 변경 감지
        if (state.selectedObject !== prevState.selectedObject) {
          if (state.selectedObject) {
            eventBus.emit(EventTypes.OBJECT_SELECTED, {
              object: state.selectedObject
            })
          } else {
            eventBus.emit(EventTypes.OBJECT_DESELECTED, {})
          }
        }

        // 변형 모드 변경 감지
        if (state.transformMode !== prevState.transformMode) {
          eventBus.emit(EventTypes.EDITOR_MODE_CHANGED, {
            type: 'transform',
            mode: state.transformMode
          })
        }

        // 그리드 가시성 변경 감지
        if (state.isGridVisible !== prevState.isGridVisible) {
          eventBus.emit(EventTypes.GRID_TOGGLED, {
            visible: state.isGridVisible
          })
        }
      })
    }
  }

  /**
   * 양방향 동기화 설정 (새 시스템 → 기존)
   */
  setupBidirectionalSync() {
    // 새 시스템의 이벤트를 기존 시스템으로 전달
    eventBus.on(EventTypes.OBJECT_SELECTED, (event) => {
      const { object } = event.detail
      if (this.editorStore.setSelectedObject) {
        this.editorStore.setSelectedObject(object)
      }
    })

    eventBus.on(EventTypes.OBJECT_DESELECTED, () => {
      if (this.editorStore.setSelectedObject) {
        this.editorStore.setSelectedObject(null)
      }
    })

    eventBus.on(EventTypes.EDITOR_MODE_CHANGED, (event) => {
      const { mode } = event.detail
      if (this.editorStore.setTransformMode) {
        this.editorStore.setTransformMode(mode)
      }
    })

    // 명령어 실행을 기존 시스템과 연동
    eventBus.on(EventTypes.COMMAND_EXECUTED, (event) => {
      const { command } = event.detail
      console.log(`[Legacy Adapter] Command executed: ${command.name}`)
    })
  }

  /**
   * 명령어 실행 (기존 방식과 새 방식 모두 지원)
   */
  async executeCommand(commandName, params = {}) {
    if (this.isNewArchitectureEnabled) {
      // 새 시스템 사용
      try {
        return await commandManager.executeCommand(commandName, params)
      } catch (error) {
        console.warn(`New system command failed, falling back to legacy: ${error.message}`)
      }
    }

    // 기존 시스템 폴백
    return this.executeLegacyCommand(commandName, params)
  }

  /**
   * 기존 방식 명령어 실행
   */
  executeLegacyCommand(commandName, params) {
    const store = this.editorStore

    switch (commandName) {
      case 'object.add':
        if (store.addObject) {
          return store.addObject(params.object, params.position)
        }
        break

      case 'object.delete':
        if (store.removeObject) {
          return store.removeObject(params.objectId)
        }
        break

      case 'transform.mode':
        if (store.setTransformMode) {
          return store.setTransformMode(params.mode)
        }
        break

      case 'scene.clear':
        if (store.clearMap) {
          return store.clearMap()
        }
        break

      default:
        console.warn(`Unknown legacy command: ${commandName}`)
        return false
    }
  }

  /**
   * 서비스 접근 (새 시스템이 활성화된 경우)
   */
  getService(serviceName) {
    if (!this.isNewArchitectureEnabled) {
      console.warn('New architecture not enabled, service not available')
      return null
    }

    return this.services.get(serviceName)
  }

  /**
   * 설정 관리 (하이브리드 방식)
   */
  getConfig(namespace, key) {
    if (this.isNewArchitectureEnabled) {
      return configManager.get(namespace, key)
    }

    // 기존 방식: localStorage 직접 접근
    const storageKey = `${namespace}_${key}`
    const stored = localStorage.getItem(storageKey)
    return stored ? JSON.parse(stored) : null
  }

  setConfig(namespace, key, value) {
    if (this.isNewArchitectureEnabled) {
      return configManager.set(namespace, key, value)
    }

    // 기존 방식: localStorage 직접 저장
    const storageKey = `${namespace}_${key}`
    localStorage.setItem(storageKey, JSON.stringify(value))
  }

  /**
   * 플러그인 시스템 접근
   */
  getPlugin(pluginName) {
    if (!this.isNewArchitectureEnabled) {
      console.warn('New architecture not enabled, plugins not available')
      return null
    }

    return app.pluginSystem?.plugins.get(pluginName)
  }

  /**
   * 이벤트 발생 (하이브리드 방식)
   */
  emit(eventName, data) {
    if (this.isNewArchitectureEnabled) {
      eventBus.emit(eventName, data)
    }

    // 기존 방식도 지원 (필요한 경우)
    if (this.editorStore.emit) {
      this.editorStore.emit(eventName, data)
    }
  }

  /**
   * 마이그레이션 상태 확인
   */
  getMigrationStatus() {
    const baseStatus = {
      newArchitectureEnabled: this.isNewArchitectureEnabled,
      availableServices: Array.from(this.services.keys()),
      pluginCount: this.isNewArchitectureEnabled ? app.pluginSystem?.plugins.size : 0,
      commandHistory: this.isNewArchitectureEnabled ? commandManager.getHistory() : null
    }

    if (this.storeMigrationService) {
      return {
        ...baseStatus,
        storeMigration: this.storeMigrationService.getMigrationStatus()
      }
    }

    return baseStatus
  }

  /**
   * 점진적 마이그레이션 기능들
   */
  
  // 선택된 객체 기능을 새 시스템으로 마이그레이션
  migrateSelectedObject() {
    if (!this.storeMigrationService) return false
    return this.storeMigrationService.migrateFeature('selectedObject')
  }

  // 변형 모드를 새 시스템으로 마이그레이션
  migrateTransformMode() {
    if (!this.storeMigrationService) return false
    return this.storeMigrationService.migrateFeature('transformMode')
  }

  // 그리드 가시성을 새 시스템으로 마이그레이션
  migrateGridVisible() {
    if (!this.storeMigrationService) return false
    return this.storeMigrationService.migrateFeature('gridVisible')
  }

  // 모든 기능을 새 시스템으로 마이그레이션
  migrateAll() {
    if (!this.storeMigrationService) return false
    return this.storeMigrationService.migrateAll()
  }

  // 특정 기능을 기존 시스템으로 롤백
  rollbackFeature(featureName) {
    if (!this.storeMigrationService) return false
    return this.storeMigrationService.rollbackFeature(featureName)
  }

  // 모든 기능을 기존 시스템으로 롤백
  rollbackAll() {
    if (!this.storeMigrationService) return false
    return this.storeMigrationService.rollbackAll()
  }

  /**
   * 정리
   */
  destroy() {
    if (this.storeMigrationService) {
      this.storeMigrationService.destroy()
      this.storeMigrationService = null
    }
    
    if (this.isNewArchitectureEnabled) {
      app.destroy()
    }
    
    this.services.clear()
    this.isNewArchitectureEnabled = false
  }
}

// 글로벌 어댑터 인스턴스 (필요시 사용)
let globalAdapter = null

export function createLegacyAdapter(editorStore) {
  globalAdapter = new LegacyAdapter(editorStore)
  return globalAdapter
}

export function getLegacyAdapter() {
  return globalAdapter
}
