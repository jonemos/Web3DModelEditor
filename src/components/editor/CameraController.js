import * as THREE from 'three';

export class CameraController {
  constructor(camera, renderer, onCameraChange = null) {
    this.camera = camera;
    this.renderer = renderer;
    this.onCameraChange = onCameraChange;
    
    // 초기 카메???�태 ?�??(리셋??
    this.initialPosition = camera.position.clone();
    this.initialTarget = new THREE.Vector3(0, 0, 0);
    
    // 카메???�겟과 구면 좌표
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

  // 속도 파라미터 (기본값은 기존 동작 유지)
  this._panSpeed = 50;
  this._orbitSpeed = 100;
  this._zoomSpeed = 0.3; // EditorControls의 wheel 변환 계수와 호환
  }
  
  // 카메?��? 초기 ?�치�?리셋 (?�영 모드???��?)
  resetCamera() {
    // Console output removed
    
    // 초기 ?�치?� ?�겟으�?리셋
    this.camera.position.copy(this.initialPosition);
    this.cameraTarget.copy(this.initialTarget);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    
    // 구면 좌표 ?�데?�트
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
    
    // Console output removed
    // Console output removed
  }

  // 카메???�영 모드 ?��? (Perspective ??Orthographic)
  toggleProjection() {
    const currentCamera = this.camera;
    const position = currentCamera.position.clone();
    const target = this.cameraTarget.clone();
    
    // ?�재 카메?��? PerspectiveCamera?��? ?�인
    if (currentCamera.isPerspectiveCamera) {
      // Console output removed
      
      // 카메?��? ?��??�이??거리 계산
      const distance = position.distanceTo(target);
      
      // OrthographicCamera ?�성
      const aspect = window.innerWidth / window.innerHeight;
      const frustumSize = distance * 0.5; // 거리???�른 ?�절???�기
      
      const orthographicCamera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2, frustumSize * aspect / 2,
        frustumSize / 2, frustumSize / -2,
        0.1, 1000
      );
      
      // ?�치?� 방향 복사
      orthographicCamera.position.copy(position);
      orthographicCamera.lookAt(target);
      orthographicCamera.updateMatrixWorld();
      
      // 카메??교체
      this.camera = orthographicCamera;
      
    } else {
      // Console output removed
      
      // PerspectiveCamera ?�성
      const perspectiveCamera = new THREE.PerspectiveCamera(
        75, window.innerWidth / window.innerHeight, 0.1, 1000
      );
      
      // ?�치?� 방향 복사
      perspectiveCamera.position.copy(position);
      perspectiveCamera.lookAt(target);
      perspectiveCamera.updateMatrixWorld();
      
      // 카메??교체
      this.camera = perspectiveCamera;
    }
    
    // 구면 좌표 ?�데?�트
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
    
    // 카메??변�?콜백 ?�출
    if (this.onCameraChange) {
      this.onCameraChange(this.camera);
    }
    
