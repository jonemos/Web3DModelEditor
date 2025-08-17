import * as THREE from 'three';
import { getGLTFLoader, setKTX2Renderer } from './gltfLoaderFactory.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { idbGetAllCustomMeshes, idbAddCustomMesh, idbDeleteCustomMesh, migrateLocalStorageCustomMeshesToIDB } from './idb.js';
import { isWorkerSupported, workerThumbnailFromGLB, workerThumbnailFromObjectJSON, imageBitmapToDataURL, workerExportGLBFromObjectJSON } from './meshWorkerClient.js';

/**
 * GLB 메쉬 관리를 위한 통합 클래스
 * 라이브러리 메쉬와 커스텀 메쉬의 로드, 저장, 썸네일 생성, 변환 등을 담당
 */
export class GLBMeshManager {
  constructor() {
  this.loader = getGLTFLoader();
    this.exporter = new GLTFExporter();
    this.thumbnailRenderer = null;
  // Cache for stable thumbnail Object URLs keyed by mesh id
  this._thumbUrlCache = new Map();
  // Cache for stable thumbnail data URLs keyed by mesh id
  this._thumbDataUrlCache = new Map();
    this.initThumbnailRenderer();
  // 초기 1회: localStorage → IndexedDB 마이그레이션 시도
  migrateLocalStorageCustomMeshesToIDB();
  }

  /**
   * 대상 객체가 렌더링 가능한 Mesh(geometry 포함)를 갖는지 검사
   */
  _hasRenderableMesh(object) {
    let found = false;
    if (!object) return false;
    object.traverse?.((n) => {
      if (found) return;
      if (n?.isMesh && n.geometry && n.geometry.isBufferGeometry && n.geometry.getAttribute('position')) {
        found = true;
      }
    });
    return found;
  }

  /**
   * 사용자가 업로드한 GLB 파일을 커스텀 메쉬 라이브러리에 추가
   * @param {File} file .glb 파일
   * @returns {Promise<Object>} 저장된 메쉬 메타데이터
   */
  async importGLBFile(file) {
    if (!file) throw new Error('NO_FILE');
    const buf = await file.arrayBuffer();
    const nameBase = (file.name || 'imported').replace(/\.(glb|gltf)$/i, '');
    return this.importGLBBuffer(buf, nameBase);
  }

  /**
   * GLB ArrayBuffer를 커스텀 메쉬로 저장
   * @param {ArrayBuffer} glbBuffer
   * @param {string} name 저장할 표시 이름
   */
  async importGLBBuffer(glbBuffer, name = 'Imported Mesh') {
    try {
      // 썸네일 생성: Worker가 있으면 워커에서 OffscreenCanvas로 렌더, 실패 시 메인 스레드 폴백
      let thumbnail = null;
    if (isWorkerSupported()) {
        try {
      const { bitmap } = await workerThumbnailFromGLB(glbBuffer, 128, false);
          thumbnail = await imageBitmapToDataURL(bitmap);
        } catch (e) {
          // fallback below
        }
      }
      if (!thumbnail) {
        const blob = new Blob([glbBuffer], { type: 'model/gltf-binary' });
        const blobUrl = URL.createObjectURL(blob);
        try {
          thumbnail = await this.generateThumbnailFromURL(blobUrl);
        } finally {
          try { URL.revokeObjectURL(blobUrl) } catch {}
        }
      }

      const timestamp = Date.now();
      const meshData = {
        id: `custom_${timestamp}`,
        name: name || `custom_${timestamp}`,
        thumbnail,
        type: 'custom',
        glbData: glbBuffer,
        createdAt: timestamp
      };

      await this.saveCustomMesh(meshData);
      try { window.dispatchEvent(new CustomEvent('customMeshAdded')) } catch {}
      return meshData;
    } catch (e) {
      console.error('GLB 임포트 실패:', e);
      throw e;
    }
  }

  /**
   * 커스텀 메쉬 데이터를 파일로 다운로드
   * @param {Object} mesh {id, name, glbData}
   */
  downloadCustomMesh(mesh) {
    if (!mesh || !mesh.glbData) return;
    try {
      const blob = new Blob([mesh.glbData], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (mesh.name || mesh.id || 'mesh').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.href = url;
      a.download = `${safeName}.glb`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => { try { URL.revokeObjectURL(url) } catch {} }, 0);
    } catch (e) {
      console.error('다운로드 실패:', e);
    }
  }

