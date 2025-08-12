/**
 * Command System - 모든 액션을 명령어로 관리
 * 
 * 장점:
 * - Undo/Redo 구현 용이
 * - 액션 로깅 및 디버깅
 * - 매크로 기능
 * - 네트워크 동기화
 */
import * as THREE from 'three';

export class Command {
  constructor(name, execute, undo = null, data = {}) {
    this.name = name
    this.execute = execute
    this.undo = undo
    this.data = data
    this.timestamp = Date.now()
    this.id = this.generateId()
  }

  generateId() {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  canUndo() {
    return typeof this.undo === 'function'
  }
}

export class CommandManager {
  constructor(maxHistorySize = 100) {
    this.history = []
    this.currentIndex = -1
    this.maxHistorySize = maxHistorySize
    this.eventBus = new EventTarget()
    this.commands = new Map() // 등록된 명령어들
  }

  /**
   * 명령어 등록
   */
  registerCommand(name, factory) {
    this.commands.set(name, factory)
  }

  /**
   * 명령어 실행
   */
  async executeCommand(name, params = {}) {
    const factory = this.commands.get(name)
    if (!factory) {
      throw new Error(`Unknown command: ${name}`)
    }

    const command = factory(params)
    return this.execute(command)
  }

  /**
   * 명령어 직접 실행 (문자열 명령어와 명령 객체 모두 지원)
   */
  async execute(commandOrName, params = {}) {
    let command

    if (typeof commandOrName === 'string') {
      // 문자열 명령어인 경우 executeCommand로 위임
      return this.executeCommand(commandOrName, params)
    } else {
      // 명령 객체인 경우
      command = commandOrName
    }

    try {
      // 명령어 실행
      const result = await command.execute()

      // 실행 가능한 명령어만 히스토리에 추가
      if (command.canUndo()) {
        this.addToHistory(command)
      }

      // 이벤트 발생
      this.emit('command:executed', { command, result })

      return result
    } catch (error) {
      this.emit('command:failed', { command, error })
      throw error
    }
  }

  /**
   * 실행 취소
   */
  async undo() {
    if (!this.canUndo()) return false

    const command = this.history[this.currentIndex]
    
    try {
      await command.undo()
      this.currentIndex--
      this.emit('command:undone', { command })
      return true
    } catch (error) {
      this.emit('command:undo_failed', { command, error })
      throw error
    }
  }

  /**
   * 다시 실행
   */
  async redo() {
    if (!this.canRedo()) return false

    this.currentIndex++
    const command = this.history[this.currentIndex]
    
    try {
      await command.execute()
      this.emit('command:redone', { command })
      return true
    } catch (error) {
      this.currentIndex--
      this.emit('command:redo_failed', { command, error })
      throw error
    }
  }

  /**
   * 히스토리에 추가
   */
  addToHistory(command) {
    // 현재 인덱스 이후의 히스토리 제거 (새로운 명령어가 실행된 경우)
    this.history = this.history.slice(0, this.currentIndex + 1)
    
    // 새 명령어 추가
    this.history.push(command)
    this.currentIndex++

    // 히스토리 크기 제한
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
      this.currentIndex--
    }
  }

  /**
   * 상태 확인
   */
  canUndo() {
    return this.currentIndex >= 0
  }

  canRedo() {
    return this.currentIndex < this.history.length - 1
  }

  /**
   * 히스토리 정보
   */
  getHistory() {
    return {
      history: this.history.map(cmd => ({
        id: cmd.id,
        name: cmd.name,
        timestamp: cmd.timestamp
      })),
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    }
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
   * 히스토리 클리어
   */
  clearHistory() {
    this.history = []
    this.currentIndex = -1
    this.emit('history:cleared')
  }
}

// 기본 명령어 팩토리들
export const createTransformCommand = (object, newTransform, oldTransform) => {
  return new Command(
    'transform',
    () => {
      object.position.copy(newTransform.position)
      object.rotation.copy(newTransform.rotation)
      object.scale.copy(newTransform.scale)
    },
    () => {
      object.position.copy(oldTransform.position)
      object.rotation.copy(oldTransform.rotation)
      object.scale.copy(oldTransform.scale)
    },
    { object, newTransform, oldTransform }
  )
}

// 객체 선택 명령
export const createSelectObjectCommand = (objectSelector, object, addToSelection = false) => {
  const previousSelection = objectSelector.getSelectedObjects();
  
  return new Command(
    'selectObject',
    () => {
      if (addToSelection) {
        objectSelector.toggleObjectSelection(object);
      } else {
        objectSelector.selectObjects([object]);
      }
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.OBJECT_SELECTED, { object });
      });
    },
    () => {
      objectSelector.selectObjects(previousSelection);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        if (previousSelection.length > 0) {
          eventBus.emit(EventTypes.OBJECT_SELECTED, { object: previousSelection[previousSelection.length - 1] });
        } else {
          eventBus.emit(EventTypes.OBJECT_DESELECTED, {});
        }
      });
    },
    { object, previousSelection, addToSelection }
  )
}

