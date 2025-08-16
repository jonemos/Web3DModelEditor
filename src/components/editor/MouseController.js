/**
 * MouseController - 마우스 입력 전담 클래스
 * InputManager와 연동하여 체계적인 마우스 제어 제공
 */
export class MouseController {
  constructor(inputManager) {
    this.inputManager = inputManager;
    
    // 외부 참조
    this.transformControls = null;
    this.objectSelector = null;
    
    // 마우스 상태 관리
    this.state = {
      isDragging: false,
      dragButton: -1,
      dragThreshold: 5, // 픽셀 단위
      isSelecting: false,
      isPanning: false,
      isOrbiting: false,
      isGizmoInteracting: false // 기즈모 상호작용 상태
    };

    // 마우스 액션 핸들러들
    this.handlers = {
      leftClick: null,
      rightClick: null,
      middleClick: null,
      leftDrag: null,
      rightDrag: null,
      middleDrag: null,
      dragSelect: null,
      wheel: null,
      hover: null
    };

    // 드래그 선택 박스 관련
    this.selectionBox = {
      element: null,
      startX: 0,
      startY: 0,
      isVisible: false
    };

    // InputManager에 핸들러 등록
    this.registerInputHandlers();

    
  }

  /**
   * InputManager에 핸들러 등록
   */
  registerInputHandlers() {
    this.inputManager.registerMouseHandler('mousedown', this.handleMouseDown.bind(this));
    this.inputManager.registerMouseHandler('mousemove', this.handleMouseMove.bind(this));
    this.inputManager.registerMouseHandler('mouseup', this.handleMouseUp.bind(this));
    this.inputManager.registerWheelHandler(this.handleWheel.bind(this));
  }

  /**
   * 외부 참조 설정
   */
  setTransformControls(transformControls) {
    this.transformControls = transformControls;
    this.setupGizmoEventListeners();
  }

  setObjectSelector(objectSelector) {
    this.objectSelector = objectSelector;
    if (objectSelector && objectSelector.transformControls) {
      this.setTransformControls(objectSelector.transformControls);
    }
  }

  /**
   * 기즈모 이벤트 리스너 설정
   */
  setupGizmoEventListeners() {
    if (!this.transformControls) return;

    this.transformControls.addEventListener('dragging-changed', (event) => {
  this.state.isGizmoInteracting = event.value;
    });
  }

  /**
   * 기즈모와 상호작용 중인지 확인
   */
  isGizmoInteracting() {
    return this.state.isGizmoInteracting || 
           (this.transformControls && this.transformControls.dragging);
  }

  /**
   * 마우스 다운 처리
   */
  handleMouseDown(mouseInfo) {
    const { button, position, ctrl, shift, alt, originalEvent } = mouseInfo;
    
    // 기즈모와 상호작용 중이면 일반 마우스 이벤트 무시
    if (this.isGizmoInteracting()) {
      
      return;
    }
    
    this.state.dragButton = button;
    
    switch (button) {
      case 0: // 왼쪽 버튼
        this.handleLeftMouseDown(mouseInfo);
        break;
      case 1: // 중간 버튼 (휠)
        this.handleMiddleMouseDown(mouseInfo);
        break;
      case 2: // 오른쪽 버튼
        this.handleRightMouseDown(mouseInfo);
        break;
    }
  }

  /**
   * 왼쪽 마우스 버튼 다운
   */
  handleLeftMouseDown(mouseInfo) {
    const { position, ctrl, shift } = mouseInfo;
    
    // 다중 선택 모드 확인
    const isMultiSelect = ctrl || shift;
    
    // 드래그 선택 준비
    this.state.isSelecting = true;
    this.selectionBox.startX = position.screenX;
    this.selectionBox.startY = position.screenY;
    
    // 왼쪽 클릭 핸들러 실행
    if (this.handlers.leftClick) {
      this.handlers.leftClick({
        position,
        isMultiSelect,
        originalEvent: mouseInfo.originalEvent
      });
    }
  }

  /**
   * 중간 마우스 버튼 다운
   */
  handleMiddleMouseDown(mouseInfo) {
    const { alt, originalEvent } = mouseInfo;
    
    originalEvent.preventDefault();
    
    if (alt) {
      // Alt + 중간 버튼: 궤도 회전
      this.state.isOrbiting = true;
    } else {
      // 중간 버튼: 팬
      this.state.isPanning = true;
    }
    
    if (this.handlers.middleClick) {
      this.handlers.middleClick({
        isOrbiting: this.state.isOrbiting,
        isPanning: this.state.isPanning,
        originalEvent
      });
    }
  }

  /**
   * 오른쪽 마우스 버튼 다운
   */
  handleRightMouseDown(mouseInfo) {
    if (this.handlers.rightClick) {
      this.handlers.rightClick(mouseInfo);
    }
  }

