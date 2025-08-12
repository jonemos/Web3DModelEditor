import * as THREE from 'three';
import { CameraController } from './CameraController.js';
import { ObjectSelector } from './ObjectSelector.js';
import { TransformManager } from './TransformManager.js';
import { InputManager } from './InputManager.js';
import { KeyboardController } from './KeyboardController.js';
import { MouseController } from './MouseController.js';

// 새 아키텍처 통합
import { eventBus, EventTypes } from '../../core/EventBus.js';
import { commandManager } from '../../core/CommandSystem.js';

export class EditorControlsModern {
  constructor(scene, camera, renderer, editorStore, newArchServices = null, onCameraChange = null) {
    this.scene = scene;
    this.renderer = renderer;
    this.editorStore = editorStore;
    this.newArchServices = newArchServices; // 새 아키텍처 서비스들
    this.isNewArchEnabled = !!newArchServices;
    
    console.log('🎮 EditorControls:', this.isNewArchEnabled ? 'Modern Mode' : 'Legacy Mode');
    
    // 입력 관리 시스템 초기화
    this.inputManager = new InputManager();
    this.keyboardController = new KeyboardController(this.inputManager);
    this.mouseController = new MouseController(this.inputManager);
    
    // 모듈 초기화 (하이브리드 모드 지원)
    this.cameraController = new CameraController(camera, renderer, onCameraChange);
    this.objectSelector = new ObjectSelector(
      scene, 
      camera, 
      renderer, 
      this.isNewArchEnabled ? null : editorStore, // 새 아키텍처에서는 스토어 대신 서비스 사용
      this.isNewArchEnabled ? newArchServices : null
    );
    
    // MouseController에 ObjectSelector 설정
    this.mouseController.setObjectSelector(this.objectSelector);
    
    // Transform Manager 초기화 (하이브리드 모드)
    this.transformManager = new TransformManager(
      this.objectSelector, 
      this.isNewArchEnabled ? null : editorStore,
      this.keyboardController,
      this.isNewArchEnabled ? newArchServices : null
    );
    
    // 그리드 헬퍼 초기화
    this.initializeGrid();
    
    // 마우스 이벤트 설정
    this.inputManager.setupMouseEvents(renderer.domElement);
    
    // 리사이즈 핸들러 등록
    this.inputManager.registerResizeHandler(this.onWindowResize.bind(this));
    
    // 마우스 핸들러 등록
    this.setupMouseHandlers();
    
    // 뷰포트 제어 키보드 액션 등록
    this.setupViewportActions();
    
    // 새 아키텍처 통합 설정
    if (this.isNewArchEnabled) {
      this.setupNewArchitectureIntegration();
    }
    
    // 컨트롤 상태 (호환성을 위해 유지)
    this.isMouseDown = false;
    this.isPanning = false;
    this.isOrbiting = false;
    this.isDragSelecting = false;
    this.mousePosition = new THREE.Vector2();
    
    console.log('✅ EditorControls initialized');
  }

  /**
   * 새 아키텍처 통합 설정
   */
  setupNewArchitectureIntegration() {
    // 명령 시스템과 통합
    this.commandManager = commandManager;
    
    // 이벤트 리스너 설정
    this.setupNewArchitectureEvents();
    
    // 키보드 단축키를 명령 시스템으로 연결
    this.setupCommandKeyBindings();
    
    console.log('🔗 EditorControls: New architecture integration setup complete');
  }

  /**
   * 새 아키텍처 이벤트 설정
   */
  setupNewArchitectureEvents() {
    // 객체 선택 이벤트
    eventBus.on(EventTypes.OBJECT_SELECTED, (event) => {
      const { object } = event.detail;
      if (this.objectSelector) {
        this.objectSelector.handleNewArchObjectSelection(object);
      }
    });

    // 변형 모드 변경 이벤트
    eventBus.on(EventTypes.TRANSFORM_MODE_CHANGED, (event) => {
      const { mode } = event.detail;
      if (this.transformManager) {
        this.transformManager.setMode(mode);
      }
    });
  }

