/**
 * 옵저버 패턴 - 상태 변경 감지 및 반응
 */
export class Observable {
  constructor(initialValue) {
    this.value = initialValue;
    this.observers = new Set();
    this.validators = [];
    this.transformers = [];
  }

  /**
   * 옵저버 등록
   */
  subscribe(observer) {
    this.observers.add(observer);
    
    // 즉시 현재 값으로 호출
    observer(this.value);
    
    // 구독 해제 함수 반환
    return () => this.unsubscribe(observer);
  }

  /**
   * 옵저버 해제
   */
  unsubscribe(observer) {
    this.observers.delete(observer);
  }

  /**
   * 값 설정 (검증 및 변환 적용)
   */
  setValue(newValue) {
    // 검증
    for (const validator of this.validators) {
      if (!validator(newValue)) {
        throw new Error(`Validation failed for value: ${newValue}`);
      }
    }

    // 변환
    let transformedValue = newValue;
    for (const transformer of this.transformers) {
      transformedValue = transformer(transformedValue);
    }

    const oldValue = this.value;
    this.value = transformedValue;

    // 옵저버들에게 알림
    this.notifyObservers(transformedValue, oldValue);
  }

  /**
   * 값 가져오기
   */
  getValue() {
    return this.value;
  }

  /**
   * 검증자 추가
   */
  addValidator(validator) {
    this.validators.push(validator);
    return this;
  }

  /**
   * 변환자 추가
   */
  addTransformer(transformer) {
    this.transformers.push(transformer);
    return this;
  }

  /**
   * 옵저버들에게 알림
   */
  notifyObservers(newValue, oldValue) {
    this.observers.forEach(observer => {
      try {
        observer(newValue, oldValue);
      } catch (error) {
        console.error('Error in observer:', error);
      }
    });
  }

  /**
   * 파생 값 생성 (computed)
   */
  map(mapper) {
    const derived = new Observable(mapper(this.value));
    
    this.subscribe(value => {
      derived.setValue(mapper(value));
    });
    
    return derived;
  }

  /**
   * 조건부 필터링
   */
  filter(predicate) {
    const filtered = new Observable(
      predicate(this.value) ? this.value : undefined
    );
    
    this.subscribe(value => {
      if (predicate(value)) {
        filtered.setValue(value);
      }
    });
    
    return filtered;
  }

  /**
   * 디바운싱
   */
  debounce(delay) {
    const debounced = new Observable(this.value);
    let timeoutId;
    
    this.subscribe(value => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        debounced.setValue(value);
      }, delay);
    });
    
    return debounced;
  }

  dispose() {
    this.observers.clear();
    this.validators = [];
    this.transformers = [];
  }
}

/**
 * 복합 상태 관리자
 */
export class StateManager {
  constructor() {
    this.state = new Map();
    this.computedState = new Map();
    this.subscriptions = new Map();
  }

  /**
   * 상태 등록
   */
  register(key, initialValue, options = {}) {
    const observable = new Observable(initialValue);
    
    // 검증자 추가
    if (options.validators) {
      options.validators.forEach(validator => {
        observable.addValidator(validator);
      });
    }
    
    // 변환자 추가
    if (options.transformers) {
      options.transformers.forEach(transformer => {
        observable.addTransformer(transformer);
      });
    }
    
    this.state.set(key, observable);
    return observable;
  }

  /**
   * 계산된 상태 등록
   */
  computed(key, dependencies, computeFn) {
    const dependencyObservables = dependencies.map(dep => this.get(dep));
    const computedValue = computeFn(...dependencyObservables.map(obs => obs.getValue()));
    
    const computed = new Observable(computedValue);
    
    // 의존성 변경시 재계산
    dependencyObservables.forEach(observable => {
      observable.subscribe(() => {
        const newValue = computeFn(...dependencyObservables.map(obs => obs.getValue()));
        computed.setValue(newValue);
      });
    });
    
    this.computedState.set(key, computed);
    return computed;
  }

  /**
   * 상태 가져오기
   */
  get(key) {
    return this.state.get(key) || this.computedState.get(key);
  }

  /**
   * 상태 값 설정
   */
  set(key, value) {
    const observable = this.state.get(key);
    if (!observable) {
      throw new Error(`State not found: ${key}`);
    }
    observable.setValue(value);
  }

  /**
   * 상태 값 가져오기
   */
  getValue(key) {
    const observable = this.get(key);
    return observable ? observable.getValue() : undefined;
  }

  /**
   * 상태 구독
   */
  subscribe(key, observer) {
    const observable = this.get(key);
    if (!observable) {
      throw new Error(`State not found: ${key}`);
    }
    
    const unsubscribe = observable.subscribe(observer);
    
    // 구독 관리
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key).add(unsubscribe);
    
    return unsubscribe;
  }

  /**
   * 배치 업데이트
   */
  batch(updates) {
    const notifications = [];
    
    // 알림 수집
    for (const [key, value] of Object.entries(updates)) {
      const observable = this.state.get(key);
      if (observable) {
        const oldValue = observable.getValue();
        observable.value = value;
        notifications.push({ observable, newValue: value, oldValue });
      }
    }
    
    // 일괄 알림
    notifications.forEach(({ observable, newValue, oldValue }) => {
      observable.notifyObservers(newValue, oldValue);
    });
  }

  /**
   * 상태 스냅샷
   */
  getSnapshot() {
    const snapshot = {};
    for (const [key, observable] of this.state) {
      snapshot[key] = observable.getValue();
    }
    return snapshot;
  }

  /**
   * 상태 복원
   */
  restore(snapshot) {
    for (const [key, value] of Object.entries(snapshot)) {
      if (this.state.has(key)) {
        this.set(key, value);
      }
    }
  }

  /**
   * 모든 상태 정리
   */
  dispose() {
    // 모든 구독 해제
    for (const unsubscribeFns of this.subscriptions.values()) {
      unsubscribeFns.forEach(unsubscribe => unsubscribe());
    }
    
    // Observable 정리
    for (const observable of this.state.values()) {
      observable.dispose();
    }
    for (const observable of this.computedState.values()) {
      observable.dispose();
    }
    
    this.state.clear();
    this.computedState.clear();
    this.subscriptions.clear();
  }
}

/**
 * React Hook for Observable
 */
import { useState, useEffect } from 'react';

export function useObservable(observable, selector = (value) => value) {
  const [state, setState] = useState(() => selector(observable.getValue()));

  useEffect(() => {
    const unsubscribe = observable.subscribe(value => {
      setState(selector(value));
    });
    
    return unsubscribe;
  }, [observable, selector]);

  return state;
}

export function useStateManager(stateManager, key) {
  const observable = stateManager.get(key);
  return useObservable(observable);
}
