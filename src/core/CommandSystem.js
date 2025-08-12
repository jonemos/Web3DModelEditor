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
    
    // Modern 패널들을 위한 기본 명령어들 등록
    this.registerModernCommands()
  }

  /**
   * Modern 패널들을 위한 명령어 등록
   */
  registerModernCommands() {
    // 객체 속성 업데이트 명령
    this.registerCommand('updateObjectProperty', (params) => {
      const { object, property, value, previousValue } = params
      return new Command(
        'updateObjectProperty',
        () => {
          object[property] = value
          if (object.updateMatrix) object.updateMatrix()
        },
        () => {
          object[property] = previousValue
          if (object.updateMatrix) object.updateMatrix()
        },
        { object, property, value, previousValue }
      )
    })

    // 벡터 속성 업데이트 명령
    this.registerCommand('updateObjectVectorProperty', (params) => {
      const { object, property, value, previousValue } = params
      return new Command(
        'updateObjectVectorProperty',
        () => {
          object[property].set(value.x, value.y, value.z)
          if (object.updateMatrix) object.updateMatrix()
        },
        () => {
          object[property].set(previousValue.x, previousValue.y, previousValue.z)
          if (object.updateMatrix) object.updateMatrix()
        },
        { object, property, value, previousValue }
      )
    })

    // 에셋 배치 명령
    this.registerCommand('placeAsset', (params) => {
      const { assetType, assetId, parameters, position } = params
      let createdObject = null
      
      return new Command(
        'placeAsset',
        async () => {
          // 에셋 타입에 따라 객체 생성
          createdObject = await this.createAssetObject(assetType, assetId, parameters)
          if (createdObject) {
            createdObject.position.set(position.x, position.y, position.z)
            // 씬에 추가하는 로직은 SceneService에서 처리
            const { eventBus, EventTypes } = await import('./EventBus.js')
            eventBus.emit(EventTypes.OBJECT_ADDED, { object: createdObject })
          }
          return createdObject
        },
        () => {
          if (createdObject) {
            const { eventBus, EventTypes } = import('./EventBus.js').then(module => {
              module.eventBus.emit(module.EventTypes.OBJECT_REMOVED, { object: createdObject })
            })
          }
        },
        { assetType, assetId, parameters, position }
      )
    })

    // 포스트 프로세싱 토글 명령
    this.registerCommand('togglePostProcessing', (params) => {
      const { enabled } = params
      return new Command(
        'togglePostProcessing',
        () => {
          const { eventBus, EventTypes } = import('./EventBus.js').then(module => {
            module.eventBus.emit(module.EventTypes.POST_PROCESSING_TOGGLED, { enabled })
          })
        },
        () => {
          const { eventBus, EventTypes } = import('./EventBus.js').then(module => {
            module.eventBus.emit(module.EventTypes.POST_PROCESSING_TOGGLED, { enabled: !enabled })
          })
        },
        { enabled }
      )
    })

    // 포스트 프로세싱 효과 활성화 명령
    this.registerCommand('enablePostProcessingEffect', (params) => {
      const { effectId, settings } = params
      return new Command(
        'enablePostProcessingEffect',
        () => {
          const { eventBus, EventTypes } = import('./EventBus.js').then(module => {
            module.eventBus.emit(module.EventTypes.POST_PROCESSING_EFFECT_ENABLED, { effectId, settings })
          })
        },
        () => {
          const { eventBus, EventTypes } = import('./EventBus.js').then(module => {
            module.eventBus.emit(module.EventTypes.POST_PROCESSING_EFFECT_DISABLED, { effectId })
          })
        },
        { effectId, settings }
      )
    })

    // HDRI 환경맵 설정 명령
    this.registerCommand('setEnvironmentMap', (params) => {
      const { hdriId, url, settings } = params
      return new Command(
        'setEnvironmentMap',
        () => {
          const { eventBus, EventTypes } = import('./EventBus.js').then(module => {
            module.eventBus.emit(module.EventTypes.ENVIRONMENT_MAP_CHANGED, { hdriId, url, settings })
          })
        },
        null, // HDRI 변경은 undo 지원하지 않음 (복잡성 때문)
        { hdriId, url, settings }
      )
    })

    // 객체 이름 변경 명령
    this.registerCommand('renameObject', (params) => {
      const { objectId, newName } = params
      let object = null
      let oldName = null
      
      return new Command(
        'renameObject',
        () => {
          // objectId로 객체 찾기 로직은 SceneService에서 처리
          const { eventBus, EventTypes } = import('./EventBus.js').then(module => {
            module.eventBus.emit(module.EventTypes.OBJECT_RENAMED, { objectId, newName, oldName })
          })
        },
        () => {
          if (object && oldName) {
            const { eventBus, EventTypes } = import('./EventBus.js').then(module => {
              module.eventBus.emit(module.EventTypes.OBJECT_RENAMED, { objectId, newName: oldName, oldName: newName })
            })
          }
        },
        { objectId, newName }
      )
    })
  }

  /**
   * 에셋 타입에 따른 객체 생성
   */
  async createAssetObject(assetType, assetId, parameters) {
    switch (assetType) {
      case 'primitive':
        return this.createPrimitive(assetId, parameters)
      case 'light':
        return this.createLight(assetId, parameters)
      case 'helper':
        return this.createHelper(assetId, parameters)
      case 'gameplay':
        return this.createGameplayObject(assetId, parameters)
      default:
        console.warn('Unknown asset type:', assetType)
        return null
    }
  }

  /**
   * 프리미티브 객체 생성
   */
  createPrimitive(primitiveId, parameters) {
    let geometry, material, mesh

    material = new THREE.MeshStandardMaterial({ color: 0x888888 })

    switch (primitiveId) {
      case 'cube':
        geometry = new THREE.BoxGeometry(
          parameters.width || 1,
          parameters.height || 1,
          parameters.depth || 1
        )
        break
      case 'sphere':
        geometry = new THREE.SphereGeometry(
          parameters.radius || 0.5,
          parameters.segments || 32,
          parameters.segments || 16
        )
        break
      case 'plane':
        geometry = new THREE.PlaneGeometry(
          parameters.width || 2,
          parameters.height || 2
        )
        break
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          parameters.radiusTop || 0.5,
          parameters.radiusBottom || 0.5,
          parameters.height || 1
        )
        break
      default:
        return null
    }

    mesh = new THREE.Mesh(geometry, material)
    mesh.name = `${primitiveId}_${Date.now()}`
    return mesh
  }

  /**
   * 조명 객체 생성
   */
  createLight(lightId, parameters) {
    let light

    switch (lightId) {
      case 'point_light':
        light = new THREE.PointLight(
          parameters.color || 0xffffff,
          parameters.intensity || 1,
          parameters.distance || 0
        )
        break
      case 'directional_light':
        light = new THREE.DirectionalLight(
          parameters.color || 0xffffff,
          parameters.intensity || 1
        )
        break
      case 'spot_light':
        light = new THREE.SpotLight(
          parameters.color || 0xffffff,
          parameters.intensity || 1,
          parameters.distance || 0,
          parameters.angle || Math.PI / 3
        )
        break
      case 'ambient_light':
        light = new THREE.AmbientLight(
          parameters.color || 0x404040,
          parameters.intensity || 0.5
        )
        break
      default:
        return null
    }

    light.name = `${lightId}_${Date.now()}`
    return light
  }

  /**
   * 헬퍼 객체 생성
   */
  createHelper(helperId, parameters) {
    let helper

    switch (helperId) {
      case 'axes_helper':
        helper = new THREE.AxesHelper(parameters.size || 1)
        break
      case 'grid_helper':
        helper = new THREE.GridHelper(
          parameters.size || 10,
          parameters.divisions || 10
        )
        break
      case 'box_helper':
        // BoxHelper는 대상 객체가 필요하므로 빈 객체 생성
        const box = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(1, 1, 1)
        )
        helper = new THREE.Box3Helper(box)
        break
      default:
        return null
    }

    helper.name = `${helperId}_${Date.now()}`
    return helper
  }

  /**
   * 게임플레이 객체 생성
   */
  createGameplayObject(objectId, parameters) {
    let object

    // 게임플레이 객체는 보통 마커나 특수한 속성을 가진 객체
    const geometry = new THREE.SphereGeometry(0.1, 8, 6)
    const material = new THREE.MeshBasicMaterial({ 
      color: objectId === 'start_position' ? 0x00ff00 : 
             objectId === 'checkpoint' ? 0xff0000 : 0x0000ff,
      transparent: true,
      opacity: 0.7
    })

    object = new THREE.Mesh(geometry, material)
    object.name = `${objectId}_${Date.now()}`
    object.userData.gameplayType = objectId

    return object
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
   * 사용 가능한 명령어 목록 반환
   */
  getAvailableCommands() {
    return Array.from(this.commands.keys())
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

/**
 * 그리드 표시/숨김 명령 생성
 */
export const createSetGridVisibilityCommand = (gridManager, visible) => {
  const previousVisible = gridManager.state.visible;
  
  return new Command(
    'setGridVisibility',
    () => {
      // 그리드 표시/숨김 적용
      gridManager.setVisibilityInternal(visible);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.GRID_VISIBILITY_CHANGED, { 
          visible, 
          previousVisible 
        });
      });
    },
    () => {
      // 이전 표시 상태 복원
      gridManager.setVisibilityInternal(previousVisible);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.GRID_VISIBILITY_CHANGED, { 
          visible: previousVisible, 
          previousVisible: visible 
        });
      });
    },
    { gridManager, visible, previousVisible }
  )
}

