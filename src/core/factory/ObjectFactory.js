/**
 * 추상 팩토리 패턴 - 3D 오브젝트 생성
 */
export class Object3DFactory {
  /**
   * 오브젝트 생성
   * @param {string} type - 오브젝트 타입
   * @param {Object} config - 설정 객체
   * @returns {THREE.Object3D}
   */
  create(type, config) {
    throw new Error('Object3DFactory.create() must be implemented');
  }

  /**
   * 지원하는 타입 목록
   */
  getSupportedTypes() {
    throw new Error('Object3DFactory.getSupportedTypes() must be implemented');
  }

  /**
   * 타입 지원 여부 확인
   */
  supports(type) {
    return this.getSupportedTypes().includes(type);
  }
}

/**
 * 기본 기하학적 도형 팩토리
 */
export class GeometryFactory extends Object3DFactory {
  constructor() {
    super();
    this.geometryCreators = new Map([
      ['cube', this.createCube],
      ['sphere', this.createSphere],
      ['cylinder', this.createCylinder],
      ['cone', this.createCone],
      ['plane', this.createPlane],
      ['torus', this.createTorus]
    ]);
  }

  create(type, config = {}) {
    const creator = this.geometryCreators.get(type);
    if (!creator) {
      throw new Error(`Unsupported geometry type: ${type}`);
    }

    return creator.call(this, config);
  }

  getSupportedTypes() {
    return Array.from(this.geometryCreators.keys());
  }

  createCube(config) {
    const {
      width = 1,
      height = 1,
      depth = 1,
      material = this.getDefaultMaterial(),
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = [1, 1, 1],
      name = 'Cube'
    } = config;

    const geometry = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.name = name;
    mesh.userData.type = 'cube';
    mesh.userData.factory = 'geometry';
    
    return mesh;
  }

  createSphere(config) {
    const {
      radius = 0.5,
      widthSegments = 32,
      heightSegments = 16,
      material = this.getDefaultMaterial(),
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = [1, 1, 1],
      name = 'Sphere'
    } = config;

    const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.name = name;
    mesh.userData.type = 'sphere';
    mesh.userData.factory = 'geometry';
    
    return mesh;
  }

  createCylinder(config) {
    const {
      radiusTop = 0.5,
      radiusBottom = 0.5,
      height = 1,
      radialSegments = 32,
      material = this.getDefaultMaterial(),
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = [1, 1, 1],
      name = 'Cylinder'
    } = config;

    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.name = name;
    mesh.userData.type = 'cylinder';
    mesh.userData.factory = 'geometry';
    
    return mesh;
  }

  createCone(config) {
    const {
      radius = 0.5,
      height = 1,
      radialSegments = 32,
      material = this.getDefaultMaterial(),
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = [1, 1, 1],
      name = 'Cone'
    } = config;

    const geometry = new THREE.ConeGeometry(radius, height, radialSegments);
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.name = name;
    mesh.userData.type = 'cone';
    mesh.userData.factory = 'geometry';
    
    return mesh;
  }

  createPlane(config) {
    const {
      width = 1,
      height = 1,
      material = this.getDefaultMaterial(),
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = [1, 1, 1],
      name = 'Plane'
    } = config;

    const geometry = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.name = name;
    mesh.userData.type = 'plane';
    mesh.userData.factory = 'geometry';
    
    return mesh;
  }

  createTorus(config) {
    const {
      radius = 0.5,
      tube = 0.2,
      radialSegments = 16,
      tubularSegments = 100,
      material = this.getDefaultMaterial(),
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = [1, 1, 1],
      name = 'Torus'
    } = config;

    const geometry = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.name = name;
    mesh.userData.type = 'torus';
    mesh.userData.factory = 'geometry';
    
    return mesh;
  }

  getDefaultMaterial() {
    return new THREE.MeshStandardMaterial({
      color: 0x4CAF50,
      roughness: 0.3,
      metalness: 0.1
    });
  }
}

/**
 * 3D 모델 팩토리 (GLB/GLTF)
 */
export class ModelFactory extends Object3DFactory {
  constructor(loader) {
    super();
    this.loader = loader || new GLTFLoader();
    this.cache = new Map();
    this.supportedFormats = ['glb', 'gltf'];
  }