  /**
   * 마우스 이동 처리
   */
  handleMouseMove(mouseInfo) {
    const { position, isDown, button, delta } = mouseInfo;
    
    // 기즈모와 상호작용 중이면 호버만 허용하고 드래그는 무시
    if (this.isGizmoInteracting() && isDown) {
      return;
    }
    
    // 호버 처리
    if (!isDown && this.handlers.hover) {
      this.handlers.hover({ position });
    }
    
    if (!isDown) return;
    
    // 드래그 상태 확인
    if (!this.state.isDragging) {
      const dragDistance = this.calculateDragDistance(mouseInfo);
      if (dragDistance > this.state.dragThreshold) {
        this.state.isDragging = true;
        this.onDragStart(mouseInfo);
      }
    }
    
    if (this.state.isDragging) {
      this.handleDragMove(mouseInfo);
    }
    
    // 드래그 선택 박스 업데이트
    if (this.state.isSelecting && button === 0) {
      this.updateSelectionBox(mouseInfo);
    }
  }

  /**
   * 드래그 시작 처리
   */
  onDragStart(mouseInfo) {
    const { button } = mouseInfo;
    
    switch (button) {
      case 0: // 왼쪽 버튼 드래그
        break;
      case 1: // 중간 버튼 드래그
        break;
      case 2: // 오른쪽 버튼 드래그
        break;
    }
  }

  /**
   * 드래그 중 처리
   */
  handleDragMove(mouseInfo) {
    const { button, delta } = mouseInfo;
    
    switch (button) {
      case 0: // 왼쪽 드래그
        if (this.handlers.leftDrag) {
          this.handlers.leftDrag({ delta, mouseInfo });
        }
        break;
      case 1: // 중간 드래그
        if (this.state.isPanning && this.handlers.middleDrag) {
          this.handlers.middleDrag({ 
            type: 'pan', 
            delta, 
            mouseInfo 
          });
        } else if (this.state.isOrbiting && this.handlers.middleDrag) {
          this.handlers.middleDrag({ 
            type: 'orbit', 
            delta, 
            mouseInfo 
          });
        }
        break;
      case 2: // 오른쪽 드래그
        if (this.handlers.rightDrag) {
          this.handlers.rightDrag({ delta, mouseInfo });
        }
        break;
    }
  }

  /**
   * 마우스 업 처리
   */
  handleMouseUp(mouseInfo) {
    const { button, position } = mouseInfo;
    
    // 기즈모와 상호작용 중이었다면 상태만 리셋하고 다른 처리는 하지 않음
    if (this.isGizmoInteracting()) {
      this.resetMouseState();
      return;
    }
    
    // 드래그 선택 완료 처리
    if (this.state.isSelecting && button === 0) {
      this.finishDragSelection(mouseInfo);
    }
    
    // 클릭 vs 드래그 판별
    if (!this.state.isDragging) {
      this.handleClick(mouseInfo);
    } else {
      this.handleDragEnd(mouseInfo);
    }
    
    // 상태 리셋
    this.resetMouseState();
  }

  /**
   * 클릭 처리 (드래그가 아닌 경우)
   */
  handleClick(mouseInfo) {
    // 클릭 처리는 이미 mousedown에서 처리됨
  }

  /**
   * 드래그 종료 처리
   */
  handleDragEnd(mouseInfo) {
    // 드래그 종료 후 추가 처리가 필요한 경우
    if (this.state.isPanning && this.handlers.dragEnd) {
      this.handlers.dragEnd({ type: 'pan', mouseInfo });
    }
  }

  /**
   * 휠 처리
   */
  handleWheel(wheelInfo) {
    if (this.handlers.wheel) {
      this.handlers.wheel(wheelInfo);
    }
  }

