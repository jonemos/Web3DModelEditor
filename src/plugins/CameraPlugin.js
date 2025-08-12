/**
 * Camera Plugin - 카메라 제어를 위한 플러그인
 * 
 * 새 아키텍처와 이벤트 시스템에 통합된 카메라 컨트롤러
 * - 카메라 움직임, 투영 모드 전환, 뷰포트 제어
 * - 명령 시스템과 통합하여 Undo/Redo 지원
 * - 이벤트 기반 상태 관리
 */

import * as THREE from 'three';
import { EventTypes } from '../core/EventBus.js';
import { BasePlugin } from '../core/BasePlugin.js';

export class CameraPlugin extends BasePlugin {
  constructor() {
    super('camera');
    
    // 카메라 상태
    this.camera = null;
    this.renderer = null;
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.spherical = new THREE.Spherical();
    
    // 초기 상태 저장 (리셋용)
    this.initialState = {
      position: new THREE.Vector3(15, 20, 15),
      target: new THREE.Vector3(0, 0, 0),
      fov: 75,
      near: 0.1,
      far: 1000
    };
    
    // 카메라 컨트롤 상태
    this.isControlsEnabled = true;
    this.movementSpeed = 1.0;
    this.rotationSpeed = 1.0;
    this.zoomSpeed = 1.0;
    
    // 카메라 타입 상태 ('perspective' | 'orthographic')
    this.projectionMode = 'perspective';
    
    // 재사용 가능한 벡터들 (성능 최적화)
    this._tempVector1 = new THREE.Vector3();
    this._tempVector2 = new THREE.Vector3();
    this._tempVector3 = new THREE.Vector3();
    
    // 서비스 참조
    this.sceneService = null;
    this.commandSystem = null;
  }

  /**
   * 플러그인 초기화
   */
  async init(context) {
    await super.init(context);
    
    // 서비스 참조 획득
    this.sceneService = this.getService('sceneService');
    this.commandSystem = this.getService('commandSystem');
    
    if (!this.sceneService) {
      throw new Error('SceneService is required for CameraPlugin');
    }
    
    // 씬에서 카메라와 렌더러 가져오기
    this.camera = this.sceneService.getCamera();
    this.renderer = this.sceneService.getRenderer();
    
    if (!this.camera || !this.renderer) {
      throw new Error('Camera and Renderer must be available in SceneService');
    }
    
    // 초기 상태 설정
    this.setupInitialState();
    
    // 이벤트 리스너 설정
    this.setupEventListeners();
    
    // 명령 팩토리 등록
    this.registerCommands();
    
    console.log('✅ Camera Plugin initialized');
  }

  /**
   * 초기 카메라 상태 설정
   */
  setupInitialState() {
    // 현재 카메라 상태를 초기 상태로 저장
    this.initialState.position.copy(this.camera.position);
    this.initialState.target.copy(this.cameraTarget);
    
    if (this.camera.isPerspectiveCamera) {
      this.initialState.fov = this.camera.fov;
      this.initialState.near = this.camera.near;
      this.initialState.far = this.camera.far;
      this.projectionMode = 'perspective';
    } else {
      this.projectionMode = 'orthographic';
    }
    
    // 구면 좌표 계산
    this.updateSpherical();
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 카메라 리셋 요청
    this.on(EventTypes.CAMERA_RESET_REQUESTED, () => {
      this.resetCamera();
    });

    // 카메라 투영 모드 전환 요청
    this.on(EventTypes.CAMERA_PROJECTION_TOGGLE_REQUESTED, () => {
      this.toggleProjection();
    });

    // 카메라 타겟 변경 요청
    this.on(EventTypes.CAMERA_TARGET_CHANGED, (event) => {
      const { target } = event.detail;
      if (target) {
        this.setCameraTarget(target);
      }
    });

    // 카메라 포지션 변경 요청
    this.on(EventTypes.CAMERA_POSITION_CHANGED, (event) => {
      const { position } = event.detail;
      if (position) {
        this.setCameraPosition(position);
      }
    });

    // 뷰포트 리사이즈 이벤트
    this.on(EventTypes.VIEWPORT_RESIZED, (event) => {
      const { width, height } = event.detail;
      this.handleResize(width, height);
    });
  }

