/**
 * Service Registry - 의존성 주입 및 서비스 관리
 * 
 * 각 기능을 독립적인 서비스로 분리:
 * - 느슨한 결합
 * - 테스트 용이성
 * - 모킹 가능
 * - 라이프사이클 관리
 */

export class ServiceRegistry {
  constructor() {
    this.services = new Map()
    this.singletons = new Map()
    this.factories = new Map()
    this.dependencies = new Map()
  }

  /**
   * 싱글톤 서비스 등록
   */
  registerSingleton(name, serviceClass, dependencies = []) {
    this.services.set(name, {
      type: 'singleton',
      serviceClass,
      dependencies
    })
    return this
  }

  /**
   * 팩토리 서비스 등록
   */
  registerFactory(name, factory, dependencies = []) {
    this.services.set(name, {
      type: 'factory',
      factory,
      dependencies
    })
    return this
  }

  /**
   * 인스턴스 직접 등록
   */
  registerInstance(name, instance) {
    this.singletons.set(name, instance)
    return this
  }

  /**
   * 서비스 조회
   */
  get(name) {
    // 이미 생성된 싱글톤이 있으면 반환
    if (this.singletons.has(name)) {
      return this.singletons.get(name)
    }

    const serviceConfig = this.services.get(name)
    if (!serviceConfig) {
      throw new Error(`Service not found: ${name}`)
    }

    // 의존성 해결
    const dependencies = this.resolveDependencies(serviceConfig.dependencies)

    let instance
    if (serviceConfig.type === 'singleton') {
      instance = new serviceConfig.serviceClass(...dependencies)
      this.singletons.set(name, instance)
    } else if (serviceConfig.type === 'factory') {
      instance = serviceConfig.factory(...dependencies)
    }

    return instance
  }

  /**
   * 의존성 해결
   */
  resolveDependencies(dependencies) {
    return dependencies.map(dep => {
      if (typeof dep === 'string') {
        return this.get(dep)
      }
      return dep
    })
  }

  /**
   * 서비스 존재 확인
   */
  has(name) {
    return this.services.has(name) || this.singletons.has(name)
  }

  /**
   * 모든 서비스 정리
   */
  clear() {
    // 싱글톤들의 정리 메서드 호출
    for (const [name, instance] of this.singletons) {
      if (instance && typeof instance.destroy === 'function') {
        try {
          instance.destroy()
        } catch (error) {
          console.error(`Error destroying service ${name}:`, error)
        }
      }
    }

    this.services.clear()
    this.singletons.clear()
    this.factories.clear()
  }

  /**
   * 등록된 서비스 목록
   */
  getServiceNames() {
    return [...this.services.keys(), ...this.singletons.keys()]
  }
}

// 기본 서비스들을 위한 인터페이스 정의
export class BaseService {
  constructor() {
    this.initialized = false
  }

  async init() {
    this.initialized = true
  }

  destroy() {
    this.initialized = false
  }

  isInitialized() {
    return this.initialized
  }
}

// Scene Service
export class SceneService extends BaseService {
  constructor() {
    super()
    this.scene = null
    this.camera = null
    this.renderer = null
  }

  async init(canvas) {
    if (this.initialized) return

    // Three.js 동적 import
    const THREE = await import('three')
    
    // Three.js 초기화
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    
    await super.init()
  }

  getScene() { return this.scene }
  getCamera() { return this.camera }
  getRenderer() { return this.renderer }
}

// Object Management Service
export class ObjectManagementService extends BaseService {
  constructor(sceneService, commandManager) {
    super()
    this.sceneService = sceneService
    this.commandManager = commandManager
    this.objects = new Map()
  }

  addObject(object) {
    const command = createAddObjectCommand(this.sceneService.getScene(), object)
    return this.commandManager.execute(command)
  }

  removeObject(objectId) {
    const object = this.objects.get(objectId)
    if (!object) return false

    const command = createDeleteObjectCommand(this.sceneService.getScene(), object)
    return this.commandManager.execute(command)
  }

  getObject(id) {
    return this.objects.get(id)
  }

  getAllObjects() {
    return Array.from(this.objects.values())
  }
}

// Selection Service
export class SelectionService extends BaseService {
  constructor() {
    super()
    this.selectedObjects = new Set()
    this.eventBus = new EventTarget()
  }

  select(object) {
    this.selectedObjects.add(object)
    this.emit('selection:changed', { selected: Array.from(this.selectedObjects) })
  }

  deselect(object) {
    this.selectedObjects.delete(object)
    this.emit('selection:changed', { selected: Array.from(this.selectedObjects) })
  }

  clearSelection() {
    this.selectedObjects.clear()
    this.emit('selection:changed', { selected: [] })
  }

  getSelectedObjects() {
    return Array.from(this.selectedObjects)
  }

  emit(eventName, data) {
    const event = new CustomEvent(eventName, { detail: data })
    this.eventBus.dispatchEvent(event)
  }

  on(eventName, callback) {
    this.eventBus.addEventListener(eventName, callback)
  }
}

// Transform Service
export class TransformService extends BaseService {
  constructor(selectionService, commandManager) {
    super()
    this.selectionService = selectionService
    this.commandManager = commandManager
    this.mode = 'translate'
  }

  setMode(mode) {
    this.mode = mode
  }

  transformSelected(delta) {
    const selected = this.selectionService.getSelectedObjects()
    if (selected.length === 0) return

    // 변형 명령어들을 배치로 실행
    const commands = selected.map(object => {
      const oldTransform = {
        position: object.position.clone(),
        rotation: object.rotation.clone(),
        scale: object.scale.clone()
      }
      
      const newTransform = this.calculateNewTransform(object, delta)
      
      return createTransformCommand(object, newTransform, oldTransform)
    })

    // 배치 명령어 실행
    return this.commandManager.executeBatch(commands)
  }

  calculateNewTransform(object, delta) {
    const newTransform = {
      position: object.position.clone(),
      rotation: object.rotation.clone(),
      scale: object.scale.clone()
    }

    switch (this.mode) {
      case 'translate':
        newTransform.position.add(delta)
        break
      case 'rotate':
        newTransform.rotation.x += delta.x
        newTransform.rotation.y += delta.y
        newTransform.rotation.z += delta.z
        break
      case 'scale':
        newTransform.scale.multiply(delta)
        break
    }

    return newTransform
  }
}

// 글로벌 서비스 레지스트리
export const serviceRegistry = new ServiceRegistry()

// 기본 서비스들 등록
export function setupDefaultServices() {
  serviceRegistry
    .registerSingleton('sceneService', SceneService)
    .registerSingleton('selectionService', SelectionService)
    .registerSingleton('objectManagementService', ObjectManagementService, ['sceneService', 'commandManager'])
    .registerSingleton('transformService', TransformService, ['selectionService', 'commandManager'])
    .registerInstance('commandManager', commandManager)
}
