/**
 * 이벤트 버스 시스템 - 컴포넌트 간 느슨한 결합을 위한 중앙 이벤트 관리
 */

export const EVENT_TYPES = {
  // 씬 관련 이벤트
  SCENE_CREATED: 'scene:created',
  SCENE_LOADED: 'scene:loaded',
  SCENE_SAVED: 'scene:saved',
  SCENE_CHANGED: 'scene:changed',
  
  // 오브젝트 관련 이벤트
  OBJECT_CREATED: 'object:created',
  OBJECT_SELECTED: 'object:selected',
  OBJECT_DESELECTED: 'object:deselected',
  OBJECT_MOVED: 'object:moved',
  OBJECT_ROTATED: 'object:rotated',
  OBJECT_SCALED: 'object:scaled',
  OBJECT_DELETED: 'object:deleted',
  OBJECT_PROPERTIES_CHANGED: 'object:properties_changed',
  
  // 카메라 관련 이벤트
  CAMERA_FOCUS_REQUESTED: 'camera:focus_requested',
  CAMERA_POSITION_CHANGED: 'camera:position_changed',
  CAMERA_TARGET_CHANGED: 'camera:target_changed',
  
  // 에디터 관련 이벤트
  EDITOR_MODE_CHANGED: 'editor:mode_changed',
  EDITOR_TOOL_CHANGED: 'editor:tool_changed',
  EDITOR_CAMERA_CHANGED: 'editor:camera_changed',
  EDITOR_GRID_TOGGLED: 'editor:grid_toggled',
  
  // UI 관련 이벤트
  UI_PANEL_OPENED: 'ui:panel_opened',
  UI_PANEL_CLOSED: 'ui:panel_closed',
  UI_NOTIFICATION: 'ui:notification',
  UI_LOADING_START: 'ui:loading_start',
  UI_LOADING_END: 'ui:loading_end',
  
  // 렌더링 관련 이벤트
  RENDER_FRAME: 'render:frame',
  RENDER_QUALITY_CHANGED: 'render:quality_changed',
  RENDER_SHADOWS_TOGGLED: 'render:shadows_toggled',
  
  // 성능 관련 이벤트
  PERFORMANCE_UPDATE: 'performance:update',
  PERFORMANCE_WARNING: 'performance:warning',
  
  // 히스토리 관련 이벤트
  HISTORY_UNDO: 'history:undo',
  HISTORY_REDO: 'history:redo',
  HISTORY_CLEARED: 'history:cleared',
  
  // 에러 관련 이벤트
  ERROR_OCCURRED: 'error:occurred',
  WARNING_OCCURRED: 'warning:occurred'
};

/**
 * 이벤트 버스 클래스
 */
export class EventBus {
  constructor() {
    this.listeners = new Map();
    this.onceListeners = new Map();
    this.debugMode = false;
    this.eventHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * 이벤트 구독
   */
  subscribe(eventType, handler, context = null) {
    if (typeof handler !== 'function') {
      throw new Error('Event handler must be a function');
    }

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    const wrappedHandler = context ? handler.bind(context) : handler;
    const listenerInfo = {
      handler: wrappedHandler,
      originalHandler: handler,
      context
    };

    this.listeners.get(eventType).push(listenerInfo);

    if (this.debugMode) {
      console.log(`[EventBus] Subscribed to ${eventType}`, { handler, context });
    }

    // 구독 해제 함수 반환
    return () => this.unsubscribe(eventType, handler, context);
  }

  /**
   * 일회성 이벤트 구독
   */
  subscribeOnce(eventType, handler, context = null) {
    if (typeof handler !== 'function') {
      throw new Error('Event handler must be a function');
    }

    if (!this.onceListeners.has(eventType)) {
      this.onceListeners.set(eventType, []);
    }

    const wrappedHandler = context ? handler.bind(context) : handler;
    const listenerInfo = {
      handler: wrappedHandler,
      originalHandler: handler,
      context
    };

    this.onceListeners.get(eventType).push(listenerInfo);

    if (this.debugMode) {
      console.log(`[EventBus] Subscribed once to ${eventType}`, { handler, context });
    }

    // 구독 해제 함수 반환
    return () => this.unsubscribeOnce(eventType, handler, context);
  }

  /**
   * 이벤트 구독 해제
   */
  unsubscribe(eventType, handler, context = null) {
    const listeners = this.listeners.get(eventType);
    if (!listeners) return false;

    const index = listeners.findIndex(
      listener => listener.originalHandler === handler && listener.context === context
    );

    if (index !== -1) {
      listeners.splice(index, 1);
      
      if (listeners.length === 0) {
        this.listeners.delete(eventType);
      }

      if (this.debugMode) {
        console.log(`[EventBus] Unsubscribed from ${eventType}`, { handler, context });
      }

      return true;
    }

    return false;
  }

  /**
   * 일회성 이벤트 구독 해제
   */
  unsubscribeOnce(eventType, handler, context = null) {
    const listeners = this.onceListeners.get(eventType);
    if (!listeners) return false;

    const index = listeners.findIndex(
      listener => listener.originalHandler === handler && listener.context === context
    );

    if (index !== -1) {
      listeners.splice(index, 1);
      
      if (listeners.length === 0) {
        this.onceListeners.delete(eventType);
      }

      if (this.debugMode) {
        console.log(`[EventBus] Unsubscribed once from ${eventType}`, { handler, context });
      }

      return true;
    }

    return false;
  }

  /**
   * 이벤트 발행
   */
  publish(eventType, data = null, options = {}) {
    const timestamp = Date.now();
    const eventData = {
      type: eventType,
      data,
      timestamp,
      options
    };

    // 이벤트 히스토리 저장
    this.addToHistory(eventData);

    if (this.debugMode) {
      console.log(`[EventBus] Publishing ${eventType}`, eventData);
    }

    // 일반 리스너 호출
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(listenerInfo => {
        try {
          listenerInfo.handler(eventData);
        } catch (error) {
          console.error(`[EventBus] Error in listener for ${eventType}:`, error);
          
          // 에러 이벤트 발행 (무한 루프 방지)
          if (eventType !== EVENT_TYPES.ERROR_OCCURRED) {
            this.publish(EVENT_TYPES.ERROR_OCCURRED, {
              source: 'EventBus',
              originalEvent: eventType,
              error: error.message,
              stack: error.stack
            });
          }
        }
      });
    }

    // 일회성 리스너 호출 및 제거
    const onceListeners = this.onceListeners.get(eventType);
    if (onceListeners) {
      onceListeners.forEach(listenerInfo => {
        try {
          listenerInfo.handler(eventData);
        } catch (error) {
          console.error(`[EventBus] Error in once listener for ${eventType}:`, error);
        }
      });
      
      // 일회성 리스너 전체 제거
      this.onceListeners.delete(eventType);
    }

    return eventData;
  }

