/**
 * 에디터 도메인 인터페이스 정의
 */

/**
 * 씬 관리 인터페이스
 */
export class ISceneManager {
  async createScene(name) {
    throw new Error('ISceneManager.createScene must be implemented');
  }
  
  async loadScene(sceneId) {
    throw new Error('ISceneManager.loadScene must be implemented');
  }
  
  async saveScene(scene) {
    throw new Error('ISceneManager.saveScene must be implemented');
  }
  
  async deleteScene(sceneId) {
    throw new Error('ISceneManager.deleteScene must be implemented');
  }
  
  getCurrentScene() {
    throw new Error('ISceneManager.getCurrentScene must be implemented');
  }
  
  setCurrentScene(scene) {
    throw new Error('ISceneManager.setCurrentScene must be implemented');
  }
}

/**
 * 오브젝트 팩토리 인터페이스
 */
export class IObjectFactory {
  createObject(type, config) {
    throw new Error('IObjectFactory.createObject must be implemented');
  }
  
  cloneObject(objectId) {
    throw new Error('IObjectFactory.cloneObject must be implemented');
  }
  
  getSupportedTypes() {
    throw new Error('IObjectFactory.getSupportedTypes must be implemented');
  }
}

/**
 * 렌더링 전략 인터페이스
 */
export class IRenderStrategy {
  initialize(canvas, scene) {
    throw new Error('IRenderStrategy.initialize must be implemented');
  }
  
  render() {
    throw new Error('IRenderStrategy.render must be implemented');
  }
  
  dispose() {
    throw new Error('IRenderStrategy.dispose must be implemented');
  }
  
  setQuality(quality) {
    throw new Error('IRenderStrategy.setQuality must be implemented');
  }
  
  enableShadows(enabled) {
    throw new Error('IRenderStrategy.enableShadows must be implemented');
  }
}

/**
 * 카메라 컨트롤러 인터페이스
 */
export class ICameraController {
  initialize(camera, domElement) {
    throw new Error('ICameraController.initialize must be implemented');
  }
  
  update() {
    throw new Error('ICameraController.update must be implemented');
  }
  
  enable() {
    throw new Error('ICameraController.enable must be implemented');
  }
  
  disable() {
    throw new Error('ICameraController.disable must be implemented');
  }
  
  reset() {
    throw new Error('ICameraController.reset must be implemented');
  }
  
  dispose() {
    throw new Error('ICameraController.dispose must be implemented');
  }
}

/**
 * 저장소 인터페이스
 */
export class IStorageRepository {
  async save(key, data) {
    throw new Error('IStorageRepository.save must be implemented');
  }
  
  async load(key) {
    throw new Error('IStorageRepository.load must be implemented');
  }
  
  async delete(key) {
    throw new Error('IStorageRepository.delete must be implemented');
  }
  
  async exists(key) {
    throw new Error('IStorageRepository.exists must be implemented');
  }
  
  async list() {
    throw new Error('IStorageRepository.list must be implemented');
  }
  
  async clear() {
    throw new Error('IStorageRepository.clear must be implemented');
  }
}

/**
 * 에셋 로더 인터페이스
 */
export class IAssetLoader {
  async loadModel(url) {
    throw new Error('IAssetLoader.loadModel must be implemented');
  }
  
  async loadTexture(url) {
    throw new Error('IAssetLoader.loadTexture must be implemented');
  }
  
  async loadAudio(url) {
    throw new Error('IAssetLoader.loadAudio must be implemented');
  }
  
  getProgress() {
    throw new Error('IAssetLoader.getProgress must be implemented');
  }
  
  preload(urls) {
    throw new Error('IAssetLoader.preload must be implemented');
  }
  
  dispose() {
    throw new Error('IAssetLoader.dispose must be implemented');
  }
}

/**
 * 선택 관리 인터페이스
 */
export class ISelectionManager {
  selectObject(objectId) {
    throw new Error('ISelectionManager.selectObject must be implemented');
  }
  
  deselectObject(objectId) {
    throw new Error('ISelectionManager.deselectObject must be implemented');
  }
  
  selectMultiple(objectIds) {
    throw new Error('ISelectionManager.selectMultiple must be implemented');
  }
  
  clearSelection() {
    throw new Error('ISelectionManager.clearSelection must be implemented');
  }
  
  getSelectedObjects() {
    throw new Error('ISelectionManager.getSelectedObjects must be implemented');
  }
  
  isSelected(objectId) {
    throw new Error('ISelectionManager.isSelected must be implemented');
  }
}

/**
 * 히스토리 관리 인터페이스
 */
export class IHistoryManager {
  execute(command) {
    throw new Error('IHistoryManager.execute must be implemented');
  }
  
  undo() {
    throw new Error('IHistoryManager.undo must be implemented');
  }
  
  redo() {
    throw new Error('IHistoryManager.redo must be implemented');
  }
  
  canUndo() {
    throw new Error('IHistoryManager.canUndo must be implemented');
  }
  
  canRedo() {
    throw new Error('IHistoryManager.canRedo must be implemented');
  }
  
  clear() {
    throw new Error('IHistoryManager.clear must be implemented');
  }
  
  getHistory() {
    throw new Error('IHistoryManager.getHistory must be implemented');
  }
}

/**
 * 성능 모니터 인터페이스
 */
export class IPerformanceMonitor {
  startFrame() {
    throw new Error('IPerformanceMonitor.startFrame must be implemented');
  }
  
  endFrame() {
    throw new Error('IPerformanceMonitor.endFrame must be implemented');
  }
  
  getStats() {
    throw new Error('IPerformanceMonitor.getStats must be implemented');
  }
  
  reset() {
    throw new Error('IPerformanceMonitor.reset must be implemented');
  }
  
  setTarget(fps) {
    throw new Error('IPerformanceMonitor.setTarget must be implemented');
  }
}

/**
 * 이벤트 시스템 인터페이스
 */
export class IEventSystem {
  subscribe(eventType, handler) {
    throw new Error('IEventSystem.subscribe must be implemented');
  }
  
  unsubscribe(eventType, handler) {
    throw new Error('IEventSystem.unsubscribe must be implemented');
  }
  
  publish(eventType, data) {
    throw new Error('IEventSystem.publish must be implemented');
  }
  
  clear() {
    throw new Error('IEventSystem.clear must be implemented');
  }
}

/**
 * 설정 관리 인터페이스
 */
export class IConfigManager {
  get(key, defaultValue) {
    throw new Error('IConfigManager.get must be implemented');
  }
  
  set(key, value) {
    throw new Error('IConfigManager.set must be implemented');
  }
  
  has(key) {
    throw new Error('IConfigManager.has must be implemented');
  }
  
  delete(key) {
    throw new Error('IConfigManager.delete must be implemented');
  }
  
  getAll() {
    throw new Error('IConfigManager.getAll must be implemented');
  }
  
  reset() {
    throw new Error('IConfigManager.reset must be implemented');
  }
}