  /**
   * 명령 팩토리 등록
   */
  registerCommands() {
    if (!this.commandSystem) return;

    // 카메라 리셋 명령
    this.commandSystem.registerCommandFactory('resetCamera', () => {
      const currentState = this.getCurrentState();
      const targetState = { ...this.initialState };
      
      return {
        execute: () => {
          this.applyCameraState(targetState);
          this.emit(EventTypes.CAMERA_RESET, { state: targetState });
        },
        undo: () => {
          this.applyCameraState(currentState);
          this.emit(EventTypes.CAMERA_STATE_RESTORED, { state: currentState });
        }
      };
    });

    // 카메라 투영 모드 전환 명령
    this.commandSystem.registerCommandFactory('toggleCameraProjection', () => {
      const currentMode = this.projectionMode;
      const targetMode = currentMode === 'perspective' ? 'orthographic' : 'perspective';
      
      return {
        execute: () => {
          this.setProjectionMode(targetMode);
          this.emit(EventTypes.CAMERA_PROJECTION_CHANGED, { 
            mode: targetMode,
            camera: this.camera 
          });
        },
        undo: () => {
          this.setProjectionMode(currentMode);
          this.emit(EventTypes.CAMERA_PROJECTION_CHANGED, { 
            mode: currentMode,
            camera: this.camera 
          });
        }
      };
    });

    // 카메라 상태 설정 명령
    this.commandSystem.registerCommandFactory('setCameraState', (targetState) => {
      const currentState = this.getCurrentState();
      
      return {
        execute: () => {
          this.applyCameraState(targetState);
          this.emit(EventTypes.CAMERA_STATE_CHANGED, { state: targetState });
        },
        undo: () => {
          this.applyCameraState(currentState);
          this.emit(EventTypes.CAMERA_STATE_CHANGED, { state: currentState });
        }
      };
    });
  }

  /**
   * 카메라 리셋
   */
  resetCamera() {
    if (this.commandSystem) {
      // 명령 시스템을 통한 실행 (Undo/Redo 지원)
      const command = this.commandSystem.createCommand('resetCamera');
      this.commandSystem.executeCommand(command);
    } else {
      // 직접 실행
      this.applyCameraState(this.initialState);
      this.emit(EventTypes.CAMERA_RESET, { state: this.initialState });
    }
  }

  /**
   * 카메라 투영 모드 전환
   */
  toggleProjection() {
    if (this.commandSystem) {
      // 명령 시스템을 통한 실행
      const command = this.commandSystem.createCommand('toggleCameraProjection');
      this.commandSystem.executeCommand(command);
    } else {
      // 직접 실행
      const newMode = this.projectionMode === 'perspective' ? 'orthographic' : 'perspective';
      this.setProjectionMode(newMode);
      this.emit(EventTypes.CAMERA_PROJECTION_CHANGED, { 
        mode: newMode,
        camera: this.camera 
      });
    }
  }

  /**
   * 투영 모드 설정
   */
  setProjectionMode(mode) {
    if (this.projectionMode === mode) return;

    const currentPosition = this.camera.position.clone();
    const currentTarget = this.cameraTarget.clone();
    
    if (mode === 'orthographic' && this.camera.isPerspectiveCamera) {
      // Perspective → Orthographic
      const distance = currentPosition.distanceTo(currentTarget);
      const aspect = window.innerWidth / window.innerHeight;
      const frustumSize = distance * 0.5;
      
      const orthographicCamera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2, frustumSize * aspect / 2,
        frustumSize / 2, frustumSize / -2,
        0.1, 1000
      );
      
      orthographicCamera.position.copy(currentPosition);
      orthographicCamera.lookAt(currentTarget);
      orthographicCamera.updateMatrixWorld();
      
      this.camera = orthographicCamera;
      this.sceneService.setCamera(orthographicCamera);
      
    } else if (mode === 'perspective' && this.camera.isOrthographicCamera) {
      // Orthographic → Perspective
      const perspectiveCamera = new THREE.PerspectiveCamera(
        this.initialState.fov,
        window.innerWidth / window.innerHeight,
        this.initialState.near,
        this.initialState.far
      );
      
      perspectiveCamera.position.copy(currentPosition);
      perspectiveCamera.lookAt(currentTarget);
      perspectiveCamera.updateMatrixWorld();
      
      this.camera = perspectiveCamera;
      this.sceneService.setCamera(perspectiveCamera);
    }
    