  /**
   * 모든 리스너 제거
   */
  clear() {
    this.listeners.clear();
    this.onceListeners.clear();
    this.eventHistory = [];
    
    if (this.debugMode) {
      console.log('[EventBus] All listeners cleared');
    }
  }

  /**
   * 특정 이벤트 타입의 모든 리스너 제거
   */
  clearEventType(eventType) {
    this.listeners.delete(eventType);
    this.onceListeners.delete(eventType);
    
    if (this.debugMode) {
      console.log(`[EventBus] Cleared all listeners for ${eventType}`);
    }
  }

  /**
   * 이벤트 히스토리에 추가
   */
  addToHistory(eventData) {
    this.eventHistory.push(eventData);
    
    // 히스토리 크기 제한
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * 이벤트 히스토리 조회
   */
  getHistory(eventType = null, limit = 100) {
    let history = this.eventHistory;
    
    if (eventType) {
      history = history.filter(event => event.type === eventType);
    }
    
    return history.slice(-limit);
  }

  /**
   * 디버그 모드 토글
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log(`[EventBus] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 이벤트 타입별 리스너 수 조회
   */
  getListenerCount(eventType) {
    const regularCount = this.listeners.get(eventType)?.length || 0;
    const onceCount = this.onceListeners.get(eventType)?.length || 0;
    return regularCount + onceCount;
  }

  /**
   * 모든 이벤트 타입과 리스너 수 조회
   */
  getStats() {
    const stats = {
      totalEventTypes: new Set([...this.listeners.keys(), ...this.onceListeners.keys()]).size,
      totalListeners: 0,
      eventTypes: {}
    };

    // 일반 리스너 카운트
    for (const [eventType, listeners] of this.listeners) {
      stats.eventTypes[eventType] = (stats.eventTypes[eventType] || 0) + listeners.length;
      stats.totalListeners += listeners.length;
    }

    // 일회성 리스너 카운트
    for (const [eventType, listeners] of this.onceListeners) {
      stats.eventTypes[eventType] = (stats.eventTypes[eventType] || 0) + listeners.length;
      stats.totalListeners += listeners.length;
    }

    stats.historySize = this.eventHistory.length;
    stats.debugMode = this.debugMode;

    return stats;
  }
}

// 전역 이벤트 버스 인스턴스
export const globalEventBus = new EventBus();

/**
 * React Hook for EventBus
 */
import { useEffect, useCallback, useRef } from 'react';

export function useEventBus(eventBus = globalEventBus) {
  const unsubscribeRefs = useRef([]);

  // 컴포넌트 언마운트 시 모든 구독 해제
  useEffect(() => {
    return () => {
      unsubscribeRefs.current.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      unsubscribeRefs.current = [];
    };
  }, []);

  const subscribe = useCallback((eventType, handler, context = null) => {
    const unsubscribe = eventBus.subscribe(eventType, handler, context);
    unsubscribeRefs.current.push(unsubscribe);
    return unsubscribe;
  }, [eventBus]);

  const subscribeOnce = useCallback((eventType, handler, context = null) => {
    const unsubscribe = eventBus.subscribeOnce(eventType, handler, context);
    unsubscribeRefs.current.push(unsubscribe);
    return unsubscribe;
  }, [eventBus]);

  const publish = useCallback((eventType, data, options) => {
    return eventBus.publish(eventType, data, options);
  }, [eventBus]);

  return {
    subscribe,
    subscribeOnce,
    publish,
    eventBus
  };
}

/**
 * 이벤트 데코레이터 - 클래스 메서드에 이벤트 발행 기능 추가
 */
export function publishEvent(eventType, dataExtractor = null) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args) {
      const result = originalMethod.apply(this, args);
      
      // 데이터 추출
      let eventData = null;
      if (typeof dataExtractor === 'function') {
        eventData = dataExtractor.call(this, args, result);
      } else if (typeof dataExtractor === 'string') {
        eventData = this[dataExtractor];
      }
      
      // 이벤트 발행
      if (this.eventBus) {
        this.eventBus.publish(eventType, eventData);
      } else {
        globalEventBus.publish(eventType, eventData);
      }
      
      return result;
    };
    
    return descriptor;
  };
}
