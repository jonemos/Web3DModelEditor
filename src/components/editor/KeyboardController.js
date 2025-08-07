/**
 * KeyboardController - 키보드 단축키 전담 클래스
 * InputManager와 연동하여 체계적인 키보드 제어 제공
 */
export class KeyboardController {
  constructor(inputManager) {
    this.inputManager = inputManager;
    
    // 키보드 액션 카테고리
    this.actions = {
      transform: new Map(),
      selection: new Map(),
      viewport: new Map(),
      object: new Map(),
      system: new Map()
    };

    // 기본 키 매핑 설정
    this.setupDefaultKeyMappings();
    
    // InputManager에 핸들러 등록
    this.registerInputHandlers();

    console.log('KeyboardController initialized');
  }

  /**
   * 기본 키 매핑 설정
   */
  setupDefaultKeyMappings() {
    // Transform 관련 키
    this.actions.transform.set('KeyW', {
      name: 'Move Mode',
      description: '이동 모드',
      action: null, // 나중에 등록됨
      category: 'transform'
    });

    this.actions.transform.set('KeyE', {
      name: 'Rotate Mode',
      description: '회전 모드',
      action: null,
      category: 'transform'
    });

    this.actions.transform.set('KeyR', {
      name: 'Scale Mode',
      description: '크기 모드',
      action: null,
      category: 'transform'
    });

    this.actions.transform.set('KeyQ', {
      name: 'Toggle Space',
      description: '좌표계 전환',
      action: null,
      category: 'transform'
    });

    this.actions.transform.set('KeyX', {
      name: 'Toggle Snap',
      description: '그리드 스냅 토글',
      action: null,
      category: 'transform'
    });

    this.actions.transform.set('KeyV', {
      name: 'Toggle Magnet',
      description: '자석 기능 토글',
      action: null,
      category: 'transform'
    });

    this.actions.transform.set('KeyC', {
      name: 'Toggle Magnet Rays',
      description: '자석 레이 표시',
      action: null,
      category: 'transform'
    });

    // 선택 관련 키
    this.actions.selection.set('Escape', {
      name: 'Deselect All',
      description: '모든 선택 해제',
      action: null,
      category: 'selection'
    });

    this.actions.selection.set('KeyA', {
      name: 'Select All',
      description: '전체 선택',
      action: null,
      category: 'selection',
      requiresCtrl: true
    });

    // 오브젝트 관련 키
    this.actions.object.set('Delete', {
      name: 'Delete Objects',
      description: '선택된 오브젝트 삭제',
      action: null,
      category: 'object'
    });

    this.actions.object.set('Backspace', {
      name: 'Delete Objects',
      description: '선택된 오브젝트 삭제',
      action: null,
      category: 'object'
    });

    this.actions.object.set('KeyD', {
      name: 'Duplicate Objects',
      description: '오브젝트 복제',
      action: null,
      category: 'object',
      requiresCtrl: true
    });

    this.actions.object.set('KeyG', {
      name: 'Group Objects',
      description: '오브젝트 그룹화',
      action: null,
      category: 'object',
      requiresCtrl: true
    });

    // 뷰포트 관련 키
    this.actions.viewport.set('KeyF', {
      name: 'Focus on Object',
      description: '선택된 오브젝트로 포커스',
      action: null,
      category: 'viewport'
    });

    this.actions.viewport.set('Numpad5', {
      name: 'Toggle Projection',
      description: '투영 모드 전환',
      action: null,
      category: 'viewport'
    });

    this.actions.viewport.set('Numpad1', {
      name: 'Front View',
      description: '정면 뷰',
      action: null,
      category: 'viewport'
    });

    this.actions.viewport.set('Numpad3', {
      name: 'Side View',
      description: '측면 뷰',
      action: null,
      category: 'viewport'
    });

    this.actions.viewport.set('Numpad7', {
      name: 'Top View',
      description: '상단 뷰',
      action: null,
      category: 'viewport'
    });

    this.actions.viewport.set('Numpad0', {
      name: 'Reset Camera',
      description: '카메라 리셋',
      action: null,
      category: 'viewport'
    });

    // 시스템 관련 키
    this.actions.system.set('KeyZ', {
      name: 'Undo',
      description: '실행 취소',
      action: null,
      category: 'system',
      requiresCtrl: true
    });

    this.actions.system.set('KeyS', {
      name: 'Save',
      description: '저장',
      action: null,
      category: 'system',
      requiresCtrl: true
    });
  }

  /**
   * InputManager에 핸들러 등록
   */
  registerInputHandlers() {
    // 기본 키보드 핸들러 등록
    this.inputManager.registerKeyHandler('default', this.handleKeyInput.bind(this));
  }

