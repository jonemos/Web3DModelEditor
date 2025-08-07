/**
 * 에디터 도메인 서비스 - 비즈니스 로직 중앙 관리
 */

import { EVENT_TYPES } from '../../../infrastructure/events/EventBus.js';
import { Object3DEntity, EditorSceneEntity } from '../../../core/entities/SceneEntities.js';

/**
 * 씬 관리 서비스
 */
export class SceneManagerService {
  constructor(eventBus, storageRepository) {
    this.eventBus = eventBus;
    this.storageRepository = storageRepository;
    this.currentScene = null;
    this.sceneHistory = [];
    this.maxHistorySize = 10;
  }

  /**
   * 새 씬 생성
   */
  async createScene(name = 'New Scene') {
    try {
      const scene = new EditorSceneEntity(name);
      this.setCurrentScene(scene);
      
      // 기본 오브젝트 추가 (그라운드 플레인)
      const groundPlane = new Object3DEntity('ground', 'Ground', 'plane');
      groundPlane.setScale(20, 1, 20);
      groundPlane.setPosition(0, 0, 0);
      scene.addObject(groundPlane);

      // Publish event
      this.eventBus.publish(EVENT_TYPES.SCENE_CREATED, { scene });

      return scene;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'SceneManagerService.createScene',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 씬 로드
   */
  async loadScene(sceneId) {
    try {
      const sceneData = await this.storageRepository.load(`scene_${sceneId}`);
      if (!sceneData) {
        throw new Error(`Scene ${sceneId} not found`);
      }

      const scene = EditorSceneEntity.fromJSON(sceneData);
      this.setCurrentScene(scene);
      
      return scene;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'SceneManagerService.loadScene',
        error: error.message,
        sceneId
      });
      throw error;
    }
  }

  /**
   * 씬 저장
   */
  async saveScene(scene) {
    try {
      if (!scene) {
        scene = this.currentScene;
      }

      if (!scene) {
        throw new Error('No scene to save');
      }

      const sceneData = scene.toJSON();
      await this.storageRepository.save(`scene_${scene.id}`, sceneData);
      
      // 씬 메타데이터 저장
      await this.updateSceneMetadata(scene);
      
      return scene.id;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'SceneManagerService.saveScene',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 씬 삭제
   */
  async deleteScene(sceneId) {
    try {
      await this.storageRepository.delete(`scene_${sceneId}`);
      
      // 메타데이터에서도 제거
      const metadata = await this.getSceneMetadata();
      delete metadata[sceneId];
      await this.storageRepository.save('scene_metadata', metadata);
      
      return true;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'SceneManagerService.deleteScene',
        error: error.message,
        sceneId
      });
      throw error;
    }
  }

  /**
   * 현재 씬 조회
   */
  getCurrentScene() {
    return this.currentScene;
  }

  /**
   * 현재 씬 설정
   */
  setCurrentScene(scene) {
    if (this.currentScene !== scene) {
      // 히스토리에 추가
      if (this.currentScene) {
        this.addToHistory(this.currentScene);
      }

      this.currentScene = scene;
    }
  }

