/**
 * InputManager - 키보드 및 마우스 입력 전담 클래스
 * 모든 입력 이벤트를 중앙에서 관리하고 적절한 핸들러로 라우팅
 */
export class InputManager {
  constructor() {
    // 입력 상태
    this.isEnabled = true;
    this.pressedKeys = new Set();
    this.mouseState = {
      isDown: false,
      button: -1,
      position: { x: 0, y: 0 },
      previousPosition: { x: 0, y: 0 },
      dragStart: { x: 0, y: 0 }
    };

    // 콜백 핸들러들
    this.handlers = {
      keyboard: new Map(),
      mouse: new Map(),
      wheel: null,
      contextMenu: null,
      resize: null
    };

    // 키보드 조합키 상태
    this.modifierKeys = {
      ctrl: false,
      shift: false,
      alt: false,
      meta: false
    };

    // 이벤트 리스너 바인딩
    this.boundHandlers = {
      keyDown: this.handleKeyDown.bind(this),
      keyUp: this.handleKeyUp.bind(this),
      mouseDown: this.handleMouseDown.bind(this),
      mouseMove: this.handleMouseMove.bind(this),
      mouseUp: this.handleMouseUp.bind(this),
      wheel: this.handleWheel.bind(this),
      contextMenu: this.handleContextMenu.bind(this),
      resize: this.handleResize.bind(this)
    };

  this.setupEventListeners();
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 키보드 이벤트
    document.addEventListener('keydown', this.boundHandlers.keyDown);
    document.addEventListener('keyup', this.boundHandlers.keyUp);

    // 마우스 이벤트는 나중에 canvas가 지정되면 설정
    // setupMouseEvents(canvas) 메서드를 통해 설정

    // 윈도우 이벤트
    window.addEventListener('resize', this.boundHandlers.resize);
  }

  /**
   * 마우스 이벤트 설정 (canvas 지정 후 호출)
   */
  setupMouseEvents(canvas) {
    this.canvas = canvas;
    
    // 마우스 이벤트
    canvas.addEventListener('mousedown', this.boundHandlers.mouseDown);
    document.addEventListener('mousemove', this.boundHandlers.mouseMove);
    document.addEventListener('mouseup', this.boundHandlers.mouseUp);
    canvas.addEventListener('wheel', this.boundHandlers.wheel);
    canvas.addEventListener('contextmenu', this.boundHandlers.contextMenu);
  }

  /**
   * 키보드 이벤트 핸들러
   */
  handleKeyDown(event) {
    if (!this.isEnabled || this.isInputFieldActive(event.target)) {
      return;
    }

    // 조합키 상태 업데이트
    this.updateModifierKeys(event);
    
    // 키 추가
    this.pressedKeys.add(event.code);

    // 키보드 핸들러 실행
    const keyInfo = {
      code: event.code,
      key: event.key,
      ctrl: this.modifierKeys.ctrl,
      shift: this.modifierKeys.shift,
      alt: this.modifierKeys.alt,
      meta: this.modifierKeys.meta,
      originalEvent: event
    };

    // 조합키 처리
    if (this.modifierKeys.ctrl || this.modifierKeys.meta) {
      this.executeHandler('keyboard', 'ctrl', keyInfo);
    } else {
      // 일반 키 처리
      this.executeHandler('keyboard', event.code, keyInfo);
    }
  }

  /**
   * 키보드 해제 핸들러
   */
  handleKeyUp(event) {
    if (!this.isEnabled) return;

    this.updateModifierKeys(event);
    this.pressedKeys.delete(event.code);

    const keyInfo = {
      code: event.code,
      key: event.key,
      ctrl: this.modifierKeys.ctrl,
      shift: this.modifierKeys.shift,
      alt: this.modifierKeys.alt,
      meta: this.modifierKeys.meta,
      originalEvent: event
    };

    this.executeHandler('keyboard', 'keyup', keyInfo);
  }

  /**
   * 마우스 다운 핸들러
   */
  handleMouseDown(event) {
    if (!this.isEnabled) return;

    this.mouseState.isDown = true;
    this.mouseState.button = event.button;
    this.updateMousePosition(event);
    this.mouseState.previousPosition = { ...this.mouseState.position };
    this.mouseState.dragStart = { ...this.mouseState.position };

    const mouseInfo = {
      button: event.button,
      position: { ...this.mouseState.position },
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey,
      originalEvent: event
    };

    this.executeHandler('mouse', 'mousedown', mouseInfo);
  }

  /**
   * 마우스 이동 핸들러
   */
  handleMouseMove(event) {
    if (!this.isEnabled) return;

    this.mouseState.previousPosition = { ...this.mouseState.position };
    this.updateMousePosition(event);

    const mouseInfo = {
      position: { ...this.mouseState.position },
      previousPosition: { ...this.mouseState.previousPosition },
      dragStart: { ...this.mouseState.dragStart },
      isDown: this.mouseState.isDown,
      button: this.mouseState.button,
      delta: {
        x: this.mouseState.position.x - this.mouseState.previousPosition.x,
        y: this.mouseState.position.y - this.mouseState.previousPosition.y
      },
      originalEvent: event
    };

    this.executeHandler('mouse', 'mousemove', mouseInfo);
  }

  /**
   * 마우스 업 핸들러
   */
  handleMouseUp(event) {
    if (!this.isEnabled) return;

    const mouseInfo = {
      button: event.button,
      position: { ...this.mouseState.position },
      dragStart: { ...this.mouseState.dragStart },
      originalEvent: event
    };

    this.executeHandler('mouse', 'mouseup', mouseInfo);

    this.mouseState.isDown = false;
    this.mouseState.button = -1;
  }