// 모든 선택 해제 명령
export const createDeselectAllCommand = (objectSelector) => {
  const previousSelection = objectSelector.getSelectedObjects();
  
  return new Command(
    'deselectAll',
    () => {
      objectSelector.clearSelection();
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.OBJECT_DESELECTED, {});
      });
    },
    () => {
      objectSelector.selectObjects(previousSelection);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        if (previousSelection.length > 0) {
          eventBus.emit(EventTypes.OBJECT_SELECTED, { object: previousSelection[previousSelection.length - 1] });
        }
      });
    },
    { previousSelection }
  )
}

// 변형 모드 설정 명령
export const createSetTransformModeCommand = (transformManager, mode) => {
  const previousMode = transformManager.getMode();
  
  return new Command(
    'setTransformMode',
    () => {
      transformManager.setMode(mode);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.TRANSFORM_MODE_CHANGED, { mode });
      });
    },
    () => {
      transformManager.setMode(previousMode);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.TRANSFORM_MODE_CHANGED, { mode: previousMode });
      });
    },
    { mode, previousMode }
  )
}

// 객체 삭제 명령
export const createDeleteObjectCommand = (scene, objectManager, object) => {
  const parent = object.parent;
  const position = parent ? parent.children.indexOf(object) : -1;
  
  return new Command(
    'deleteObject',
    () => {
      if (parent) {
        parent.remove(object);
      } else {
        scene.remove(object);
      }
      
      // 객체 관리자에서 제거
      if (objectManager && objectManager.removeObject) {
        objectManager.removeObject(object);
      }
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.OBJECT_REMOVED, { object });
      });
    },
    () => {
      if (parent && position >= 0) {
        parent.children.splice(position, 0, object);
        object.parent = parent;
      } else {
        scene.add(object);
      }
      
      // 객체 관리자에 추가
      if (objectManager && objectManager.addObject) {
        objectManager.addObject(object);
      }
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.OBJECT_ADDED, { object });
      });
    },
    { object, parent, position }
  )
}

export const createAddObjectCommand = (scene, object, parent = null) => {
  return new Command(
    'addObject',
    () => {
      if (parent) {
        parent.add(object);
      } else {
        scene.add(object);
      }
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.OBJECT_ADDED, { object });
      });
    },
    () => {
      if (object.parent) {
        object.parent.remove(object);
      }
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.OBJECT_REMOVED, { object });
      });
    },
    { object, parent }
  )
}

/**
 * 객체 회전 명령 생성
 */
export const createRotateObjectCommand = (object, axis, degrees) => {
  const previousRotation = { ...object.rotation };
  const radians = THREE.MathUtils.degToRad(degrees);
  
  return new Command(
    'rotateObject',
    () => {
      // 회전 적용
      switch (axis.toLowerCase()) {
        case 'x':
          object.rotation.x += radians;
          break;
        case 'y':
          object.rotation.y += radians;
          break;
        case 'z':
          object.rotation.z += radians;
          break;
      }
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.OBJECT_ROTATED, { object, axis, degrees });
      });
    },
    () => {
      // 이전 회전 복원
      object.rotation.copy(previousRotation);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.OBJECT_ROTATED, { 
          object, 
          axis, 
          degrees: -degrees 
        });
      });
    },
    { object, axis, degrees, previousRotation }
  )
}

/**
 * 객체 회전 초기화 명령 생성
 */
export const createResetObjectRotationCommand = (object) => {
  const previousRotation = { ...object.rotation };
  
  return new Command(
    'resetObjectRotation',
    () => {
      // 회전 초기화
      object.rotation.set(0, 0, 0);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.OBJECT_ROTATION_RESET, { object });
      });
    },
    () => {
      // 이전 회전 복원
      object.rotation.copy(previousRotation);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.OBJECT_ROTATED, { object });
      });
    },
    { object, previousRotation }
  )
}

/**
 * 객체 이동 명령 생성
 */
export const createMoveObjectCommand = (object, delta) => {
  const previousPosition = { ...object.position };
  
  return new Command(
    'moveObject',
    () => {
      // 이동 적용
      object.position.add(delta);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.OBJECT_MOVED, { object, delta });
      });
    },
    () => {
      // 이전 위치 복원
      object.position.copy(previousPosition);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.OBJECT_MOVED, { 
          object, 
          delta: delta.clone().negate() 
        });
      });
    },
    { object, delta, previousPosition }
  )
}

/**
 * 객체 스케일 명령 생성
 */
export const createScaleObjectCommand = (object, scaleFactor) => {
  const previousScale = { ...object.scale };
  
  return new Command(
    'scaleObject',
    () => {
      // 스케일 적용
      object.scale.multiplyScalar(scaleFactor);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.OBJECT_SCALED, { object, scaleFactor });
      });
    },
    () => {
      // 이전 스케일 복원
      object.scale.copy(previousScale);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.OBJECT_SCALED, { 
          object, 
          scaleFactor: 1 / scaleFactor 
        });
      });
    },
    { object, scaleFactor, previousScale }
  )
}

// 글로벌 명령어 매니저
export const commandManager = new CommandManager()
