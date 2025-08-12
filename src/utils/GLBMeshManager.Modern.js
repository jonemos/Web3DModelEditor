/**
 * GLBMeshManager Modern - 이벤트 기반 파일 I/O 시스템
 * 
 * 주요 개선사항:
 * - 이벤트 기반 아키텍처로 전환
 * - 진행률 추적 및 취소 기능
 * - 명령 패턴 통합 지원
 * - 향상된 오류 처리
 * - 메모리 최적화
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { eventBus, EventTypes } from '../core/EventBus.js';

/**
 * 현대적 GLB 메쉬 관리 클래스
 */
export class GLBMeshManagerModern {
  constructor(options = {}) {
    this.options = {
      enableEvents: true,
      enableProgress: true,
      thumbnailSize: 128,
      maxConcurrentOperations: 3,
      ...options
    };

    // 로더 및 익스포터 초기화
    this.loader = new GLTFLoader();
    this.exporter = new GLTFExporter();
    
    // 썸네일 렌더러
    this.thumbnailRenderer = null;
    
    // 작업 관리
    this.operations = new Map(); // 진행 중인 작업들
    this.operationQueue = []; // 대기 중인 작업들
    this.activeOperations = 0;
    
    // 캐시
    this.modelCache = new Map(); // 로드된 모델 캐시
    this.thumbnailCache = new Map(); // 썸네일 캐시
    
    // 초기화
    this.initThumbnailRenderer();
    this.setupEventListeners();
    
    console.log('🚀 GLBMeshManagerModern initialized with options:', this.options);
  }