    this.projectionMode = mode;
    this.updateSpherical();
  }

  /**
   * 카메라 타겟 설정
   */
  setCameraTarget(target) {
    this.cameraTarget.copy(target);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    this.updateSpherical();
    
    this.emit(EventTypes.CAMERA_TARGET_UPDATED, { 
      target: this.cameraTarget.clone() 
    });
  }

  /**
   * 카메라 위치 설정
   */
  setCameraPosition(position) {
    this.camera.position.copy(position);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    this.updateSpherical();
    
    this.emit(EventTypes.CAMERA_POSITION_UPDATED, { 
      position: this.camera.position.clone() 
    });
  }

  /**
   * 카메라 상태 적용
   */
  applyCameraState(state) {
    this.camera.position.copy(state.position);
    this.cameraTarget.copy(state.target);
    this.camera.lookAt(this.cameraTarget);
    
    if (this.camera.isPerspectiveCamera && state.fov) {
      this.camera.fov = state.fov;
      this.camera.near = state.near || 0.1;
      this.camera.far = state.far || 1000;
      this.camera.updateProjectionMatrix();
    }
    
    this.camera.updateMatrixWorld();
    this.updateSpherical();
  }

  /**
   * 현재 카메라 상태 가져오기
   */
  getCurrentState() {
    const state = {
      position: this.camera.position.clone(),
      target: this.cameraTarget.clone(),
      mode: this.projectionMode
    };
    
    if (this.camera.isPerspectiveCamera) {
      state.fov = this.camera.fov;
      state.near = this.camera.near;
      state.far = this.camera.far;
    }
    
    return state;
  }

  /**
   * 구면 좌표 업데이트
   */
  updateSpherical() {
    this.spherical.setFromVector3(
      this.camera.position.clone().sub(this.cameraTarget)
    );
  }

  /**
   * 리사이즈 처리
   */
  handleResize(width, height) {
    const aspect = width / height;
    
    if (this.camera.isPerspectiveCamera) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    } else if (this.camera.isOrthographicCamera) {
      const frustumHeight = this.camera.top - this.camera.bottom;
      this.camera.left = -frustumHeight * aspect / 2;
      this.camera.right = frustumHeight * aspect / 2;
      this.camera.updateProjectionMatrix();
    }
    
    this.emit(EventTypes.CAMERA_RESIZED, { 
      width, 
      height, 
      aspect 
    });
  }

  /**
   * 카메라 컨트롤 활성화/비활성화
   */
  setControlsEnabled(enabled) {
    this.isControlsEnabled = enabled;
    this.emit(EventTypes.CAMERA_CONTROLS_CHANGED, { 
      enabled 
    });
  }

  /**
   * 카메라 정보 가져오기
   */
  getCameraInfo() {
    return {
      position: this.camera.position.clone(),
      target: this.cameraTarget.clone(),
      mode: this.projectionMode,
      fov: this.camera.isPerspectiveCamera ? this.camera.fov : null,
      isControlsEnabled: this.isControlsEnabled,
      spherical: {
        radius: this.spherical.radius,
        phi: this.spherical.phi,
        theta: this.spherical.theta
      }
    };
  }

  /**
   * 플러그인 정리
   */
  destroy() {
    // 이벤트 리스너 정리는 BasePlugin에서 자동으로 처리
    this.camera = null;
    this.renderer = null;
    this.sceneService = null;
    this.commandSystem = null;
    
    console.log('Camera Plugin destroyed');
  }
}

// 플러그인 등록 헬퍼
export function registerCameraPlugin(pluginSystem) {
  const plugin = new CameraPlugin();
  return pluginSystem.registerPlugin('camera', plugin);
}