  async create(type, config = {}) {
    const {
      url,
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = [1, 1, 1],
      name = 'Model'
    } = config;

    if (!url) {
      throw new Error('Model URL is required');
    }

    // 캐시 확인
    if (this.cache.has(url)) {
      const cached = this.cache.get(url);
      return this.cloneModel(cached, { position, rotation, scale, name });
    }

    // 모델 로드
    const gltf = await this.loadModel(url);
    const model = gltf.scene;
    
    // 캐시 저장
    this.cache.set(url, model);
    
    // 복제 후 반환
    return this.cloneModel(model, { position, rotation, scale, name });
  }

  async loadModel(url) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => resolve(gltf),
        (progress) => {
          // 로딩 진행상황 이벤트 발행
          this.emitProgress?.(progress);
        },
        (error) => reject(error)
      );
    });
  }

  cloneModel(original, config) {
    const clone = original.clone();
    
    clone.position.set(...config.position);
    clone.rotation.set(...config.rotation);
    clone.scale.set(...config.scale);
    clone.name = config.name;
    clone.userData.type = 'model';
    clone.userData.factory = 'model';
    
    return clone;
  }

  getSupportedTypes() {
    return this.supportedFormats;
  }

  supports(type) {
    return this.supportedFormats.includes(type.toLowerCase());
  }

  clearCache() {
    this.cache.clear();
  }
}

/**
 * 복합 오브젝트 팩토리 (여러 팩토리 조합)
 */
export class CompositeObjectFactory {
  constructor() {
    this.factories = new Map();
    this.defaultFactory = null;
  }

  /**
   * 팩토리 등록
   */
  registerFactory(name, factory) {
    this.factories.set(name, factory);
    
    if (!this.defaultFactory) {
      this.defaultFactory = factory;
    }
    
    return this;
  }

  /**
   * 기본 팩토리 설정
   */
  setDefaultFactory(name) {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Factory not found: ${name}`);
    }
    this.defaultFactory = factory;
    return this;
  }

  /**
   * 오브젝트 생성
   */
  async create(type, config = {}) {
    // 특정 팩토리 지정된 경우
    if (config.factory) {
      const factory = this.factories.get(config.factory);
      if (!factory) {
        throw new Error(`Factory not found: ${config.factory}`);
      }
      return await factory.create(type, config);
    }

    // 타입을 지원하는 팩토리 찾기
    for (const factory of this.factories.values()) {
      if (factory.supports(type)) {
        return await factory.create(type, config);
      }
    }

    // 기본 팩토리 사용
    if (this.defaultFactory) {
      return await this.defaultFactory.create(type, config);
    }

    throw new Error(`No factory found for type: ${type}`);
  }

  /**
   * 모든 지원 타입 목록
   */
  getAllSupportedTypes() {
    const types = new Set();
    for (const factory of this.factories.values()) {
      factory.getSupportedTypes().forEach(type => types.add(type));
    }
    return Array.from(types);
  }

  /**
   * 팩토리별 지원 타입
   */
  getFactoryTypes() {
    const result = {};
    for (const [name, factory] of this.factories) {
      result[name] = factory.getSupportedTypes();
    }
    return result;
  }
}

/**
 * 싱글톤 팩토리 매니저
 */
export class FactoryManager {
  constructor() {
    if (FactoryManager.instance) {
      return FactoryManager.instance;
    }

    this.compositeFactory = new CompositeObjectFactory();
    this.setupDefaultFactories();
    
    FactoryManager.instance = this;
  }

  setupDefaultFactories() {
    // 기하학적 도형 팩토리
    this.compositeFactory.registerFactory('geometry', new GeometryFactory());
    
    // 모델 팩토리
    this.compositeFactory.registerFactory('model', new ModelFactory());
    
    // 기본 팩토리 설정
    this.compositeFactory.setDefaultFactory('geometry');
  }

  /**
   * 오브젝트 생성
   */
  async createObject(type, config) {
    return await this.compositeFactory.create(type, config);
  }

  /**
   * 팩토리 등록
   */
  registerFactory(name, factory) {
    this.compositeFactory.registerFactory(name, factory);
    return this;
  }

  /**
   * 지원 타입 목록
   */
  getSupportedTypes() {
    return this.compositeFactory.getAllSupportedTypes();
  }

  static getInstance() {
    if (!FactoryManager.instance) {
      new FactoryManager();
    }
    return FactoryManager.instance;
  }
}

// 의존성 주입을 위한 설정
FactoryManager.dependencies = [];