  /**
   * 명령 시스템과 키보드 단축키 연결
   */
  setupCommandKeyBindings() {
    // Transform 모드 변경 명령들
    this.keyboardController.addAction('KeyW', () => {
      if (this.isNewArchEnabled && this.newArchServices.transform) {
        this.commandManager.execute('setTransformMode', { mode: 'translate' });
      } else {
        // 기존 방식
        this.transformManager.setMode('translate');
      }
    });

    this.keyboardController.addAction('KeyE', () => {
      if (this.isNewArchEnabled && this.newArchServices.transform) {
        this.commandManager.execute('setTransformMode', { mode: 'rotate' });
      } else {
        this.transformManager.setMode('rotate');
      }
    });

    this.keyboardController.addAction('KeyR', () => {
      if (this.isNewArchEnabled && this.newArchServices.transform) {
        this.commandManager.execute('setTransformMode', { mode: 'scale' });
      } else {
        this.transformManager.setMode('scale');
      }
    });

    // 실행 취소/다시 실행
    this.keyboardController.addAction('KeyZ', (event) => {
      if (event.ctrlKey && this.isNewArchEnabled) {
        if (event.shiftKey) {
          this.commandManager.redo();
        } else {
          this.commandManager.undo();
        }
      }
    });

    // 삭제 명령
    this.keyboardController.addAction('Delete', () => {
      if (this.isNewArchEnabled && this.newArchServices.objectManagement) {
        const selectedObject = this.objectSelector.getSelectedObject();
        if (selectedObject) {
          this.commandManager.execute('deleteObject', { object: selectedObject });
        }
      }
    });
  }

  /**
   * 그리드 초기화 (하이브리드 모드 지원)
   */
  initializeGrid() {
    this.gridHelper = new THREE.GridHelper(100, 100, 0x888888, 0x444444);
    this.gridHelper.name = 'EditorGrid';
    this.scene.add(this.gridHelper);
    
    // 새 아키텍처에 그리드 등록
    if (this.isNewArchEnabled && this.newArchServices.scene) {
      this.newArchServices.scene.registerSystemObject(this.gridHelper, 'grid');
    }
    
    console.log('📏 Grid initialized');
  }

  /**
   * 마우스 핸들러 설정 (하이브리드 모드)
   */
  setupMouseHandlers() {
    // 마우스 다운
    this.inputManager.onMouseDown((event) => {
      this.isMouseDown = true;
      this.mousePosition.set(event.clientX, event.clientY);
      
      // 새 아키텍처 이벤트 발행
      if (this.isNewArchEnabled) {
        eventBus.emit(EventTypes.MOUSE_DOWN, { 
          position: this.mousePosition.clone(),
          button: event.button
        });
      }
    });

    // 마우스 업
    this.inputManager.onMouseUp((event) => {
      if (this.isMouseDown) {
        // 클릭 감지 (마우스가 거의 움직이지 않았을 때)
        const deltaX = Math.abs(event.clientX - this.mousePosition.x);
        const deltaY = Math.abs(event.clientY - this.mousePosition.y);
        
        if (deltaX < 5 && deltaY < 5) {
          this.handleMouseClick(event);
        }
      }
      
      this.isMouseDown = false;
      this.isPanning = false;
      this.isOrbiting = false;
      this.isDragSelecting = false;
      
      // 새 아키텍처 이벤트 발행
      if (this.isNewArchEnabled) {
        eventBus.emit(EventTypes.MOUSE_UP, { 
          position: { x: event.clientX, y: event.clientY },
          button: event.button
        });
      }
    });

    // 마우스 이동
    this.inputManager.onMouseMove((event) => {
      if (this.isMouseDown) {
        const deltaX = event.clientX - this.mousePosition.x;
        const deltaY = event.clientY - this.mousePosition.y;
        
        if (!this.isPanning && !this.isOrbiting && !this.isDragSelecting) {
          // 드래그 모드 결정
          if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
            this.isPanning = true;
          } else if (event.button === 2 || (event.button === 0 && event.altKey)) {
            this.isOrbiting = true;
          }
        }
        
        // 카메라 컨트롤
        if (this.isPanning) {
          this.cameraController.pan(deltaX, deltaY);
        } else if (this.isOrbiting) {
          this.cameraController.orbit(deltaX, deltaY);
        }
        
        this.mousePosition.set(event.clientX, event.clientY);
      }
    });