  /**
   * 썸네일 생성용 렌더러 초기화
   */
  initThumbnailRenderer() {
    // 기존 렌더러가 있다면 재사용 또는 정리
    if (this.thumbnailRenderer && this.thumbnailRenderer.renderer) {
      try { this.thumbnailRenderer.renderer.dispose(); } catch {}
    }
  this.thumbnailRenderer = {
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(75, 1, 0.1, 1000),
      renderer: new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' })
    };
    
    const { scene, camera, renderer } = this.thumbnailRenderer;
    
  // 썸네일 크기 설정
    const thumbnailSize = 128;
    renderer.setSize(thumbnailSize, thumbnailSize);
    renderer.setClearColor(0x2a2a2a, 1); // 어두운 배경
    
    // 조명 설정
    this.setupLighting(scene);
  // KTX2 하드웨어 변환 지원 감지(1회)
  try { setKTX2Renderer(renderer); } catch {}
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
   * 안전한 회전 복사 유틸리티
   * @param {THREE.Euler} sourceRotation 소스 회전
   * @param {THREE.Euler} targetRotation 타겟 회전
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
          'XYZ' // 기본 order
        );
      }
    } catch (error) {
      console.warn('회전 복사 실패:', error);
      // 실패 시 기본값으로 설정
      targetRotation.set(0, 0, 0, 'XYZ');
    }
  }

  /**
   * 안전한 객체 복제 메서드
   * clone 메서드가 없거나 실패하는 경우 수동으로 객체를 복제
   * @param {THREE.Object3D} object 복제할 객체
   * @returns {THREE.Object3D} 복제된 객체
   */
  createSafeClone(object) {
    try {
      // 입력 객체 유효성 검사
      if (!object || typeof object !== 'object') {
        console.warn('유효하지 않은 객체입니다:', object);
        return new THREE.Object3D();
      }

      // Group 객체인 경우
      if (object.type === 'Group' || object.isGroup) {
        const clonedGroup = new THREE.Group();
        clonedGroup.name = object.name || '';
        
        // 자식 객체들을 재귀적으로 복제 (children 존재 여부 확인)
        if (Array.isArray(object.children)) {
          object.children.forEach(child => {
            try {
              const clonedChild = this.createSafeClone(child);
              clonedGroup.add(clonedChild);
            } catch (childError) {
              console.warn('자식 객체 복제 실패:', childError);
            }
          });
        }
        
        // 변환 정보 복사 (프로퍼티 존재 여부 확인)
        if (object.position) clonedGroup.position.copy(object.position);
        if (object.rotation) this.safeRotationCopy(object.rotation, clonedGroup.rotation);
        if (object.scale) clonedGroup.scale.copy(object.scale);
        
        return clonedGroup;
      }
      
      // Mesh 객체인 경우
      if (object.isMesh) {
        const clonedGeometry = object.geometry ? object.geometry.clone() : null;
        const clonedMaterial = object.material ? this.cloneMaterial(object.material) : null;
        
        const clonedMesh = new THREE.Mesh(clonedGeometry, clonedMaterial);
        clonedMesh.name = object.name || '';
        
        // 변환 정보 복사
        if (object.position) clonedMesh.position.copy(object.position);
        if (object.rotation) this.safeRotationCopy(object.rotation, clonedMesh.rotation);
        if (object.scale) clonedMesh.scale.copy(object.scale);
        
        return clonedMesh;
      }
      
      // 기타 Object3D인 경우
      const clonedObject = new THREE.Object3D();
      clonedObject.name = object.name || '';
      
      // 자식 객체들을 재귀적으로 복제 (children 존재 여부 확인)
      if (Array.isArray(object.children)) {
        object.children.forEach(child => {
          try {
            const clonedChild = this.createSafeClone(child);
            clonedObject.add(clonedChild);
          } catch (childError) {
            console.warn('자식 객체 복제 실패:', childError);
          }
        });
      }
      
      // 변환 정보 복사 (프로퍼티 존재 여부 확인)
      if (object.position) clonedObject.position.copy(object.position);
      if (object.rotation) this.safeRotationCopy(object.rotation, clonedObject.rotation);
      if (object.scale) clonedObject.scale.copy(object.scale);
      
      return clonedObject;
      
    } catch (error) {
      console.error('수동 복제 실패:', error);
      console.error('복제 대상 객체:', object);
      
      // 최후의 수단으로 기본 Object3D 반환
      const fallbackObject = new THREE.Object3D();
      fallbackObject.name = (object && object.name) || 'fallback_object';
      return fallbackObject;
    }
  }

  /**
   * 머티리얼 복제 메서드
   * @param {THREE.Material|Array} material 복제할 머티리얼
   * @returns {THREE.Material|Array} 복제된 머티리얼
   */
  cloneMaterial(material) {
    if (Array.isArray(material)) {
      return material.map(mat => mat.clone ? mat.clone() : mat);
    } else {
      return material.clone ? material.clone() : material;
    }
  }

  /**
   * 라이브러리 메쉬 목록 로드
   * @returns {Array} 라이브러리 메쉬 배열
   */
  async loadLibraryMeshes() {
    // 기본값: 라이브러리 매니페스트 비활성화 → 네트워크 요청 자체를 만들지 않아 404 로그 방지
    // 활성화하려면 Vite 환경변수 VITE_ENABLE_LIBRARY_MANIFEST=true 또는 window.__ENABLE_LIBRARY_MANIFEST = true 설정
    const enableByEnv = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ENABLE_LIBRARY_MANIFEST === 'true';
    const enableByWindow = typeof window !== 'undefined' && window.__ENABLE_LIBRARY_MANIFEST === true;
    if (!enableByEnv && !enableByWindow) {
      return [];
    }

    try {
      const manifestUrl = '/library/mesh/manifest.json';
      const res = await fetch(manifestUrl, { method: 'GET', cache: 'no-store' });
      if (!res.ok) return [];
      const files = await res.json(); // 기대 형태: [{filename:'x.glb', name:'표시명'}]
      if (!Array.isArray(files)) return [];
      return files.map((file) => ({
        id: `library_${String(file.filename || '').replace(/\.glb$/i, '')}`,
        name: file.name || file.filename,
        type: 'library',
        geometry: 'LibraryMesh',
        glbUrl: `/library/mesh/${file.filename}`,
        filename: file.filename,
        thumbnail: null,
        isLoadingThumbnail: true
      }));
    } catch (error) {
      // 조용히 무시하고 빈 배열 (패널 오픈 시 404 로그 방지)
      return [];
    }
  }

  /**
   * GLB URL로부터 썸네일 생성
   * @param {string} glbUrl GLB 파일 URL
   * @returns {Promise<string>} 썸네일 데이터 URL
   */
  async generateThumbnailFromURL(glbUrl) {
    // Worker가 있으면 URL을 ArrayBuffer로 페치해 워커로 전달
    if (isWorkerSupported()) {
      try {
        const res = await fetch(glbUrl, { cache: 'no-store' });
        const buf = await res.arrayBuffer();
        const { bitmap } = await workerThumbnailFromGLB(buf, 128);
        return await imageBitmapToDataURL(bitmap);
      } catch (e) {
        // fallback below
      }
    }
    // 메인 스레드 렌더 폴백
    return new Promise((resolve, reject) => {
      this.loader.load(
        glbUrl,
        (gltf) => {
          try {
            const { scene, camera, renderer } = this.thumbnailRenderer;
            // 기존 메쉬 제거
            const toRemove = [];
            scene.traverse((c)=>{ if (c.isMesh) toRemove.push(c); });
            toRemove.forEach(m=>scene.remove(m));
            const model = gltf.scene; scene.add(model);
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ *= 1.5;
            camera.position.set(cameraZ * 0.7, cameraZ * 0.5, cameraZ);
            camera.lookAt(0, 0, 0);
            renderer.render(scene, camera);
            const dataURL = renderer.domElement.toDataURL('image/png');
            scene.remove(model);
            resolve(dataURL);
          } catch (error) { reject(error); }
        },
        undefined,
        (error) => reject(error)
      );
    });
  }

  /**
   * 3D 오브젝트로부터 썸네일 생성
   * @param {THREE.Object3D} object 3D 오브젝트
   * @param {number} size 썸네일 크기
   * @returns {string} 썸네일 데이터 URL
   */
  generateThumbnailFromObject(object, size = 128) {
  // 썸네일 전용 리소스 재사용
  const { scene: tempScene, camera: tempCamera, renderer: tempRenderer } = this.thumbnailRenderer;
  tempRenderer.setSize(size, size);
  tempRenderer.setClearColor(0x2a2a2a, 1);
  // 씬 초기화
  while (tempScene.children.length) tempScene.remove(tempScene.children[0]);
  this.setupLighting(tempScene);

    // 오브젝트 안전하게 복제 및 씬에 추가
    let clonedObject;
    try {
      if (typeof object.clone === 'function') {
        clonedObject = object.clone();
      } else {
        clonedObject = this.createSafeClone(object);
      }
    } catch (error) {
      console.warn('썸네일 생성을 위한 객체 복제 실패, 수동 복제 시도:', error);
      clonedObject = this.createSafeClone(object);
    }
    tempScene.add(clonedObject);

    // 바운딩 박스 계산
    const box = new THREE.Box3().setFromObject(clonedObject);
    const center = box.getCenter(new THREE.Vector3());
    const size3 = box.getSize(new THREE.Vector3());

  // 모델의 원점은 유지 (피벗 유지)

    // 카메라 위치 조정
    const maxDim = Math.max(size3.x, size3.y, size3.z);
    const fov = tempCamera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    
    // 적절한 거리로 조정 (약간 더 멀리)
    cameraZ *= 1.5;
    
    tempCamera.position.set(cameraZ * 0.7, cameraZ * 0.5, cameraZ);
    tempCamera.lookAt(0, 0, 0);

    // 렌더링
    tempRenderer.render(tempScene, tempCamera);

    // 데이터 URL로 변환
    const dataURL = tempRenderer.domElement.toDataURL('image/png');

  // 정리: 씬 비우지만 컨텍스트는 유지 (재사용)
  tempScene.clear();

    return dataURL;
  }

  /**
   * 가능하면 하나의 Mesh로 병합하여 반환
   * - 정적 Mesh만 지원(스키닝/인스턴스/멀티머티리얼 혼합 시 실패)
   * - 머티리얼은 입력 순서로 배열을 구성하고, mergeBufferGeometries(useGroups=true)로 그룹 매칭
   */
  _buildSingleMesh(object, { preserveTransform = true } = {}) {
    try {
      if (!object) return null;
      const root = (typeof object.clone === 'function') ? object.clone(true) : this.createSafeClone(object);
      root.updateMatrixWorld(true);

      const invRoot = new THREE.Matrix4();
      invRoot.copy(root.matrixWorld).invert();

      const geometries = [];
      const materials = [];

      const pushMesh = (mesh) => {
        if (mesh.isSkinnedMesh || mesh.isInstancedMesh) return false;
        if (Array.isArray(mesh.material)) return false; // 입력은 단일 재질만 허용
        const src = mesh.geometry;
        if (!src || !src.isBufferGeometry) return false;
        const geo = src.clone();
        const m = new THREE.Matrix4();
        // 항상 루트 기준(local)으로 굽기: invRoot * mesh.matrixWorld
        m.copy(mesh.matrixWorld);
        m.premultiply(invRoot);
        geo.applyMatrix4(m);
        try { geo.clearGroups(); } catch {}
        geometries.push(geo);
        materials.push(mesh.material);
        return true;
      };

      let ok = true;
      root.traverse((n) => {
        if (!ok) return;
        const ud = n.userData || {};
        const isSystem = !!(ud.isSystemObject || ud.isRayHelper || ud.isLightHelper || ud.isLightTarget || ud.isLightTargetHandle || ud.isHelper);
        if (n.isMesh && !isSystem) ok = pushMesh(n);
      });
      if (!ok || geometries.length === 0) return null;

  const merged = BufferGeometryUtils.mergeGeometries(geometries, true);
      if (!merged || !merged.groups || merged.groups.length !== materials.length) return null;

      const single = new THREE.Mesh(merged, materials);
      single.name = object.name || 'MergedMesh';
      single.position.set(0,0,0); single.rotation.set(0,0,0); single.scale.set(1,1,1);
      return single;
    } catch (e) {
      console.warn('단일 메시 병합 실패:', e);
      return null;
    }
  }

  /**
   * 3D 오브젝트를 GLB 형식으로 익스포트
   * @param {THREE.Object3D} object 익스포트할 3D 오브젝트
   * @param {Object} options 익스포트 옵션
   * @param {boolean} options.preserveTransform 변환 값 유지 여부 (기본값: false)
   * @returns {Promise<ArrayBuffer>} GLB 데이터
   */
  async exportObjectToGLB(object, options = {}) {
    const { preserveTransform = false } = options;
    
    // 1) Try worker-based export when supported, using Object3D.toJSON
    if (isWorkerSupported()) {
      try {
        const json = object?.toJSON ? object.toJSON() : new THREE.Object3D().toJSON();
        const { glb } = await workerExportGLBFromObjectJSON(json, { preserveTransform, compressToSingleMesh: true });
        if (glb && (glb.byteLength || (glb.buffer && glb.buffer.byteLength))) {
          return glb;
        }
      } catch (e) {
        // fallback to main thread exporter below
      }
    }

    return new Promise((resolve, reject) => {
      // 오브젝트를 안전하게 복제하여 변환 초기화
      let clonedObject;
      try {
        // clone 메서드가 있는지 확인하고 사용
        if (typeof object.clone === 'function') {
          clonedObject = object.clone();
        } else {
          // clone 메서드가 없거나 작동하지 않는 경우 수동으로 복제
          clonedObject = this.createSafeClone(object);
        }
      } catch (error) {
        console.warn('객체 복제 실패, 수동 복제 시도:', error);
        clonedObject = this.createSafeClone(object);
      }
      
      // 복제된 객체 유효성 검사
      if (!clonedObject || typeof clonedObject !== 'object') {
        reject(new Error('객체 복제에 실패했습니다.'));
        return;
      }
      
      // 변환 값 처리 (안전한 방식)
      if (preserveTransform) {
        // 현재 월드 변환을 지오메트리에 굽고, 루트는 항등으로 초기화
        try {
          clonedObject.updateMatrixWorld?.(true);
          const invRoot = new THREE.Matrix4().copy(clonedObject.matrixWorld).invert();
          // 1) 각 Mesh의 월드변환을 지오메트리에 베이크
          clonedObject.traverse?.((n) => {
            if (!n || !n.isMesh || !n.geometry || !n.geometry.isBufferGeometry) return;
            const mat = new THREE.Matrix4().copy(n.matrixWorld).premultiply(invRoot);
            try {
              const g = n.geometry;
              const baked = g.clone();
              baked.applyMatrix4(mat);
              n.geometry = baked;
            } catch {}
          });
          // 2) 베이크 후 모든 노드의 트랜스폼을 항등으로 리셋(이중 적용 방지)
          clonedObject.traverse?.((n) => {
            try {
              if (n.position && typeof n.position.set === 'function') n.position.set(0, 0, 0);
              if (n.rotation && typeof n.rotation.set === 'function') n.rotation.set(0, 0, 0, 'XYZ');
              if (n.scale && typeof n.scale.set === 'function') n.scale.set(1, 1, 1);
              n.updateMatrix?.();
              n.updateMatrixWorld?.(false);
            } catch {}
          });
        } catch {}
        // 루트 변환은 항등으로
        try {
          clonedObject.position?.set(0, 0, 0);
          clonedObject.rotation?.set(0, 0, 0, 'XYZ');
          clonedObject.scale?.set(1, 1, 1);
        } catch {}
      } else {
        // 기본 모드: 위치, 회전, 크기를 초기화 (안전하게)
        try {
          if (clonedObject.position && typeof clonedObject.position.set === 'function') {
            clonedObject.position.set(0, 0, 0);
          }
          if (clonedObject.rotation && typeof clonedObject.rotation.set === 'function') {
            // Euler 회전 설정 시 order 명시
            clonedObject.rotation.set(0, 0, 0, 'XYZ');
          }
          if (clonedObject.scale && typeof clonedObject.scale.set === 'function') {
            clonedObject.scale.set(1, 1, 1);
          }
        } catch (transformError) {
          console.warn('변환 값 설정 실패:', transformError);
        }
      }
  // 머티리얼은 가능한 한 원본 레퍼런스를 유지하여
  // GLTFExporter가 텍스처/확장(KHR_*) 정보를 그대로 직렬화하도록 둡니다.
      
      this.exporter.parse(
        clonedObject,
        (gltf) => {
          resolve(gltf);
        },
        (error) => {
          reject(error);
        },
        { 
          binary: true, // GLB 형식으로 익스포트
          includeCustomExtensions: true, // 커스텀 확장 포함
          embedImages: true, // 이미지를 GLB에 포함
          maxTextureSize: 1024, // 텍스처 최대 크기
          forcePowerOfTwoTextures: false, // 2의 거듭제곱 텍스처 강제 비활성화
          truncateDrawRange: false // 드로우 범위 절단 비활성화
        }
      );
    });
  }

  /**
   * 커스텀 메쉬를 라이브러리에 추가
   * @param {THREE.Object3D} object 추가할 3D 오브젝트
   * @param {string} name 메쉬 이름
   * @param {Object} options 추가 옵션
   * @param {boolean} options.preserveTransform 변환 값 유지 여부 (기본값: true)
   * @returns {Promise<Object>} 저장된 메쉬 데이터
   */
  async addCustomMesh(object, name, options = {}) {
    const { preserveTransform = true, compressToSingleMesh = true } = options;
    
    try {
      // 단일 메시 병합: 워커가 있으면 워커 내에서 수행 → 메인 스레드 부하 감소
      let exportTarget = object;
      if (compressToSingleMesh && !isWorkerSupported()) {
        const merged = this._buildSingleMesh(object, { preserveTransform });
        if (merged) exportTarget = merged;
      }

      // 비어있는 대상 방지
      if (!this._hasRenderableMesh(exportTarget)) {
        throw new Error('NO_MESH_FOUND');
      }

      // GLB 데이터 생성 (변환 값 유지 옵션 적용)
  const glbData = await this.exportObjectToGLB(exportTarget, { preserveTransform });
      
      // 썸네일 생성: 워커가 있으면 오브젝트 JSON 기반으로 워커에게, 실패 시 폴백
      let thumbnail = null;
      if (isWorkerSupported()) {
        try {
          const json = object?.toJSON ? object.toJSON() : new THREE.Object3D().toJSON();
          const { bitmap } = await workerThumbnailFromObjectJSON(json, 128);
          thumbnail = await imageBitmapToDataURL(bitmap);
        } catch {}
      }
      if (!thumbnail) {
        thumbnail = this.generateThumbnailFromObject(object);
      }
      
      // 파일명 생성 (타임스탬프 기반)
      const timestamp = Date.now();
      const fileName = `custom_${timestamp}.glb`;
      
      // 메쉬 데이터 객체 생성
      const meshData = {
        id: `custom_${timestamp}`,
        name: name || '커스텀 메쉬',
        fileName: fileName,
        thumbnail: thumbnail,
        type: 'custom',
        glbData: glbData,
        createdAt: timestamp,
        // 변환 정보도 저장 (참고용)
        transform: (object && object.position && object.rotation && object.scale) ? {
          position: { x: object.position.x, y: object.position.y, z: object.position.z },
          rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
          scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z }
        } : undefined
      };

  // IndexedDB에 저장 (완료 보장)
  await this.saveCustomMesh(meshData);

      return meshData;
    } catch (error) {
      console.error('커스텀 메쉬 추가 실패:', error);
      throw new Error('ADD_CUSTOM_MESH_FAILED');
    }
  }

  /**
   * 커스텀 메쉬를 로컬 스토리지에 저장
   * @param {Object} meshData 메쉬 데이터
   */
  async saveCustomMesh(meshData) {
    // IndexedDB에 저장 (ArrayBuffer 그대로 보관)
    try {
      await idbAddCustomMesh(meshData);
    } catch (e) {
      console.error('IndexedDB 저장 실패:', e)
      throw new Error('IDB_SAVE_FAILED')
    }
    
  }

  /**
   * 로컬 스토리지에서 커스텀 메쉬 목록 가져오기
   * @returns {Array} 커스텀 메쉬 배열
   */
  async getCustomMeshes() {
    const meshes = await idbGetAllCustomMeshes();
    // 썸네일이 Blob이면 Object URL로 변환해 UI에서 직접 사용 가능하도록 가공
  const processed = await Promise.all(meshes.map(async (m) => {
      const out = { ...m };
  // 패널/드롭 핸들러에서 인식되도록 명시적 타입 부여
  if (!out.type) out.type = 'custom';
      if (m && m.thumbnail && typeof m.thumbnail === 'object' && 'size' in m.thumbnail) {
        try {
          const dataCached = this._thumbDataUrlCache.get(m.id);
          if (dataCached) {
            out.thumbnail = dataCached;
          } else {
            // Convert Blob -> data URL (small size; stable, no revoke needed)
            out.thumbnail = await new Promise((resolve, reject) => {
              try {
                const fr = new FileReader();
                fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : '');
                fr.onerror = () => reject(fr.error || new Error('FileReader error'));
                fr.readAsDataURL(m.thumbnail);
              } catch (e) { reject(e); }
            });
            this._thumbDataUrlCache.set(m.id, out.thumbnail);
          }
        } catch {}
      }
      return out;
    }));
    
    return processed;
  }

  /**
   * 커스텀 메쉬 삭제
   * @param {string} meshId 삭제할 메쉬 ID
   * @returns {Array} 업데이트된 커스텀 메쉬 배열
   */
  async deleteCustomMesh(meshId) {
    try {
      await idbDeleteCustomMesh(meshId);
      // Revoke cached thumbnail URL if any
      try {
        const url = this._thumbUrlCache.get(meshId);
        if (url) { URL.revokeObjectURL(url); this._thumbUrlCache.delete(meshId); }
      } catch {}
  // Drop data URL cache
  try { this._thumbDataUrlCache.delete(meshId); } catch {}
    } catch (e) {
      console.error('IndexedDB 삭제 실패:', e)
      throw new Error('IDB_DELETE_FAILED')
    }
    
    // 호출자가 새 목록을 원하면 getCustomMeshes()를 다시 호출
    const meshes = await idbGetAllCustomMeshes();
    return meshes;
  }

  /**
   * GLB 데이터를 Blob URL로 변환
   * @param {ArrayBuffer|Uint8Array|Array} glbData GLB 데이터
   * @returns {string} Blob URL
   */
  createBlobURL(glbData) {
    try {
      let binaryData;
      
      // 데이터 타입에 따라 적절히 처리
      if (glbData instanceof ArrayBuffer) {
        binaryData = glbData;
      } else if (glbData instanceof Uint8Array) {
        binaryData = glbData.buffer;
      } else if (typeof glbData === 'object' && glbData.type === 'Buffer') {
        // Node.js Buffer 객체나 JSON으로 직렬화된 Buffer
        binaryData = new Uint8Array(glbData.data || glbData).buffer;
      } else if (Array.isArray(glbData)) {
        // 배열 형태로 저장된 경우
        binaryData = new Uint8Array(glbData).buffer;
      } else {
        console.error('지원되지 않는 GLB 데이터 형식:', typeof glbData, glbData);
        throw new Error('GLB 데이터를 처리할 수 없습니다.');
      }
      
      
      const blob = new Blob([binaryData], { type: 'model/gltf-binary' });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Blob URL 생성 실패:', error, glbData);
      throw error;
    }
  }

  /**
   * GLB URL에서 3D 모델 로드
   * @param {string} glbUrl GLB 파일 URL
   * @returns {Promise<THREE.Group>} 로드된 3D 모델
   */
  async loadGLBModel(glbUrl) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        glbUrl,
        (gltf) => {
          resolve(gltf.scene);
        },
        (progress) => {
          // 로딩 진행 상황 (필요시 사용)
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * 리소스 정리
   */
  dispose() {
    if (this.thumbnailRenderer) {
      this.thumbnailRenderer.renderer.dispose();
      this.thumbnailRenderer.scene.clear();
      this.thumbnailRenderer = null;
    }
  }
}

// 싱글톤 인스턴스
let glbMeshManagerInstance = null;

/**
 * GLBMeshManager 싱글톤 인스턴스 반환
 * @returns {GLBMeshManager} GLBMeshManager 인스턴스
 */
export const getGLBMeshManager = () => {
  if (!glbMeshManagerInstance) {
    glbMeshManagerInstance = new GLBMeshManager();
  }
  return glbMeshManagerInstance;
};

/**
 * GLBMeshManager 인스턴스 정리
 */
export const disposeGLBMeshManager = () => {
  if (glbMeshManagerInstance) {
    glbMeshManagerInstance.dispose();
    glbMeshManagerInstance = null;
  }
};
