import * as THREE from 'three';

export class CameraController {
  constructor(camera, renderer, onCameraChange = null) {
    this.camera = camera;
    this.renderer = renderer;
    this.onCameraChange = onCameraChange;
    
    // 초기 카메라 상태 저장 (리셋용)
    this.initialPosition = camera.position.clone();
    this.initialTarget = new THREE.Vector3(0, 0, 0);
    
    // 카메라 타겟과 구면 좌표
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.spherical = new THREE.Spherical();
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
    
    // 재사용 가능한 Vector3 객체들 (성능 최적화)
    this._tempVector1 = new THREE.Vector3();
    this._tempVector2 = new THREE.Vector3();
    this._tempVector3 = new THREE.Vector3();
    
    // Console output removed
    // Console output removed
    // Console output removed
    // Console output removed
  }
  
  // 카메라를 초기 위치로 리셋 (편집 모드에서만)
  resetCamera() {
    // Console output removed
    
    // 초기 위치와 타겟으로 리셋
    this.camera.position.copy(this.initialPosition);
    this.cameraTarget.copy(this.initialTarget);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    
    // 구면 좌표 ?�데?�트
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
    
    // Console output removed
    // Console output removed
  }

  // 카메라 투영 모드 전환 (Perspective 또는 Orthographic)
  toggleProjection() {
    const currentCamera = this.camera;
    const position = currentCamera.position.clone();
    const target = this.cameraTarget.clone();
    
    // 현재 카메라가 PerspectiveCamera인지 확인
    if (currentCamera.isPerspectiveCamera) {
      // Console output removed
      
      // 카메라와 타겟과의 거리 계산
      const distance = position.distanceTo(target);
      
      // OrthographicCamera 생성
      const aspect = window.innerWidth / window.innerHeight;
      const frustumSize = distance * 0.5; // 거리에 따른 적절한 크기
      
      const orthographicCamera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2, frustumSize * aspect / 2,
        frustumSize / 2, frustumSize / -2,
        0.1, 1000
      );
      
      // 위치와 방향 복사
      orthographicCamera.position.copy(position);
      orthographicCamera.lookAt(target);
      orthographicCamera.updateMatrixWorld();
      
      // 카메라 교체
      this.camera = orthographicCamera;
      
    } else {
      // Console output removed
      
      // PerspectiveCamera 생성
      const perspectiveCamera = new THREE.PerspectiveCamera(
        75, window.innerWidth / window.innerHeight, 0.1, 1000
      );
      
      // 위치와 방향 복사
      perspectiveCamera.position.copy(position);
      perspectiveCamera.lookAt(target);
      perspectiveCamera.updateMatrixWorld();
      
      // 카메라 교체
      this.camera = perspectiveCamera;
    }
    
    // 구면 좌표 업데이트
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
    
    // 카메라 변경 콜백 호출
    if (this.onCameraChange) {
      this.onCameraChange(this.camera);
    }
    
