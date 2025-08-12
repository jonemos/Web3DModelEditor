/**
 * Store Migration Service - Zustand 스토어를 새 서비스로 점진적 마이그레이션
 * 
 * 기존 스토어 기능을 새로운 서비스 시스템으로 단계적으로 이전하면서
 * 호환성을 유지합니다.
 */

import { BaseService } from '../core/ServiceRegistry.js'
import { EventTypes } from '../core/EventBus.js'

export class StoreMigrationService extends BaseService {
  constructor(eventBus, commandManager, configManager) {
    super()
    this.eventBus = eventBus
    this.commandManager = commandManager
    this.configManager = configManager
    
    // 마이그레이션된 스토어 상태
    this.migratedState = {
      selectedObject: null,
      transformMode: 'translate',
      isGridVisible: true,
      objects: [],
      walls: []
    }
    
    // 원본 스토어 참조
    this.originalStore = null
    
    // 마이그레이션 진행 상태
    this.migrationProgress = {
      selectedObject: false,
      transformMode: false,
      gridVisible: false,
      objects: false,
      walls: false
    }
  }

  /**
   * 서비스 초기화
   */
  async init(originalStore) {
    if (this.initialized) return

    this.originalStore = originalStore
    
    // 기존 스토어에서 초기 상태 복사
    this.syncFromOriginalStore()
    
    // 이벤트 리스너 설정
    this.setupEventListeners()
    
    await super.init()
    console.log('Store Migration Service initialized')
  }

  /**
   * 기존 스토어에서 상태 동기화
   */
  syncFromOriginalStore() {
    if (!this.originalStore) return

    try {
      const state = this.originalStore.getState()
      this.migratedState = {
        selectedObject: state.selectedObject,
        transformMode: state.transformMode,
        isGridVisible: state.isGridVisible,
        objects: [...(state.objects || [])],
        walls: [...(state.walls || [])]
      }
      
      console.log('✅ Store state synced:', this.migratedState)
    } catch (error) {
      console.error('❌ Failed to sync from original store:', error)
      // 기본값으로 초기화
      this.migratedState = {
        selectedObject: null,
        transformMode: 'translate',
        isGridVisible: true,
        objects: [],
        walls: []
      }
    }
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 새 시스템의 이벤트를 기존 스토어에 반영
    this.eventBus.on(EventTypes.OBJECT_SELECTED, (event) => {
      if (!this.migrationProgress.selectedObject) return
      
      const eventDetail = event.detail || {}
      const { object } = eventDetail
      
      if (object) {
        this.migratedState.selectedObject = object
        
        // 기존 스토어와 동기화
        if (this.originalStore && this.originalStore.getState().setSelectedObject) {
          this.originalStore.getState().setSelectedObject(object)
        }
      }
    })

    this.eventBus.on(EventTypes.TRANSFORM_MODE_CHANGED, (event) => {
      if (!this.migrationProgress.transformMode) return
      
      const eventDetail = event.detail || {}
      const { mode } = eventDetail
      
      if (mode) {
        this.migratedState.transformMode = mode
        
        // 기존 스토어와 동기화
        if (this.originalStore && this.originalStore.getState().setTransformMode) {
          this.originalStore.getState().setTransformMode(mode)
        }
      }
    })

    this.eventBus.on(EventTypes.GRID_TOGGLED, (event) => {
      if (!this.migrationProgress.gridVisible) return
      
      const eventDetail = event.detail || {}
      const { visible } = eventDetail
      
      if (typeof visible === 'boolean') {
        this.migratedState.isGridVisible = visible
        
        // 기존 스토어와 동기화
        if (this.originalStore && this.originalStore.getState().toggleGridVisible) {
          // 현재 상태와 다른 경우에만 토글
          const currentState = this.originalStore.getState().isGridVisible
          if (currentState !== visible) {
            this.originalStore.getState().toggleGridVisible()
          }
        }
      }
    })
  }

  /**
   * 특정 기능을 새 시스템으로 마이그레이션
   */
  migrateFeature(featureName) {
    if (this.migrationProgress[featureName]) {
      console.warn(`Feature ${featureName} already migrated`)
      return false
    }

    switch (featureName) {
      case 'selectedObject':
        return this.migrateSelectedObject()
      
      case 'transformMode':
        return this.migrateTransformMode()
        
      case 'gridVisible':
        return this.migrateGridVisible()
        
      case 'objects':
        return this.migrateObjects()
        
      case 'walls':
        return this.migrateWalls()
        
      default:
        console.error(`Unknown feature: ${featureName}`)
        return false
    }
  }

  /**
   * 선택된 객체 기능 마이그레이션
   */
  migrateSelectedObject() {
    console.log('🔄 Migrating selectedObject to new system...')
    
    // 현재 상태를 새 시스템으로 이전
    if (this.migratedState.selectedObject) {
      this.eventBus.emit(EventTypes.OBJECT_SELECTED, {
        object: this.migratedState.selectedObject
      })
    }

    this.migrationProgress.selectedObject = true
    console.log('✅ selectedObject migrated')
    return true
  }

