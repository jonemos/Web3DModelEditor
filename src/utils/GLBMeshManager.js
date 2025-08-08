import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

/**
 * GLB 메쉬 관리를 위한 통합 클래스
 * 라이브러리 메쉬와 커스텀 메쉬의 로드, 저장, 썸네일 생성, 변환 등을 담당
 */
export class GLBMeshManager {
  constructor() {
    this.loader = new GLTFLoader();
    this.exporter = new GLTFExporter();
    this.thumbnailRenderer = null;
    this.initThumbnailRenderer();
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
        preserveDrawingBuffer: true 
      })
    };
    
    const { scene, camera, renderer } = this.thumbnailRenderer;
    
    // 썸네일 크기 설정
    const thumbnailSize = 128;
    renderer.setSize(thumbnailSize, thumbnailSize);
    renderer.setClearColor(0x2a2a2a, 1); // 어두운 배경
    
    // 조명 설정
    this.setupLighting(scene);
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
   * 라이브러리 메쉬 목록 로드
   * @returns {Array} 라이브러리 메쉬 배열
   */
  async loadLibraryMeshes() {
    try {
      // library/mesh 폴더의 GLB 파일 목록
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
      
      // 각 파일에 대해 존재 여부 확인
      for (const file of meshFiles) {
        const glbUrl = `/library/mesh/${file.filename}`;
        
        // 파일 존재 여부 확인
        try {
          const response = await fetch(glbUrl, { method: 'HEAD' });
          if (!response.ok) {
            continue; // 파일이 없으면 건너뛰기
          }
        } catch (error) {
          continue; // 파일 확인 실패 시 건너뛰기
        }
        
        const meshObject = {
          id: `library_${file.filename.replace('.glb', '')}`,
          name: file.name,
          type: 'library',
          geometry: 'LibraryMesh',
          glbUrl: glbUrl,
          filename: file.filename,
          thumbnail: null,
          isLoadingThumbnail: true
        };
        
        meshObjects.push(meshObject);
      }
      
      return meshObjects;
    } catch (error) {
      console.error('라이브러리 메쉬 로드 실패:', error);
      return [];
    }
  }

  /**
   * GLB URL로부터 썸네일 생성
   * @param {string} glbUrl GLB 파일 URL
   * @returns {Promise<string>} 썸네일 데이터 URL
   */
  async generateThumbnailFromURL(glbUrl) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        glbUrl,
        (gltf) => {
          try {
            const { scene, camera, renderer } = this.thumbnailRenderer;
            
            // 기존 메쉬들 제거
            const meshesToRemove = [];
            scene.traverse((child) => {
              if (child.isMesh) {
                meshesToRemove.push(child);
              }
            });
            meshesToRemove.forEach(mesh => scene.remove(mesh));
            
            // 새 모델 추가
            const model = gltf.scene;
            scene.add(model);
            
            // 바운딩 박스 계산
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // 모델을 중앙으로 이동
            model.position.sub(center);
            
            // 카메라 위치 조정
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            
            // 적절한 거리로 조정 (약간 더 멀리)
            cameraZ *= 1.5;
            
            camera.position.set(cameraZ * 0.7, cameraZ * 0.5, cameraZ);
            camera.lookAt(0, 0, 0);
            
            // 렌더링
            renderer.render(scene, camera);
            
            // 캔버스에서 데이터 URL 생성
            const dataURL = renderer.domElement.toDataURL('image/png');
            
            // 모델 제거
            scene.remove(model);
            
            resolve(dataURL);
          } catch (error) {
            reject(error);
          }
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
   * 3D 오브젝트로부터 썸네일 생성
   * @param {THREE.Object3D} object 3D 오브젝트
   * @param {number} size 썸네일 크기
   * @returns {string} 썸네일 데이터 URL
   */
  generateThumbnailFromObject(object, size = 128) {
    // 임시 씬과 카메라 생성
    const tempScene = new THREE.Scene();
    const tempCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const tempRenderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      preserveDrawingBuffer: true 
    });
    
    tempRenderer.setSize(size, size);
    tempRenderer.setClearColor(0x2a2a2a, 1); // 어두운 배경
    
    // 임시 컨테이너에 렌더러 추가 (보이지 않게)
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    document.body.appendChild(tempContainer);
    tempContainer.appendChild(tempRenderer.domElement);

    // 조명 설정
    this.setupLighting(tempScene);

    // 오브젝트 복제 및 씬에 추가
    const clonedObject = object.clone();
    tempScene.add(clonedObject);

    // 바운딩 박스 계산
    const box = new THREE.Box3().setFromObject(clonedObject);
    const center = box.getCenter(new THREE.Vector3());
    const size3 = box.getSize(new THREE.Vector3());

    // 모델을 중앙으로 이동
    clonedObject.position.sub(center);

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

    // 정리
    document.body.removeChild(tempContainer);
    tempRenderer.dispose();
    tempScene.clear();

    return dataURL;
  }

  /**
   * 3D 오브젝트를 GLB 형식으로 익스포트
   * @param {THREE.Object3D} object 익스포트할 3D 오브젝트
   * @returns {Promise<ArrayBuffer>} GLB 데이터
   */
  async exportObjectToGLB(object) {
    return new Promise((resolve, reject) => {
      // 오브젝트를 복제하여 변환 초기화
      const clonedObject = object.clone();
      
      // 위치, 회전, 크기를 초기화
      clonedObject.position.set(0, 0, 0);
      clonedObject.rotation.set(0, 0, 0);
      clonedObject.scale.set(1, 1, 1);
      
      // 머티리얼 복사를 위한 재귀 함수
      const cloneMaterials = (obj) => {
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material = obj.material.map(mat => mat.clone());
          } else {
            obj.material = obj.material.clone();
          }
        }
        obj.children.forEach(child => cloneMaterials(child));
      };
      
      // 머티리얼 복사 적용
      cloneMaterials(clonedObject);
      
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
   * @returns {Promise<Object>} 저장된 메쉬 데이터
   */
  async addCustomMesh(object, name) {
    try {
      // GLB 데이터 생성
      const glbData = await this.exportObjectToGLB(object);
      
      // 썸네일 생성
      const thumbnail = this.generateThumbnailFromObject(object);
      
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
        createdAt: timestamp
      };

      // 로컬 스토리지에 저장
      this.saveCustomMesh(meshData);

      return meshData;
    } catch (error) {
      console.error('커스텀 메쉬 추가 실패:', error);
      throw error;
    }
  }

  /**
   * 커스텀 메쉬를 로컬 스토리지에 저장
   * @param {Object} meshData 메쉬 데이터
   */
  saveCustomMesh(meshData) {
    const customMeshes = this.getCustomMeshes();
    
    // GLB 데이터를 저장 가능한 형태로 변환
    const storableMeshData = {
      ...meshData,
      glbData: Array.from(new Uint8Array(meshData.glbData)) // ArrayBuffer를 배열로 변환
    };
    
    customMeshes.push(storableMeshData);
    localStorage.setItem('customMeshes', JSON.stringify(customMeshes));
    console.log('커스텀 메쉬 저장됨:', storableMeshData.name, '총 개수:', customMeshes.length);
  }

  /**
   * 로컬 스토리지에서 커스텀 메쉬 목록 가져오기
   * @returns {Array} 커스텀 메쉬 배열
   */
  getCustomMeshes() {
    const stored = localStorage.getItem('customMeshes');
    const meshes = stored ? JSON.parse(stored) : [];
    console.log('로컬 스토리지에서 커스텀 메쉬 로드:', meshes.length, '개');
    return meshes;
  }

  /**
   * 커스텀 메쉬 삭제
   * @param {string} meshId 삭제할 메쉬 ID
   * @returns {Array} 업데이트된 커스텀 메쉬 배열
   */
  deleteCustomMesh(meshId) {
    const customMeshes = this.getCustomMeshes();
    const filteredMeshes = customMeshes.filter(mesh => mesh.id !== meshId);
    localStorage.setItem('customMeshes', JSON.stringify(filteredMeshes));
    console.log('커스텀 메쉬 삭제됨:', meshId, '남은 개수:', filteredMeshes.length);
    return filteredMeshes;
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
      
      console.log('GLB 데이터 변환:', typeof glbData, '->', 'ArrayBuffer', binaryData.byteLength, 'bytes');
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