  /**
   * 통합 키 입력 처리
   */
  handleKeyInput(keyInfo) {
    const { code, ctrl, shift, originalEvent } = keyInfo;
    
    // Ctrl 조합키 처리
    if (ctrl) {
      this.handleCtrlKeyPress(keyInfo);
    } else {
      this.handleKeyPress(keyInfo);
    }
  }

  /**
   * 키 입력 처리
   */
  handleKeyPress(keyInfo) {
    const { code, ctrl, shift, originalEvent } = keyInfo;
    
    // Ctrl 조합키는 별도 처리
    if (ctrl) return;

    // 해당 키에 대한 액션 찾기
    const action = this.findAction(code);
    if (action && action.action && !action.requiresCtrl) {
      originalEvent.preventDefault();
      this.executeAction(action, keyInfo);
    }
  }

  /**
   * Ctrl 조합키 처리
   */
  handleCtrlKeyPress(keyInfo) {
    const { code, shift, originalEvent } = keyInfo;
    
    // 해당 키에 대한 액션 찾기
    const action = this.findAction(code);
    if (action && action.action && action.requiresCtrl) {
      originalEvent.preventDefault();
      
      // Shift 조합 처리 (예: Ctrl+Shift+G = 그룹 해제)
      if (shift && code === 'KeyG') {
        this.executeSpecialAction('ungroupObjects', keyInfo);
      } else if (shift && code === 'KeyZ') {
        this.executeSpecialAction('redo', keyInfo);
      } else {
        this.executeAction(action, keyInfo);
      }
    }
  }

  /**
   * 액션 찾기
   */
  findAction(keyCode) {
    for (const [category, actions] of Object.entries(this.actions)) {
      if (actions.has(keyCode)) {
        return actions.get(keyCode);
      }
    }
    return null;
  }

  /**
   * 액션 실행
   */
  executeAction(action, keyInfo) {
    if (typeof action.action === 'function') {
      try {
        action.action(keyInfo);
        console.log(`Executed: ${action.name}`);
      } catch (error) {
        console.error(`Error executing action ${action.name}:`, error);
      }
    }
  }

  /**
   * 특수 액션 실행
   */
  executeSpecialAction(actionName, keyInfo) {
    const specialActions = {
      ungroupObjects: this.actions.object.get('KeyG')?.ungroupAction,
      redo: this.actions.system.get('KeyZ')?.redoAction
    };

    const action = specialActions[actionName];
    if (typeof action === 'function') {
      try {
        action(keyInfo);
        console.log(`Executed special action: ${actionName}`);
      } catch (error) {
        console.error(`Error executing special action ${actionName}:`, error);
      }
    }
  }

  // ======================
  // 공개 API - 액션 등록
  // ======================

  /**
   * Transform 액션 등록
   */
  registerTransformActions(actions) {
    if (actions.setMode) {
      this.actions.transform.get('KeyW').action = () => actions.setMode('translate');
      this.actions.transform.get('KeyE').action = () => actions.setMode('rotate');
      this.actions.transform.get('KeyR').action = () => actions.setMode('scale');
    }
    
    if (actions.toggleSpace) {
      this.actions.transform.get('KeyQ').action = actions.toggleSpace;
    }
    
    if (actions.toggleSnap) {
      this.actions.transform.get('KeyX').action = actions.toggleSnap;
    }
    
    if (actions.toggleMagnet) {
      this.actions.transform.get('KeyV').action = actions.toggleMagnet;
    }
    
    if (actions.toggleMagnetRays) {
      this.actions.transform.get('KeyC').action = actions.toggleMagnetRays;
    }
  }

  /**
   * 선택 액션 등록
   */
  registerSelectionActions(actions) {
    if (actions.deselectAll) {
      this.actions.selection.get('Escape').action = actions.deselectAll;
    }
    
    if (actions.selectAll) {
      this.actions.selection.get('KeyA').action = actions.selectAll;
    }
  }

  /**
   * 오브젝트 액션 등록
   */
  registerObjectActions(actions) {
    if (actions.deleteSelected) {
      this.actions.object.get('Delete').action = actions.deleteSelected;
      this.actions.object.get('Backspace').action = actions.deleteSelected;
    }
    
    if (actions.duplicateSelected) {
      this.actions.object.get('KeyD').action = actions.duplicateSelected;
    }
    
    if (actions.groupSelected) {
      this.actions.object.get('KeyG').action = actions.groupSelected;
    }
    
    if (actions.ungroupSelected) {
      this.actions.object.get('KeyG').ungroupAction = actions.ungroupSelected;
    }
  }

  /**
   * 뷰포트 액션 등록
   */
  registerViewportActions(actions) {
    if (actions.focusOnSelected) {
      this.actions.viewport.get('KeyF').action = actions.focusOnSelected;
    }
    
    if (actions.toggleProjection) {
      this.actions.viewport.get('Numpad5').action = actions.toggleProjection;
    }
    
    if (actions.setView) {
      this.actions.viewport.get('Numpad1').action = () => actions.setView('front');
      this.actions.viewport.get('Numpad3').action = () => actions.setView('side');
      this.actions.viewport.get('Numpad7').action = () => actions.setView('top');
    }
    
    if (actions.resetCamera) {
      this.actions.viewport.get('Numpad0').action = actions.resetCamera;
    }
  }