  /**
   * 드래그 거리 계산
   */
  calculateDragDistance(mouseInfo) {
    const { position, dragStart } = mouseInfo;
    const dx = position.screenX - dragStart.screenX;
    const dy = position.screenY - dragStart.screenY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 드래그 선택 박스 업데이트
   */
  updateSelectionBox(mouseInfo) {
    const { position } = mouseInfo;
    const currentX = position.screenX;
    const currentY = position.screenY;
    
    const left = Math.min(this.selectionBox.startX, currentX);
    const top = Math.min(this.selectionBox.startY, currentY);
    const width = Math.abs(currentX - this.selectionBox.startX);
    const height = Math.abs(currentY - this.selectionBox.startY);
    
    // 선택 박스가 충분히 클 때만 표시
    if (width > this.state.dragThreshold || height > this.state.dragThreshold) {
      this.showSelectionBox(left, top, width, height);
      
      if (this.handlers.dragSelect) {
        this.handlers.dragSelect({
          startX: this.selectionBox.startX,
          startY: this.selectionBox.startY,
          currentX,
          currentY,
          left,
          top,
          width,
          height
        });
      }
    }
  }

  /**
   * 드래그 선택 완료
   */
  finishDragSelection(mouseInfo) {
    const { position, ctrl, shift } = mouseInfo;
    
    const dragDistance = this.calculateDragDistance(mouseInfo);
    const isMultiSelect = ctrl || shift;
    
    this.hideSelectionBox();
    
    if (dragDistance < this.state.dragThreshold) {
      // 짧은 드래그는 클릭으로 처리
      return;
    }
    
    // 드래그 선택 완료 핸들러 실행
    if (this.handlers.dragSelectEnd) {
      this.handlers.dragSelectEnd({
        startX: this.selectionBox.startX,
        startY: this.selectionBox.startY,
        endX: position.screenX,
        endY: position.screenY,
        isMultiSelect
      });
    }
  }

  /**
   * 선택 박스 표시
   */
  showSelectionBox(left, top, width, height) {
    if (!this.selectionBox.element) {
      this.createSelectionBoxElement();
    }
    
    const box = this.selectionBox.element;
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    box.style.display = 'block';
    
    this.selectionBox.isVisible = true;
  }

  /**
   * 선택 박스 숨기기
   */
  hideSelectionBox() {
    if (this.selectionBox.element) {
      this.selectionBox.element.style.display = 'none';
    }
    this.selectionBox.isVisible = false;
  }

  /**
   * 선택 박스 DOM 요소 생성
   */
  createSelectionBoxElement() {
    const box = document.createElement('div');
    box.style.position = 'fixed';
    box.style.border = '1px dashed #007acc';
    box.style.backgroundColor = 'rgba(0, 122, 204, 0.1)';
    box.style.pointerEvents = 'none';
    box.style.zIndex = '10000';
    box.style.display = 'none';
    
    document.body.appendChild(box);
    this.selectionBox.element = box;
  }

  /**
   * 마우스 상태 리셋
   */
  resetMouseState() {
    this.state.isDragging = false;
    this.state.dragButton = -1;
    this.state.isSelecting = false;
    this.state.isPanning = false;
    this.state.isOrbiting = false;
  }

  // ======================
  // 공개 API - 핸들러 등록
  // ======================

  /**
   * 왼쪽 클릭 핸들러 등록
   */
  onLeftClick(handler) {
    this.handlers.leftClick = handler;
  }

  /**
   * 오른쪽 클릭 핸들러 등록
   */
  onRightClick(handler) {
    this.handlers.rightClick = handler;
  }

  /**
   * 중간 클릭 핸들러 등록
   */
  onMiddleClick(handler) {
    this.handlers.middleClick = handler;
  }

  /**
   * 왼쪽 드래그 핸들러 등록
   */
  onLeftDrag(handler) {
    this.handlers.leftDrag = handler;
  }

  /**
   * 중간 드래그 핸들러 등록
   */
  onMiddleDrag(handler) {
    this.handlers.middleDrag = handler;
  }

  /**
   * 오른쪽 드래그 핸들러 등록
   */
  onRightDrag(handler) {
    this.handlers.rightDrag = handler;
  }

  /**
   * 드래그 선택 핸들러 등록
   */
  onDragSelect(handler) {
    this.handlers.dragSelect = handler;
  }

  /**
   * 드래그 선택 완료 핸들러 등록
   */
  onDragSelectEnd(handler) {
    this.handlers.dragSelectEnd = handler;
  }

  /**
   * 휠 핸들러 등록
   */
  onWheel(handler) {
    this.handlers.wheel = handler;
  }

  /**
   * 호버 핸들러 등록
   */
  onHover(handler) {
    this.handlers.hover = handler;
  }

  /**
   * 드래그 종료 핸들러 등록
   */
  onDragEnd(handler) {
    this.handlers.dragEnd = handler;
  }

  /**
   * 드래그 임계값 설정
   */
  setDragThreshold(threshold) {
    this.state.dragThreshold = Math.max(1, threshold);
  }

  /**
   * 마우스 상태 조회
   */
  getMouseState() {
    return { ...this.state };
  }

  /**
   * 선택 박스 상태 조회
   */
  getSelectionBoxState() {
    return { ...this.selectionBox };
  }

  /**
   * 핸들러 제거
   */
  removeHandler(handlerName) {
    if (this.handlers.hasOwnProperty(handlerName)) {
      this.handlers[handlerName] = null;
    }
  }

  /**
   * 모든 핸들러 제거
   */
  removeAllHandlers() {
    for (const key in this.handlers) {
      this.handlers[key] = null;
    }
  }

  /**
   * 정리
   */
  dispose() {
    // 선택 박스 DOM 요소 제거
    if (this.selectionBox.element) {
      document.body.removeChild(this.selectionBox.element);
      this.selectionBox.element = null;
    }

    // 모든 핸들러 제거
    this.removeAllHandlers();

    // 상태 리셋
    this.resetMouseState();

    // 외부 참조 정리
    this.transformControls = null;
    this.objectSelector = null;

    
  }
}

export default MouseController;
