import * as THREE from 'three';

// Blender-like viewport navigation
// - Alt + Middle Mouse Drag: Orbit around target
// - Middle Mouse Drag: Pan (truck/pedestal)
// - Mouse Wheel: Dolly (zoom toward target)
// Usage: const ctrl = new BlenderControls(camera, renderer.domElement); call ctrl.update() each frame; ctrl.dispose() when done.
export class BlenderControls {
  constructor(camera, domElement) {
    if (!camera || !domElement) throw new Error('BlenderControls requires camera and domElement');
    this.camera = camera;
    this.domElement = domElement;

    // Public params
    this.enabled = true;
    this.target = new THREE.Vector3(0, 0, 0);
    this.rotateSpeed = 1.0; // higher = more sensitive
    this.panSpeed = 1.0;    // multiplier
    this.zoomSpeed = 1.0;   // multiplier
    this.minDistance = 0.1;
    this.maxDistance = Infinity;
    this.minPolarAngle = 0.0001; // radians
    this.maxPolarAngle = Math.PI - 0.0001;
    this.enableDamping = true;
    this.dampingFactor = 0.15;

    // Internal state
    this._spherical = new THREE.Spherical();
    this._sphericalDelta = new THREE.Spherical(0, 0, 0);
    this._panOffset = new THREE.Vector3();
    this._zoomScale = 1;
    this._state = 'none'; // 'none' | 'rotate' | 'pan'
  this._isAltDown = false;
  this._isShiftDown = false;
  this._isCtrlDown = false;
    this._pointer = new THREE.Vector2();
    this._pointerPrev = new THREE.Vector2();
  this._lastPointerForPick = new THREE.Vector2();
  this._raycaster = new THREE.Raycaster();
  this._scene = null;

    // Bind handlers
    this._onContextMenu = this._onContextMenu.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onPointerMovePassive = (e) => {
      // track last pointer even when not dragging, for F to focus under cursor
      this._lastPointerForPick.set(e.clientX, e.clientY);
    };
    this._onMouseUp = this._onMouseUp.bind(this);
  this._onWheel = this._onWheel.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    // Init spherical from camera/target
    this._updateSphericalFromCamera();

    // Listeners
    this.domElement.addEventListener('contextmenu', this._onContextMenu);
    this.domElement.addEventListener('mousedown', this._onMouseDown);
  this.domElement.addEventListener('wheel', this._onWheel, { passive: false });
  this.domElement.addEventListener('mousemove', this._onPointerMovePassive);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  // --- Public API ---
  setSpeeds({ rotate, pan, zoom } = {}) {
    if (Number.isFinite(rotate)) this.rotateSpeed = rotate;
    if (Number.isFinite(pan)) this.panSpeed = pan;
    if (Number.isFinite(zoom)) this.zoomSpeed = zoom;
  }

  setCamera(camera) {
    if (!camera) return;
    this.camera = camera;
    this._updateSphericalFromCamera();
  }

  setScene(scene) {
    this._scene = scene;
  }

  focusOnObject(object) {
    if (!object) return false;
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    let distance;
    if (this.camera.isPerspectiveCamera) {
      const fov = (this.camera.fov || 75) * Math.PI / 180;
      distance = Math.abs(maxDim / Math.sin(fov / 2)) * 1.2;
    } else {
      distance = maxDim * 2;
    }
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.target).normalize();
    this.target.copy(center);
    this.camera.position.copy(center).add(dir.multiplyScalar(distance));
    this._updateSphericalFromCamera();
    {
      const m = new THREE.Matrix4().lookAt(this.camera.position, this.target, this.camera.up);
      this.camera.quaternion.setFromRotationMatrix(m);
      this.camera.updateMatrixWorld();
    }
    return true;
  }

