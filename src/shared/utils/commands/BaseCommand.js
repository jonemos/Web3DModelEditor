/**
 * 기본 커맨드 클래스
 * 모든 커맨드는 이 클래스를 상속받아야 합니다.
 */
export class BaseCommand {
  constructor(description = 'Unknown Command') {
    this.description = description;
    this.timestamp = Date.now();
  }

  /**
   * 커맨드를 실행합니다.
   * 하위 클래스에서 반드시 구현해야 합니다.
   */
  execute() {
    throw new Error('execute() method must be implemented');
  }

  /**
   * 커맨드를 되돌립니다.
   * 하위 클래스에서 반드시 구현해야 합니다.
   */
  undo() {
    throw new Error('undo() method must be implemented');
  }

  /**
   * 커맨드를 다시 실행합니다.
   * 기본적으로 execute()와 동일하지만, 필요시 오버라이드 가능합니다.
   */
  redo() {
    return this.execute();
  }

  /**
   * 커맨드가 병합 가능한지 확인합니다.
   * @param {BaseCommand} otherCommand 
   * @returns {boolean}
   */
  canMergeWith(otherCommand) {
    return false;
  }

  /**
   * 다른 커맨드와 병합합니다.
   * @param {BaseCommand} otherCommand 
   * @returns {BaseCommand} 병합된 새 커맨드
   */
  mergeWith(otherCommand) {
    throw new Error('mergeWith() method must be implemented when canMergeWith returns true');
  }

  /**
   * 커맨드의 설명을 반환합니다.
   */
  getDescription() {
    return this.description;
  }
}