  /**
   * 씬 히스토리에 추가
   */
  addToHistory(scene) {
    this.sceneHistory.unshift(scene);
    
    if (this.sceneHistory.length > this.maxHistorySize) {
      this.sceneHistory = this.sceneHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * 씬 리스트 조회
   */
  async getSceneList() {
    try {
      const metadata = await this.getSceneMetadata();
      return Object.values(metadata);
    } catch (error) {
      console.error('Error loading scene list:', error);
      return [];
    }
  }

  /**
   * 씬 메타데이터 조회
   */
  async getSceneMetadata() {
    try {
      return await this.storageRepository.load('scene_metadata') || {};
    } catch (error) {
      return {};
    }
  }

  /**
   * 씬 메타데이터 업데이트
   */
  async updateSceneMetadata(scene) {
    const metadata = await this.getSceneMetadata();
    
    metadata[scene.id] = {
      id: scene.id,
      name: scene.name,
      createdAt: scene.createdAt,
      updatedAt: scene.updatedAt,
      objectCount: scene.getAllObjects().length,
      thumbnail: null // 나중에 스크린샷 기능 추가
    };

    await this.storageRepository.save('scene_metadata', metadata);
  }
}

/**
 * 오브젝트 팩토리 서비스
 */
export class ObjectFactoryService {
  constructor(eventBus, assetLoader) {
    this.eventBus = eventBus;
    this.assetLoader = assetLoader;
    this.objectCreators = new Map();
    this.templates = new Map();
    
    this.initializeDefaultCreators();
  }

  /**
   * 기본 오브젝트 생성자 초기화
   */
  initializeDefaultCreators() {
    // 기본 도형들
    this.registerCreator('cube', this.createCube.bind(this));
    this.registerCreator('sphere', this.createSphere.bind(this));
    this.registerCreator('plane', this.createPlane.bind(this));
    this.registerCreator('cylinder', this.createCylinder.bind(this));
    
    // 메시 오브젝트 (일반적인 메시 - 기본 큐브로 처리)
    this.registerCreator('mesh', this.createMesh.bind(this));
    
    // 라이트
    this.registerCreator('directional-light', this.createDirectionalLight.bind(this));
    this.registerCreator('point-light', this.createPointLight.bind(this));
    this.registerCreator('ambient-light', this.createAmbientLight.bind(this));
    
    // 모델
    this.registerCreator('gltf-model', this.createGLTFModel.bind(this));
  }

  /**
   * 오브젝트 생성자 등록
   */
  registerCreator(type, creator) {
    if (typeof creator !== 'function') {
      throw new Error('Creator must be a function');
    }
    
    this.objectCreators.set(type, creator);
  }

  /**
   * 오브젝트 생성
   */
  async createObject(type, config = {}) {
    try {
      const creator = this.objectCreators.get(type);
      if (!creator) {
        throw new Error(`Unknown object type: ${type}`);
      }

      const object = await creator(config);
      
      // 기본 메타데이터 추가
      object.setMetadata('createdBy', 'ObjectFactory');
      object.setMetadata('createdAt', new Date().toISOString());
      
      return object;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'ObjectFactoryService.createObject',
        error: error.message,
        type,
        config
      });
      throw error;
    }
  }