  focusOnObjects(objects) {
    const arr = Array.isArray(objects) ? objects.filter(Boolean) : [objects];
    if (!arr || arr.length === 0) return false;
    const box = new THREE.Box3();
    for (const o of arr) { try { box.expandByObject(o); } catch {} }
    if (!isFinite(box.min.x) || !isFinite(box.max.x)) return false;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    let distance;
    if (this.camera.isPerspectiveCamera) {
      const fov = (this.camera.fov || 75) * Math.PI / 180;
      distance = Math.abs(maxDim / Math.sin(fov / 2)) * 1.2;
    } else {
      distance = maxDim * 2;
    }
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.target).normalize();
    this.target.copy(center);
    this.camera.position.copy(center).add(dir.multiplyScalar(distance));
    this._updateSphericalFromCamera();
    {
      const m = new THREE.Matrix4().lookAt(this.camera.position, this.target, this.camera.up);
      this.camera.quaternion.setFromRotationMatrix(m);
      this.camera.updateMatrixWorld();
    }
    return true;
  }

  update() {
    if (!this.enabled) return false;

    const offset = new THREE.Vector3();
    offset.copy(this.camera.position).sub(this.target);
    this._spherical.setFromVector3(offset);

    // Apply deltas
    this._spherical.theta += this._sphericalDelta.theta;
    this._spherical.phi += this._sphericalDelta.phi;
    this._spherical.radius *= this._zoomScale;

  // Clamp angles to avoid flipping/oscillation
  this._spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this._spherical.phi));
  // keep theta within -PI..PI to reduce numeric growth
  if (this._spherical.theta > Math.PI) this._spherical.theta -= 2 * Math.PI;
  if (this._spherical.theta < -Math.PI) this._spherical.theta += 2 * Math.PI;
    this._spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this._spherical.radius));

    // Apply pan offset to target (camera follows because we recalc from spherical around target)
    this.target.add(this._panOffset);

    // Compute new position
    const newPos = new THREE.Vector3().setFromSpherical(this._spherical).add(this.target);
    this.camera.position.copy(newPos);
    {
      const m = new THREE.Matrix4().lookAt(this.camera.position, this.target, this.camera.up);
      this.camera.quaternion.setFromRotationMatrix(m);
      this.camera.updateMatrixWorld();
    }

    // Damping
    if (this.enableDamping) {
      this._sphericalDelta.theta *= (1 - this.dampingFactor);
      this._sphericalDelta.phi *= (1 - this.dampingFactor);
      this._panOffset.multiplyScalar(1 - this.dampingFactor);
      // Epsilon clamp to avoid jitter/drift
      if (Math.abs(this._sphericalDelta.theta) < 1e-6) this._sphericalDelta.theta = 0;
      if (Math.abs(this._sphericalDelta.phi) < 1e-6) this._sphericalDelta.phi = 0;
      if (this._panOffset.lengthSq() < 1e-10) this._panOffset.set(0,0,0);
      const zoomDecay = Math.pow(1 - this.dampingFactor, 2);
      this._zoomScale = 1 + (this._zoomScale - 1) * zoomDecay;
      if (Math.abs(this._zoomScale - 1) < 1e-4) this._zoomScale = 1;
    } else {
      this._sphericalDelta.set(0, 0, 0);
      this._panOffset.set(0, 0, 0);
      this._zoomScale = 1;
    }
    return true;
  }

  dispose() {
    this.domElement.removeEventListener('contextmenu', this._onContextMenu);
    this.domElement.removeEventListener('mousedown', this._onMouseDown);
    this.domElement.removeEventListener('wheel', this._onWheel);
  this.domElement.removeEventListener('mousemove', this._onPointerMovePassive);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }

  // --- Internal: Events ---
  _onContextMenu(e) { e.preventDefault(); }

  _onKeyDown(e) {
    if (e.key === 'Alt' || e.altKey) this._isAltDown = true;
    if (e.key === 'Shift' || e.shiftKey) this._isShiftDown = true;
    if (e.key === 'Control' || e.ctrlKey) this._isCtrlDown = true;
  // 'F' 키 포커스는 상위 EditorControls의 키보드 맵핑으로 처리 (중복 방지)
  }

  _onKeyUp(e) {
    if (!e.altKey) this._isAltDown = false;
    if (!e.shiftKey) this._isShiftDown = false;
    if (!e.ctrlKey) this._isCtrlDown = false;
  }

  _onMouseDown(e) {
    if (!this.enabled) return;
    if (e.button !== 1) return; // middle only
    e.preventDefault();

    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);

    this._pointerPrev.set(e.clientX, e.clientY);
    this._state = this._isAltDown ? 'rotate' : 'pan';
  }

  _onMouseMove(e) {
    if (!this.enabled || this._state === 'none') return;
    e.preventDefault();

  this._pointer.set(e.clientX, e.clientY);
  this._lastPointerForPick.set(e.clientX, e.clientY);
    const dx = this._pointer.x - this._pointerPrev.x;
    const dy = this._pointer.y - this._pointerPrev.y;
    this._pointerPrev.copy(this._pointer);

    if (this._state === 'rotate') this._handleRotate(dx, dy);
    else if (this._state === 'pan') this._handlePan(dx, dy);
  }

  _onMouseUp() {
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    this._state = 'none';
  }

  _onWheel(e) {
    if (!this.enabled) return;
    e.preventDefault();

    const deltaY = e.deltaY;
    const dollyScale = Math.pow(0.95, this.zoomSpeed);
    if (deltaY < 0) this._dollyIn(dollyScale); else if (deltaY > 0) this._dollyOut(dollyScale);
  }

  // (dblclick removed by design per request)

  // --- Internal: Ops ---
  _updateSphericalFromCamera() {
    const offset = new THREE.Vector3().copy(this.camera.position).sub(this.target);
    this._spherical.setFromVector3(offset);
  }

  _handleRotate(dx, dy) {
    const { clientWidth: width, clientHeight: height } = this.domElement;
    const rotTheta = (2 * Math.PI * dx / Math.max(1, width)) * this.rotateSpeed;
    const rotPhi = (2 * Math.PI * dy / Math.max(1, height)) * this.rotateSpeed;
    this._sphericalDelta.theta -= rotTheta;
    this._sphericalDelta.phi -= rotPhi;
  }

  _handlePan(dx, dy) {
    const element = this.domElement;
    // Modifiers: Shift -> horizontal only, Ctrl -> vertical only
    if (this._isShiftDown) dy = 0;
    if (this._isCtrlDown) dx = 0;
    if (this.camera.isPerspectiveCamera) {
      const offset = new THREE.Vector3().copy(this.camera.position).sub(this.target);
      const targetDistance = offset.length();
      const fov = (this.camera.fov || 75) * Math.PI / 180;
      const halfHeight = targetDistance * Math.tan(fov / 2);
      const halfWidth = halfHeight * (element.clientWidth / Math.max(1, element.clientHeight));

      const panX = (dx * this.panSpeed * (2 * halfWidth) / Math.max(1, element.clientWidth));
      const panY = (dy * this.panSpeed * (2 * halfHeight) / Math.max(1, element.clientHeight));
      this._panLeft(panX);
      this._panUp(panY);
    } else if (this.camera.isOrthographicCamera) {
      const xScale = (this.camera.right - this.camera.left) / Math.max(1, element.clientWidth);
      const yScale = (this.camera.top - this.camera.bottom) / Math.max(1, element.clientHeight);
      this._panLeft(dx * this.panSpeed * xScale);
      this._panUp(dy * this.panSpeed * yScale);
    } else {
      const panX = dx * 0.002 * this.panSpeed;
      const panY = dy * 0.002 * this.panSpeed;
      this._panLeft(panX);
      this._panUp(panY);
    }
  }

  _panLeft(distance) {
    const v = new THREE.Vector3();
    v.setFromMatrixColumn(this.camera.matrix, 0);
    v.multiplyScalar(-distance);
    this._panOffset.add(v);
  }

  _panUp(distance) {
    const v = new THREE.Vector3();
    v.setFromMatrixColumn(this.camera.matrix, 1);
    v.multiplyScalar(distance);
    this._panOffset.add(v);
  }

  // Zoom in should reduce radius -> zoomScale should be < 1 (multiply by scale)
  // Zoom out should increase radius -> zoomScale should be > 1 (divide by scale)
  _dollyIn(scale) { this._zoomScale *= Math.max(1e-6, scale); }
  _dollyOut(scale) { this._zoomScale /= Math.max(1e-6, scale); }
}

export default BlenderControls;