  /**
   * 휠 이벤트 핸들러
   */
  handleWheel(event) {
    if (!this.isEnabled) return;

    event.preventDefault();

    const wheelInfo = {
      delta: event.deltaY,
      position: { ...this.mouseState.position },
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
      originalEvent: event
    };

    if (this.handlers.wheel) {
      this.handlers.wheel(wheelInfo);
    }
  }

  /**
   * 컨텍스트 메뉴 핸들러
   */
  handleContextMenu(event) {
    event.preventDefault();
    
    if (this.handlers.contextMenu) {
      this.handlers.contextMenu(event);
    }
  }

  /**
   * 리사이즈 핸들러
   */
  handleResize(event) {
    if (this.handlers.resize) {
      this.handlers.resize(event);
    }
  }

  /**
   * 마우스 위치 업데이트
   */
  updateMousePosition(event) {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    this.mouseState.position = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
      screenX: event.clientX,
      screenY: event.clientY
    };
  }

  /**
   * 조합키 상태 업데이트
   */
  updateModifierKeys(event) {
    this.modifierKeys.ctrl = event.ctrlKey;
    this.modifierKeys.shift = event.shiftKey;
    this.modifierKeys.alt = event.altKey;
    this.modifierKeys.meta = event.metaKey;
  }

  /**
   * 핸들러 실행
   */
  executeHandler(type, eventKey, data) {
    if (type === 'keyboard') {
      // 키보드 이벤트는 default 핸들러로 전달
      const handler = this.handlers.keyboard.get('default');
      if (handler) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in keyboard handler:`, error);
        }
      }
    } else {
      const handler = this.handlers[type]?.get(eventKey);
      if (handler) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${type} handler for ${eventKey}:`, error);
        }
      }
    }
  }

  /**
   * 입력 필드 활성화 상태 확인
   */
  isInputFieldActive(target) {
    const inputTags = ['INPUT', 'TEXTAREA', 'SELECT'];
    return inputTags.includes(target.tagName) || target.contentEditable === 'true';
  }

  // ======================
  // 공개 API
  // ======================

  /**
   * 키보드 핸들러 등록
   */
  registerKeyHandler(keyCode, handler) {
    if (!this.handlers.keyboard.has(keyCode)) {
      this.handlers.keyboard.set(keyCode, handler);
    } else {
      console.warn(`Key handler for ${keyCode} already exists`);
    }
  }

  /**
   * 마우스 핸들러 등록
   */
  registerMouseHandler(eventType, handler) {
    if (!this.handlers.mouse.has(eventType)) {
      this.handlers.mouse.set(eventType, handler);
    } else {
      console.warn(`Mouse handler for ${eventType} already exists`);
    }
  }

  /**
   * 휠 핸들러 등록
   */
  registerWheelHandler(handler) {
    this.handlers.wheel = handler;
  }

  /**
   * 컨텍스트 메뉴 핸들러 등록
   */
  registerContextMenuHandler(handler) {
    this.handlers.contextMenu = handler;
  }

  /**
   * 리사이즈 핸들러 등록
   */
  registerResizeHandler(handler) {
    this.handlers.resize = handler;
  }

  /**
   * 핸들러 제거
   */
  unregisterHandler(type, eventKey) {
    if (type === 'wheel') {
      this.handlers.wheel = null;
    } else if (type === 'contextMenu') {
      this.handlers.contextMenu = null;
    } else {
      this.handlers[type]?.delete(eventKey);
    }
  }

  /**
   * 모든 핸들러 제거
   */
  clearAllHandlers() {
    this.handlers.keyboard.clear();
    this.handlers.mouse.clear();
    this.handlers.wheel = null;
    this.handlers.contextMenu = null;
  }

  /**
   * 입력 활성화/비활성화
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    
  }

  /**
   * 키가 현재 눌려있는지 확인
   */
  isKeyPressed(keyCode) {
    return this.pressedKeys.has(keyCode);
  }

  /**
   * 조합키 상태 확인
   */
  getModifierKeys() {
    return { ...this.modifierKeys };
  }

  /**
   * 마우스 상태 확인
   */
  getMouseState() {
    return { ...this.mouseState };
  }

  /**
   * 현재 입력 상태 반환
   */
  getInputState() {
    return {
      enabled: this.isEnabled,
      pressedKeys: Array.from(this.pressedKeys),
      modifierKeys: this.getModifierKeys(),
      mouseState: this.getMouseState()
    };
  }

  /**
   * 정리
   */
  dispose() {
    // 키보드 이벤트 리스너 제거
    document.removeEventListener('keydown', this.boundHandlers.keyDown);
    document.removeEventListener('keyup', this.boundHandlers.keyUp);

    // 마우스 이벤트 리스너 제거
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.boundHandlers.mouseDown);
      this.canvas.removeEventListener('wheel', this.boundHandlers.wheel);
      this.canvas.removeEventListener('contextmenu', this.boundHandlers.contextMenu);
    }
    
    document.removeEventListener('mousemove', this.boundHandlers.mouseMove);
    document.removeEventListener('mouseup', this.boundHandlers.mouseUp);

    // 윈도우 이벤트 리스너 제거
    window.removeEventListener('resize', this.boundHandlers.resize);

    // 모든 핸들러 제거
    this.clearAllHandlers();

    // 참조 정리
    this.canvas = null;
    this.boundHandlers = null;
    this.pressedKeys.clear();

    
  }
}

export default InputManager;
