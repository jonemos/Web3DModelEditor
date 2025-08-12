/**
 * Event Bus - 중앙 이벤트 관리 시스템
 * 
 * 컴포넌트 간 느슨한 결합을 위한 이벤트 기반 통신
 */

export class EventBus {
  constructor() {
    this.events = new Map()
    this.wildcardEvents = new Map()
    this.middlewares = []
    this.debug = false
  }

  /**
   * 이벤트 리스너 등록
   */
  on(event, callback, options = {}) {
    const { once = false, priority = 0 } = options

    if (event.includes('*')) {
      this.addWildcardListener(event, callback, { once, priority })
    } else {
      this.addEventListener(event, callback, { once, priority })
    }

    return () => this.off(event, callback)
  }

  /**
   * 일회성 이벤트 리스너
   */
  once(event, callback, options = {}) {
    return this.on(event, callback, { ...options, once: true })
  }

  /**
   * 이벤트 리스너 제거
   */
  off(event, callback) {
    if (event.includes('*')) {
      this.removeWildcardListener(event, callback)
    } else {
      this.removeEventListener(event, callback)
    }
  }

  /**
   * 이벤트 발생
   */
  emit(event, data = {}, options = {}) {
    const { sync = false, bubbles = true } = options

    if (this.debug) {
      console.log(`[EventBus] Emitting: ${event}`, data)
    }

    // 미들웨어 실행
    const eventData = this.runMiddlewares(event, data)
    if (eventData === false) return false // 미들웨어에서 중단

    if (sync) {
      return this.emitSync(event, eventData, bubbles)
    } else {
      return this.emitAsync(event, eventData, bubbles)
    }
  }

  /**
   * 동기 이벤트 발생
   */
  emitSync(event, data, bubbles) {
    const results = []

    // 정확한 이벤트 매치
    const listeners = this.events.get(event)
    if (listeners) {
      results.push(...this.executeListeners(listeners, event, data))
    }

    // 와일드카드 매치
    if (bubbles) {
      for (const [pattern, listeners] of this.wildcardEvents) {
        if (this.matchWildcard(pattern, event)) {
          results.push(...this.executeListeners(listeners, event, data))
        }
      }
    }

    return results
  }

  /**
   * 비동기 이벤트 발생
   */
  async emitAsync(event, data, bubbles) {
    const promises = []

    // 정확한 이벤트 매치
    const listeners = this.events.get(event)
    if (listeners) {
      promises.push(...this.executeListenersAsync(listeners, event, data))
    }

    // 와일드카드 매치
    if (bubbles) {
      for (const [pattern, listeners] of this.wildcardEvents) {
        if (this.matchWildcard(pattern, event)) {
          promises.push(...this.executeListenersAsync(listeners, event, data))
        }
      }
    }

    return Promise.allSettled(promises)
  }

  /**
   * 리스너들 실행 (동기)
   */
  executeListeners(listeners, event, data) {
    const results = []
    const toRemove = []

    // 우선순위 순으로 정렬
    const sortedListeners = [...listeners].sort((a, b) => b.priority - a.priority)

    for (const listener of sortedListeners) {
      try {
        // DOM 이벤트 스타일 객체 생성
        const eventObject = {
          type: event,
          detail: data,
          target: this,
          preventDefault: () => {},
          stopPropagation: () => {}
        }
        
        const result = listener.callback(eventObject, event)
        results.push(result)

        // 일회성 리스너 제거 표시
        if (listener.once) {
          toRemove.push(listener)
        }
      } catch (error) {
        console.error(`[EventBus] Error in listener for ${event}:`, error)
      }
    }

    // 일회성 리스너들 제거
    toRemove.forEach(listener => {
      const index = listeners.indexOf(listener)
      if (index > -1) listeners.splice(index, 1)
    })

    return results
  }

  /**
   * 리스너들 실행 (비동기)
   */
  executeListenersAsync(listeners, event, data) {
    const promises = []
    const toRemove = []

    // 우선순위 순으로 정렬
    const sortedListeners = [...listeners].sort((a, b) => b.priority - a.priority)

    for (const listener of sortedListeners) {
      const promise = Promise.resolve().then(() => {
        // DOM 이벤트 스타일 객체 생성
        const eventObject = {
          type: event,
          detail: data,
          target: this,
          preventDefault: () => {},
          stopPropagation: () => {}
        }
        
        const result = listener.callback(eventObject, event)

        // 일회성 리스너 제거 표시
        if (listener.once) {
          toRemove.push(listener)
        }

        return result
      }).catch(error => {
        console.error(`[EventBus] Error in async listener for ${event}:`, {
          error,
          listener: listener.name || listener.callback.name || 'anonymous',
          eventDetail: eventObject.detail,
          stack: error.stack
        })
        throw error
      })

      promises.push(promise)
    }

    // 일회성 리스너들 제거 (비동기로)
    Promise.resolve().then(() => {
      toRemove.forEach(listener => {
        const index = listeners.indexOf(listener)
        if (index > -1) listeners.splice(index, 1)
      })
    })

    return promises
  }

