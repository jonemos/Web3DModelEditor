import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

class ThumbnailGenerator {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      preserveDrawingBuffer: true 
    });
    
    // 썸네일 크기 설정
    this.thumbnailSize = 128;
    this.renderer.setSize(this.thumbnailSize, this.thumbnailSize);
    this.renderer.setClearColor(0x2a2a2a, 1); // 어두운 배경
    
    // 조명 설정
    this.setupLighting();
    
    // GLTFLoader 초기화
    this.loader = new GLTFLoader();
  }

  setupLighting() {
    // 환경광
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);
    
    // 방향광 (메인 라이트)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
    
    // 보조 라이트
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-1, -1, -1);
    this.scene.add(directionalLight2);
  }

  async generateThumbnail(glbUrl) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        glbUrl,
        (gltf) => {
          try {
            // 기존 메쉬들 제거
            const meshesToRemove = [];
            this.scene.traverse((child) => {
              if (child.isMesh) {
                meshesToRemove.push(child);
              }
            });
            meshesToRemove.forEach(mesh => this.scene.remove(mesh));
            
            // 새 모델 추가
            const model = gltf.scene;
            this.scene.add(model);
            
            // 바운딩 박스 계산
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // 모델을 중앙으로 이동
            model.position.sub(center);
            
            // 카메라 위치 조정
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = this.camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            
            // 적절한 거리로 조정 (약간 더 멀리)
            cameraZ *= 1.5;
            
            this.camera.position.set(cameraZ * 0.7, cameraZ * 0.5, cameraZ);
            this.camera.lookAt(0, 0, 0);
            
            // 렌더링
            this.renderer.render(this.scene, this.camera);
            
            // 캔버스에서 데이터 URL 생성
            const dataURL = this.renderer.domElement.toDataURL('image/png');
            
            // 모델 제거
            this.scene.remove(model);
            
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

  dispose() {
    this.renderer.dispose();
    this.scene.clear();
  }
}

// 싱글톤 인스턴스
let thumbnailGenerator = null;

export const generateThumbnail = async (glbUrl) => {
  if (!thumbnailGenerator) {
    thumbnailGenerator = new ThumbnailGenerator();
  }
  
  try {
    return await thumbnailGenerator.generateThumbnail(glbUrl);
  } catch (error) {
    console.error('썸네일 생성 실패:', error);
    return null;
  }
};

export const disposeThumbnailGenerator = () => {
  if (thumbnailGenerator) {
    thumbnailGenerator.dispose();
    thumbnailGenerator = null;
  }
};
