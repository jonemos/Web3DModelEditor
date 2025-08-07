import { BaseCommand } from './BaseCommand.js';

/**
 * 객체 추가 커맨드
 */
export class AddObjectCommand extends BaseCommand {
  constructor(editorStore, objectData) {
    super(`Add Object: ${objectData.name || 'Unnamed'}`);
    this.editorStore = editorStore;
    this.objectData = { ...objectData }; // 깊은 복사로 데이터 보존
    this.addedObjectId = null;
  }

  execute() {
    // 새로운 ID 생성 (이미 있다면 사용)
    if (!this.addedObjectId) {
      this.addedObjectId = this.objectData.id || Date.now();
      this.objectData.id = this.addedObjectId;
    }

    // 에디터 스토어에 객체 추가
    this.editorStore.getState().addObject(this.objectData);
    
    console.log(`Executed: ${this.description}`, this.objectData);
    return this.addedObjectId;
  }

  undo() {
    if (this.addedObjectId) {
      // 에디터 스토어에서 객체 제거
      this.editorStore.getState().removeObject(this.addedObjectId);
      console.log(`Undone: ${this.description}`, this.addedObjectId);
    }
  }

  redo() {
    return this.execute();
  }
}

/**
 * 객체 삭제 커맨드
 */
export class RemoveObjectCommand extends BaseCommand {
  constructor(editorStore, objectId) {
    super(`Remove Object: ${objectId}`);
    this.editorStore = editorStore;
    this.objectId = objectId;
    this.removedObjectData = null;
  }

  execute() {
    // 삭제하기 전에 객체 데이터 백업
    const objects = this.editorStore.getState().objects;
    this.removedObjectData = objects.find(obj => obj.id === this.objectId);
    
    if (!this.removedObjectData) {
      throw new Error(`Object with id ${this.objectId} not found`);
    }

    // 객체 데이터 복사 (참조 문제 방지)
    this.removedObjectData = { ...this.removedObjectData };

    // 에디터 스토어에서 객체 제거
    this.editorStore.getState().removeObject(this.objectId);
    
    console.log(`Executed: ${this.description}`, this.removedObjectData);
    return this.objectId;
  }

  undo() {
    if (this.removedObjectData) {
      // 에디터 스토어에 객체 복원
      this.editorStore.getState().addObject(this.removedObjectData);
      console.log(`Undone: ${this.description}`, this.removedObjectData);
    }
  }

  redo() {
    return this.execute();
  }
}

/**
 * 객체 이동 커맨드 (Transform)
 */
export class TransformObjectCommand extends BaseCommand {
  constructor(editorStore, objectId, newTransform, oldTransform = null) {
    super(`Transform Object: ${objectId}`);
    this.editorStore = editorStore;
    this.objectId = objectId;
    this.newTransform = { ...newTransform };
    this.oldTransform = oldTransform ? { ...oldTransform } : null;
  }

  execute() {
    // 이전 transform 백업 (첫 실행시)
    if (!this.oldTransform) {
      const objects = this.editorStore.getState().objects;
      const obj = objects.find(o => o.id === this.objectId);
      if (obj) {
        this.oldTransform = {
          position: { ...obj.position },
          rotation: { ...obj.rotation },
          scale: { ...obj.scale }
        };
      }
    }

    // 새로운 transform 적용
    const updateObject = this.editorStore.getState().updateObject;
    updateObject(this.objectId, this.newTransform);
    
    console.log(`Executed: ${this.description}`, this.newTransform);
    return this.objectId;
  }

  undo() {
    if (this.oldTransform) {
      const updateObject = this.editorStore.getState().updateObject;
      updateObject(this.objectId, this.oldTransform);
      console.log(`Undone: ${this.description}`, this.oldTransform);
    }
  }

  redo() {
    const updateObject = this.editorStore.getState().updateObject;
    updateObject(this.objectId, this.newTransform);
    console.log(`Redone: ${this.description}`, this.newTransform);
    return this.objectId;
  }

  /**
   * 같은 객체의 연속적인 변형은 병합 가능
   */
  canMergeWith(otherCommand) {
    return otherCommand instanceof TransformObjectCommand &&
           otherCommand.objectId === this.objectId &&
           (Date.now() - otherCommand.timestamp) < 1000; // 1초 이내
  }

  /**
   * 변형 커맨드 병합 (마지막 상태만 유지)
   */
  mergeWith(otherCommand) {
    return new TransformObjectCommand(
      this.editorStore,
      this.objectId,
      otherCommand.newTransform,
      this.oldTransform // 원래의 초기 상태 유지
    );
  }
}

/**
 * 객체 이름 변경 커맨드
 */
export class RenameObjectCommand extends BaseCommand {
  constructor(editorStore, objectId, newName, oldName = null) {
    super(`Rename Object: ${objectId}`);
    this.editorStore = editorStore;
    this.objectId = objectId;
    this.newName = newName;
    this.oldName = oldName;
  }

  execute() {
    // 이전 이름 백업 (첫 실행시)
    if (!this.oldName) {
      const objects = this.editorStore.getState().objects;
      const obj = objects.find(o => o.id === this.objectId);
      if (obj) {
        this.oldName = obj.name;
      }
    }

    // 새 이름 적용
    const updateObject = this.editorStore.getState().updateObject;
    updateObject(this.objectId, { name: this.newName });
    
    console.log(`Executed: ${this.description}`, `${this.oldName} -> ${this.newName}`);
    return this.objectId;
  }

  undo() {
    if (this.oldName) {
      const updateObject = this.editorStore.getState().updateObject;
      updateObject(this.objectId, { name: this.oldName });
      console.log(`Undone: ${this.description}`, `${this.newName} -> ${this.oldName}`);
    }
  }

  redo() {
    const updateObject = this.editorStore.getState().updateObject;
    updateObject(this.objectId, { name: this.newName });
    console.log(`Redone: ${this.description}`, `${this.oldName} -> ${this.newName}`);
    return this.objectId;
  }
}
