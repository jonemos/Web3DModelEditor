/**
 * EventBus 사용을 위한 React Hook
 */

import { useDI } from '../../infrastructure/react/providers/DIProvider.jsx';

export function useEventBus() {
  const { resolve } = useDI();
  
  const createFallbackEventBus = () => ({
    subscribe: () => () => {}, // 빈 unsubscribe 함수 반환
    unsubscribe: () => {},
    publish: () => {},
    subscribeOnce: () => () => {}, // once 대신 subscribeOnce 사용
    clear: () => {}
  });
  
  try {
    const eventBus = resolve('EventBus');
    
    // 더 상세한 EventBus 상태 디버깅
    console.log('EventBus resolution attempt:', {
      eventBus,
      type: typeof eventBus,
      constructor: eventBus?.constructor?.name,
      isEventBusInstance: eventBus instanceof Object,
      methods: eventBus ? Object.getOwnPropertyNames(eventBus.__proto__) : 'N/A'
    });
    
    if (!eventBus) {
      console.error('EventBus is null or undefined');
      return createFallbackEventBus();
    }
    
    // EventBus 메서드들의 존재 여부 확인 (정확한 메서드명 사용)
    const requiredMethods = ['subscribe', 'unsubscribe', 'publish', 'subscribeOnce', 'clear'];
    const missingMethods = requiredMethods.filter(method => {
      const methodExists = typeof eventBus[method] === 'function';
      console.log(`EventBus.${method}:`, {
        exists: methodExists,
        type: typeof eventBus[method],
        value: eventBus[method]
      });
      return !methodExists;
    });
    
    if (missingMethods.length > 0) {
      console.error('EventBus is missing required methods:', missingMethods);
      console.error('Available EventBus methods:', Object.getOwnPropertyNames(eventBus).filter(prop => typeof eventBus[prop] === 'function'));
      console.error('Available EventBus prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(eventBus)).filter(prop => typeof eventBus[prop] === 'function'));
      return createFallbackEventBus();
    }
    
    // EventBus 메서드들을 안전하게 바인딩하여 반환
    return {
      subscribe: (...args) => {
        try {
          return eventBus.subscribe.bind(eventBus)(...args);
        } catch (error) {
          console.error('Error in EventBus.subscribe:', error);
          return () => {}; // 빈 unsubscribe 함수
        }
      },
      unsubscribe: (...args) => {
        try {
          return eventBus.unsubscribe.bind(eventBus)(...args);
        } catch (error) {
          console.error('Error in EventBus.unsubscribe:', error);
        }
      },
      publish: (...args) => {
        try {
          return eventBus.publish.bind(eventBus)(...args);
        } catch (error) {
          console.error('Error in EventBus.publish:', error);
        }
      },
      subscribeOnce: (...args) => {
        try {
          return eventBus.subscribeOnce.bind(eventBus)(...args);
        } catch (error) {
          console.error('Error in EventBus.subscribeOnce:', error);
          return () => {}; // 빈 unsubscribe 함수
        }
      },
      clear: (...args) => {
        try {
          return eventBus.clear.bind(eventBus)(...args);
        } catch (error) {
          console.error('Error in EventBus.clear:', error);
        }
      }
    };
  } catch (error) {
    console.error('Failed to resolve EventBus:', error);
    return createFallbackEventBus();
  }
}
