import { BaseCommand } from './BaseCommand.js';

/**
 * 커맨드 히스토리를 관리하는 클래스
 */
export class CommandHistory {
  constructor(maxHistory = 50) {
    this.history = []; // 실행된 커맨드들
    this.currentIndex = -1; // 현재 위치 (-1은 아무것도 실행되지 않은 상태)
    this.maxHistory = maxHistory;
    this.listeners = new Set(); // 상태 변경 리스너들
  }

  /**
   * 커맨드를 실행하고 히스토리에 추가합니다.
   * @param {BaseCommand} command 
   */
  execute(command) {
    if (!(command instanceof BaseCommand)) {
      throw new Error('Command must be an instance of BaseCommand');
    }

    try {
      // 커맨드 실행
      const result = command.execute();

      // 현재 인덱스 이후의 히스토리 제거 (새로운 분기 시작)
      this.history = this.history.slice(0, this.currentIndex + 1);

      // 이전 커맨드와 병합 가능한지 확인
      if (this.history.length > 0) {
        const lastCommand = this.history[this.history.length - 1];
        if (lastCommand.canMergeWith(command)) {
          // 병합된 커맨드로 교체
          this.history[this.history.length - 1] = lastCommand.mergeWith(command);
          this.notifyListeners();
          return result;
        }
      }

      // 새 커맨드 추가
      this.history.push(command);
      this.currentIndex = this.history.length - 1;

      // 히스토리 크기 제한
      if (this.history.length > this.maxHistory) {
        this.history = this.history.slice(-this.maxHistory);
        this.currentIndex = this.history.length - 1;
      }

      this.notifyListeners();
      return result;
    } catch (error) {
      console.error('Command execution failed:', error);
      throw error;
    }
  }

  /**
   * 되돌리기 (Undo)
   */
  undo() {
    if (!this.canUndo()) {
      console.warn('Nothing to undo');
      return false;
    }

    try {
      const command = this.history[this.currentIndex];
      command.undo();
      this.currentIndex--;
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Undo failed:', error);
      throw error;
    }
  }

  /**
   * 다시 실행 (Redo)
   */
  redo() {
    if (!this.canRedo()) {
      console.warn('Nothing to redo');
      return false;
    }

    try {
      this.currentIndex++;
      const command = this.history[this.currentIndex];
      command.redo();
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Redo failed:', error);
      this.currentIndex--; // 실패시 인덱스 복원
      throw error;
    }
  }

  /**
   * 되돌리기가 가능한지 확인
   */
  canUndo() {
    return this.currentIndex >= 0;
  }

  /**
   * 다시 실행이 가능한지 확인
   */
  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * 히스토리 클리어
   */
  clear() {
    this.history = [];
    this.currentIndex = -1;
    this.notifyListeners();
  }

  /**
   * 현재 히스토리 상태 정보 반환
   */
  getState() {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoDescription: this.canUndo() ? this.history[this.currentIndex].getDescription() : null,
      redoDescription: this.canRedo() ? this.history[this.currentIndex + 1].getDescription() : null,
      historyLength: this.history.length,
      currentIndex: this.currentIndex
    };
  }

  /**
   * 히스토리 목록 반환 (디버깅용)
   */
  getHistory() {
    return this.history.map((cmd, index) => ({
      index,
      description: cmd.getDescription(),
      timestamp: cmd.timestamp,
      isCurrent: index === this.currentIndex
    }));
  }

  /**
   * 상태 변경 리스너 추가
   * @param {Function} listener 
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * 상태 변경 리스너 제거
   * @param {Function} listener 
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * 모든 리스너에게 상태 변경 알림
   */
  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }
}