    // Console output removed
    return this.camera;
  }
  
  // 카메라 뷰 설정 (정면, 측면, 위 아래)
  setView(viewType) {
    const distance = this.camera.position.distanceTo(this.cameraTarget);
    const target = this.cameraTarget.clone();
    let newPosition = new THREE.Vector3();
    
    switch (viewType) {
      case 'front': // 정면 (Z축에서 바라보기)
        newPosition.set(target.x, target.y, target.z + distance);
        break;
      case 'side': // 측면 (X축에서 바라보기)
        newPosition.set(target.x + distance, target.y, target.z);
        break;
      case 'top': // 위 (Y축에서 바라보기)
        newPosition.set(target.x, target.y + distance, target.z);
        break;
      case 'bottom': // 아래 (Y축 아래에서 바라보기)
        newPosition.set(target.x, target.y - distance, target.z);
        break;
      default:
        // Console output removed
        return;
    }
    
    // Console output removed
    
    // 카메라 위치 설정
    this.camera.position.copy(newPosition);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
    
    // 구면 좌표 업데이트
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
    
    // Console output removed
  }
  
  // 패닝 기능
  pan(deltaX, deltaY) {
    // Console output removed
    
    const panSpeed = 50;
    
    // 카메라의 로컬 좌표계 기준으로 이동
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    
    right.setFromMatrixColumn(this.camera.matrix, 0);
    up.setFromMatrixColumn(this.camera.matrix, 1);
    
    // 거리에 따른 패닝 속도 조정
    const distance = this.camera.position.distanceTo(this.cameraTarget);
    const adjustedPanSpeed = panSpeed * (distance / 50);
    
    const panOffset = new THREE.Vector3();
    panOffset.add(right.clone().multiplyScalar(-deltaX * adjustedPanSpeed));
    panOffset.add(up.clone().multiplyScalar(-deltaY * adjustedPanSpeed));
    
    this.camera.position.add(panOffset);
    this.cameraTarget.add(panOffset);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    
    // 구면 좌표 업데이트
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
  }

  // 패닝 후 화면 중앙의 오브젝트로 회전 중심을 설정
  updateRotationCenterAfterPan(scene, selectableObjects = []) {
    // Console output removed
    // Console output removed
    
    // 화면 중앙에서 레이캐스팅
    const raycaster = new THREE.Raycaster();
    const screenCenter = new THREE.Vector2(0, 0); // 화면 중앙 (NDC 좌표)
    
    raycaster.setFromCamera(screenCenter, this.camera);
    // Console output removed
    // Console output removed
    
    // 선택 가능한 오브젝트들과 교차점 확인
    const intersects = raycaster.intersectObjects(selectableObjects, true);
    // Console output removed
    
    if (intersects.length > 0) {
      // 오브젝트와 교차하는 경우, 교차점을 새로운 회전 중심으로 설정
      const intersectionPoint = intersects[0].point;
      this.cameraTarget.copy(intersectionPoint);
      // Console output removed
    } else {
      // 오브젝트와 교차하지 않는 경우, 현재 타겟에서 일정 거리만큼 앞의 점을 사용
      const direction = new THREE.Vector3();
      direction.setFromMatrixColumn(this.camera.matrix, 2).negate(); // 카메라의 전면 방향
      
      const newTarget = this.camera.position.clone().add(direction.multiplyScalar(50));
      this.cameraTarget.copy(newTarget);
      // Console output removed
    }
    
    // 구면 좌표 업데이트
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
    // Console output removed
    // Console output removed
  }
  
  // 궤도 회전 기능
  orbit(deltaX, deltaY) {
    // Console output removed
    
    const orbitSpeed = 100;
    
    // F키에 의한 포커스시에만 회전 중심이 변경됨
    // 현재 설정된 cameraTarget을 그대로 사용 (포커스 설정된 회전 중심이나 기본 중심에서만)
    
    // Console output removed
    
    // 구면 좌표로 카메라 회전
    this.spherical.theta -= deltaX * orbitSpeed * 0.01;
    this.spherical.phi += deltaY * orbitSpeed * 0.01;
    
    // phi 각도 제한 (카메라 반전 방지)
    this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi));
    
    // 새 카메라 위치 계산
    const newPosition = new THREE.Vector3();
    newPosition.setFromSpherical(this.spherical);
    newPosition.add(this.cameraTarget);
    
    this.camera.position.copy(newPosition);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
  }
  
  // 줌 기능
  zoom(delta) {
    // Console output removed
    
    const zoomSpeed = 1.2;
    const factor = delta > 0 ? zoomSpeed : 1 / zoomSpeed;
    
    if (this.camera.isPerspectiveCamera) {
      // Perspective 카메라: 거리 조정
      this.spherical.radius *= factor;
      this.spherical.radius = Math.max(1, Math.min(1000, this.spherical.radius));
      
      const newPosition = new THREE.Vector3();
      newPosition.setFromSpherical(this.spherical);
      newPosition.add(this.cameraTarget);
      
      this.camera.position.copy(newPosition);
      this.camera.lookAt(this.cameraTarget);
      this.camera.updateMatrixWorld();
      
    } else if (this.camera.isOrthographicCamera) {
      // Orthographic 카메라: frustum 크기 조정
      const currentWidth = this.camera.right - this.camera.left;
      const currentHeight = this.camera.top - this.camera.bottom;
      
      const newWidth = currentWidth * factor;
      const newHeight = currentHeight * factor;
      
      // 최소/최대 크기 제한
      const maxSize = 2000;
      const minSize = 0.1;
      const clampedWidth = Math.max(minSize, Math.min(maxSize, newWidth));
      const clampedHeight = Math.max(minSize, Math.min(maxSize, newHeight));
      
      // frustum 업데이트
      this.camera.left = -clampedWidth / 2;
      this.camera.right = clampedWidth / 2;
      this.camera.top = clampedHeight / 2;
      this.camera.bottom = -clampedHeight / 2;
      
      this.camera.updateProjectionMatrix();
    }
  }
  
  // 오브젝트에 포커스
  focusOnObject(object) {
    if (!object) return;
    
    // 유효한 Three.js 객체인지 확인
    if (!object.isObject3D && !object.isMesh && !object.isGroup) {
      console.warn('focusOnObject: Invalid object type', object);
      return;
    }
    
    try {
      // 객체의 월드 매트릭스 업데이트
      if (typeof object.updateMatrixWorld === 'function') {
        object.updateMatrixWorld(true);
      }
      
      // 오브젝트의 바운딩 박스 계산
      const box = new THREE.Box3().setFromObject(object);
      
      // 바운딩 박스가 유효한지 확인
      if (box.isEmpty()) {
        console.warn('focusOnObject: Empty bounding box for object', object);
        return;
      }
      
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // 적절한 거리 계산
      const maxDim = Math.max(size.x, size.y, size.z);
      let distance;
      
      if (this.camera.isPerspectiveCamera) {
        const fov = this.camera.fov * (Math.PI / 180);
        distance = Math.abs(maxDim / Math.sin(fov / 2)) * 1.5;
      } else {
        distance = maxDim * 2; // Orthographic 카메라용
      }
      
      // 최소 거리 보장
      distance = Math.max(distance, 1);
      
      // 카메라 타겟을 오브젝트 중심으로 설정 (회전 중심 변경)
      this.cameraTarget.copy(center);
      
      // 현재 방향을 유지하면서 거리만 조정
      const direction = new THREE.Vector3();
      direction.subVectors(this.camera.position, this.cameraTarget).normalize();
      
      this.camera.position.copy(center).add(direction.multiplyScalar(distance));
      this.camera.lookAt(this.cameraTarget);
      this.camera.updateMatrixWorld();
      
      // 구면 좌표 업데이트
      this.spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
      
    } catch (error) {
      console.error('focusOnObject: Error focusing on object', error);
    }
  }
  
  // 화면 리사이즈 처리
  handleResize() {
    // PerspectiveCamera와 OrthographicCamera에 따라 다르게 처리
    if (this.camera.isPerspectiveCamera) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    } else if (this.camera.isOrthographicCamera) {
      // OrthographicCamera의 경우 aspect ratio에 따라 left, right, top, bottom 재계산
      const aspect = window.innerWidth / window.innerHeight;
      const frustumHeight = this.camera.top - this.camera.bottom;
      const frustumWidth = frustumHeight * aspect;
      
      this.camera.left = -frustumWidth / 2;
      this.camera.right = frustumWidth / 2;
      this.camera.updateProjectionMatrix();
    }
  }
  
  // 카메라 타겟 설정
  setTarget(target) {
    this.cameraTarget.copy(target);
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
  }
  
  // 현재 카메라 반환
  getCamera() {
    return this.camera;
  }
  
  // 카메라 타겟 반환
  getTarget() {
    return this.cameraTarget.clone();
  }
}