  /**
   * 변형 모드 기능 마이그레이션
   */
  migrateTransformMode() {
    console.log('🔄 Migrating transformMode to new system...')
    
    // 현재 상태를 새 시스템으로 이전
    this.eventBus.emit(EventTypes.TRANSFORM_MODE_CHANGED, {
      mode: this.migratedState.transformMode,
      previousMode: null
    })

    this.migrationProgress.transformMode = true
    console.log('✅ transformMode migrated')
    return true
  }

  /**
   * 그리드 가시성 기능 마이그레이션
   */
  migrateGridVisible() {
    console.log('🔄 Migrating gridVisible to new system...')
    
    // 현재 상태를 새 시스템으로 이전
    this.eventBus.emit(EventTypes.GRID_TOGGLED, {
      visible: this.migratedState.isGridVisible
    })

    this.migrationProgress.gridVisible = true
    console.log('✅ gridVisible migrated')
    return true
  }

  /**
   * 객체 관리 기능 마이그레이션
   */
  migrateObjects() {
    console.log('🔄 Migrating objects management to new system...')
    
    // 기존 객체들을 새 시스템으로 이전
    for (const object of this.migratedState.objects) {
      this.eventBus.emit(EventTypes.OBJECT_ADDED, {
        object: object
      })
    }

    this.migrationProgress.objects = true
    console.log('✅ objects management migrated')
    return true
  }

  /**
   * 벽 관리 기능 마이그레이션
   */
  migrateWalls() {
    console.log('🔄 Migrating walls management to new system...')
    
    // 기존 벽들을 새 시스템으로 이전
    for (const wall of this.migratedState.walls) {
      this.eventBus.emit(EventTypes.OBJECT_ADDED, {
        object: wall,
        type: 'wall'
      })
    }

    this.migrationProgress.walls = true
    console.log('✅ walls management migrated')
    return true
  }

  /**
   * 모든 기능을 한번에 마이그레이션
   */
  migrateAll() {
    console.log('🚀 Starting full migration...')
    
    const features = Object.keys(this.migrationProgress)
    let successCount = 0
    
    for (const feature of features) {
      if (this.migrateFeature(feature)) {
        successCount++
      }
    }
    
    console.log(`✅ Migration completed: ${successCount}/${features.length} features migrated`)
    
    // 마이그레이션 완료 이벤트
    this.eventBus.emit('migration:completed', {
      totalFeatures: features.length,
      migratedFeatures: successCount,
      progress: this.migrationProgress
    })
    
    return successCount === features.length
  }

  /**
   * 특정 기능을 기존 시스템으로 롤백
   */
  rollbackFeature(featureName) {
    if (!this.migrationProgress[featureName]) {
      console.warn(`Feature ${featureName} not migrated`)
      return false
    }

    this.migrationProgress[featureName] = false
    console.log(`🔙 Rolled back ${featureName} to legacy system`)
    
    // 기존 스토어와 다시 동기화
    this.syncFromOriginalStore()
    
    return true
  }

  /**
   * 모든 기능을 기존 시스템으로 롤백
   */
  rollbackAll() {
    console.log('🔙 Rolling back all features to legacy system...')
    
    const features = Object.keys(this.migrationProgress)
    for (const feature of features) {
      this.migrationProgress[feature] = false
    }
    
    // 기존 스토어와 다시 동기화
    this.syncFromOriginalStore()
    
    console.log('✅ All features rolled back to legacy system')
  }

  /**
   * 마이그레이션 상태 조회
   */
  getMigrationStatus() {
    const totalFeatures = Object.keys(this.migrationProgress).length
    const migratedFeatures = Object.values(this.migrationProgress).filter(Boolean).length
    
    return {
      progress: this.migrationProgress,
      totalFeatures,
      migratedFeatures,
      percentage: Math.round((migratedFeatures / totalFeatures) * 100),
      isComplete: migratedFeatures === totalFeatures
    }
  }

  /**
   * 새 시스템 상태 조회
   */
  getNewSystemState() {
    return { ...this.migratedState }
  }

  /**
   * 기존 스토어 상태 조회
   */
  getLegacySystemState() {
    return this.originalStore ? this.originalStore.getState() : null
  }

  /**
   * 하이브리드 상태 조회 (마이그레이션 진행 상태에 따라)
   */
  getHybridState() {
    const legacyState = this.getLegacySystemState()
    const newState = this.getNewSystemState()
    const hybridState = {}

    for (const [key, isMigrated] of Object.entries(this.migrationProgress)) {
      if (isMigrated) {
        hybridState[key] = newState[key]
      } else {
        hybridState[key] = legacyState ? legacyState[key] : newState[key]
      }
    }

    return hybridState
  }

  /**
   * 서비스 정리
   */
  destroy() {
    this.rollbackAll()
    this.originalStore = null
    super.destroy()
  }
}

// 스토어 마이그레이션 서비스 등록 헬퍼
export function registerStoreMigrationService(serviceRegistry, eventBus, commandManager, configManager) {
  const service = new StoreMigrationService(eventBus, commandManager, configManager)
  serviceRegistry.registerInstance('storeMigrationService', service)
  return service
}
