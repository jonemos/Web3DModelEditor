/**
 * 3D 오브젝트 엔티티 - 도메인 핵심 객체
 */
export class Object3DEntity {
  constructor(id, name, type) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.transform = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    };
    this.material = null;
    this.geometry = null;
    this.visible = true;
    this.selectable = true;
    this.metadata = {};
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * 위치 변경
   */
  setPosition(x, y, z) {
    this.transform.position = { x, y, z };
    this.updatedAt = new Date();
  }

  /**
   * 회전 변경
   */
  setRotation(x, y, z) {
    this.transform.rotation = { x, y, z };
    this.updatedAt = new Date();
  }

  /**
   * 크기 변경
   */
  setScale(x, y, z) {
    this.transform.scale = { x, y, z };
    this.updatedAt = new Date();
  }

  /**
   * 가시성 토글
   */
  toggleVisibility() {
    this.visible = !this.visible;
    this.updatedAt = new Date();
  }

  /**
   * 메타데이터 설정
   */
  setMetadata(key, value) {
    this.metadata[key] = value;
    this.updatedAt = new Date();
  }

  /**
   * 엔티티 복제
   */
  clone() {
    const cloned = new Object3DEntity(
      `${this.id}_clone_${Date.now()}`,
      `${this.name} Copy`,
      this.type
    );
    
    cloned.transform = JSON.parse(JSON.stringify(this.transform));
    cloned.material = this.material; // 참조 복사
    cloned.geometry = this.geometry; // 참조 복사
    cloned.visible = this.visible;
    cloned.selectable = this.selectable;
    cloned.metadata = { ...this.metadata };
    
    return cloned;
  }

  /**
   * 직렬화
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      transform: this.transform,
      visible: this.visible,
      selectable: this.selectable,
      metadata: this.metadata,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  /**
   * 역직렬화
   */
  static fromJSON(data) {
    const entity = new Object3DEntity(data.id, data.name, data.type);
    entity.transform = data.transform;
    entity.visible = data.visible ?? true;
    entity.selectable = data.selectable ?? true;
    entity.metadata = data.metadata || {};
    entity.createdAt = new Date(data.createdAt);
    entity.updatedAt = new Date(data.updatedAt);
    return entity;
  }

  /**
   * 유효성 검증
   */
  validate() {
    const errors = [];
    
    if (!this.id || typeof this.id !== 'string') {
      errors.push('ID is required and must be a string');
    }
    
    if (!this.name || typeof this.name !== 'string') {
      errors.push('Name is required and must be a string');
    }
    
    if (!this.type || typeof this.type !== 'string') {
      errors.push('Type is required and must be a string');
    }
    
    // Transform 검증
    const { position, rotation, scale } = this.transform;
    if (!this.isValidVector3(position)) {
      errors.push('Position must be a valid Vector3');
    }
    if (!this.isValidVector3(rotation)) {
      errors.push('Rotation must be a valid Vector3');
    }
    if (!this.isValidVector3(scale)) {
      errors.push('Scale must be a valid Vector3');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Vector3 유효성 검증
   */
  isValidVector3(vector) {
    return vector &&
           typeof vector.x === 'number' &&
           typeof vector.y === 'number' &&
           typeof vector.z === 'number' &&
           !isNaN(vector.x) &&
           !isNaN(vector.y) &&
           !isNaN(vector.z);
  }
}

/**
 * 에디터 씬 엔티티
 */
export class EditorSceneEntity {
  constructor(name = 'Untitled Scene') {
    this.id = `scene_${Date.now()}`;
    this.name = name;
    this.objects = new Map(); // id -> Object3DEntity
    this.environment = {
      background: { type: 'color', value: '#87CEEB' },
      lighting: {
        ambient: { color: '#404040', intensity: 0.6 },
        directional: { color: '#ffffff', intensity: 0.8, position: { x: 10, y: 10, z: 5 } }
      },
      grid: {
        visible: true,
        size: 50,
        divisions: 50,
        color: '#666666'
      }
    };
    this.camera = {
      position: { x: 0, y: 5, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      projection: 'perspective',
      fov: 75,
      near: 0.1,
      far: 1000
    };
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * 오브젝트 추가
   */
  addObject(object3D) {
    if (!(object3D instanceof Object3DEntity)) {
      throw new Error('Object must be an instance of Object3DEntity');
    }
    
    this.objects.set(object3D.id, object3D);
    this.updatedAt = new Date();
  }

  /**
   * 오브젝트 제거
   */
  removeObject(objectId) {
    const removed = this.objects.delete(objectId);
    if (removed) {
      this.updatedAt = new Date();
    }
    return removed;
  }

  /**
   * 오브젝트 조회
   */
  getObject(objectId) {
    return this.objects.get(objectId);
  }

  /**
   * 모든 오브젝트 조회
   */
  getAllObjects() {
    return Array.from(this.objects.values());
  }

  /**
   * 씬 정리
   */
  clear() {
    this.objects.clear();
    this.updatedAt = new Date();
  }

  /**
   * 씬 통계
   */
  getStats() {
    const objects = this.getAllObjects();
    const typeCount = {};
    
    objects.forEach(obj => {
      typeCount[obj.type] = (typeCount[obj.type] || 0) + 1;
    });
    
    return {
      totalObjects: objects.length,
      visibleObjects: objects.filter(obj => obj.visible).length,
      selectableObjects: objects.filter(obj => obj.selectable).length,
      typeBreakdown: typeCount
    };
  }

  /**
   * 직렬화
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      objects: Array.from(this.objects.values()).map(obj => obj.toJSON()),
      environment: this.environment,
      camera: this.camera,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  /**
   * 역직렬화
   */
  static fromJSON(data) {
    const scene = new EditorSceneEntity(data.name);
    scene.id = data.id;
    scene.environment = data.environment || scene.environment;
    scene.camera = data.camera || scene.camera;
    scene.createdAt = new Date(data.createdAt);
    scene.updatedAt = new Date(data.updatedAt);
    
    // 오브젝트 복원
    if (data.objects && Array.isArray(data.objects)) {
      data.objects.forEach(objData => {
        const obj = Object3DEntity.fromJSON(objData);
        scene.addObject(obj);
      });
    }
    
    return scene;
  }
}