  /**
   * 이벤트 리스너 추가
   */
  addEventListener(event, callback, options) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }

    this.events.get(event).push({
      callback,
      ...options
    })
  }

  /**
   * 와일드카드 리스너 추가
   */
  addWildcardListener(pattern, callback, options) {
    if (!this.wildcardEvents.has(pattern)) {
      this.wildcardEvents.set(pattern, [])
    }

    this.wildcardEvents.get(pattern).push({
      callback,
      ...options
    })
  }

  /**
   * 이벤트 리스너 제거
   */
  removeEventListener(event, callback) {
    const listeners = this.events.get(event)
    if (!listeners) return

    const index = listeners.findIndex(l => l.callback === callback)
    if (index > -1) {
      listeners.splice(index, 1)
    }

    if (listeners.length === 0) {
      this.events.delete(event)
    }
  }

  /**
   * 와일드카드 리스너 제거
   */
  removeWildcardListener(pattern, callback) {
    const listeners = this.wildcardEvents.get(pattern)
    if (!listeners) return

    const index = listeners.findIndex(l => l.callback === callback)
    if (index > -1) {
      listeners.splice(index, 1)
    }

    if (listeners.length === 0) {
      this.wildcardEvents.delete(pattern)
    }
  }

  /**
   * 와일드카드 매칭
   */
  matchWildcard(pattern, event) {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(event)
  }

  /**
   * 미들웨어 추가
   */
  use(middleware) {
    this.middlewares.push(middleware)
  }

  /**
   * 미들웨어 실행
   */
  runMiddlewares(event, data) {
    let currentData = data

    for (const middleware of this.middlewares) {
      try {
        const result = middleware(event, currentData)
        if (result === false) return false // 중단
        if (result !== undefined) currentData = result
      } catch (error) {
        console.error('[EventBus] Middleware error:', error)
      }
    }

    return currentData
  }

  /**
   * 모든 리스너 제거
   */
  clear() {
    this.events.clear()
    this.wildcardEvents.clear()
  }

  /**
   * 디버그 모드 토글
   */
  setDebug(enabled) {
    this.debug = enabled
  }

  /**
   * 현재 등록된 이벤트들
   */
  getEvents() {
    return {
      events: Array.from(this.events.keys()),
      wildcardEvents: Array.from(this.wildcardEvents.keys())
    }
  }
}