    // 마우스 휠
    this.inputManager.onMouseWheel((event) => {
      this.cameraController.zoom(event.deltaY);
      
      // 새 아키텍처 이벤트
      if (this.isNewArchEnabled) {
        eventBus.emit(EventTypes.CAMERA_CHANGED, {
          position: this.cameraController.camera.position.clone(),
          target: this.cameraController.getTarget()
        });
      }
    });
  }

  /**
   * 마우스 클릭 처리 (하이브리드 모드)
   */
  handleMouseClick(event) {
    if (event.button === 0) { // 좌클릭
      const selectedObject = this.objectSelector.selectObject(event);
      
      // 새 아키텍처로 선택 이벤트 발행
      if (this.isNewArchEnabled && selectedObject) {
        this.commandManager.execute('selectObject', { object: selectedObject });
      }
    }
  }

  /**
   * 뷰포트 액션 설정
   */
  setupViewportActions() {
    // 포커스 액션 (F키)
    this.keyboardController.addAction('KeyF', () => {
      const selectedObject = this.objectSelector.getSelectedObject();
      if (selectedObject) {
        this.cameraController.focusOnObject(selectedObject);
        
        // 새 아키텍처 이벤트
        if (this.isNewArchEnabled) {
          eventBus.emit(EventTypes.CAMERA_FOCUSED, { object: selectedObject });
        }
      }
    });

    // 뷰 리셋 (Home)
    this.keyboardController.addAction('Home', () => {
      this.cameraController.resetView();
      
      if (this.isNewArchEnabled) {
        eventBus.emit(EventTypes.CAMERA_RESET, {});
      }
    });
  }

  /**
   * 업데이트 (매 프레임 호출)
   */
  update() {
    if (this.cameraController) {
      this.cameraController.update();
    }
    
    if (this.transformManager) {
      this.transformManager.update();
    }
    
    if (this.objectSelector) {
      this.objectSelector.update();
    }
  }

  /**
   * 윈도우 리사이즈 처리
   */
  onWindowResize() {
    if (this.cameraController) {
      this.cameraController.onWindowResize();
    }
  }

  /**
   * 리소스 정리
   */
  dispose() {
    if (this.inputManager) {
      this.inputManager.dispose();
    }
    
    if (this.cameraController) {
      this.cameraController.dispose();
    }
    
    if (this.objectSelector) {
      this.objectSelector.dispose();
    }
    
    if (this.transformManager) {
      this.transformManager.dispose();
    }
    
    // 그리드 제거
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
    }
    
    // 새 아키텍처 이벤트 리스너 정리
    if (this.isNewArchEnabled) {
      eventBus.off(EventTypes.OBJECT_SELECTED);
      eventBus.off(EventTypes.TRANSFORM_MODE_CHANGED);
    }
    
    console.log('🧹 EditorControls disposed');
  }

  // 호환성을 위한 기존 메서드들
  getSelectedObject() {
    return this.objectSelector ? this.objectSelector.getSelectedObject() : null;
  }

  setTransformMode(mode) {
    if (this.isNewArchEnabled) {
      this.commandManager.execute('setTransformMode', { mode });
    } else if (this.transformManager) {
      this.transformManager.setMode(mode);
    }
  }

  getTransformMode() {
    return this.transformManager ? this.transformManager.getMode() : 'translate';
  }

  showGrid(visible = true) {
    if (this.gridHelper) {
      this.gridHelper.visible = visible;
      
      if (this.isNewArchEnabled) {
        eventBus.emit(EventTypes.GRID_VISIBILITY_CHANGED, { visible });
      }
    }
  }
}

// 기존 클래스와의 호환성을 위한 alias
export const EditorControls = EditorControlsModern;