/**
 * 그리드 크기 설정 명령 생성
 */
export const createSetGridSizeCommand = (gridManager, size) => {
  const previousSize = gridManager.state.size;
  
  return new Command(
    'setGridSize',
    () => {
      // 그리드 크기 적용
      gridManager.setSizeInternal(size);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.GRID_SIZE_CHANGED, { 
          size, 
          previousSize 
        });
      });
    },
    () => {
      // 이전 크기 복원
      gridManager.setSizeInternal(previousSize);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.GRID_SIZE_CHANGED, { 
          size: previousSize, 
          previousSize: size 
        });
      });
    },
    { gridManager, size, previousSize }
  )
}

/**
 * 그리드 분할 수 설정 명령 생성
 */
export const createSetGridDivisionsCommand = (gridManager, divisions) => {
  const previousDivisions = gridManager.state.divisions;
  
  return new Command(
    'setGridDivisions',
    () => {
      // 그리드 분할 적용
      gridManager.setDivisionsInternal(divisions);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.GRID_DIVISIONS_CHANGED, { 
          divisions, 
          previousDivisions 
        });
      });
    },
    () => {
      // 이전 분할 수 복원
      gridManager.setDivisionsInternal(previousDivisions);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.GRID_DIVISIONS_CHANGED, { 
          divisions: previousDivisions, 
          previousDivisions: divisions 
        });
      });
    },
    { gridManager, divisions, previousDivisions }
  )
}

