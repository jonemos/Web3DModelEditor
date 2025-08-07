import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export class MeshLibraryManager {
  constructor() {
    this.exporter = new GLTFExporter();
  }

  // 메쉬를 GLB 파일로 익스포트
  async exportMeshToGLB(object) {
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

  // 메쉬의 썸네일 생성
  generateThumbnail(object, size = 128) {
    // 임시 씬과 카메라 생성
    const tempScene = new THREE.Scene();
    const tempCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const tempRenderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      preserveDrawingBuffer: true 
    });
    
    tempRenderer.setSize(size, size);
    tempRenderer.setClearColor(0x2a2a2a, 1); // 어두운 배경 (라이브러리 메쉬와 동일)
    
    // 임시 컨테이너에 렌더러 추가 (보이지 않게)
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    document.body.appendChild(tempContainer);
    tempContainer.appendChild(tempRenderer.domElement);

    // 조명 설정 (라이브러리 메쉬와 동일)
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    tempScene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    tempScene.add(directionalLight);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-1, -1, -1);
    tempScene.add(directionalLight2);

    // 오브젝트 복제 및 씬에 추가
    const clonedObject = object.clone();
    tempScene.add(clonedObject);

    // 바운딩 박스 계산
    const box = new THREE.Box3().setFromObject(clonedObject);
    const center = box.getCenter(new THREE.Vector3());
    const size3 = box.getSize(new THREE.Vector3());

    // 모델을 중앙으로 이동
    clonedObject.position.sub(center);

    // 카메라 위치 조정 (라이브러리 메쉬와 동일한 방식)
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

  // 커스텀 메쉬를 로컬 스토리지에 저장
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

  // 로컬 스토리지에서 커스텀 메쉬 목록 가져오기
  getCustomMeshes() {
    const stored = localStorage.getItem('customMeshes');
    const meshes = stored ? JSON.parse(stored) : [];
    console.log('로컬 스토리지에서 커스텀 메쉬 로드:', meshes.length, '개');
    return meshes;
  }

  // 메쉬를 라이브러리에 추가
  async addMeshToLibrary(object, name) {
    try {
      // GLB 데이터 생성
      const glbData = await this.exportMeshToGLB(object);
      
      // 썸네일 생성
      const thumbnail = this.generateThumbnail(object);
      
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
      console.error('메쉬 라이브러리 추가 실패:', error);
      throw error;
    }
  }

  // 커스텀 메쉬를 삭제
  deleteCustomMesh(meshId) {
    const customMeshes = this.getCustomMeshes();
    const filteredMeshes = customMeshes.filter(mesh => mesh.id !== meshId);
    localStorage.setItem('customMeshes', JSON.stringify(filteredMeshes));
    console.log('커스텀 메쉬 삭제됨:', meshId, '남은 개수:', filteredMeshes.length);
    return filteredMeshes;
  }

  // GLB 데이터를 Blob URL로 변환
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
}