    // Console output removed
    return this.camera;
  }
  
  // 카메??�??�정 (?�면, 측면, ?? ?�래)
  setView(viewType) {
    const distance = this.camera.position.distanceTo(this.cameraTarget);
    const target = this.cameraTarget.clone();
    let newPosition = new THREE.Vector3();
    
    switch (viewType) {
      case 'front': // ?�면 (Z축에??바라보기)
        newPosition.set(target.x, target.y, target.z + distance);
        break;
      case 'side': // 측면 (X축에??바라보기)
        newPosition.set(target.x + distance, target.y, target.z);
        break;
      case 'top': // ??(Y축에??바라보기)
        newPosition.set(target.x, target.y + distance, target.z);
        break;
      case 'bottom': // ?�래 (Y�??�래?�서 바라보기)
        newPosition.set(target.x, target.y - distance, target.z);
        break;
      default:
        // Console output removed
        return;
    }
    
    // Console output removed
    
    // 카메???�치 ?�정
    this.camera.position.copy(newPosition);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
    
    // 구면 좌표 ?�데?�트
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
    
    // Console output removed
  }
  
  // ??기능
  pan(deltaX, deltaY) {
    // Console output removed
    
  const panSpeed = this._panSpeed;
    
    // 카메?�의 로컬 좌표�?기�??�로 ?�동
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    
    right.setFromMatrixColumn(this.camera.matrix, 0);
    up.setFromMatrixColumn(this.camera.matrix, 1);
    
    // 거리???�른 ???�도 조정
    const distance = this.camera.position.distanceTo(this.cameraTarget);
    const adjustedPanSpeed = panSpeed * (distance / 50);
    
    const panOffset = new THREE.Vector3();
    panOffset.add(right.clone().multiplyScalar(-deltaX * adjustedPanSpeed));
    panOffset.add(up.clone().multiplyScalar(-deltaY * adjustedPanSpeed));
    
    this.camera.position.add(panOffset);
    this.cameraTarget.add(panOffset);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    
    // 구면 좌표 ?�데?�트
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
  }

  // ???�료 ???�면 중앙???�로???�전 중심?�로 ?�정
  updateRotationCenterAfterPan(scene, selectableObjects = []) {
    // Console output removed
    // Console output removed
    
    // ?�면 중앙?�서 ?�이캐스??
    const raycaster = new THREE.Raycaster();
    const screenCenter = new THREE.Vector2(0, 0); // ?�면 중앙 (NDC 좌표)
    
    raycaster.setFromCamera(screenCenter, this.camera);
    // Console output removed
    // Console output removed
    
    // ?�택 가?�한 ?�브?�트?�과 교차???�인
    const intersects = raycaster.intersectObjects(selectableObjects, true);
    // Console output removed
    
    if (intersects.length > 0) {
      // ?�브?�트?� 교차?�는 경우, 교차?�을 ?�로???�전 중심?�로 ?�정
      const intersectionPoint = intersects[0].point;
      this.cameraTarget.copy(intersectionPoint);
      // Console output removed
    } else {
      // ?�브?�트?� 교차?��? ?�는 경우, ?�재 ?�겟에???�정 거리만큼 ?�의 ?�을 ?�용
      const direction = new THREE.Vector3();
      direction.setFromMatrixColumn(this.camera.matrix, 2).negate(); // 카메?�의 ??방향
      
      const newTarget = this.camera.position.clone().add(direction.multiplyScalar(50));
      this.cameraTarget.copy(newTarget);
      // Console output removed
    }
    
    // 구면 좌표 ?�데?�트
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
    // Console output removed
    // Console output removed
  }
  
  // 궤도 ?�전 기능
  orbit(deltaX, deltaY) {
    // Console output removed
    
  const orbitSpeed = this._orbitSpeed;
    
    // F?��? ?�한 ?�커?�에?�만 ?�전 중심??변경됨
    // ?�재 ?�정??cameraTarget??그�?�??�용 (?????�정???�전 중심?�나 기본 중심???��?)
    
    // Console output removed
    
    // 구면 좌표�?카메???�전
    this.spherical.theta -= deltaX * orbitSpeed * 0.01;
    this.spherical.phi += deltaY * orbitSpeed * 0.01;
    
    // phi 각도 ?�한 (?�아??반전 방�?)
    this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi));
    
    // ??카메???�치 계산
    const newPosition = new THREE.Vector3();
    newPosition.setFromSpherical(this.spherical);
    newPosition.add(this.cameraTarget);
    
    this.camera.position.copy(newPosition);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
  }
  
  // �?기능
  zoom(delta) {
    // Console output removed
    
  // zoomSpeed는 휠 delta를 EditorControls에서 0.3 스케일로 전달 → 여기선 승수로 사용
  const zoomSpeed = Math.max(0.01, this._zoomSpeed);
  const factor = delta > 0 ? (1 + zoomSpeed) : 1 / (1 + zoomSpeed);
    
    if (this.camera.isPerspectiveCamera) {
      // Perspective 카메?? 거리 조정
      this.spherical.radius *= factor;
      this.spherical.radius = Math.max(1, Math.min(1000, this.spherical.radius));
      
      const newPosition = new THREE.Vector3();
      newPosition.setFromSpherical(this.spherical);
      newPosition.add(this.cameraTarget);
      
      this.camera.position.copy(newPosition);
      this.camera.lookAt(this.cameraTarget);
      this.camera.updateMatrixWorld();
      
    } else if (this.camera.isOrthographicCamera) {
      // Orthographic 카메?? frustum ?�기 조정
      const currentWidth = this.camera.right - this.camera.left;
      const currentHeight = this.camera.top - this.camera.bottom;
      
      const newWidth = currentWidth * factor;
      const newHeight = currentHeight * factor;
      
      // 최소/최�? ?�기 ?�한
      const maxSize = 2000;
      const minSize = 0.1;
      const clampedWidth = Math.max(minSize, Math.min(maxSize, newWidth));
      const clampedHeight = Math.max(minSize, Math.min(maxSize, newHeight));
      
      // frustum ?�데?�트
      this.camera.left = -clampedWidth / 2;
      this.camera.right = clampedWidth / 2;
      this.camera.top = clampedHeight / 2;
      this.camera.bottom = -clampedHeight / 2;
      
      this.camera.updateProjectionMatrix();
    }
  }

  // 속도 설정 API
  setSpeeds({ pan, orbit, zoom } = {}) {
    if (Number.isFinite(pan)) this._panSpeed = pan;
    if (Number.isFinite(orbit)) this._orbitSpeed = orbit;
    if (Number.isFinite(zoom)) this._zoomSpeed = zoom;
  }
  
  // ?�브?�트???�커??
  focusOnObject(object) {
    if (!object) return;
    
    // Console output removed
    
    // ?�브?�트??바운??박스 계산
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // ?�절??거리 계산
    const maxDim = Math.max(size.x, size.y, size.z);
    let distance;
    
    if (this.camera.isPerspectiveCamera) {
      const fov = this.camera.fov * (Math.PI / 180);
      distance = Math.abs(maxDim / Math.sin(fov / 2)) * 1.5;
    } else {
      distance = maxDim * 2; // Orthographic 카메?�용
    }
    
    // 카메???�겟을 ?�브?�트 중심?�로 ?�정 (?�전 중심 변�?
    this.cameraTarget.copy(center);
    // Console output removed
    
    // ?�재 방향???��??�면??거리�?조정
    const direction = new THREE.Vector3();
    direction.subVectors(this.camera.position, this.cameraTarget).normalize();
    
    this.camera.position.copy(center).add(direction.multiplyScalar(distance));
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    
    // 구면 좌표 ?�데?�트
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
    
    // Console output removed
    // Console output removed
  }
  
  // ?�도??리사?�즈 처리
  handleResize() {
    // PerspectiveCamera?� OrthographicCamera???�라 ?�르�?처리
    if (this.camera.isPerspectiveCamera) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    } else if (this.camera.isOrthographicCamera) {
      // OrthographicCamera??경우 aspect ratio???�라 left, right, top, bottom ?�계??
      const aspect = window.innerWidth / window.innerHeight;
      const frustumHeight = this.camera.top - this.camera.bottom;
      const frustumWidth = frustumHeight * aspect;
      
      this.camera.left = -frustumWidth / 2;
      this.camera.right = frustumWidth / 2;
      this.camera.updateProjectionMatrix();
    }
  }
  
  // 카메???��??�정
  setTarget(target) {
    this.cameraTarget.copy(target);
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
  }
  
  // ?�재 카메??반환
  getCamera() {
    return this.camera;
  }
  
  // 카메???��?반환
  getTarget() {
    return this.cameraTarget.clone();
  }
}
