/**
 * 게임 도메인 서비스 - Zustand 스토어를 서비스 패턴으로 전환
 */

import { IGameService } from '../../../core/interfaces/DomainInterfaces.js';
import { EVENT_TYPES } from '../../../infrastructure/events/EventBus.js';
import * as THREE from 'three';

/**
 * 게임 서비스
 */
export class GameService extends IGameService {
  constructor(eventBus) {
    super();
    this.eventBus = eventBus;
    
    // Game state
    this.isPlaying = true;
    this.isPaused = false;
    this.isLoading = true;
    
    // Scene objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.player = null;
    this.mixer = null;
    this.clock = new THREE.Clock();
    
    // Player state
    this.playerPosition = { x: 0, y: 1, z: 0 };
    this.playerRotation = 0;
    
    // Camera state
    this.cameraState = {
      distance: 10,
      height: 5,
      followMode: true,
      rotationSpeed: 0.002,
      zoomSpeed: 1,
      minDistance: 3,
      maxDistance: 50,
      phi: Math.PI / 4,
      theta: 0
    };
    
    // Mouse and keyboard state
    this.keys = {};
    this.mouseState = {
      isMouseDown: false,
      lastMousePos: { x: 0, y: 0 },
      prevMousePos: { x: 0, y: 0 }
    };
    
    // Game objects
    this.trees = [];
    this.items = [];
    this.walls = [];
  }

  /**
   * 게임 시작
   */
  startGame() {
    this.isPlaying = true;
    this.isPaused = false;
    this.eventBus.publish(EVENT_TYPES.GAME_STARTED, {
      timestamp: Date.now()
    });
  }

  /**
   * 게임 일시정지
   */
  pauseGame() {
    this.isPaused = true;
    this.eventBus.publish(EVENT_TYPES.GAME_PAUSED, {
      timestamp: Date.now()
    });
  }

  /**
   * 게임 재시작
   */
  resumeGame() {
    this.isPaused = false;
    this.eventBus.publish(EVENT_TYPES.GAME_RESUMED, {
      timestamp: Date.now()
    });
  }

  /**
   * 게임 재개 (alias for resumeGame)
   */
  resume() {
    this.resumeGame();
  }

  /**
   * 카메라 팔로우 모드 토글
   */
  toggleCameraFollowMode() {
    this.cameraState.followMode = !this.cameraState.followMode;
    this.eventBus.publish(EVENT_TYPES.CAMERA_CHANGED, {
      cameraState: this.cameraState
    });
  }

  /**
   * 카메라 상태 가져오기
   */
  getCameraState() {
    return { ...this.cameraState };
  }

  /**
   * 플레이어 위치 설정
   */
  setPlayerPosition(position) {
    this.playerPosition = { ...position };
    this.eventBus.publish(EVENT_TYPES.PLAYER_MOVED, {
      position: this.playerPosition
    });
  }

  /**
   * 카메라 상태 업데이트
   */
  updateCameraState(updates) {
    this.cameraState = { ...this.cameraState, ...updates };
    this.eventBus.publish(EVENT_TYPES.CAMERA_CHANGED, {
      cameraState: this.cameraState
    });
  }

  /**
   * 키 상태 설정
   */
  setKeyState(key, pressed) {
    this.keys[key] = pressed;
  }

  /**
   * 마우스 상태 업데이트
   */
  updateMouseState(updates) {
    this.mouseState = { ...this.mouseState, ...updates };
  }

  /**
   * 아이템 추가
   */
  addItem(item) {
    this.items.push(item);
    this.eventBus.publish(EVENT_TYPES.ITEM_ADDED, { item });
  }

  /**
   * 아이템 제거
   */
  removeItem(itemId) {
    const index = this.items.findIndex(item => item.id === itemId);
    if (index !== -1) {
      const removedItem = this.items.splice(index, 1)[0];
      this.eventBus.publish(EVENT_TYPES.ITEM_REMOVED, { item: removedItem });
      return removedItem;
    }
    return null;
  }

  /**
   * 나무 설정
   */
  setTrees(trees) {
    this.trees = trees;
    this.eventBus.publish(EVENT_TYPES.TREES_UPDATED, { trees });
  }

  /**
   * 벽 추가
   */
  addWall(wall) {
    this.walls.push(wall);
    this.eventBus.publish(EVENT_TYPES.WALL_ADDED, { wall });
  }

  /**
   * 벽 제거
   */
  clearWalls() {
    this.walls = [];
    this.eventBus.publish(EVENT_TYPES.WALLS_CLEARED, {});
  }

  /**
   * 믹서 설정
   */
  setMixer(mixer) {
    this.mixer = mixer;
  }

  /**
   * 씬 설정
   */
  setSceneObjects(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
  }

  /**
   * 플레이어 설정
   */
  setPlayer(player) {
    this.player = player;
  }

  /**
   * 게임 상태 조회
   */
  getGameState() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      isLoading: this.isLoading,
      playerPosition: this.playerPosition,
      playerRotation: this.playerRotation,
      cameraState: this.cameraState,
      trees: this.trees,
      items: this.items,
      walls: this.walls
    };
  }

  /**
   * 입력 상태 조회
   */
  getInputState() {
    return {
      keys: { ...this.keys },
      mouseState: { ...this.mouseState }
    };
  }

  /**
   * 게임 리셋
   */
  resetGame() {
    this.isPlaying = false;
    this.isPaused = false;
    this.isLoading = true;
    this.playerPosition = { x: 0, y: 1, z: 0 };
    this.playerRotation = 0;
    this.keys = {};
    this.mouseState = {
      isMouseDown: false,
      lastMousePos: { x: 0, y: 0 },
      prevMousePos: { x: 0, y: 0 }
    };
    this.items = [];
    this.walls = [];
    
    this.eventBus.publish(EVENT_TYPES.GAME_RESET, {
      timestamp: Date.now()
    });
  }

  /**
   * 로딩 상태 설정
   */
  setLoading(isLoading) {
    this.isLoading = isLoading;
    this.eventBus.publish(EVENT_TYPES.LOADING_CHANGED, {
      isLoading: this.isLoading
    });
  }

  /**
   * 게임 일시정지/재개 토글
   */
  pause() {
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  /**
   * 게임 재시작
   */
  restart() {
    this.resetGame();
    this.startGame();
  }

  /**
   * 현재 상태 반환
   */
  getState() {
    return {
      isLoading: this.isLoading,
      isPaused: this.isPaused,
      isPlaying: this.isPlaying,
      playerPosition: this.playerPosition,
      cameraPosition: this.cameraPosition,
      currentLevel: this.currentLevel,
      items: [...this.items],
      trees: [...this.trees],
      walls: [...this.walls]
    };
  }
}

// 게임 이벤트 타입 추가
export const GAME_EVENT_TYPES = {
  GAME_STARTED: 'game:started',
  GAME_PAUSED: 'game:paused',
  GAME_RESUMED: 'game:resumed',
  GAME_RESET: 'game:reset',
  PLAYER_MOVED: 'game:player:moved',
  CAMERA_CHANGED: 'game:camera:changed',
  ITEM_ADDED: 'game:item:added',
  ITEM_REMOVED: 'game:item:removed',
  TREES_UPDATED: 'game:trees:updated',
  WALL_ADDED: 'game:wall:added',
  WALLS_CLEARED: 'game:walls:cleared'
};