  /**
   * 오브젝트 복제
   */
  async cloneObject(objectId, sceneManager) {
    try {
      const scene = sceneManager.getCurrentScene();
      if (!scene) {
        throw new Error('No current scene');
      }

      const originalObject = scene.getObject(objectId);
      if (!originalObject) {
        throw new Error(`Object ${objectId} not found`);
      }

      const clonedObject = originalObject.clone();
      
      // 복제본 메타데이터 추가
      clonedObject.setMetadata('clonedFrom', objectId);
      clonedObject.setMetadata('clonedAt', new Date().toISOString());
      
      return clonedObject;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'ObjectFactoryService.cloneObject',
        error: error.message,
        objectId
      });
      throw error;
    }
  }

  /**
   * 지원하는 타입 조회
   */
  getSupportedTypes() {
    return Array.from(this.objectCreators.keys());
  }

  // 기본 오브젝트 생성 메서드들
  async createCube(config) {
    const { name = 'Cube', size = 1 } = config;
    const object = new Object3DEntity(`cube_${Date.now()}`, name, 'cube');
    object.setMetadata('geometry', { type: 'box', size });
    return object;
  }

  async createSphere(config) {
    const { name = 'Sphere', radius = 1 } = config;
    const object = new Object3DEntity(`sphere_${Date.now()}`, name, 'sphere');
    object.setMetadata('geometry', { type: 'sphere', radius });
    return object;
  }

  async createPlane(config) {
    const { name = 'Plane', width = 1, height = 1 } = config;
    const object = new Object3DEntity(`plane_${Date.now()}`, name, 'plane');
    object.setMetadata('geometry', { type: 'plane', width, height });
    return object;
  }

  async createCylinder(config) {
    const { name = 'Cylinder', radius = 1, height = 2 } = config;
    const object = new Object3DEntity(`cylinder_${Date.now()}`, name, 'cylinder');
    object.setMetadata('geometry', { type: 'cylinder', radius, height });
    return object;
  }

  async createMesh(config) {
    const { name = 'Mesh', geometry = 'box', ...geometryParams } = config;
    const object = new Object3DEntity(`mesh_${Date.now()}`, name, 'mesh');
    object.setMetadata('geometry', { type: geometry, ...geometryParams });
    
    // 위치, 회전, 스케일 설정
    if (config.position) {
      object.setPosition(...config.position);
    }
    if (config.rotation) {
      object.setRotation(...config.rotation);
    }
    if (config.scale) {
      object.setScale(...config.scale);
    }
    
    return object;
  }

  async createDirectionalLight(config) {
    const { name = 'Directional Light', intensity = 1, color = '#ffffff' } = config;
    const object = new Object3DEntity(`dir_light_${Date.now()}`, name, 'directional-light');
    object.setMetadata('light', { type: 'directional', intensity, color });
    object.setPosition(10, 10, 5);
    return object;
  }

  async createPointLight(config) {
    const { name = 'Point Light', intensity = 1, color = '#ffffff', distance = 0 } = config;
    const object = new Object3DEntity(`point_light_${Date.now()}`, name, 'point-light');
    object.setMetadata('light', { type: 'point', intensity, color, distance });
    object.setPosition(0, 5, 0);
    return object;
  }

  async createAmbientLight(config) {
    const { name = 'Ambient Light', intensity = 0.5, color = '#404040' } = config;
    const object = new Object3DEntity(`ambient_light_${Date.now()}`, name, 'ambient-light');
    object.setMetadata('light', { type: 'ambient', intensity, color });
    return object;
  }

  async createGLTFModel(config) {
    const { name = 'Model', url, scale = 1 } = config;
    
    if (!url) {
      throw new Error('GLTF model URL is required');
    }

    // 모델 로드
    const modelData = await this.assetLoader.loadModel(url);
    
    const object = new Object3DEntity(`gltf_${Date.now()}`, name, 'gltf-model');
    object.setMetadata('model', { url, originalData: modelData });
    object.setScale(scale, scale, scale);
    
    return object;
  }
}

/**
 * 에디터 메인 서비스 - 모든 도메인 서비스 조정
 */
export class EditorService {
  constructor(
    eventBus,
    sceneManager,
    objectFactory,
    selectionManager,
    historyManager,
    renderManager
  ) {
    this.eventBus = eventBus;
    this.sceneManager = sceneManager;
    this.objectFactory = objectFactory;
    this.selectionManager = selectionManager;
    this.historyManager = historyManager;
    this.renderManager = renderManager;
    
    this.editorMode = 'select'; // select, move, rotate, scale
    this.gridVisible = true;
    this.snapToGrid = false;
    this.gridSize = 1;
    
    this.setupEventHandlers();
  }

  /**
   * 이벤트 핸들러 설정
   */
  setupEventHandlers() {
    // 오브젝트 선택 시 렌더링 업데이트
    this.eventBus.subscribe(EVENT_TYPES.OBJECT_SELECTED, (event) => {
      this.renderManager.highlightObject(event.data.objectId);
    });

    // 오브젝트 변형 시 히스토리에 기록
    this.eventBus.subscribe(EVENT_TYPES.OBJECT_MOVED, (event) => {
      this.renderManager.updateObject(event.data.objectId);
    });
  }

  /**
   * 새 프로젝트 시작
   */
  async startNewProject(projectName = 'New Project') {
    try {
      // 새 씬 생성
      const scene = await this.sceneManager.createScene(projectName);
      
      // 렌더링 초기화
      await this.renderManager.initializeScene(scene);
      
      // 히스토리 클리어
      this.historyManager.clear();
      
      this.eventBus.publish(EVENT_TYPES.EDITOR_MODE_CHANGED, {
        mode: 'project_started',
        projectName
      });

      return scene;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.startNewProject',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 오브젝트 추가
   */
  async addObject(type, config = {}) {
    try {
      const scene = this.sceneManager.getCurrentScene();
      if (!scene) {
        throw new Error('No active scene');
      }

      // 오브젝트 생성
      const object = await this.objectFactory.createObject(type, config);
      
      // 씬에 추가
      scene.addObject(object);
      
      // 렌더링에 추가
      await this.renderManager.addObject(object);
      
      // 자동 선택
      this.selectionManager.selectObject(object.id);
      
      // 히스토리에 기록
      this.historyManager.execute({
        type: 'ADD_OBJECT',
        objectId: object.id,
        execute: () => scene.addObject(object),
        undo: () => scene.removeObject(object.id)
      });

      return object;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.addObject',
        error: error.message,
        type,
        config
      });
      throw error;
    }
  }