  /**
   * 썸네일 생성용 렌더러 초기화
   */
  initThumbnailRenderer() {
    this.thumbnailRenderer = {
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(75, 1, 0.1, 1000),
      renderer: new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
      })
    };
    
    const { scene, camera, renderer } = this.thumbnailRenderer;
    
    // 썸네일 크기 설정
    renderer.setSize(this.options.thumbnailSize, this.options.thumbnailSize);
    renderer.setClearColor(0x2a2a2a, 1);
    renderer.shadowMap.enabled = false; // 썸네일에서는 그림자 비활성화
    
    // 조명 설정
    this.setupLighting(scene);
    
    console.log('🎨 Thumbnail renderer initialized');
  }

  /**
   * 조명 설정
   */
  setupLighting(scene) {
    // 환경광
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    // 방향광 (메인 라이트)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // 보조 라이트
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-1, -1, -1);
    scene.add(directionalLight2);
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    if (!this.options.enableEvents) return;

    // 파일 로드 요청 이벤트
    eventBus.on(EventTypes.FILE_LOAD_START, this.handleLoadRequest.bind(this));
    
    // 썸네일 생성 요청 이벤트
    eventBus.on(EventTypes.FILE_THUMBNAIL_GENERATED, this.handleThumbnailRequest.bind(this));
    
    console.log('📡 Event listeners setup complete');
  }

  /**
   * 작업 큐 관리
   */
  async processOperationQueue() {
    while (this.operationQueue.length > 0 && this.activeOperations < this.options.maxConcurrentOperations) {
      const operation = this.operationQueue.shift();
      this.activeOperations++;
      
      try {
        await operation.execute();
      } catch (error) {
        console.error('작업 실행 실패:', error);
      } finally {
        this.activeOperations--;
        this.processOperationQueue(); // 다음 작업 처리
      }
    }
  }

  /**
   * 작업 추가
   */
  addOperation(operation) {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    operation.id = operationId;
    
    this.operations.set(operationId, operation);
    this.operationQueue.push(operation);
    
    this.processOperationQueue();
    
    return operationId;
  }

  /**
   * 작업 취소
   */
  cancelOperation(operationId) {
    const operation = this.operations.get(operationId);
    if (operation && operation.cancel) {
      operation.cancel();
      this.operations.delete(operationId);
      
      if (this.options.enableEvents) {
        eventBus.emit(EventTypes.FILE_LOAD_ERROR, {
          operationId,
          error: 'Operation cancelled',
          cancelled: true
        });
      }
    }
  }

  /**
   * 라이브러리 메쉬 목록 로드 (개선된 버전)
   */
  async loadLibraryMeshes() {
    const operationId = this.addOperation({
      type: 'loadLibrary',
      execute: async () => {
        try {
          if (this.options.enableEvents) {
            eventBus.emit(EventTypes.LIBRARY_REFRESH_START, { operationId });
          }
          
          // 라이브러리 파일 목록
          const meshFiles = [
            { filename: '111.glb', name: '메쉬 111' },
            { filename: '222.glb', name: '메쉬 222' },
            { filename: 'SM_MERGED_BP_C_GY_Floor_C_1.glb', name: '바닥 메쉬' },
            { filename: 'SM_MERGED_BP_GY_Ceil_C_1.glb', name: '천장 메쉬' },
            { filename: 'SM_MERGED_BP_GY_Pillar_C_1.glb', name: '기둥 메쉬' },
            { filename: 'SM_MERGED_BP_GY_Wall_C_1.glb', name: '벽 메쉬' },
            { filename: 'SM_MERGED_StaticMeshActor_0.glb', name: '정적 메쉬' }
          ];

          const meshObjects = [];
          const totalFiles = meshFiles.length;
          
          // 병렬로 파일 존재 여부 확인
          const existenceChecks = meshFiles.map(async (file, index) => {
            const glbUrl = `/library/mesh/${file.filename}`;
            
            try {
              const response = await fetch(glbUrl, { method: 'HEAD' });
              
              if (this.options.enableProgress) {
                eventBus.emit(EventTypes.FILE_LOAD_PROGRESS, {
                  operationId,
                  progress: ((index + 1) / totalFiles) * 100,
                  current: index + 1,
                  total: totalFiles
                });
              }
              
              if (response.ok) {
                return {
                  id: `library_${file.filename.replace('.glb', '')}`,
                  name: file.name,
                  type: 'library',
                  geometry: 'LibraryMesh',
                  glbUrl: glbUrl,
                  filename: file.filename,
                  thumbnail: null,
                  isLoadingThumbnail: true,
                  fileSize: response.headers.get('content-length') || 'Unknown'
                };
              }
            } catch (error) {
              console.warn(`라이브러리 파일 확인 실패: ${file.filename}`, error);
            }
            
            return null;
          });
          
          const results = await Promise.all(existenceChecks);
          meshObjects.push(...results.filter(Boolean));
          
          if (this.options.enableEvents) {
            eventBus.emit(EventTypes.LIBRARY_REFRESH_COMPLETE, {
              operationId,
              meshes: meshObjects,
              count: meshObjects.length
            });
          }
          
          return meshObjects;
          
        } catch (error) {
          if (this.options.enableEvents) {
            eventBus.emit(EventTypes.LIBRARY_REFRESH_ERROR, {
              operationId,
              error: error.message
            });
          }
          throw error;
        }
      }
    });

    return new Promise((resolve, reject) => {
      const operation = this.operations.get(operationId);
      operation.resolve = resolve;
      operation.reject = reject;
    });
  }

  /**
   * GLB URL로부터 썸네일 생성 (개선된 버전)
   */
  async generateThumbnailFromURL(glbUrl, options = {}) {
    const { 
      size = this.options.thumbnailSize,
      useCache = true,
      quality = 0.8 
    } = options;

    // 캐시 확인
    const cacheKey = `${glbUrl}_${size}`;
    if (useCache && this.thumbnailCache.has(cacheKey)) {
      return this.thumbnailCache.get(cacheKey);
    }

    return new Promise((resolve, reject) => {
      const operationId = this.addOperation({
        type: 'generateThumbnail',
        execute: async () => {
          let model = null;
          
          try {
            // 모델 캐시 확인
            if (useCache && this.modelCache.has(glbUrl)) {
              model = this.modelCache.get(glbUrl).clone();
            } else {
              // 새로 로드
              const gltf = await new Promise((loadResolve, loadReject) => {
                this.loader.load(glbUrl, loadResolve, undefined, loadReject);
              });
              
              model = gltf.scene;
              
              // 캐시에 저장
              if (useCache) {
                this.modelCache.set(glbUrl, gltf.scene.clone());
              }
            }

            // 썸네일 생성
            const thumbnail = this.renderThumbnail(model, size, quality);
            
            // 캐시에 저장
            if (useCache) {
              this.thumbnailCache.set(cacheKey, thumbnail);
            }

            if (this.options.enableEvents) {
              eventBus.emit(EventTypes.FILE_THUMBNAIL_GENERATED, {
                operationId,
                glbUrl,
                thumbnail,
                size
              });
            }
            
            resolve(thumbnail);
            
          } catch (error) {
            if (this.options.enableEvents) {
              eventBus.emit(EventTypes.FILE_THUMBNAIL_ERROR, {
                operationId,
                glbUrl,
                error: error.message
              });
            }
            reject(error);
          }
        }
      });
    });
  }

  /**
   * 실제 썸네일 렌더링
   */
  renderThumbnail(model, size, quality) {
    const { scene, camera, renderer } = this.thumbnailRenderer;
    
    // 임시 렌더러 설정
    const originalSize = renderer.getSize(new THREE.Vector2());
    renderer.setSize(size, size);
    
    try {
      // 기존 메쉬들 제거
      const meshesToRemove = [];
      scene.traverse((child) => {
        if (child.isMesh) {
          meshesToRemove.push(child);
        }
      });
      meshesToRemove.forEach(mesh => scene.remove(mesh));
      
      // 새 모델 추가
      scene.add(model);
      
      // 바운딩 박스 계산 및 카메라 위치 조정
      this.adjustCameraForModel(model, camera);
      
      // 렌더링
      renderer.render(scene, camera);
      
      // 데이터 URL 생성
      const dataURL = renderer.domElement.toDataURL('image/png', quality);
      
      // 모델 제거
      scene.remove(model);
      
      return dataURL;
      
    } finally {
      // 원래 크기로 복원
      renderer.setSize(originalSize.x, originalSize.y);
    }
  }

  /**
   * 모델에 맞게 카메라 조정
   */
  adjustCameraForModel(model, camera) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // 모델을 중앙으로 이동
    model.position.sub(center);
    
    // 카메라 위치 조정
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    
    // 적절한 거리로 조정
    cameraZ *= 1.5;
    
    camera.position.set(cameraZ * 0.7, cameraZ * 0.5, cameraZ);
    camera.lookAt(0, 0, 0);
  }

  /**
   * 3D 오브젝트로부터 썸네일 생성 (개선된 버전)
   */
  generateThumbnailFromObject(object, options = {}) {
    const { 
      size = this.options.thumbnailSize,
      quality = 0.8,
      useOffscreenRenderer = true 
    } = options;

    if (useOffscreenRenderer) {
      return this.generateThumbnailOffscreen(object, size, quality);
    } else {
      return this.generateThumbnailDirect(object, size, quality);
    }
  }

  /**
   * 오프스크린 렌더링으로 썸네일 생성
   */
  generateThumbnailOffscreen(object, size, quality) {
    // OffscreenCanvas 지원 확인
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(size, size);
      const renderer = new THREE.WebGLRenderer({ 
        canvas,
        antialias: true, 
        alpha: true,
        preserveDrawingBuffer: true 
      });
      
      return this.renderThumbnailWithRenderer(object, renderer, size, quality);
    } else {
      // 폴백: 기존 방식 사용
      return this.generateThumbnailDirect(object, size, quality);
    }
  }

  /**
   * 직접 렌더링으로 썸네일 생성
   */
  generateThumbnailDirect(object, size, quality) {
    // 임시 씬과 카메라 생성
    const tempScene = new THREE.Scene();
    const tempCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const tempRenderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      preserveDrawingBuffer: true 
    });
    
    return this.renderThumbnailWithRenderer(object, tempRenderer, size, quality, tempScene, tempCamera);
  }

  /**
   * 렌더러를 사용한 썸네일 생성
   */
  renderThumbnailWithRenderer(object, renderer, size, quality, scene = null, camera = null) {
    // 씬과 카메라 설정
    const useScene = scene || new THREE.Scene();
    const useCamera = camera || new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    
    renderer.setSize(size, size);
    renderer.setClearColor(0x2a2a2a, 1);
    
    // 임시 컨테이너 (필요한 경우)
    let tempContainer = null;
    if (renderer.domElement && !scene) {
      tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      document.body.appendChild(tempContainer);
      tempContainer.appendChild(renderer.domElement);
    }

    try {
      // 조명 설정
      if (!scene) {
        this.setupLighting(useScene);
      }

      // 오브젝트 복제 및 추가
      const clonedObject = this.createSafeClone(object);
      useScene.add(clonedObject);

      // 카메라 조정
      this.adjustCameraForModel(clonedObject, useCamera);

      // 렌더링
      renderer.render(useScene, useCamera);

      // 데이터 URL 생성
      const dataURL = renderer.domElement.toDataURL('image/png', quality);
      
      return dataURL;
      
    } finally {
      // 정리
      if (tempContainer) {
        document.body.removeChild(tempContainer);
      }
      
      if (!scene) {
        renderer.dispose();
        useScene.clear();
      }
    }
  }

  /**
   * 안전한 객체 복제 (개선된 버전)
   */
  createSafeClone(object) {
    try {
      // 표준 clone 메서드 시도
      if (typeof object.clone === 'function') {
        return object.clone();
      }
    } catch (error) {
      console.warn('표준 clone 실패, 수동 복제 시도:', error);
    }
    
    // 수동 복제
    return this.manualClone(object);
  }

  /**
   * 수동 객체 복제
   */
  manualClone(object) {
    if (!object || typeof object !== 'object') {
      console.warn('유효하지 않은 객체:', object);
      return new THREE.Object3D();
    }

    let cloned;

    // 타입별 복제
    if (object.type === 'Group' || object.isGroup) {
      cloned = new THREE.Group();
    } else if (object.isMesh) {
      const geometry = object.geometry ? object.geometry.clone() : null;
      const material = object.material ? this.cloneMaterial(object.material) : null;
      cloned = new THREE.Mesh(geometry, material);
    } else {
      cloned = new THREE.Object3D();
    }

    // 기본 속성 복사
    cloned.name = object.name || '';
    if (object.position) cloned.position.copy(object.position);
    if (object.rotation) this.safeRotationCopy(object.rotation, cloned.rotation);
    if (object.scale) cloned.scale.copy(object.scale);

    // 자식 객체 복제
    if (Array.isArray(object.children)) {
      object.children.forEach(child => {
        try {
          const clonedChild = this.createSafeClone(child);
          cloned.add(clonedChild);
        } catch (childError) {
          console.warn('자식 객체 복제 실패:', childError);
        }
      });
    }

    return cloned;
  }

  /**
   * 안전한 회전 복사
   */
  safeRotationCopy(sourceRotation, targetRotation) {
    if (!sourceRotation || !targetRotation) return;
    
    try {
      if (sourceRotation.order !== undefined) {
        targetRotation.copy(sourceRotation);
      } else {
        targetRotation.set(
          sourceRotation.x || 0,
          sourceRotation.y || 0,
          sourceRotation.z || 0,
          'XYZ'
        );
      }
    } catch (error) {
      console.warn('회전 복사 실패:', error);
      targetRotation.set(0, 0, 0, 'XYZ');
    }
  }

  /**
   * 머티리얼 복제
   */
  cloneMaterial(material) {
    if (Array.isArray(material)) {
      return material.map(mat => mat.clone ? mat.clone() : mat);
    } else {
      return material.clone ? material.clone() : material;
    }
  }

  /**
   * 3D 오브젝트를 GLB 형식으로 익스포트 (개선된 버전)
   */
  async exportObjectToGLB(object, options = {}) {
    const { 
      preserveTransform = false,
      embedImages = true,
      maxTextureSize = 1024,
      binary = true
    } = options;

    return new Promise((resolve, reject) => {
      const operationId = this.addOperation({
        type: 'exportGLB',
        execute: async () => {
          try {
            if (this.options.enableEvents) {
              eventBus.emit(EventTypes.FILE_SAVE_START, {
                operationId,
                objectName: object.name || 'Unknown'
              });
            }
            
            // 안전한 객체 복제
            const clonedObject = this.createSafeClone(object);
            
            // 변환 값 처리
            if (!preserveTransform) {
              this.resetTransform(clonedObject);
            }
            
            // 머티리얼 복제
            this.cloneMaterials(clonedObject);
            
            // GLB 익스포트
            this.exporter.parse(
              clonedObject,
              (gltf) => {
                if (this.options.enableEvents) {
                  eventBus.emit(EventTypes.FILE_SAVE_COMPLETE, {
                    operationId,
                    fileSize: gltf.byteLength || gltf.length || 0
                  });
                }
                resolve(gltf);
              },
              (error) => {
                if (this.options.enableEvents) {
                  eventBus.emit(EventTypes.FILE_SAVE_ERROR, {
                    operationId,
                    error: error.message
                  });
                }
                reject(error);
              },
              {
                binary,
                includeCustomExtensions: true,
                embedImages,
                maxTextureSize,
                forcePowerOfTwoTextures: false,
                truncateDrawRange: false
              }
            );
            
          } catch (error) {
            if (this.options.enableEvents) {
              eventBus.emit(EventTypes.FILE_SAVE_ERROR, {
                operationId,
                error: error.message
              });
            }
            reject(error);
          }
        }
      });
    });
  }

  /**
   * 변환 값 초기화
   */
  resetTransform(object) {
    try {
      if (object.position && typeof object.position.set === 'function') {
        object.position.set(0, 0, 0);
      }
      if (object.rotation && typeof object.rotation.set === 'function') {
        object.rotation.set(0, 0, 0, 'XYZ');
      }
      if (object.scale && typeof object.scale.set === 'function') {
        object.scale.set(1, 1, 1);
      }
    } catch (error) {
      console.warn('변환 값 초기화 실패:', error);
    }
  }

  /**
   * 머티리얼 복제 (재귀)
   */
  cloneMaterials(obj) {
    if (!obj || typeof obj !== 'object') return;
    
    if (obj.material) {
      try {
        obj.material = this.cloneMaterial(obj.material);
      } catch (error) {
        console.warn('머티리얼 복제 실패:', error);
      }
    }
    
    if (Array.isArray(obj.children)) {
      obj.children.forEach(child => {
        try {
          this.cloneMaterials(child);
        } catch (error) {
          console.warn('자식 객체 머티리얼 처리 실패:', error);
        }
      });
    }
  }

  /**
   * GLB URL에서 3D 모델 로드 (개선된 버전)
   */
  async loadGLBModel(glbUrl, options = {}) {
    const { useCache = true, onProgress = null } = options;

    // 캐시 확인
    if (useCache && this.modelCache.has(glbUrl)) {
      const cachedModel = this.modelCache.get(glbUrl);
      return cachedModel.clone();
    }

    return new Promise((resolve, reject) => {
      const operationId = this.addOperation({
        type: 'loadGLB',
        execute: async () => {
          this.loader.load(
            glbUrl,
            (gltf) => {
              // 캐시에 저장
              if (useCache) {
                this.modelCache.set(glbUrl, gltf.scene.clone());
              }
              
              if (this.options.enableEvents) {
                eventBus.emit(EventTypes.FILE_LOAD_COMPLETE, {
                  operationId,
                  glbUrl,
                  model: gltf.scene
                });
              }
              
              resolve(gltf.scene);
            },
            (progress) => {
              if (onProgress) onProgress(progress);
              
              if (this.options.enableEvents && this.options.enableProgress) {
                const percent = progress.loaded / progress.total * 100;
                eventBus.emit(EventTypes.FILE_LOAD_PROGRESS, {
                  operationId,
                  progress: percent,
                  loaded: progress.loaded,
                  total: progress.total
                });
              }
            },
            (error) => {
              if (this.options.enableEvents) {
                eventBus.emit(EventTypes.FILE_LOAD_ERROR, {
                  operationId,
                  glbUrl,
                  error: error.message
                });
              }
              reject(error);
            }
          );
        }
      });
    });
  }

  /**
   * 캐시 관리
   */
  clearCache() {
    this.modelCache.clear();
    this.thumbnailCache.clear();
    console.log('🗑️ Cache cleared');
  }

  /**
   * 캐시 상태 반환
   */
  getCacheStatus() {
    return {
      models: this.modelCache.size,
      thumbnails: this.thumbnailCache.size,
      operations: this.operations.size
    };
  }

  /**
   * 진행 중인 작업 상태
   */
  getOperationStatus() {
    return {
      active: this.activeOperations,
      queued: this.operationQueue.length,
      total: this.operations.size
    };
  }

  /**
   * 이벤트 핸들러들
   */
  handleLoadRequest(event) {
    // 로드 요청 처리 로직
    console.log('파일 로드 요청:', event.detail);
  }

  handleThumbnailRequest(event) {
    // 썸네일 생성 요청 처리 로직
    console.log('썸네일 생성 요청:', event.detail);
  }

  /**
   * 커스텀 메쉬 관리 (기존 메서드들은 그대로 유지)
   */
  async addCustomMesh(object, name, options = {}) {
    const { preserveTransform = true } = options;
    
    try {
      const operationId = `custom_${Date.now()}`;
      
      if (this.options.enableEvents) {
        eventBus.emit(EventTypes.CUSTOM_MESH_SAVED, {
          operationId,
          name
        });
      }
      
      // GLB 데이터 생성
      const glbData = await this.exportObjectToGLB(object, { preserveTransform });
      
      // 썸네일 생성
      const thumbnail = this.generateThumbnailFromObject(object);
      
      // 메쉬 데이터 구성
      const meshData = {
        id: `custom_${Date.now()}`,
        name: name || '커스텀 메쉬',
        fileName: `custom_${Date.now()}.glb`,
        thumbnail: thumbnail,
        type: 'custom',
        glbData: glbData,
        createdAt: Date.now(),
        transform: {
          position: { x: object.position.x, y: object.position.y, z: object.position.z },
          rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
          scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z }
        }
      };

      // 로컬 스토리지에 저장
      this.saveCustomMesh(meshData);

      if (this.options.enableEvents) {
        eventBus.emit(EventTypes.CUSTOM_MESH_SAVED, {
          operationId,
          meshData
        });
      }

      return meshData;
    } catch (error) {
      if (this.options.enableEvents) {
        eventBus.emit(EventTypes.CUSTOM_MESH_SAVE_ERROR, {
          name,
          error: error.message
        });
      }
      throw error;
    }
  }

  /**
   * 커스텀 메쉬 저장
   */
  saveCustomMesh(meshData) {
    const customMeshes = this.getCustomMeshes();
    
    const storableMeshData = {
      ...meshData,
      glbData: Array.from(new Uint8Array(meshData.glbData))
    };
    
    customMeshes.push(storableMeshData);
    localStorage.setItem('customMeshes', JSON.stringify(customMeshes));
    console.log('✅ 커스텀 메쉬 저장:', storableMeshData.name);
  }

  /**
   * 커스텀 메쉬 목록 가져오기
   */
  getCustomMeshes() {
    const stored = localStorage.getItem('customMeshes');
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * 커스텀 메쉬 삭제
   */
  deleteCustomMesh(meshId) {
    const customMeshes = this.getCustomMeshes();
    const filteredMeshes = customMeshes.filter(mesh => mesh.id !== meshId);
    localStorage.setItem('customMeshes', JSON.stringify(filteredMeshes));
    
    if (this.options.enableEvents) {
      eventBus.emit(EventTypes.CUSTOM_MESH_DELETED, {
        meshId,
        remaining: filteredMeshes.length
      });
    }
    
    return filteredMeshes;
  }

  /**
   * Blob URL 생성
   */
  createBlobURL(glbData) {
    try {
      let binaryData;
      
      if (glbData instanceof ArrayBuffer) {
        binaryData = glbData;
      } else if (glbData instanceof Uint8Array) {
        binaryData = glbData.buffer;
      } else if (Array.isArray(glbData)) {
        binaryData = new Uint8Array(glbData).buffer;
      } else {
        throw new Error('지원되지 않는 GLB 데이터 형식');
      }
      
      const blob = new Blob([binaryData], { type: 'model/gltf-binary' });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Blob URL 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 리소스 정리
   */
  dispose() {
    // 진행 중인 작업들 취소
    this.operations.forEach((operation, id) => {
      this.cancelOperation(id);
    });
    
    // 캐시 정리
    this.clearCache();
    
    // 썸네일 렌더러 정리
    if (this.thumbnailRenderer) {
      this.thumbnailRenderer.renderer.dispose();
      this.thumbnailRenderer.scene.clear();
      this.thumbnailRenderer = null;
    }
    
    // 이벤트 리스너 제거
    if (this.options.enableEvents) {
      eventBus.off(EventTypes.FILE_LOAD_START, this.handleLoadRequest);
      eventBus.off(EventTypes.FILE_THUMBNAIL_GENERATED, this.handleThumbnailRequest);
    }
    
    console.log('🔄 GLBMeshManagerModern disposed');
  }
}

// 모던 매니저 인스턴스
let modernManagerInstance = null;

/**
 * 모던 GLBMeshManager 싱글톤 인스턴스 반환
 */
export const getGLBMeshManagerModern = (options = {}) => {
  if (!modernManagerInstance) {
    modernManagerInstance = new GLBMeshManagerModern(options);
  }
  return modernManagerInstance;
};

/**
 * 모던 GLBMeshManager 인스턴스 정리
 */
export const disposeGLBMeshManagerModern = () => {
  if (modernManagerInstance) {
    modernManagerInstance.dispose();
    modernManagerInstance = null;
  }
};

// 기존 GLBMeshManager와의 호환성을 위한 export
export { GLBMeshManagerModern as GLBMeshManager };
export const getGLBMeshManager = getGLBMeshManagerModern;
export const disposeGLBMeshManager = disposeGLBMeshManagerModern;