/**
 * 그리드 토글 명령 생성
 */
export const createToggleGridCommand = (gridManager) => {
  const currentVisible = gridManager.state.visible;
  const newVisible = !currentVisible;
  
  return new Command(
    'toggleGrid',
    () => {
      // 그리드 토글
      gridManager.setVisibilityInternal(newVisible);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.GRID_TOGGLED, { 
          visible: newVisible,
          previousVisible: currentVisible
        });
      });
    },
    () => {
      // 이전 상태로 복원
      gridManager.setVisibilityInternal(currentVisible);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.GRID_TOGGLED, { 
          visible: currentVisible,
          previousVisible: newVisible
        });
      });
    },
    { gridManager, currentVisible, newVisible }
  )
}

// === 카메라 명령 팩토리들 ===

/**
 * 카메라 리셋 명령 생성
 */
export const createResetCameraCommand = (cameraPlugin) => {
  const currentState = cameraPlugin.getCurrentState();
  const initialState = { ...cameraPlugin.initialState };
  
  return new Command(
    'resetCamera',
    () => {
      // 카메라를 초기 상태로 리셋
      cameraPlugin.applyCameraState(initialState);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.CAMERA_RESET, { 
          state: initialState,
          previousState: currentState
        });
      });
    },
    () => {
      // 이전 상태로 복원
      cameraPlugin.applyCameraState(currentState);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.CAMERA_STATE_RESTORED, { 
          state: currentState,
          resetState: initialState
        });
      });
    },
    { cameraPlugin, currentState, initialState }
  )
}

/**
 * 카메라 투영 모드 전환 명령 생성
 */
export const createToggleCameraProjectionCommand = (cameraPlugin) => {
  const currentMode = cameraPlugin.projectionMode;
  const targetMode = currentMode === 'perspective' ? 'orthographic' : 'perspective';
  
  return new Command(
    'toggleCameraProjection',
    () => {
      // 투영 모드 전환
      cameraPlugin.setProjectionMode(targetMode);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.CAMERA_PROJECTION_CHANGED, { 
          mode: targetMode,
          previousMode: currentMode,
          camera: cameraPlugin.camera
        });
      });
    },
    () => {
      // 이전 모드로 복원
      cameraPlugin.setProjectionMode(currentMode);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.CAMERA_PROJECTION_CHANGED, { 
          mode: currentMode,
          previousMode: targetMode,
          camera: cameraPlugin.camera
        });
      });
    },
    { cameraPlugin, currentMode, targetMode }
  )
}

/**
 * 카메라 상태 설정 명령 생성
 */
export const createSetCameraStateCommand = (cameraPlugin, targetState) => {
  const currentState = cameraPlugin.getCurrentState();
  
  return new Command(
    'setCameraState',
    () => {
      // 카메라 상태 적용
      cameraPlugin.applyCameraState(targetState);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.CAMERA_STATE_CHANGED, { 
          state: targetState,
          previousState: currentState
        });
      });
    },
    () => {
      // 이전 상태로 복원
      cameraPlugin.applyCameraState(currentState);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.CAMERA_STATE_CHANGED, { 
          state: currentState,
          targetState: targetState
        });
      });
    },
    { cameraPlugin, currentState, targetState }
  )
}

/**
 * 카메라 타겟 설정 명령 생성
 */
export const createSetCameraTargetCommand = (cameraPlugin, newTarget) => {
  const currentTarget = cameraPlugin.cameraTarget.clone();
  
  return new Command(
    'setCameraTarget',
    () => {
      // 카메라 타겟 설정
      cameraPlugin.setCameraTarget(newTarget);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.CAMERA_TARGET_UPDATED, { 
          target: newTarget,
          previousTarget: currentTarget
        });
      });
    },
    () => {
      // 이전 타겟으로 복원
      cameraPlugin.setCameraTarget(currentTarget);
      
      // 이벤트 발행
      import('./EventBus.js').then(({ eventBus, EventTypes }) => {
        eventBus.emit(EventTypes.CAMERA_TARGET_UPDATED, { 
          target: currentTarget,
          newTarget: newTarget
        });
      });
    },
    { cameraPlugin, currentTarget, newTarget }
  )
}

// 글로벌 명령어 매니저
export const commandManager = new CommandManager()