  /**
   * 오브젝트 삭제
   */
  async deleteObject(objectId) {
    try {
      const scene = this.sceneManager.getCurrentScene();
      if (!scene) {
        throw new Error('No active scene');
      }

      const object = scene.getObject(objectId);
      if (!object) {
        throw new Error(`Object ${objectId} not found`);
      }

      // 선택 해제
      this.selectionManager.deselectObject(objectId);
      
      // 씬에서 제거
      scene.removeObject(objectId);
      
      // 렌더링에서 제거
      this.renderManager.removeObject(objectId);
      
      // 히스토리에 기록
      this.historyManager.execute({
        type: 'DELETE_OBJECT',
        objectId,
        objectData: object.toJSON(),
        execute: () => scene.removeObject(objectId),
        undo: () => {
          const restoredObject = Object3DEntity.fromJSON(this.objectData);
          scene.addObject(restoredObject);
          this.renderManager.addObject(restoredObject);
        }
      });

      this.eventBus.publish(EVENT_TYPES.OBJECT_DELETED, { objectId });

      return true;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.deleteObject',
        error: error.message,
        objectId
      });
      throw error;
    }
  }

  /**
   * 에디터 모드 변경
   */
  setEditorMode(mode) {
    if (this.editorMode !== mode) {
      this.editorMode = mode;
      this.eventBus.publish(EVENT_TYPES.EDITOR_MODE_CHANGED, { mode });
    }
  }

  /**
   * 그리드 토글
   */
  toggleGrid() {
    this.gridVisible = !this.gridVisible;
    this.renderManager.setGridVisible(this.gridVisible);
    this.eventBus.publish(EVENT_TYPES.EDITOR_GRID_TOGGLED, { visible: this.gridVisible });
  }

  /**
   * 실행 취소
   */
  undo() {
    if (this.historyManager.canUndo()) {
      this.historyManager.undo();
      this.eventBus.publish(EVENT_TYPES.HISTORY_UNDO, {});
    }
  }

  /**
   * 다시 실행
   */
  redo() {
    if (this.historyManager.canRedo()) {
      this.historyManager.redo();
      this.eventBus.publish(EVENT_TYPES.HISTORY_REDO, {});
    }
  }

  /**
   * 맵 클리어
   */
  clearMap() {
    try {
      const scene = this.sceneManager.getCurrentScene();
      if (scene) {
        scene.clear();
        this.selectionManager.clearSelection();
        this.historyManager.clear();
        
        this.eventBus.publish(EVENT_TYPES.SCENE_CLEARED, {
          sceneId: scene.id
        });
      }
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.clearMap',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 맵 저장
   */
  async saveMap(name) {
    try {
      const scene = this.sceneManager.getCurrentScene();
      if (!scene) {
        throw new Error('No active scene to save');
      }

      scene.name = name;
      await this.sceneManager.saveScene(scene);
      
      return true;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.saveMap',
        error: error.message,
        mapName: name
      });
      throw error;
    }
  }

  /**
   * 맵 로드
   */
  async loadMap(name) {
    try {
      const scene = await this.sceneManager.loadScene(name);
      
      // 렌더링 시스템에 씬 업데이트
      await this.renderManager.initializeScene(scene);
      
      // 히스토리 클리어
      this.historyManager.clear();
      
      return true;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.loadMap',
        error: error.message,
        mapName: name
      });
      throw error;
    }
  }

  /**
   * 에디터 상태 조회
   */
  getState() {
    return {
      editorMode: this.editorMode,
      gridVisible: this.gridVisible,
      snapToGrid: this.snapToGrid,
      gridSize: this.gridSize,
      currentScene: this.sceneManager.getCurrentScene()?.id || null,
      selectedObjects: this.selectionManager.getSelectedObjects(),
      canUndo: this.historyManager.canUndo(),
      canRedo: this.historyManager.canRedo()
    };
  }

  // Selection methods
  selectObject(objectId) {
    this.selectionManager.selectObject(objectId);
  }

  getSelectedObjects() {
    return this.selectionManager.getSelectedObjects();
  }

  getSelectedObject() {
    const selected = this.selectionManager.getSelectedObjects();
    return selected.length > 0 ? selected[0] : null;
  }

  /**
   * 오브젝트 선택
   */
  setSelectedObject(objectId) {
    try {
      this.selectionManager.selectObject(objectId);
      this.eventBus.publish(EVENT_TYPES.OBJECT_SELECTED, { 
        objectId,
        selectedObjects: this.selectionManager.getSelectedObjects()
      });
    } catch (error) {
      console.error('Failed to select object:', error);
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.setSelectedObject',
        error: error.message
      });
    }
  }

  /**
   * 모든 오브젝트 선택 해제
   */
  deselectAllObjects() {
    try {
      this.selectionManager.clearSelection();
      this.eventBus.publish(EVENT_TYPES.OBJECT_DESELECTED, { 
        selectedObjects: []
      });
    } catch (error) {
      console.error('Failed to deselect all objects:', error);
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.deselectAllObjects',
        error: error.message
      });
    }
  }

  /**
   * 오브젝트 선택 해제
   */
  deselectObject(objectId) {
    try {
      this.selectionManager.deselectObject(objectId);
      this.eventBus.publish(EVENT_TYPES.OBJECT_DESELECTED, { 
        objectId,
        selectedObjects: this.selectionManager.getSelectedObjects()
      });
    } catch (error) {
      console.error('Failed to deselect object:', error);
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.deselectObject',
        error: error.message
      });
    }
  }

  /**
   * 오브젝트 선택 토글
   */
  toggleObjectSelection(objectId) {
    try {
      const isSelected = this.selectionManager.getSelectedObjects().some(obj => obj.id === objectId);
      if (isSelected) {
        this.deselectObject(objectId);
      } else {
        this.setSelectedObject(objectId);
      }
    } catch (error) {
      console.error('Failed to toggle object selection:', error);
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.toggleObjectSelection',
        error: error.message
      });
    }
  }

  setTransformMode(mode) {
    // Store transform mode for UI consistency
    this.currentTransformMode = mode;
    this.eventBus.publish('transform-mode-changed', { mode });
  }

  getTransformMode() {
    return this.currentTransformMode || 'translate';
  }

  /**
   * 선택된 오브젝트로 카메라 포커스
   */
  focusOnSelectedObject() {
    try {
      const selectedObjects = this.selectionManager.getSelectedObjects();
      
      if (!selectedObjects || selectedObjects.length === 0) {
        this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
          source: 'EditorService.focusOnSelectedObject',
          error: 'No object selected for focus'
        });
        return false;
      }

      // 마지막 선택된 오브젝트로 포커스
      const targetObjectId = selectedObjects[selectedObjects.length - 1];
      
      // 포커스 성공 이벤트 발행
      this.eventBus.publish(EVENT_TYPES.CAMERA_FOCUS_REQUESTED, { 
        objectId: targetObjectId,
        selectedObjects: selectedObjects 
      });
      
      return true;
    } catch (error) {
      console.error('Failed to focus on selected object:', error);
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.focusOnSelectedObject',
        error: error.message
      });
      return false;
    }
  }

  // History methods
  canUndo() {
    return this.historyManager.canUndo();
  }

  canRedo() {
    return this.historyManager.canRedo();
  }

  // Wall management methods
  addWall(wallData) {
    try {
      // Create wall object directly for now
      const wall = {
        id: wallData.id || Date.now(),
        type: 'wall',
        position: wallData.position || [0, 2.5, 0],
        scale: wallData.scale || [1, 1, 1],
        name: wallData.name || `wall_${Date.now()}`,
        visible: true,
        createdAt: new Date().toISOString()
      };
      
      // Add to scene
      this.sceneManager.addObject(wall);
      
      // Record in history
      this.historyManager.recordAction({
        type: 'ADD_WALL',
        objectId: wall.id,
        objectData: wallData
      });

      // Publish event
      this.eventBus.publish(EVENT_TYPES.OBJECT_ADDED, { object: wall });

      return wall;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.addWall',
        error: error.message
      });
      throw error;
    }
  }

  // Floor management methods
  setFloorSize(width, depth) {
    try {
      this.floorWidth = width;
      this.floorDepth = depth;
      
      // Record in history
      this.historyManager.recordAction({
        type: 'SET_FLOOR_SIZE',
        oldSize: { width: this.floorWidth, depth: this.floorDepth },
        newSize: { width, depth }
      });

      // Publish event
      this.eventBus.publish(EVENT_TYPES.SCENE_CHANGED, { 
        floorSize: { width, depth } 
      });

      return true;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.setFloorSize',
        error: error.message
      });
      throw error;
    }
  }

  getFloorSize() {
    return {
      width: this.floorWidth,
      depth: this.floorDepth
    };
  }

  // Object visibility methods
  toggleObjectVisibility(objectId) {
    try {
      const object = this.sceneManager.getObject(objectId);
      if (!object) {
        throw new Error(`Object with id ${objectId} not found`);
      }

      object.visible = !object.visible;

      // Record in history
      this.historyManager.recordAction({
        type: 'TOGGLE_VISIBILITY',
        objectId: objectId,
        visible: object.visible
      });

      // Publish event
      this.eventBus.publish(EVENT_TYPES.OBJECT_UPDATED, { object });

      return object.visible;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.toggleObjectVisibility',
        error: error.message
      });
      throw error;
    }
  }

  // Object manipulation methods
  renameObject(objectId, newName) {
    try {
      const object = this.sceneManager.getObject(objectId);
      if (!object) {
        throw new Error(`Object with id ${objectId} not found`);
      }

      const oldName = object.name;
      object.name = newName;

      // Record in history
      this.historyManager.recordAction({
        type: 'RENAME_OBJECT',
        objectId: objectId,
        oldName: oldName,
        newName: newName
      });

      // Publish event
      this.eventBus.publish(EVENT_TYPES.OBJECT_UPDATED, { object });

      return object;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.renameObject',
        error: error.message
      });
      throw error;
    }
  }

  removeObject(objectId) {
    try {
      const object = this.sceneManager.getObject(objectId);
      if (!object) {
        throw new Error(`Object with id ${objectId} not found`);
      }

      // Remove from scene
      this.sceneManager.removeObject(objectId);

      // Deselect if selected
      if (this.selectionManager.getSelectedObjects().some(obj => obj.id === objectId)) {
        this.selectionManager.deselectObject(objectId);
      }

      // Record in history
      this.historyManager.recordAction({
        type: 'REMOVE_OBJECT',
        objectId: objectId,
        objectData: object
      });

      // Publish event
      this.eventBus.publish(EVENT_TYPES.OBJECT_DELETED, { objectId });

      return true;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.removeObject',
        error: error.message
      });
      throw error;
    }
  }

  // Asset management methods
  addAsset(name, url) {
    try {
      // Store asset for later use
      if (!this.assets) {
        this.assets = new Map();
      }
      
      this.assets.set(name, {
        name,
        url,
        addedAt: new Date().toISOString()
      });

      // Publish event
      this.eventBus.publish(EVENT_TYPES.ASSET_ADDED, { name, url });

      return true;
    } catch (error) {
      this.eventBus.publish(EVENT_TYPES.ERROR_OCCURRED, {
        source: 'EditorService.addAsset',
        error: error.message
      });
      throw error;
    }
  }

  getAssets() {
    return this.assets ? Array.from(this.assets.values()) : [];
  }
}