  /**
   * 시스템 액션 등록
   */
  registerSystemActions(actions) {
    if (actions.undo) {
      this.actions.system.get('KeyZ').action = actions.undo;
    }
    
    if (actions.redo) {
      this.actions.system.get('KeyZ').redoAction = actions.redo;
    }
    
    if (actions.save) {
      this.actions.system.get('KeyS').action = actions.save;
    }
  }

  /**
   * 커스텀 키 등록
   */
  registerCustomKey(keyCode, actionName, description, action, category = 'custom', requiresCtrl = false) {
    if (!this.actions[category]) {
      this.actions[category] = new Map();
    }

    this.actions[category].set(keyCode, {
      name: actionName,
      description: description,
      action: action,
      category: category,
      requiresCtrl: requiresCtrl
    });

    console.log(`Registered custom key: ${keyCode} -> ${actionName}`);
  }

  /**
   * 키 매핑 제거
   */
  unregisterKey(keyCode, category = null) {
    if (category && this.actions[category]) {
      this.actions[category].delete(keyCode);
    } else {
      // 모든 카테고리에서 찾아서 제거
      for (const actions of Object.values(this.actions)) {
        if (actions.has(keyCode)) {
          actions.delete(keyCode);
          break;
        }
      }
    }
  }

  /**
   * 키 매핑 정보 조회
   */
  getKeyMappings() {
    const mappings = {};
    
    for (const [category, actions] of Object.entries(this.actions)) {
      mappings[category] = {};
      
      for (const [keyCode, action] of actions.entries()) {
        mappings[category][keyCode] = {
          name: action.name,
          description: action.description,
          requiresCtrl: action.requiresCtrl || false
        };
      }
    }
    
    return mappings;
  }

  /**
   * 키 충돌 확인
   */
  checkKeyConflicts() {
    const allKeys = new Map();
    const conflicts = [];

    for (const [category, actions] of Object.entries(this.actions)) {
      for (const [keyCode, action] of actions.entries()) {
        const keySignature = `${keyCode}${action.requiresCtrl ? '+Ctrl' : ''}`;
        
        if (allKeys.has(keySignature)) {
          conflicts.push({
            key: keySignature,
            conflicting: [allKeys.get(keySignature), `${category}:${action.name}`]
          });
        } else {
          allKeys.set(keySignature, `${category}:${action.name}`);
        }
      }
    }

    if (conflicts.length > 0) {
      console.warn('Key conflicts detected:', conflicts);
    }

    return conflicts;
  }

  /**
   * 키 매핑 도움말 생성
   */
  generateHelpText() {
    let helpText = 'Keyboard Shortcuts:\n\n';
    
    for (const [category, actions] of Object.entries(this.actions)) {
      if (actions.size === 0) continue;
      
      helpText += `${category.toUpperCase()}:\n`;
      
      for (const [keyCode, action] of actions.entries()) {
        const keyName = this.formatKeyName(keyCode, action.requiresCtrl);
        helpText += `  ${keyName.padEnd(20)} - ${action.description}\n`;
      }
      
      helpText += '\n';
    }
    
    return helpText;
  }

  /**
   * 키 이름 포맷팅
   */
  formatKeyName(keyCode, requiresCtrl = false) {
    const keyMap = {
      'KeyW': 'W', 'KeyE': 'E', 'KeyR': 'R', 'KeyQ': 'Q',
      'KeyX': 'X', 'KeyV': 'V', 'KeyC': 'C', 'KeyA': 'A',
      'KeyD': 'D', 'KeyG': 'G', 'KeyF': 'F', 'KeyZ': 'Z',
      'KeyS': 'S', 'Escape': 'ESC', 'Delete': 'DEL',
      'Backspace': 'BACKSPACE', 'Numpad1': 'NUM1',
      'Numpad3': 'NUM3', 'Numpad5': 'NUM5', 'Numpad7': 'NUM7',
      'Numpad0': 'NUM0'
    };

    const keyName = keyMap[keyCode] || keyCode;
    return requiresCtrl ? `Ctrl+${keyName}` : keyName;
  }

  /**
   * 입력 활성화/비활성화
   */
  setEnabled(enabled) {
    this.inputManager.setEnabled(enabled);
  }

  /**
   * 정리
   */
  dispose() {
    // 모든 액션 제거
    for (const actions of Object.values(this.actions)) {
      actions.clear();
    }

    console.log('KeyboardController disposed');
  }
}

export default KeyboardController;