// 미리 정의된 이벤트 타입들
export const EventTypes = {
  // 앱 관련
  APP_INITIALIZED: 'app.initialized',

  // 객체 관련
  OBJECT_ADDED: 'object.added',
  OBJECT_REMOVED: 'object.removed',
  OBJECT_SELECTED: 'object.selected',
  OBJECT_DESELECTED: 'object.deselected',
  OBJECT_TRANSFORMED: 'object.transformed',
  OBJECT_ROTATED: 'object.rotated',
  OBJECT_ROTATION_RESET: 'object.rotation.reset',
  OBJECT_MOVED: 'object.moved',
  OBJECT_SCALED: 'object.scaled',

  // 변형 관련
  TRANSFORM_MODE_CHANGED: 'transform.mode.changed',
  TRANSFORM_SPACE_CHANGED: 'transform.space.changed',
  TRANSFORM_CHANGED: 'transform.changed',
  TRANSFORM_DRAGGING_CHANGED: 'transform.dragging.changed',
  TRANSFORM_MANAGER_READY: 'transform.manager.ready',
  TRANSFORM_STATE_CHANGED: 'transform.state.changed',

  // 그리드 관련
  GRID_VISIBILITY_CHANGED: 'grid.visibility.changed',
  GRID_SNAP_CHANGED: 'grid.snap.changed',
  GRID_SIZE_CHANGED: 'grid.size.changed',
  GRID_DIVISIONS_CHANGED: 'grid.divisions.changed',
  GRID_SNAP_SIZE_CHANGED: 'grid.snap.size.changed',
  GRID_CREATED: 'grid.created',
  GRID_REMOVED: 'grid.removed',
  GRID_STATE_CHANGED: 'grid.state.changed',
  GRID_MANAGER_READY: 'grid.manager.ready',
  GRID_TOGGLED: 'editor.grid.toggled',

  // 자석 관련
  MAGNET_CHANGED: 'magnet.changed',
  MAGNET_RAYS_CHANGED: 'magnet.rays.changed',

  // 카메라 관련
  CAMERA_CHANGED: 'camera.changed',
  CAMERA_FOCUSED: 'camera.focused',
  CAMERA_RESET: 'camera.reset',
  CAMERA_RESET_REQUESTED: 'camera.reset.requested',
  CAMERA_PROJECTION_TOGGLE_REQUESTED: 'camera.projection.toggle.requested',
  CAMERA_PROJECTION_CHANGED: 'camera.projection.changed',
  CAMERA_TARGET_CHANGED: 'camera.target.changed',
  CAMERA_TARGET_UPDATED: 'camera.target.updated',
  CAMERA_POSITION_CHANGED: 'camera.position.changed',
  CAMERA_POSITION_UPDATED: 'camera.position.updated',
  CAMERA_STATE_CHANGED: 'camera.state.changed',
  CAMERA_STATE_RESTORED: 'camera.state.restored',
  CAMERA_CONTROLS_CHANGED: 'camera.controls.changed',
  CAMERA_RESIZED: 'camera.resized',

  // 마우스 관련
  MOUSE_DOWN: 'mouse.down',
  MOUSE_UP: 'mouse.up',
  MOUSE_MOVE: 'mouse.move',

  // 씬 관련
  SCENE_LOADED: 'scene.loaded',
  SCENE_SAVED: 'scene.saved',
  SCENE_CLEARED: 'scene.cleared',

  // 에디터 관련
  EDITOR_MODE_CHANGED: 'editor.mode.changed',
  VIEWPORT_CHANGED: 'editor.viewport.changed',
  VIEWPORT_RESIZED: 'editor.viewport.resized',
  GRID_TOGGLED: 'editor.grid.toggled',

  // 키보드 관련
  KEYBOARD_INPUT: 'keyboard.input',

  // 명령어 관련
  COMMAND_EXECUTED: 'command.executed',
  COMMAND_UNDONE: 'command.undone',
  COMMAND_REDONE: 'command.redone',

  // 플러그인 관련
  PLUGIN_LOADED: 'plugin.loaded',
  PLUGIN_UNLOADED: 'plugin.unloaded',

  // UI 관련
  PANEL_OPENED: 'ui.panel.opened',
  PANEL_CLOSED: 'ui.panel.closed',
  DIALOG_OPENED: 'ui.dialog.opened',
  DIALOG_CLOSED: 'ui.dialog.closed',
  MENU_REGISTERED: 'ui.menu.registered',
  MENU_UNREGISTERED: 'ui.menu.unregistered',

  // 파일 I/O 관련
  FILE_LOAD_START: 'file.load.start',
  FILE_LOAD_PROGRESS: 'file.load.progress',
  FILE_LOAD_COMPLETE: 'file.load.complete',
  FILE_LOAD_ERROR: 'file.load.error',
  FILE_LOAD_UNDONE: 'file.load.undone',
  FILE_SAVE_START: 'file.save.start',
  FILE_SAVE_PROGRESS: 'file.save.progress',
  FILE_SAVE_COMPLETE: 'file.save.complete',
  FILE_SAVE_ERROR: 'file.save.error',
  FILE_DROP: 'file.drop',
  FILE_THUMBNAIL_GENERATED: 'file.thumbnail.generated',
  FILE_THUMBNAIL_ERROR: 'file.thumbnail.error',
  FILE_STATUS_REQUEST: 'file.status.request',
  FILE_STATUS_RESPONSE: 'file.status.response',

  // 라이브러리 관련
  LIBRARY_REQUEST_MESHES: 'library.request.meshes',
  LIBRARY_MESHES_LOADED: 'library.meshes.loaded',
  LIBRARY_MESHES_LOAD_ERROR: 'library.meshes.load.error',
  LIBRARY_MESH_LOADED: 'library.mesh.loaded',
  LIBRARY_MESH_LOAD_ERROR: 'library.mesh.load.error',
  LIBRARY_MESH_UNLOADED: 'library.mesh.unloaded',
  LIBRARY_REFRESH_START: 'library.refresh.start',
  LIBRARY_REFRESH_COMPLETE: 'library.refresh.complete',
  LIBRARY_REFRESH_ERROR: 'library.refresh.error',

  // 커스텀 메쉬 관련
  CUSTOM_MESH_SAVED: 'custom.mesh.saved',
  CUSTOM_MESH_SAVE_ERROR: 'custom.mesh.save.error',
  CUSTOM_MESH_LOADED: 'custom.mesh.loaded',
  CUSTOM_MESH_LOAD_ERROR: 'custom.mesh.load.error',
  CUSTOM_MESH_UNLOADED: 'custom.mesh.unloaded',
  CUSTOM_MESH_DELETED: 'custom.mesh.deleted',
  CUSTOM_MESH_DELETE_ERROR: 'custom.mesh.delete.error',
  CUSTOM_MESH_RESTORED: 'custom.mesh.restored'
}

// 글로벌 이벤트 버스
export const eventBus = new EventBus()

// 개발 환경에서 디버그 모드 활성화
if (process.env.NODE_ENV === 'development') {
  eventBus.setDebug(true)
  
  // 전역에서 접근 가능하도록 (디버깅용)
  window.eventBus = eventBus
}
