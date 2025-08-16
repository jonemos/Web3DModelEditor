import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export class ObjectSelector {
  constructor(scene, camera, renderer, editorStore) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.editorStore = editorStore;
  this.gizmoScene = null; // gizmo 전용 오버레이 씬 (postprocess 비적용)
    
    // ?�택 관???�태
    this.selectedObjects = [];
    this.lastSelectedObject = null; // 마�?막으�??�택???�브?�트 (기즈�??�치 기�?)
    this.selectableObjects = [];
    this.raycaster = new THREE.Raycaster();
    
    // ?�래�??�택 박스
    this.selectionBox = null;
    this.createSelectionBox();
    
    // Transform controls (기즈모)
    this.transformControls = null;
    this.gizmoMode = 'translate'; // translate, rotate, scale
    this.isDragging = false;
    
    // 스냅 설정
    this.snapEnabled = false;
    this.gridSize = 1.0;
    
    // 다중 선택 임시 그룹
    this.tempGroup = null;
    this.tempGroupCenter = new THREE.Vector3();
    
  // 자석 기능 제거됨
    
    // ?�중 ?�택 변?�을 ?�한 초기 ?�태 ?�??
    this.initialTransformStates = new Map(); // object -> initial transform state
    
    this.initializeTransformControls();
    
  // 히스토리 기록을 위한 프레임별 펜딩 큐
  this._pendingTransformUpdates = new Map(); // id -> {position, rotation, scale}
  this._rafScheduled = false;
  
  // 포스트프로세싱 매니저(Outline 일관성)
  this.postProcessingManager = null;
    
    // ObjectSelector initialized
  }

  // 온디맨드 렌더 모드 호환: 가능하면 렌더 요청
  _requestRender() {
    try {
      if (typeof window !== 'undefined' && typeof window.__requestRender === 'function') {
        window.__requestRender();
      }
    } catch {}
  }

  // Outline 효과 제거: 항상 로컬 대체 아웃라인 경로 사용
  _shouldUseFallbackOutline() { return true; }

  // 매 프레임 강제 숨김: 헬퍼 라인/보조선 차단 + gizmoScene 재부착 보장
  forceHideGizmoLines() {
    try {
  // TransformControls 본체는 씬에 추가하지 않음 (Object3D 아님)

      const helper = this.transformControls?.getHelper?.();
      if (!helper || !helper.isObject3D) return;
      // 올바른 씬에 존재하도록 보장
      const targetScene = this.gizmoScene || this.scene;
      if (helper.parent !== targetScene) {
        if (helper.parent) helper.parent.remove(helper);
        targetScene.add(helper);
      }
      // 제거 처리
      const toRemove = [];
      helper.traverse?.((n) => {
        if (!n) return;
        const isLineType = n.type === 'Line' || n.type === 'Line2' || n.type === 'LineSegments' || n.type === 'LineSegments2' || n.isLine;
        const isLineMat = n.material && (n.material.isLineBasicMaterial || n.material.isLineDashedMaterial);
        if (isLineType || isLineMat) toRemove.push(n);
      });
      toRemove.forEach((n) => {
        try {
          if (n.parent) n.parent.remove(n);
          if (n.geometry?.dispose) n.geometry.dispose();
          const mat = n.material;
          if (Array.isArray(mat)) mat.forEach(m => m?.dispose && m.dispose()); else if (mat?.dispose) mat.dispose();
        } catch {}
      });
    } catch {}
  }

  setGizmoScene(scene) {
    this.gizmoScene = scene;
    // 이미 생성된 helper가 있다면 새로운 gizmoScene으로 이동
    try {
      const helper = this.transformControls?.getHelper?.();
      if (helper && helper.isObject3D && scene) {
        // 흰색 보조선 그룹 숨김 유지
        try {
          const helperGroup = helper.children?.find?.((c) => c.name === 'helper');
          if (helperGroup) helperGroup.visible = false;
          // 라인류 영구 제거 함수
          const removeLines = (root) => {
            const toRemove = [];
            root.traverse?.((n) => {
              if (!n) return;
              const isLineType = n.type === 'Line' || n.type === 'Line2' || n.type === 'LineSegments' || n.type === 'LineSegments2' || n.isLine;
              const isLineMat = n.material && (n.material.isLineBasicMaterial || n.material.isLineDashedMaterial);
              if (isLineType || isLineMat) toRemove.push(n);
            });
            toRemove.forEach((n) => {
              try {
                if (n.parent) n.parent.remove(n);
                if (n.geometry?.dispose) n.geometry.dispose();
                const mat = n.material;
                if (Array.isArray(mat)) mat.forEach(m => m?.dispose && m.dispose()); else if (mat?.dispose) mat.dispose();
              } catch {}
            });
          };
          removeLines(helper);
          helper.onBeforeRender = () => { try { if (helperGroup) helperGroup.visible = false; removeLines(helper); } catch {} };
        } catch {}
  if (helper.parent) helper.parent.remove(helper);
  scene.add(helper);
      }
    } catch {}
  }

  setPostProcessingManager(manager) {
    this.postProcessingManager = manager;
  }

  _syncOutlineWithSelection() {
    if (!this.postProcessingManager) return;
    const list = (this.selectedObjects && this.selectedObjects.length > 0) ? [...this.selectedObjects] : [];
    try {
      this.postProcessingManager.setOutlineSelectedObjects(list);
      const active = (this.lastSelectedObject && list.includes(this.lastSelectedObject)) ? [this.lastSelectedObject] : (list.length ? [list[list.length - 1]] : []);
      this.postProcessingManager.setOutlineActiveObjects(active);
    } catch {}
  }

  // 헬퍼: 오브젝트가 씬 그래프에 포함되어 있는지 검사
  isInSceneGraph(object) {
    if (!object) return false;
    let current = object;
    while (current) {
  if (current === this.scene || current === this.gizmoScene) return true;
      current = current.parent;
    }
    return false;
  }

  // 프레임마다 기즈모 부착 유효성 검사 (씬 밖 오브젝트에 붙어있으면 분리)
  validateTransformAttachment() {
    if (!this.transformControls || !this.transformControls.object) return;
    // 드래그 중에는 임시 분리/선택 해제를 수행하지 않음 (인스펙터 깜빡임 방지)
    if (this.isDragging) return;
    const attached = this.transformControls.object;
    if (!this.isInSceneGraph(attached)) {
      try { this.transformControls.detach(); } catch {}
      // 선택 상태도 정리
      this.editorStore.getState().setSelectedObject(null);
    }
  }
  
  // 임시 그룹 생성 및 중앙 계산
  createTempGroup() {
    if (this.selectedObjects.length <= 1) {
      this.clearTempGroup();
      return null;
    }

    // 기존 임시 그룹 제거
    this.clearTempGroup();

    // 새 임시 그룹 생성
    this.tempGroup = new THREE.Group();
    this.tempGroup.name = 'TempSelectionGroup';
    this.tempGroup.userData.isTempGroup = true;

    // 선택된 오브젝트들의 중앙점 계산
    this.calculateGroupCenter();

  // 임시 그룹을 중앙점에 위치시킴
    this.tempGroup.position.copy(this.tempGroupCenter);

  // 씬에 임시 그룹 추가 (TransformControls 연결 전에 반드시 필요)
  // gizmoScene이 있다면 동일 씬에 추가하여 렌더 순서/깊이와 일관성 유지
  const targetScene = this.gizmoScene || this.scene;
  try { targetScene.add(this.tempGroup); } catch {}

    return this.tempGroup;
  }

  // 선택된 오브젝트들의 중앙점 계산
  calculateGroupCenter() {
    if (this.selectedObjects.length === 0) {
      this.tempGroupCenter.set(0, 0, 0);
      return;
    }

    const boundingBox = new THREE.Box3();
    
    // 모든 선택된 오브젝트의 바운딩 박스를 합침
    this.selectedObjects.forEach(object => {
      if (object) {
        const objectBox = new THREE.Box3().setFromObject(object);
        boundingBox.union(objectBox);
      }
    });

    // 바운딩 박스의 중앙점 계산
    boundingBox.getCenter(this.tempGroupCenter);
  }

  // 임시 그룹 제거
  clearTempGroup() {
    if (this.tempGroup) {
  try { if (this.tempGroup.parent) this.tempGroup.parent.remove(this.tempGroup); } catch {}
      this.tempGroup = null;
    }
  }

  // 초기 변???�태 ?�??
  saveInitialTransformStates() {
    this.initialTransformStates.clear();
    
    // 선택된 오브젝트들의 초기 상태 저장
    for (const object of this.selectedObjects) {
      if (object && object.position && object.rotation && object.scale) { // ?�전??검??
        this.initialTransformStates.set(object, {
          position: object.position.clone(),
          rotation: object.rotation.clone(),
          scale: object.scale.clone()
        });
      }
    }
    
    // 임시 그룹의 초기 상태도 저장 (다중 선택인 경우)
    if (this.tempGroup && this.selectedObjects.length > 1) {
      this.initialTransformStates.set(this.tempGroup, {
        position: this.tempGroup.position.clone(),
        rotation: this.tempGroup.rotation.clone(),
        scale: this.tempGroup.scale.clone()
      });
    }
  }
  
  // ?�중 ?�택???�브?�트?�에 변???�용
  applyTransformToSelectedObjects() {
    if (!this.tempGroup || !this.transformControls.object || this.selectedObjects.length <= 1) {
      return;
    }
    
    // 임시 그룹의 변환을 기반으로 각 오브젝트의 변환 계산
    const groupTransform = {
      position: this.tempGroup.position.clone(),
      rotation: this.tempGroup.rotation.clone(),
      scale: this.tempGroup.scale.clone()
    };
    
    const initialGroupState = this.initialTransformStates.get(this.tempGroup);
    if (!initialGroupState) return;

    // 각 선택된 오브젝트에 대해 상대적 변환 적용
    for (const object of this.selectedObjects) {
      if (object) {
        const objectInitialState = this.initialTransformStates.get(object);
        if (objectInitialState) {
          this.applyRelativeTransformFromGroup(object, groupTransform, initialGroupState, objectInitialState);
        }
      }
    }
  }
  
  // 그룹 기반 상대적 변환 적용
  applyRelativeTransformFromGroup(targetObject, groupTransform, initialGroupState, targetInitialState) {
    const mode = this.transformControls.getMode();
    
    switch (mode) {
      case 'translate':
        // 그룹의 이동량 계산
        const groupDelta = new THREE.Vector3().subVectors(groupTransform.position, initialGroupState.position);
        
        // 타겟 오브젝트에 같은 이동량 적용
        targetObject.position.copy(targetInitialState.position).add(groupDelta);
        break;
        
      case 'rotate':
        // 그룹의 회전량을 쿼터니언으로 계산
        const initialQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          initialGroupState.rotation.x,
          initialGroupState.rotation.y,
          initialGroupState.rotation.z
        ));
        
        const currentQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          groupTransform.rotation.x,
          groupTransform.rotation.y,
          groupTransform.rotation.z
        ));
        
        // 회전 차이를 쿼터니언으로 계산
        const deltaQuaternion = new THREE.Quaternion().multiplyQuaternions(
          currentQuaternion,
          initialQuaternion.invert()
        );
        
        // 그룹 중심을 기준으로 위치 회전
        const objectToGroupCenter = new THREE.Vector3().subVectors(targetInitialState.position, initialGroupState.position);
        objectToGroupCenter.applyQuaternion(deltaQuaternion);
        targetObject.position.copy(groupTransform.position).add(objectToGroupCenter);
        
        // 오브젝트 자체의 회전을 쿼터니언으로 적용
        const targetInitialQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          targetInitialState.rotation.x,
          targetInitialState.rotation.y,
          targetInitialState.rotation.z
        ));
        
        targetObject.quaternion.multiplyQuaternions(deltaQuaternion, targetInitialQuaternion);
        break;
        
      case 'scale':
        // 그룹의 스케일 비율 계산
        const scaleRatio = new THREE.Vector3(
          groupTransform.scale.x / initialGroupState.scale.x,
          groupTransform.scale.y / initialGroupState.scale.y,
          groupTransform.scale.z / initialGroupState.scale.z
        );
        
        // 그룹 중심을 기준으로 스케일 적용
        const objectToGroupCenterScale = new THREE.Vector3().subVectors(targetInitialState.position, initialGroupState.position);
        objectToGroupCenterScale.multiply(scaleRatio);
        targetObject.position.copy(groupTransform.position).add(objectToGroupCenterScale);
        
        // 오브젝트 자체의 스케일도 적용
        targetObject.scale.copy(targetInitialState.scale).multiply(scaleRatio);
        break;
    }
  }

  // ?��???변???�용 (개선??버전)
  applyRelativeTransform(targetObject, primaryObject, primaryInitialState, targetInitialState) {
    const mode = this.transformControls.getMode();
    
    switch (mode) {
      case 'translate':
        // ?�동: 기�? ?�브?�트???�동?�을 ?��??�브?�트???�용
        const positionDelta = new THREE.Vector3().subVectors(primaryObject.position, primaryInitialState.position);
        targetObject.position.copy(targetInitialState.position).add(positionDelta);
        break;
        
      case 'rotate':
        // ?�전: 기�? ?�브?�트???�전?�을 ?��??�브?�트???�용
        const rotationDelta = new THREE.Euler(
          primaryObject.rotation.x - primaryInitialState.rotation.x,
          primaryObject.rotation.y - primaryInitialState.rotation.y,
          primaryObject.rotation.z - primaryInitialState.rotation.z
        );
        targetObject.rotation.copy(targetInitialState.rotation);
        targetObject.rotation.x += rotationDelta.x;
        targetObject.rotation.y += rotationDelta.y;
        targetObject.rotation.z += rotationDelta.z;
        break;
        
      case 'scale':
        // ?�기: 기�? ?�브?�트???�기 비율???��??�브?�트???�용
        const scaleRatio = new THREE.Vector3(
          primaryObject.scale.x / primaryInitialState.scale.x,
          primaryObject.scale.y / primaryInitialState.scale.y,
          primaryObject.scale.z / primaryInitialState.scale.z
        );
        targetObject.scale.copy(targetInitialState.scale).multiply(scaleRatio);
        break;
    }
  }
  
  initializeTransformControls() {
    try {
      // Creating TransformControls
      
  this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
  // TransformControls 본체는 씬에 추가하지 않음 (헬퍼만 추가)
      
      // 초기 기즈모 사이즈/스냅을 스토어에서 반영
      try {
        const s = this.editorStore.getState();
        if (Number.isFinite(s?.gizmoSize)) this.transformControls.setSize(s.gizmoSize);
        // 스냅 초기값
        const enable = !!s?.isGridSnap;
        const grid = Number.isFinite(s?.gridSize) ? s.gridSize : 1;
        const move = Number.isFinite(s?.snapMove) ? s.snapMove : grid;
        const rot = Number.isFinite(s?.snapRotateDeg) ? THREE.MathUtils.degToRad(s.snapRotateDeg) : THREE.MathUtils.degToRad(15);
        const sca = Number.isFinite(s?.snapScale) ? s.snapScale : 0.1;
        if (enable) {
          this.transformControls.setTranslationSnap(move || grid || 1);
          this.transformControls.setRotationSnap(rot);
          this.transformControls.setScaleSnap(sca);
        } else {
          this.transformControls.setTranslationSnap(null);
          this.transformControls.setRotationSnap(null);
          this.transformControls.setScaleSnap(null);
        }
      } catch {}

      // ?�벤??리스??추�?
      this.transformControls.addEventListener('dragging-changed', (event) => {
        this.isDragging = event.value;
        
        if (event.value) {
          // ?�래�??�작 - 모든 ?�택???�브?�트??초기 ?�태 ?�??
          this.saveInitialTransformStates();
          // 배치 시작 (Undo/Redo 묶음)
          try {
            const api = this.editorStore?.getState?.();
            api?.beginBatch && api.beginBatch();
          } catch {}
          // Transform drag started, saved initial states
        } else {
          // 드래그 종료: 자석 기능 제거됨(아무 것도 수행하지 않음)
          // 드래그 동안 누적되지 못한 펜딩 업데이트를 먼저 플러시
          try { this.flushPendingTransformUpdates?.(); } catch {}
          this.initialTransformStates.clear();
          // 최종 상태를 히스토리에 반영 (선택 전체)
          try {
            const api = this.editorStore?.getState?.();
            const update = api?.updateObjectTransform;
            if (update) {
              const targets = this.selectedObjects && this.selectedObjects.length > 0
                ? this.selectedObjects
                : (this.lastSelectedObject ? [this.lastSelectedObject] : []);
              for (const obj of targets) {
                const id = obj?.userData?.id;
                if (!id) continue;
                update(id, {
                  position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                  rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
                  scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
                });
              }
            }
            // 배치 종료
            api?.endBatch && api.endBatch();
          } catch {}
          // Transform drag ended, cleared initial states
        }
      });
      
      // ?�중 ?�택???�브?�트?�의 ?�시 변?�을 ?�한 ?�벤??리스??
      this.transformControls.addEventListener('change', () => {
        this.applyTransformToSelectedObjects();
        // 동일 프레임 내 다중 변경은 병합하여 히스토리에 누적
        try {
          const selected = this.selectedObjects && this.selectedObjects.length > 0
            ? this.selectedObjects
            : (this.lastSelectedObject ? [this.lastSelectedObject] : []);
          // 회전 모드에서는 스포트/디렉셔널 라이트의 타겟을 라이트 회전에 맞춰 재배치하여 Helper 방향이 즉시 반영되게 함
          try {
            const mode = this.transformControls.getMode?.();
            if (mode === 'rotate') {
              selected.forEach(obj => {
                if (obj && obj.isLight && (obj.isSpotLight || obj.isDirectionalLight) && obj.target) {
                  try {
                    const lightWorldPos = new THREE.Vector3();
                    const dir = new THREE.Vector3();
                    obj.getWorldPosition(lightWorldPos);
                    obj.getWorldDirection(dir);
                    let dist = 0;
                    try { dist = obj.target.getWorldPosition(new THREE.Vector3()).distanceTo(lightWorldPos); } catch {}
                    if (!Number.isFinite(dist) || dist < 0.001) dist = 10;
                    const newTargetWorld = lightWorldPos.clone().add(dir.multiplyScalar(dist));
                    obj.target.position.copy(newTargetWorld);
                    obj.target.updateMatrixWorld(true);
                    if (obj.userData?.lightHelper && typeof obj.userData.lightHelper.update === 'function') {
                      obj.userData.lightHelper.update();
                    }
                  } catch {}
                }
              });
            }
          } catch {}
          selected.forEach(obj => this.scheduleTransformUpdate(obj));
        } catch {}
      });
      
      // 기즈�??�정
      this.transformControls.setSize(1.0);
      
      // TransformControls??getHelper()�??�용?�서 ?�각???�현???�에 추�?
  const gizmoHelper = this.transformControls.getHelper();
      if (gizmoHelper instanceof THREE.Object3D) {
        // 흰색 보조선이 들어있는 'helper' 그룹을 비활성화
        try {
          const helperGroup = gizmoHelper.children?.find?.((c) => c.name === 'helper');
          if (helperGroup) helperGroup.visible = false;
          // 라인류 영구 제거
          const removeLines = (root) => {
            const toRemove = [];
            root.traverse?.((n) => {
              if (!n) return;
              const isLineType = n.type === 'Line' || n.type === 'Line2' || n.type === 'LineSegments' || n.type === 'LineSegments2' || n.isLine;
              const isLineMat = n.material && (n.material.isLineBasicMaterial || n.material.isLineDashedMaterial);
              if (isLineType || isLineMat) toRemove.push(n);
            });
            toRemove.forEach((n) => {
              try {
                if (n.parent) n.parent.remove(n);
                if (n.geometry?.dispose) n.geometry.dispose();
                const mat = n.material;
                if (Array.isArray(mat)) mat.forEach(m => m?.dispose && m.dispose()); else if (mat?.dispose) mat.dispose();
              } catch {}
            });
          };
          removeLines(gizmoHelper);
          gizmoHelper.onBeforeRender = () => { try { if (helperGroup) helperGroup.visible = false; removeLines(gizmoHelper); } catch {} };
        } catch {}
        gizmoHelper.renderOrder = 999;
  const targetScene = this.gizmoScene || this.scene;
  targetScene.add(gizmoHelper);
        // hover/변경 시에도 helper 보조선이 다시 켜지지 않도록 보장
        try {
          const hideHelper = () => {
            try {
              const hg = gizmoHelper.children?.find?.((c) => c.name === 'helper');
              if (hg) hg.visible = false;
              // 라인 영구 제거 재실행
              const toRemove = [];
              gizmoHelper.traverse?.((n) => {
                const isLineType = n.type === 'Line' || n.type === 'Line2' || n.type === 'LineSegments' || n.type === 'LineSegments2' || n.isLine;
                const isLineMat = n.material && (n.material.isLineBasicMaterial || n.material.isLineDashedMaterial);
                if (isLineType || isLineMat) toRemove.push(n);
              });
              toRemove.forEach((n) => {
                try {
                  if (n.parent) n.parent.remove(n);
                  if (n.geometry?.dispose) n.geometry.dispose();
                  const mat = n.material;
                  if (Array.isArray(mat)) mat.forEach(m => m?.dispose && m.dispose()); else if (mat?.dispose) mat.dispose();
                } catch {}
              });
            } catch {}
          };
          this.transformControls.addEventListener('change', hideHelper);
          this.transformControls.addEventListener('dragging-changed', hideHelper);
          this.transformControls.addEventListener('mouseDown', hideHelper);
          this.transformControls.addEventListener('mouseUp', hideHelper);
          this.transformControls.addEventListener('objectChange', hideHelper);
        } catch {}
      }
      
    } catch (error) {
      // Failed to initialize TransformControls
      this.transformControls = null;
    }
  }

  // 선택된 오브젝트의 현재 변환을 히스토리 펜딩 큐에 등록하고, RAF로 프레임당 한 번만 스토어 갱신
  scheduleTransformUpdate(object) {
    if (!object) return;
    const id = object.userData?.id;
    if (!id) return;
    // 라이트/타겟 헬퍼 갱신(기즈모 이동 중 반영)
    try {
      if (object.isLight && object.userData?.lightHelper) {
        const h = object.userData.lightHelper;
        try { object.updateMatrixWorld(true); } catch {}
        try { object.target?.updateMatrixWorld?.(true); } catch {}
        if (typeof h.update === 'function') h.update();
        // Spot/Directional helper는 target 포함해 갱신
      } else if (object.userData?.isLightTarget) {
        // 타겟 이동 시, 소유 라이트 헬퍼 갱신
        let ownerLight = null;
        try {
          const ownerId = object.userData?.ownerId;
          if (ownerId) {
            // 씬에서 ownerId 매칭 라이트 탐색(간단 폴백)
            this.scene.traverse((n) => {
              if (!ownerLight && n?.isLight && n.userData?.id === ownerId) ownerLight = n;
            });
          } else {
            // target 역참조
            this.scene.traverse((n) => {
              if (!ownerLight && n?.isLight && n.target === object) ownerLight = n;
            });
          }
        } catch {}
        if (ownerLight?.userData?.lightHelper && typeof ownerLight.userData.lightHelper.update === 'function') {
          try { ownerLight.updateMatrixWorld(true); } catch {}
          try { ownerLight.target?.updateMatrixWorld?.(true); } catch {}
          ownerLight.userData.lightHelper.update();
        }
      }
    } catch {}
    this._pendingTransformUpdates.set(id, {
      position: { x: object.position.x, y: object.position.y, z: object.position.z },
      rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
      scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z }
    });
    if (this._rafScheduled) return;
    this._rafScheduled = true;
    requestAnimationFrame(() => this.flushPendingTransformUpdates());
  }

  // 펜딩된 변환 업데이트를 스토어에 반영 (배치 중이면 배치 버퍼에 누적)
  flushPendingTransformUpdates() {
    this._rafScheduled = false;
    if (!this._pendingTransformUpdates || this._pendingTransformUpdates.size === 0) return;
    try {
      const api = this.editorStore?.getState?.();
      const update = api?.updateObjectTransform;
      if (update) {
        for (const [id, transform] of this._pendingTransformUpdates.entries()) {
          update(id, transform);
        }
      }
    } catch {}
    // 라이트 헬퍼 최종 동기화
    try {
      this.selectedObjects?.forEach?.((obj) => {
        if (obj?.isLight && obj.userData?.lightHelper && typeof obj.userData.lightHelper.update === 'function') {
          obj.userData.lightHelper.update();
        }
      });
    } catch {}
    this._pendingTransformUpdates.clear();
  }
  
  createSelectionBox() {
    // ?�래�??�택 박스 ?�성
    this.selectionBox = document.createElement('div');
    this.selectionBox.style.position = 'absolute';
    this.selectionBox.style.border = '2px dashed #007acc';
    this.selectionBox.style.backgroundColor = 'rgba(0, 122, 204, 0.1)';
    this.selectionBox.style.pointerEvents = 'none';
    this.selectionBox.style.display = 'none';
    this.selectionBox.style.zIndex = '1000';
    document.body.appendChild(this.selectionBox);
  }
  
  // 객체가 ?�택???�효?��? 검?�하???�퍼 메서??
  isObjectValidForSelection(object) {
  // Mesh/Group 뿐 아니라 GLB 루트처럼 일반 Object3D도 허용
  if (!object || !object.visible || !object.isObject3D) {
      return false;
    }
    
    // 프리즈된 객체는 선택할 수 없음
    const editorState = this.editorStore.getState();
    const uid = object.userData?.id ?? object.userData?.ownerId;
    const objectInStore = editorState.objects.find(obj => obj.id === uid) || 
                         editorState.walls.find(wall => wall.id === uid);
    
  if (objectInStore && objectInStore.frozen) {
      return false;
    }
    
    return true;
  }

  // 선택 표준화: ownerId가 있고 id가 없는 서브노드는 루트(id===ownerId)로 승격
  _promoteToCanonical(object) {
    if (!object || !object.userData) return object;
    const hasId = !!object.userData.id;
    const ownerId = object.userData.ownerId;
    if (!hasId && ownerId != null) {
      let cur = object;
      while (cur) {
        if (cur.userData && cur.userData.id === ownerId) return cur;
        cur = cur.parent;
      }
    }
    return object;
  }
  
  // ?�일 ?�브?�트 ?�택
  selectSingleObject(object) {
  // 루트 승격
  object = this._promoteToCanonical(object);
    // ?�전??검??
    if (!object || !this.isObjectValidForSelection(object)) {
      // Console output removed
      return;
    }
    
    // Console output removed
    
    // 배열 ?�리
    this.cleanupSelectedObjects();
    
    // 모든 ?�택 ?�제
    this.deselectAllObjects();
    
    // ???�브?�트 ?�택
    this.selectedObjects = [object];
    this.lastSelectedObject = object; // 마�?�??�택???�브?�트 ?�데?�트
    this.editorStore.getState().setSelectedObject(object);
    try {
      const api = this.editorStore.getState();
  const id = object?.userData?.id ?? object?.userData?.ownerId;
  api?.setSelectedIds && api.setSelectedIds(id != null ? [id] : []);
    } catch {}
    
  // 단일 선택이므로 임시 그룹 제거
    this.clearTempGroup();
    
    // 기즈�??�결 (객체가 ?�에 ?�는지 ?�인)
    if (this.transformControls && object.parent) {
      // 객체가 ??그래?�에 ?�해?�는지 ?�인
      let isInScene = false;
      let current = object;
      while (current.parent) {
        current = current.parent;
        if (current === this.scene) {
          isInScene = true;
          break;
        }
      }
      
      if (isInScene) {
        // Console output removed
        this.transformControls.attach(object);
        this.setGizmoMode(this.gizmoMode);
      } else {
        console.error('선택된 오브젝트가 씬 그래프에 포함되지 않았습니다:', object.name);
      }
    }
    
  // PostProcessing Outline 동기화 + 대체 아웃라인 즉시 적용
  this._syncOutlineWithSelection();
  try { this.addSelectionOutline(object); this.updateSelectionOutline(object); } catch {}
  // 렌더 요청
  this._requestRender();
    
    // Console output removed
  }
  
  // ?�중 ?�브?�트 ?�택
  selectMultipleObjects(objects, isMultiSelect = false) {
    // ?�전??검??
    if (!objects || !Array.isArray(objects)) {
      // Console output removed
      return;
    }
    
    if (!isMultiSelect) {
      this.deselectAllObjects();
    }
    
  for (let object of objects) {
      object = this._promoteToCanonical(object);
      // �??�브?�트???�효??검??
      if (object && !this.selectedObjects.includes(object)) {
        this.selectedObjects.push(object);
        this.lastSelectedObject = object; // 마�?막으�?추�????�브?�트�?마�?�??�택?�로 ?�정
  try { this.addSelectionOutline(object); this.updateSelectionOutline(object); } catch {}
      }
    }
    
  // 다중 선택인 경우 임시 그룹 생성 및 기즈모 연결
  if (this.selectedObjects.length > 1) {
      const tempGroup = this.createTempGroup();
      if (tempGroup && this.transformControls) {
    // 임시 그룹이 렌더 가능한 씬에 추가되었는지 확인 (gizmoScene 우선)
    const okParent = (tempGroup.parent === (this.gizmoScene || this.scene));
    if (okParent) {
          this.editorStore.getState().setSelectedObject(tempGroup);
          this.transformControls.attach(tempGroup);
          this.setGizmoMode(this.gizmoMode);
          // Console output removed
  } else {
          console.error('임시 그룹이 씬에 추가되지 않았습니다.');
        }
      }
    } else if (this.selectedObjects.length === 1) {
      // 단일 선택으로 변경된 경우
      this.clearTempGroup();
      const singleObject = this.selectedObjects[0];
      if (singleObject && this.transformControls) {
        this.editorStore.getState().setSelectedObject(singleObject);
        this.transformControls.attach(singleObject);
        this.setGizmoMode(this.gizmoMode);
      }
    }
    // 스토어에 선택 집합 동기화
    try {
      const api = this.editorStore.getState();
      const ids = this.selectedObjects
        .map(o => (o?.userData?.id ?? o?.userData?.ownerId))
        .filter((v) => v != null);
      api?.setSelectedIds && api.setSelectedIds(ids);
    } catch {}
    
  // PostProcessing Outline 동기화
  this._syncOutlineWithSelection();
  // 렌더 요청
  this._requestRender();
  }
  
  // ?�브?�트 ?�택 ?��?
  toggleObjectSelection(object) {
    // ?�전??검??
    if (!object) {
      // Console output removed
      return;
    }
  // 루트 승격
  object = this._promoteToCanonical(object);
    
    const index = this.selectedObjects.indexOf(object);
    
  if (index > -1) {
      // ?��? ?�택???�브?�트 - ?�택 ?�제
      this.selectedObjects.splice(index, 1);
      this.removeSelectionOutline(object);
      
      // 마�?�??�택???�브?�트가 ?�거??경우 ?�데?�트
      if (this.lastSelectedObject === object) {
        this.lastSelectedObject = this.selectedObjects.length > 0 ? this.selectedObjects[this.selectedObjects.length - 1] : null;
      }
      
      // Transform controls ?�데?�트
      if (this.selectedObjects.length > 1) {
        // 여전히 다중 선택인 경우 임시 그룹 재생성
        const tempGroup = this.createTempGroup();
        if (tempGroup && this.transformControls) {
          // 임시 그룹이 씬에 추가되었는지 확인
          if (tempGroup.parent === this.scene) {
            this.editorStore.getState().setSelectedObject(tempGroup);
            this.transformControls.attach(tempGroup);
            this.setGizmoMode(this.gizmoMode);
          } else {
            console.error('임시 그룹이 씬에 추가되지 않았습니다.');
          }
        }
      } else if (this.selectedObjects.length === 1) {
        // 단일 선택으로 변경된 경우
        this.clearTempGroup();
        const singleObject = this.selectedObjects[0];
        if (singleObject && this.transformControls) {
          this.editorStore.getState().setSelectedObject(singleObject);
          this.transformControls.attach(singleObject);
          this.setGizmoMode(this.gizmoMode);
        }
  } else {
        // 선택된 것이 없는 경우
        this.clearTempGroup();
        this.editorStore.getState().setSelectedObject(null);
        this.lastSelectedObject = null;
        if (this.transformControls) {
          this.transformControls.detach();
        }
  }
    } else {
      // ?�로???�브?�트 ?�택
      this.selectedObjects.push(object);
      this.lastSelectedObject = object; // ?�로 ?�택???�브?�트�?마�?�??�택?�로 ?�정
  try { this.addSelectionOutline(object); this.updateSelectionOutline(object); } catch {}
      
      // Transform controls 업데이트
    if (this.selectedObjects.length > 1) {
        // 다중 선택인 경우 임시 그룹 생성
        const tempGroup = this.createTempGroup();
        if (tempGroup && this.transformControls) {
      // 임시 그룹이 렌더 가능한 씬에 추가되었는지 확인 (gizmoScene 우선)
      const okParent = (tempGroup.parent === (this.gizmoScene || this.scene));
      if (okParent) {
            this.editorStore.getState().setSelectedObject(tempGroup);
            this.transformControls.attach(tempGroup);
            this.setGizmoMode(this.gizmoMode);
          } else {
            console.error('임시 그룹이 씬에 추가되지 않았습니다.');
          }
        }
      } else {
        // 단일 선택인 경우
        this.clearTempGroup();
        if (this.transformControls) {
          this.editorStore.getState().setSelectedObject(object);
          this.transformControls.attach(object);
          this.setGizmoMode(this.gizmoMode);
        }
      }
    }
    // 스토어에 선택 집합 동기화
    try {
      const api = this.editorStore.getState();
      const ids = this.selectedObjects
        .map(o => (o?.userData?.id ?? o?.userData?.ownerId))
        .filter((v) => v != null);
      api?.setSelectedIds && api.setSelectedIds(ids);
    } catch {}
    
  // PostProcessing Outline 동기화
  this._syncOutlineWithSelection();
  // 렌더 요청
  this._requestRender();
  }
  
  // 모든 ?�브?�트 ?�택 ?�제
  deselectAllObjects() {
    // Console output removed
    
    // 기즈�?먼�? ?�제 (가??중요)
    if (this.transformControls) {
      try {
        this.transformControls.detach();
        // Console output removed
      } catch (error) {
        // Console output removed
      }
    }
    
    // 임시 그룹 제거
    this.clearTempGroup();
    
    // 배열 ?�리 먼�? ?�행
  this.cleanupSelectedObjects();
    
    // 모든 ?�택???�브?�트???�웃?�인 ?�거 (?�전??검???�함)
    for (const object of this.selectedObjects) {
      if (object) { // undefined??null 체크
        try {
          this.removeSelectionOutline(object);
        } catch (error) {
          // Console output removed
        }
      }
    }
    
    this.selectedObjects = [];
    this.lastSelectedObject = null; // 마�?�??�택???�브?�트??초기??
    this.editorStore.getState().setSelectedObject(null);
    try {
      const api = this.editorStore.getState();
      api?.setSelectedIds && api.setSelectedIds([]);
    } catch {}
    
  // PostProcessing Outline 동기화
  this._syncOutlineWithSelection();
  // 렌더 요청
  this._requestRender();
  }
  
  // 선택 배열 정리: 무효/씬 밖/비가시/프리즈된 객체 제거 + 기즈모 부착 유효성 검사
  cleanupSelectedObjects() {
  // 드래그 중에는 정리/분리를 수행하지 않아 선택 상태가 유지되도록 한다.
  if (this.isDragging) return;
    const before = this.selectedObjects.length;
    this.selectedObjects = this.selectedObjects.filter(obj => this.isObjectValidForSelection(obj) && this.isInSceneGraph(obj));
    if (this.lastSelectedObject && (!this.isObjectValidForSelection(this.lastSelectedObject) || !this.isInSceneGraph(this.lastSelectedObject))) {
      this.lastSelectedObject = this.selectedObjects.length > 0 ? this.selectedObjects[this.selectedObjects.length - 1] : null;
    }
    // 부착된 기즈모가 씬 밖 오브젝트를 참조하면 분리
    this.validateTransformAttachment();
  }
  
  // 마우스 위치에서 오브젝트 선택 처리
  handleObjectSelection(mousePosition, isMultiSelect = false) {
    // TransformControls 드래그 중에는 선택 변경을 하지 않음 (깜빡임 방지)
    if (this.isDragging) return;

    this.raycaster.setFromCamera(mousePosition, this.camera);
    let intersects = [];
    try {
      intersects = this.raycaster.intersectObjects(this.selectableObjects, true);
    } catch { intersects = []; }

    // 폴백: selectableObjects에서 교차가 없으면 씬 전체 검사 → selectableObjects 조상 승격만 허용
    if ((!intersects || intersects.length === 0) && this.scene) {
      try {
        const allHits = this.raycaster.intersectObjects(this.scene.children, true);
        const pickSelectableAncestor = (n) => {
          let cur = n;
          while (cur) {
            if (this.selectableObjects.includes(cur)) return cur;
            cur = cur.parent;
          }
          return null;
        };
        for (const hit of allHits) {
          const found = pickSelectableAncestor(hit.object);
          if (found) { intersects = [{ object: found }]; break; }
        }
      } catch {}
    }

    if (intersects && intersects.length > 0) {
      let selectedObject = intersects[0].object;
      // selectableObjects에 포함될 때까지 상위로 승격 시도
      while (selectedObject && selectedObject.parent && !this.selectableObjects.includes(selectedObject)) {
        selectedObject = selectedObject.parent;
      }
      // 최종 유효성 검사: 반드시 selectableObjects 목록 내에 존재해야 함
      if (!selectedObject || !this.selectableObjects.includes(selectedObject) || !this.isObjectValidForSelection(selectedObject)) {
        if (!isMultiSelect && !this.isDragging) this.deselectAllObjects();
        return;
      }

      if (isMultiSelect) this.toggleObjectSelection(selectedObject);
      else this.selectSingleObject(selectedObject);
    } else if (!isMultiSelect) {
      // 빈공간 클릭 → 전체 해제
      if (!this.isDragging) this.deselectAllObjects();
    }
  }
  
  // ?�래�??�택 ?�역 ???�브?�트??찾기
  getObjectsInArea(startPos, endPos) {
    const selectedInArea = [];
    const minX = Math.min(startPos.x, endPos.x);
    const maxX = Math.max(startPos.x, endPos.x);
    const minY = Math.min(startPos.y, endPos.y);
    const maxY = Math.max(startPos.y, endPos.y);
    
    for (const object of this.selectableObjects) {
      // 프리즈된 객체는 드래그 선택에서 제외
      if (!this.isObjectValidForSelection(object)) {
        continue;
      }
      
      // 오브젝트의 화면 좌표 계산
      const objectPosition = new THREE.Vector3();
      object.getWorldPosition(objectPosition);
      objectPosition.project(this.camera);
      
      // 선택 영역 내에 있는지 확인
      if (objectPosition.x >= minX && objectPosition.x <= maxX &&
          objectPosition.y >= minY && objectPosition.y <= maxY) {
        selectedInArea.push(object);
      }
    }
    
    return selectedInArea;
  }
  
  // ?�택 ?�웃?�인 추�?
  addSelectionOutline(object) {
    if (!object) return;
  if (object.userData?.isSelectionOutline) return; // 아웃라인 메쉬 자체는 무시
    if (!this._shouldUseFallbackOutline()) return; // PP Outline이 활성인 경우 대기
    if (object.isGroup || (object.children && object.children.length > 0)) {
      this.addSelectionOutlineToGroup(object);
      return;
    }
    this.addSelectionOutlineToSingleMesh(object);
  }
  
  // Group ?�는 복합 ?�브?�트???�웃?�인 추�?
  addSelectionOutlineToGroup(group) {
    if (!group || !group.traverse) return;
    group.traverse((child) => {
  if (child && child.isMesh && child !== group && !child.userData?.isSelectionOutline) {
        this.addSelectionOutlineToSingleMesh(child);
      }
    });
  }
  
  // ?�일 메시???�웃?�인 추�? (Group???�식??
  addSelectionOutlineToSingleMesh(mesh) {
    try {
      if (!mesh || !mesh.isMesh) return;
  if (mesh.userData?.isSelectionOutline) return; // 이미 아웃라인 메쉬는 무시
      if (!this._shouldUseFallbackOutline()) return;
      if (!mesh.userData) mesh.userData = {};
      if (mesh.userData.outlineObject) {
        // 존재하면 부모가 mesh가 아니면 재부착만 시도
        try {
          const o = mesh.userData.outlineObject;
          if (o && o.parent !== mesh) {
            if (o.parent) o.parent.remove(o);
            mesh.add(o);
          }
        } catch {}
        return;
      }

      const outlineGeom = mesh.geometry?.clone?.() || null;
      if (!outlineGeom) return;
      try {
        if (!outlineGeom.attributes || !outlineGeom.attributes.normal) {
          outlineGeom.computeVertexNormals();
        }
      } catch {}
      // 활성/선택 색 구분: 마지막 선택(활성) = 노랑, 그 외 선택 = 주황
      const isActive = (this.lastSelectedObject === mesh) || (this.selectedObjects.length === 1 && this.selectedObjects[0] === mesh);
      const color = isActive ? 0xffd400 : 0xff7a00;
      const outlineMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.BackSide,
        transparent: false,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      });
      // 두께를 메시 크기에 따라 산정 (월드 유닛 기준 대략 값)
      try { outlineGeom.computeBoundingSphere(); } catch {}
      const radius = outlineGeom.boundingSphere ? outlineGeom.boundingSphere.radius : 1.0;
      const thickness = Math.max(0.002, radius * 0.005);
      outlineMat.onBeforeCompile = (shader) => {
        shader.uniforms.uOutlineThickness = { value: thickness };
        // 유니폼만 주입하고, normal 속성은 geometry에 normals가 있을 때 이미 정의되어 있으므로 재선언하지 않음
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\nuniform float uOutlineThickness;`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>\n  vec3 worldNormal = normalize(mat3(modelMatrix) * normal);\n  transformed += worldNormal * uOutlineThickness;`);
        outlineMat.userData.shader = shader;
      };
      const outlineMesh = new THREE.Mesh(outlineGeom, outlineMat);
      outlineMesh.name = 'SelectionOutline';
  outlineMesh.userData = outlineMesh.userData || {};
  outlineMesh.userData.isSelectionOutline = true;
      outlineMesh.userData.isSystemObject = true;
  // 스케일 팩터 사용 제거: 노멀 기반 외곽 확장으로 대체
      // 레이어/가시성 상속 유사 처리
      try { outlineMesh.layers.mask = mesh.layers.mask; } catch {}
      // 렌더 순서 소폭 뒤로
      try { outlineMesh.renderOrder = (mesh.renderOrder || 0) + 0.001; } catch {}
      // 메시에 자식으로 부착 (부모/월드 변환 자동 추적)
      mesh.add(outlineMesh);
      mesh.userData.outlineObject = outlineMesh;
    } catch {}
  }
  
  // ?�택 ?�웃?�인 ?�거
  removeSelectionOutline(object) {
    // ?�전??검??
    if (!object) {
      // Console output removed
      return;
    }
    
    // Group??경우 ?�식 메시?�의 ?�웃?�인 ?�거
    if (object.isGroup || (object.children && object.children.length > 0)) {
      this.removeSelectionOutlineFromGroup(object);
      return;
    }
    
    // ?�일 메시??경우
    this.removeSelectionOutlineFromMesh(object);
  }
  
  // Group?�서 ?�웃?�인 ?�거
  removeSelectionOutlineFromGroup(group) {
    // ?�전??검??
    if (!group || !group.traverse) {
      // Console output removed
      return;
    }
    
    try {
      // Group??모든 ?�식 메시?�서 ?�웃?�인 ?�거
      group.traverse((child) => {
        // child가 ?�효?��? ?�인
  if (child && child.isMesh && child !== group && !child.userData?.isSelectionOutline) {
          this.removeSelectionOutlineFromMesh(child);
        }
      });
    } catch (error) {
      // Console output removed
      // Console output removed
    }
    
    // Group???�웃?�인 ?�보 ?�리
    if (group.userData) {
      delete group.userData.outlineChildren;
    }
  }
  
  // ?�일 메시?�서 ?�웃?�인 ?�거
  removeSelectionOutlineFromMesh(object) {
    // ?�전??검??
    if (!object || !object.userData) {
      // Console output removed
      return;
    }
    if (object.userData.isSelectionOutline) {
      // 아웃라인 메쉬 자체에 대해 호출된 경우는 상위 메쉬 경로에서만 정리
      return;
    }
    
    // ?�웃?�인 ?�브?�트 ?�거
    if (object.userData.outlineObject) {
      if (object.userData.outlineObject.parent) {
        object.userData.outlineObject.parent.remove(object.userData.outlineObject);
      }
      
      // 메모�??�리
      if (object.userData.outlineObject.geometry) {
      // TransformControls 드래그 중에는 선택 변경을 하지 않음 (깜빡임 방지)
      if (this.isDragging) return;
        object.userData.outlineObject.geometry.dispose();
      }
      if (object.userData.outlineObject.material) {
        object.userData.outlineObject.material.dispose();
      }
      
      delete object.userData.outlineObject;
    }
    
    // ?�본 발광 ?�과 복원
    if (object.material && object.userData.originalEmissive !== undefined) {
      object.material.emissive.copy(object.userData.originalEmissive);
      object.material.emissiveIntensity = object.userData.originalEmissiveIntensity;
      
      delete object.userData.originalEmissive;
      delete object.userData.originalEmissiveIntensity;
    }
  }
  
  // ?�웃?�인 ?�치/?�전/?��????�데?�트
  updateSelectionOutline(object) {
  // 선택 해제 유발 로직 제거: 아웃라인 갱신은 상태를 변경하지 않아야 함
  if (object.userData?.isSelectionOutline) return;
    if (!this._shouldUseFallbackOutline()) return;
    if (object.isGroup || (object.children && object.children.length > 0)) {
      this.updateSelectionOutlineForGroup(object);
      return;
    }
    this.updateSelectionOutlineForMesh(object);
  }
  
  // Group???�웃?�인 ?�데?�트
  updateSelectionOutlineForGroup(group) {
    if (!group || !group.traverse) return;
    group.traverse((child) => {
  if (child && child.isMesh && child !== group && !child.userData?.isSelectionOutline) {
        this.updateSelectionOutlineForMesh(child);
      }
    });
  }
  
  // ?�일 메시???�웃?�인 ?�데?�트
  updateSelectionOutlineForMesh(object) {
    if (!object || !object.isMesh) return;
  if (object.userData?.isSelectionOutline) return;
    if (!this._shouldUseFallbackOutline()) return;
    // 필요 시 스케일을 다시 보장 (부모 변경/스케일 변동 대비)
    const outline = object.userData?.outlineObject;
    if (outline) {
  // 노멀 기반 확장으로 대체했으므로 스케일 보정 불필요
      // 색상도 활성/선택 기준으로 최근 상태 반영
      try {
        const isActive = (this.lastSelectedObject === object) || (this.selectedObjects.length === 1 && this.selectedObjects[0] === object);
        const target = isActive ? 0xffd400 : 0xff7a00;
        if (outline.material && outline.material.color) outline.material.color.setHex(target);
      } catch {}
    }
  }
  
  // 모든 ?�택???�브?�트???�웃?�인 ?�데?�트 (?�니메이??중인 ?�브?�트??
  updateAllSelectionOutlines() {
    // 드래그 중에는 선택 정리/부착 유효성 검사를 건너뛰어
    // 일시적인 선택 해제(깜빡임)를 방지한다.
    if (!this.isDragging) {
      this.cleanupSelectedObjects();
    }
    // PostProcessing Outline 동기화 (PP 켜진 경우에만 의미)
    this._syncOutlineWithSelection();
    // 대체 아웃라인 적용/정리
    const useFallback = this._shouldUseFallbackOutline();
    if (useFallback) {
      // 선택된 오브젝트들에 아웃라인 보장
      for (const obj of this.selectedObjects) {
        if (!obj) continue;
        try { this.addSelectionOutline(obj); } catch {}
        try { this.updateSelectionOutline(obj); } catch {}
      }
    } else {
      // 선택된 오브젝트들에서 대체 아웃라인 제거 (PP Outline 사용)
      for (const obj of this.selectedObjects) {
        if (!obj) continue;
        try { this.removeSelectionOutline(obj); } catch {}
      }
    }
  }
  
  // 기즈�?모드 ?�정
  setGizmoMode(mode) {
    if (!this.transformControls) {
      // Console output removed
      return;
    }
    
    // Console output removed
    
    this.gizmoMode = mode;
    this.transformControls.setMode(mode);
    
    // ?�디???�토?�에 모드 ?�정
    const editorState = this.editorStore.getState();
    if (editorState.setTransformMode) {
      editorState.setTransformMode(mode);
    }
    
    // 기즈모�? ?�택???�브?�트???�결?�어 ?�는지 ?�인
    const selectedObject = this.editorStore.getState().selectedObject;
    if (selectedObject && !this.transformControls.object) {
      // Console output removed
      this.transformControls.attach(selectedObject);
    }
  }
  
  // 그리드 스냅 설정
  setGridSnap(enabled, gridSize = 1) {
    if (!this.transformControls) return;
    
    if (enabled) {
      const s = this.editorStore.getState();
      const move = Number.isFinite(s?.snapMove) ? s.snapMove : gridSize;
      const rot = Number.isFinite(s?.snapRotateDeg) ? THREE.MathUtils.degToRad(s.snapRotateDeg) : THREE.MathUtils.degToRad(15);
      const sca = Number.isFinite(s?.snapScale) ? s.snapScale : 0.1;
      this.transformControls.setTranslationSnap(move || gridSize);
      this.transformControls.setRotationSnap(rot);
      this.transformControls.setScaleSnap(sca);
    } else {
      this.transformControls.setTranslationSnap(null);
      this.transformControls.setRotationSnap(null);
      this.transformControls.setScaleSnap(null);
    }
  }

  // 기즈모 크기 업데이트
  updateGizmoSize() {
    try {
      const size = this.editorStore.getState()?.gizmoSize;
      if (this.transformControls && Number.isFinite(size)) this.transformControls.setSize(size);
    } catch {}
  }
  
  // 그리드 스냅 상태 업데이트
  updateGridSnap() {
    const editorState = this.editorStore.getState();
    this.setGridSnap(editorState.isGridSnap, editorState.gridSize);
  }

  // 기즈모 좌표계 업데이트
  updateGizmoSpace() {
    const editorState = this.editorStore.getState();
    if (this.transformControls) {
      this.transformControls.setSpace(editorState.gizmoSpace);
    }
  }

  // 자석 기능 제거됨

  // 자석 기능 제거됨

  // 오브젝트가 다른 오브젝트의 자식인지 확인
  isChildOf(child, parent) {
    let currentParent = child.parent;
    while (currentParent) {
      if (currentParent === parent) {
        return true;
      }
      currentParent = currentParent.parent;
    }
    return false;
  }

  // 자석 기능 제거됨
  
  // 카메???�데?�트 (카메?��? 변경될 ???�출)
  updateCamera(camera) {
    this.camera = camera;
    if (this.transformControls) {
      this.transformControls.camera = camera;
    }
  }
  
  // ?�택 가?�한 ?�브?�트 관�?
  addSelectableObject(object) {
    if (!this.selectableObjects.includes(object)) {
      this.selectableObjects.push(object);
    }
  }
  
  removeSelectableObject(object) {
    const index = this.selectableObjects.indexOf(object);
    if (index > -1) {
      this.selectableObjects.splice(index, 1);
    }
  }
  
  updateSelectableObjects(objects) {
    this.selectableObjects = [...objects];
  }
  
  // ?�택 박스 ?�시/?�기�?
  showSelectionBox(left, top, width, height) {
    this.selectionBox.style.display = 'block';
    this.selectionBox.style.left = left + 'px';
    this.selectionBox.style.top = top + 'px';
    this.selectionBox.style.width = width + 'px';
    this.selectionBox.style.height = height + 'px';
  }
  
  hideSelectionBox() {
    this.selectionBox.style.display = 'none';
  }
  
  // Getter 메서?�들
  getSelectedObjects() {
    return [...this.selectedObjects];
  }

  getSelectableObjects() {
    return [...this.selectableObjects];
  }
  
  getTransformControls() {
    return this.transformControls;
  }
  
  isDraggingGizmo() {
    return this.isDragging;
  }
  
  // ?�리
  dispose() {
  // 자석/레이 헬퍼 기능 제거됨
    
    // 임시 그룹 제거
    this.clearTempGroup();
    
    // Transform controls ?�제
    if (this.transformControls) {
      try {
        const helper = this.transformControls.getHelper?.();
        if (helper && helper.parent) helper.parent.remove(helper);
      } catch {}
      this.transformControls.dispose();
    }
    
    // ?�택 박스 ?�거
    if (this.selectionBox && this.selectionBox.parentNode) {
      this.selectionBox.parentNode.removeChild(this.selectionBox);
    }
    
    // Console output removed
  }
}
