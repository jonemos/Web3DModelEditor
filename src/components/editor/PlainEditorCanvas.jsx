import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getGLTFLoader, setKTX2Renderer } from '../../utils/gltfLoaderFactory.js';
import { useEditorStore } from '../../store/editorStore';
import { runSmokeTest } from '../../utils/smokeTest';
import { EditorControls } from './EditorControls.js';
import { BlenderControls } from './BlenderControls.js';
import { PostProcessingManager } from './PostProcessingManager.js';
import { getGLBMeshManager } from '../../utils/GLBMeshManager';

function PlainEditorCanvas({ onEditorControlsReady, onPostProcessingReady, onContextMenu }) {
  const mountRef = useRef(null);
  const editorControlsRef = useRef(null);
  const blenderControlsRef = useRef(null);
  const postProcessingRef = useRef(null);
  const sceneRef = useRef(null);
  const [sceneReady, setSceneReady] = useState(false);
  const loadedObjectsRef = useRef(new Map()); // 로드된 오브젝트들을 추적
  const loadingIdsRef = useRef(new Set()); // GLB 로딩 중인 오브젝트 id 추적
  const statsRef = useRef({ lastT: 0, frames: 0, fps: 0, lastPush: 0, vert: 0, tri: 0, obj: 0 });
  const dropIndicatorRef = useRef(null); // 드롭 위치 인디케이터(링)
  const dropFadeRef = useRef({ animId: null, t: 0, target: 0, start: 0, startTime: 0, duration: 220, easing: 'easeInOutQuad', maxOpacity: 0.6 });
  
  const { 
    objects,
    walls,
    setScene,
    setSelectedObject
  } = useEditorStore();

  const isPostProcessingEnabledRef = useRef(useEditorStore.getState().isPostProcessingEnabled);
  // 구독: 포스트프로세싱 토글 상태 변화 추적
  useEffect(() => {
    // subscribeWithSelector 미사용 환경에서도 동작하도록 전체 상태 구독 후 변경 시만 반영
    const unsub = useEditorStore.subscribe((state, prev) => {
      if (state.isPostProcessingEnabled !== prev.isPostProcessingEnabled) {
        isPostProcessingEnabledRef.current = state.isPostProcessingEnabled;
      }
    });
    return () => { try { unsub?.(); } catch {} };
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
  const scene = new THREE.Scene();
  // gizmo용 오버레이 씬 (postprocess 비적용)
  const gizmoScene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a2a); // 기본 배경 (회색)

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(15, 20, 15);
    camera.lookAt(0, 0, 0);

    // Renderer setup (AA 모드 반영)
  const aaMode = (() => { try { return useEditorStore.getState().rendererAA || 'msaa' } catch { return 'msaa' } })();
  const renderer = new THREE.WebGLRenderer({ antialias: aaMode === 'msaa', powerPreference: 'high-performance' });
  try {
    const st = useEditorStore.getState();
    const initialPR = st.safeMode?.enabled ? (st.safeMode.pixelRatio || 1.0) : Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(initialPR);
  } catch {
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // 깊이 테스트 설정 (기즈모가 제대로 렌더링되도록)
    renderer.sortObjects = false;
    renderer.autoClear = false;
    
    // Mount the renderer
    mountRef.current.appendChild(renderer.domElement);

  // KTX2 하드웨어 변환 지원 감지 (메인 렌더러 기준 1회)
  try { setKTX2Renderer(renderer) } catch {}

    // WebGL context lost/restore 처리
    const onContextLost = (e) => {
      e.preventDefault();
      // 렌더 루프는 requestAnimationFrame이 재귀라 자동 중단되지 않음 → 플래그로 스킵 가능
      console.warn('WebGL context lost');
    };
    const onContextRestored = () => {
      try {
        console.warn('WebGL context restored');
        // 렌더러 상태 재설정
        renderer.setSize(window.innerWidth, window.innerHeight);
        // 포스트프로세싱 재초기화
        if (postProcessingRef.current) {
          postProcessingRef.current.initializeComposer();
          postProcessingRef.current.handleResize(window.innerWidth, window.innerHeight);
        }
      } catch {}
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);

    // 캔버스 우클릭 이벤트 리스너 추가
    const handleCanvasContextMenu = (e) => {
      if (onContextMenu) {
        onContextMenu(e);
      }
    };

  renderer.domElement.addEventListener('contextmenu', handleCanvasContextMenu);

    // Store scene reference
    sceneRef.current = scene;
  setScene(scene, camera, renderer);

    // 카메라 변경 콜백 함수
    const handleCameraChange = (newCamera) => {
      // Camera changed
      setScene(scene, newCamera, renderer);
      try { postProcessingRef.current?.setCamera?.(newCamera); } catch {}
      try { blenderControlsRef.current?.setCamera?.(newCamera); } catch {}
    };

  // 에디터 컨트롤 초기화
  const editorControls = new EditorControls(scene, camera, renderer, useEditorStore, handleCameraChange);
  editorControls.gizmoScene = gizmoScene;
    editorControlsRef.current = editorControls;
  // 디버그 접근을 위해 window에 노출 (개발용)
  try { window.__editorControls = editorControls } catch {}
  window.runSmokeTest = () => runSmokeTest(editorControls, useEditorStore);
  // 저장된 설정값을 즉시 반영
  try { editorControls.applyInitialViewState?.() } catch {}
    // BlenderControls 사용 시 초기화
    try {
      const useBlender = !!useEditorStore.getState().useBlenderControls;
      if (useBlender) {
        const bc = new BlenderControls(editorControls.camera, renderer.domElement);
        bc.setScene(scene);
        const st = useEditorStore.getState();
        bc.setSpeeds({ rotate: st.cameraOrbitSpeed * 0.01, pan: st.cameraPanSpeed * 0.02, zoom: st.cameraZoomSpeed });
        blenderControlsRef.current = bc;
        try { window.__blenderControls = bc } catch {}
        // 구독: 카메라 속도 설정 변경 시 즉시 반영
        try {
          const unsubSpeeds = useEditorStore.subscribe((state, prev) => {
            if (
              state.cameraPanSpeed !== prev.cameraPanSpeed ||
              state.cameraOrbitSpeed !== prev.cameraOrbitSpeed ||
              state.cameraZoomSpeed !== prev.cameraZoomSpeed
            ) {
              bc.setSpeeds({
                rotate: state.cameraOrbitSpeed * 0.01,
                pan: state.cameraPanSpeed * 0.02,
                zoom: state.cameraZoomSpeed
              });
            }
          });
          // unmount 시 해제
          const prevDispose = editorControls.dispose?.bind(editorControls);
          editorControls.dispose = () => { try { unsubSpeeds?.(); } catch {} prevDispose?.(); };
        } catch {}
      }
    } catch {}
    
  // 포스트프로세싱 매니저 초기화
    const postProcessingManager = new PostProcessingManager(scene, camera, renderer);
    postProcessingRef.current = postProcessingManager;
  // 모든 주요 초기화(씬/카메라/렌더러/컨트롤/포스트프로세싱) 이후에 sceneReady 신호
  try { setSceneReady(true); } catch {}
  try { postProcessingManager.setCamera(camera); } catch {}
  // 환경의 톤매핑/프리셋 초기값을 매니저에 반영
  try {
    const envCfg = loadEnvironmentSettings?.();
    if (envCfg) {
      if (envCfg.toneMapping) {
        postProcessingManager.updateEffectSettings('toneMapping', { ...envCfg.toneMapping });
        postProcessingManager.setEffectEnabled('toneMapping', envCfg.toneMapping.enabled !== false);
      }
      if (envCfg.postProcessing?.preset) {
        postProcessingManager.applyPreset?.(envCfg.postProcessing.preset);
      }
    }
  } catch {}
  // 파트 아웃라인 동기화를 위해 EditorControls에 주입
  try { editorControls.setPostProcessingManager(postProcessingManager); } catch {}
  try { useEditorStore.getState().setPostProcessingManager(postProcessingManager); } catch {}
  // FXAA 상호배타 처리: rendererAA가 fxaa일 때만 FXAA 켜고, msaa/none이면 끔(세이프모드 우선)
  try {
    const st = useEditorStore.getState();
    const wantFXAA = st.rendererAA === 'fxaa' && !st.safeMode?.enabled;
    postProcessingManager.setEffectEnabled('fxaa', !!wantFXAA);
  } catch {}
  try { useEditorStore.getState().estimateVRAMUsage(); } catch {}
    
  // EditorControls가 준비되었음을 부모 컴포넌트에 알림
    if (onEditorControlsReady) {
      onEditorControlsReady(editorControls);
    }
    
    // PostProcessingManager가 준비되었음을 부모 컴포넌트에 알림
    if (onPostProcessingReady) {
      onPostProcessingReady(postProcessingManager);
    }

  // gizmo 씬은 라이트 불필요(기즈모는 기본재질)
  editorControls.objectSelector.setGizmoScene?.(gizmoScene);

  // Add lights
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  ambientLight.userData.isSystemObject = true;
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
  directionalLight.userData.isSystemObject = true;
    scene.add(directionalLight);

  // Bloom/SSAO 시각 확인을 위한 보조 광원
  const point = new THREE.PointLight(0xffaa88, 1.0, 100);
  point.position.set(0, 6, 6);
  point.userData.isSystemObject = true;
  scene.add(point);

    // Test cube
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
    const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(0, 1, 0);
    cube.castShadow = true;
    cube.userData.name = 'Test Cube';
    cube.userData.id = 'test_cube';
    scene.add(cube);

    // Test cylinder (tree trunk)
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.5, 3);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(5, 1.5, 0);
    trunk.castShadow = true;
    trunk.userData.name = 'Tree Trunk';
    trunk.userData.id = 'tree_trunk';
    scene.add(trunk);

    // Test sphere (tree leaves)
    const leavesGeometry = new THREE.SphereGeometry(2);
    const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
    leaves.position.set(5, 4, 0);
    leaves.castShadow = true;
    leaves.userData.name = 'Tree Leaves';
    leaves.userData.id = 'tree_leaves';
    scene.add(leaves);

    // 테스트 오브젝트들을 loadedObjectsRef에 추가 (가시성 토글을 위해)
    loadedObjectsRef.current.set('test_cube', cube);
    loadedObjectsRef.current.set('tree_trunk', trunk);
    loadedObjectsRef.current.set('tree_leaves', leaves);

    // 선택 가능한 오브젝트들을 컨트롤러에 등록
    editorControls.addSelectableObject(cube);
    editorControls.addSelectableObject(trunk);
    editorControls.addSelectableObject(leaves);

  // Animation loop with on-demand rendering support
    let needsRender = true;
    const getRenderMode = () => { try { return useEditorStore.getState().renderMode || 'continuous' } catch { return 'continuous' } };
    const requestRender = () => { needsRender = true; };
    try { window.__requestRender = requestRender } catch {}

    const animate = () => {
      const mode = getRenderMode();
      requestAnimationFrame(animate);
      
      // Rotate cube slowly for visual feedback
      cube.rotation.y += 0.005;
      
      // 선택된 오브젝트들의 아웃라인 업데이트 (애니메이션 중인 오브젝트용)
      if (editorControlsRef.current) {
        editorControlsRef.current.updateSelectedOutlines();
        // 라이트 헬퍼 주기적 동기화(타겟 이동 포함)
        try {
          const sel = editorControlsRef.current.getSelectedObjects?.() || [];
          sel.forEach((obj) => {
            if (obj?.isLight && obj.userData?.lightHelper && typeof obj.userData.lightHelper.update === 'function') {
              obj.userData.lightHelper.update();
            } else if (obj?.userData?.isLightTarget || obj?.userData?.ownerId) {
              // 타겟이 선택된 경우: 소유 라이트의 헬퍼 갱신
              try {
                const ownerId = obj.userData.ownerId;
                let ownerLight = null;
                if (ownerId && loadedObjectsRef.current?.has(ownerId)) {
                  ownerLight = loadedObjectsRef.current.get(ownerId);
                } else {
                  // 폴백: 씬에서 target === obj인 라이트 탐색
                  scene.traverse((n) => {
                    if (!ownerLight && n?.isLight && n.target === obj) ownerLight = n;
                  });
                }
                if (ownerLight?.userData?.lightHelper && typeof ownerLight.userData.lightHelper.update === 'function') {
                  ownerLight.userData.lightHelper.update();
                }
              } catch {}
            }
          });
        } catch {}
      }
      
      // 드롭 링 rAF 페이드 처리 (easeInOutQuad)
      if (dropIndicatorRef.current) {
        const ring = dropIndicatorRef.current;
        const f = dropFadeRef.current;
        if (f && f.duration > 0 && (f.t < 1 || ring.material.opacity !== f.target)) {
          const now = performance.now();
          const elapsed = Math.min(1, (now - f.startTime) / f.duration);
          // 이징 선택
          let ease;
          switch (f.easing) {
            case 'linear':
              ease = elapsed;
              break;
            case 'easeOutCubic':
              ease = 1 - Math.pow(1 - elapsed, 3);
              break;
            case 'easeInCubic':
              ease = Math.pow(elapsed, 3);
              break;
            case 'easeInOutQuad':
            default:
              ease = elapsed < 0.5 ? 2 * elapsed * elapsed : -1 + (4 - 2 * elapsed) * elapsed;
          }
          const nextOpacity = f.start + (f.target - f.start) * ease;
          if (ring.material) ring.material.opacity = Math.max(0, Math.min(1, nextOpacity));
          f.t = elapsed;
          if (elapsed >= 1 && f.target === 0 && ring.visible) {
            ring.visible = false; // 완전 페이드아웃 시 숨김
          }
        }
      }

  // BlenderControls 업데이트
  const bcUpdated = (() => { try { return blenderControlsRef.current?.update?.() } catch { return false } })();
  if (bcUpdated) needsRender = true;

  // === 통계 갱신 (FPS 및 지오메트리 집계) - 렌더 스킵과 무관하게 실행 ===
      try {
        const now = performance.now();
        const s = statsRef.current;
        if (!s.lastT) s.lastT = now;
        s.frames += 1;
        const dt = now - s.lastT;
        if (dt >= 500) { // 0.5초 윈도우로 FPS 계산
          s.fps = Math.round((s.frames * 1000) / dt);
          s.frames = 0; s.lastT = now;
        }
        // 1초마다 씬 집계 후 스토어에 푸시
        if (!s.lastPush || (now - s.lastPush) >= 1000) {
          s.lastPush = now;
          let objCount = 0, vert = 0, tri = 0;
          scene.traverse((child) => {
            if (!child.visible) return;
            if (child.userData?.isSystemObject || child.userData?.isSelectionOutline) return;
            // Group 카운트
            if (child.isGroup) objCount += 1;
            // Mesh 카운트 및 지오메트리 합산
            if (child.isMesh && child.geometry) {
              objCount += 1;
              const g = child.geometry;
              const pos = g.attributes?.position;
              const idx = g.index;
              const v = pos ? pos.count : 0;
              const t = idx ? Math.floor(idx.count / 3) : (pos ? Math.floor(pos.count / 3) : 0);
              vert += v;
              tri += t;
            }
          });
          s.obj = objCount; s.vert = vert; s.tri = tri;
          try { useEditorStore.getState().setStats({ fps: s.fps, objects: objCount, vertices: vert, triangles: tri }); } catch {}
        }
      } catch {}

      // 렌더링 (포스트프로세싱 사용 여부)
      if (mode === 'on-demand' && !needsRender) {
        return; // 스킵 프레임
      }
      needsRender = false;
      renderer.clear();
      // EditorControls의 현재 카메라 사용 (Perspective/Orthographic 토글 대응)
      const currentCamera = editorControlsRef.current ? editorControlsRef.current.camera : camera;
      
      const usePP = isPostProcessingEnabledRef.current && !!postProcessingRef.current;
      // 라이트 헬퍼 월드행렬/업데이트 (전역 보강)
      try {
        scene.traverse((n) => {
          if (n?.isLight && n.userData?.lightHelper && typeof n.userData.lightHelper.update === 'function') {
            try { n.updateMatrixWorld(true); } catch {}
            try { n.target?.updateMatrixWorld?.(true); } catch {}
            // three.js SpotLightHelper.update는 light/target의 월드행렬 최신화 후 호출해야 방향/콘이 맞음
            n.userData.lightHelper.update();
          }
        });
      } catch {}
      if (usePP) {
        // EditorControls가 보유한 최신 카메라를 컴포저에 반영
        try { postProcessingRef.current.setCamera(currentCamera); } catch {}
        postProcessingRef.current.render();
      } else {
        renderer.render(scene, currentCamera);
      }
      // 렌더 전후로도 기즈모 라인 강제 숨김 (안전망)
      try { editorControlsRef.current?.objectSelector?.forceHideGizmoLines?.(); } catch {}
      // postprocess 이후 gizmo 오버레이 씬 렌더 (깊이 무시, 색상만 덮어씀)
      renderer.clearDepth();
      renderer.render(gizmoScene, currentCamera);
      try { editorControlsRef.current?.objectSelector?.forceHideGizmoLines?.(); } catch {}
    };
  animate();

    // 드래그 앤 드롭 이벤트 핸들러 추가
    const canvas = renderer.domElement;
    
    const setDropFade = (to, duration = 220) => {
      const ring = dropIndicatorRef.current;
      if (!ring) return;
      const f = dropFadeRef.current;
      f.start = ring.material?.opacity ?? 0;
      const { dropIndicator } = useEditorStore.getState();
      f.target = Math.min(to, dropIndicator?.maxOpacity ?? 0.6);
      f.t = 0;
      f.duration = duration;
      f.easing = dropIndicator?.easing ?? 'easeInOutQuad';
      f.maxOpacity = dropIndicator?.maxOpacity ?? 0.6;
      f.startTime = performance.now();
      if (to > 0) ring.visible = true;
    };

    canvas.addEventListener('dragover', (event) => {
      event.preventDefault();
      // 드롭 인디케이터 업데이트
      try {
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        const raycaster = new THREE.Raycaster();
        const currentCamera = editorControlsRef.current ? editorControlsRef.current.camera : camera;
        raycaster.setFromCamera(mouse, currentCamera);
        // 지면(y=0)뿐만 아니라 씬의 메시 충돌도 고려하여 정렬
        const meshes = [];
        scene.traverse((child)=>{ if (child.isMesh && child.visible) meshes.push(child); });
        const hits = raycaster.intersectObjects(meshes, true);
        if (hits && hits.length > 0) {
          const hit = hits[0];
          const point = hit.point;
          const normal = hit.face && hit.face.normal ? hit.face.normal.clone() : new THREE.Vector3(0,1,0);
          // 월드 노말로 변환
          if (hit.object && hit.object.isMesh && hit.object.normalMatrix) {
            normal.applyMatrix3(hit.object.normalMatrix).normalize();
          }
          // 링 생성 또는 업데이트
          if (!dropIndicatorRef.current) {
            const ringGeo = new THREE.RingGeometry(0.6, 0.75, 48);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.0, side: THREE.DoubleSide });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.position.copy(point);
            // 노말 정렬: 기본 up(0,1,0)에서 normal로 회전
            const from = new THREE.Vector3(0,1,0);
            const q = new THREE.Quaternion().setFromUnitVectors(from, normal.clone().normalize());
            ringMesh.quaternion.copy(q);
            ringMesh.userData.isSystemObject = true;
            scene.add(ringMesh);
            dropIndicatorRef.current = ringMesh;
          } else {
            const ring = dropIndicatorRef.current;
            ring.position.copy(point);
            const from = new THREE.Vector3(0,1,0);
            const q = new THREE.Quaternion().setFromUnitVectors(from, normal.clone().normalize());
            ring.quaternion.copy(q);
            ring.visible = true;
          }
          // 카메라 거리 기반 스케일 자동 조정
          const camPos = currentCamera.position;
          const dist = camPos.distanceTo(point);
          const scale = Math.max(0.5, Math.min(4, dist * 0.06));
          dropIndicatorRef.current.scale.setScalar(scale);
          // 페이드 인 목표 (스토어 설정 사용)
          const di = useEditorStore.getState().dropIndicator;
          setDropFade(di?.maxOpacity ?? 0.6, di?.inMs ?? 200);
        } else {
          // 바닥 평면으로 대체
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const intersection = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(plane, intersection)) {
            if (!dropIndicatorRef.current) {
              const ringGeo = new THREE.RingGeometry(0.6, 0.75, 48);
              const ringMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.0, side: THREE.DoubleSide });
              const ringMesh = new THREE.Mesh(ringGeo, ringMat);
              ringMesh.rotation.x = -Math.PI / 2;
              ringMesh.position.copy(intersection);
              ringMesh.userData.isSystemObject = true;
              scene.add(ringMesh);
              dropIndicatorRef.current = ringMesh;
            } else {
              dropIndicatorRef.current.position.copy(intersection);
              dropIndicatorRef.current.rotation.set(-Math.PI/2, 0, 0);
              dropIndicatorRef.current.visible = true;
            }
    const camPos = currentCamera.position;
            const dist = camPos.distanceTo(intersection);
            const scale = Math.max(0.5, Math.min(4, dist * 0.06));
            dropIndicatorRef.current.scale.setScalar(scale);
            const di = useEditorStore.getState().dropIndicator;
            setDropFade(di?.maxOpacity ?? 0.6, di?.inMs ?? 200);
          }
        }
      } catch {}
    });

    canvas.addEventListener('drop', (event) => {
      event.preventDefault();
      // 드롭 시 인디케이터 숨김
      if (dropIndicatorRef.current) {
        const di = useEditorStore.getState().dropIndicator;
        setDropFade(0.0, di?.outMs ?? 180);
      }
      
      try {
        const data = event.dataTransfer.getData('text/plain');
        if (data) {
          const objectData = JSON.parse(data);
          
          // 기본 에셋인 경우 별도 처리
          if (objectData.type === 'start_position' || objectData.type === 'directional_light' || 
              objectData.type === 'point_light' || objectData.type === 'spot_light' || 
              objectData.type === 'ambient_light' || objectData.type === 'audio_source' ||
              objectData.type === 'fog' || objectData.type === 'skybox' || 
              objectData.type === 'post_process' || objectData.type === 'camera_helper' ||
              objectData.type === 'grid_helper' || objectData.type === 'axes_helper') {
            
            // 마우스 위치를 3D 좌표로 변환
            const rect = canvas.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            // 바닥과의 교차점 계산 (y=0 평면)
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersection = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, intersection);
            
            // 에셋 타입에 따라 3D 객체 생성
            let assetObject;
            
            switch (objectData.type) {
              case 'start_position':
                // 스타트 위치는 사용하지 않음 (생성 스킵)
                assetObject = null;
                break;
                
              case 'directional_light':
                // 디렉셔널 라이트
                const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
                directionalLight.position.set(intersection.x + 5, intersection.y + 10, intersection.z + 5);
                directionalLight.target.position.copy(intersection);
                directionalLight.castShadow = true;
                directionalLight.shadow.mapSize.width = 2048;
                directionalLight.shadow.mapSize.height = 2048;
                
                // 라이트 헬퍼 추가
                const directionalHelper = new THREE.DirectionalLightHelper(directionalLight, 1);
                directionalLight.userData = directionalLight.userData || {};
                directionalLight.userData.lightHelper = directionalHelper;
                scene.add(directionalHelper);
                try { directionalHelper.update(); } catch {}
                // 타겟 선택/레이캐스트용 핸들 추가 및 선택 가능 등록
                try {
                  const tGrabGeo = new THREE.SphereGeometry(0.18, 12, 12);
                  const tGrabMat = new THREE.MeshBasicMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.95 });
                  const tGrab = new THREE.Mesh(tGrabGeo, tGrabMat);
                  tGrab.name = 'DirectionalTargetHandle';
                  tGrab.userData.isSystemObject = true;
                  tGrab.userData.isLightTargetHandle = true;
                  tGrab.raycast = THREE.Mesh.prototype.raycast;
                  directionalLight.target.userData = directionalLight.target.userData || {};
                  directionalLight.target.userData.isLightTarget = true;
                  directionalLight.target.add(tGrab);
                } catch {}

                // 선택/레이캐스트용 그랩 핸들(라이트의 자식으로 추가)
                try {
                  const grabGeo = new THREE.SphereGeometry(0.25, 12, 12);
                  const grabMat = new THREE.MeshBasicMaterial({ color: 0xffff66, transparent: true, opacity: 0.9 });
                  const grab = new THREE.Mesh(grabGeo, grabMat);
                  grab.name = 'DirectionalLightHandle';
                  grab.userData.isSystemObject = true; // 통계/선택 외부 영향 차단
                  grab.userData.isLightHelper = true;
                  grab.raycast = THREE.Mesh.prototype.raycast; // 레이캐스트 가능
                  directionalLight.add(grab);
                } catch {}
                
                assetObject = directionalLight;
                scene.add(directionalLight.target); // target도 씬에 추가
                try { editorControls.addSelectableObject(directionalLight.target); } catch {}
                break;
                
              case 'point_light':
                // 포인트 라이트
                const pointLight = new THREE.PointLight(0xffffff, 1, 10, 2);
                pointLight.position.set(intersection.x, intersection.y + 3, intersection.z);
                pointLight.castShadow = true;
                
                // 라이트 헬퍼 추가
                const pointHelper = new THREE.PointLightHelper(pointLight, 0.5);
                pointLight.userData = pointLight.userData || {};
                pointLight.userData.lightHelper = pointHelper;
                scene.add(pointHelper);
                try { pointHelper.update(); } catch {}

                // 선택/레이캐스트용 그랩 핸들(라이트의 자식으로 추가)
                try {
                  const grabGeo = new THREE.SphereGeometry(0.2, 12, 12);
                  const grabMat = new THREE.MeshBasicMaterial({ color: 0xffff66, transparent: true, opacity: 0.95 });
                  const grab = new THREE.Mesh(grabGeo, grabMat);
                  grab.name = 'PointLightHandle';
                  grab.userData.isSystemObject = true;
                  grab.userData.isLightHelper = true;
                  grab.raycast = THREE.Mesh.prototype.raycast;
                  pointLight.add(grab);
                } catch {}
                
                assetObject = pointLight;
                break;
                
              case 'spot_light':
                // 스포트 라이트
                const spotLight = new THREE.SpotLight(0xffffff, 1, 10, Math.PI/6, 0.1, 2);
                spotLight.position.set(intersection.x, intersection.y + 5, intersection.z);
                spotLight.target.position.copy(intersection);
                spotLight.castShadow = true;
                
                // 라이트 헬퍼 추가
                const spotHelper = new THREE.SpotLightHelper(spotLight);
                spotLight.userData = spotLight.userData || {};
                spotLight.userData.lightHelper = spotHelper;
                scene.add(spotHelper);
                try { spotHelper.update(); } catch {}

                // 선택/레이캐스트용 그랩 핸들(라이트의 자식으로 추가)
                try {
                  const grabGeo = new THREE.SphereGeometry(0.22, 12, 12);
                  const grabMat = new THREE.MeshBasicMaterial({ color: 0xffff66, transparent: true, opacity: 0.9 });
                  const grab = new THREE.Mesh(grabGeo, grabMat);
                  grab.name = 'SpotLightHandle';
                  grab.userData.isSystemObject = true;
                  grab.userData.isLightHelper = true;
                  grab.raycast = THREE.Mesh.prototype.raycast;
                  spotLight.add(grab);
                } catch {}
                
                assetObject = spotLight;
                scene.add(spotLight.target); // target도 씬에 추가
                // 타겟 선택/레이캐스트용 핸들 추가
                try {
                  const tGrabGeo = new THREE.SphereGeometry(0.18, 12, 12);
                  const tGrabMat = new THREE.MeshBasicMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.95 });
                  const tGrab = new THREE.Mesh(tGrabGeo, tGrabMat);
                  tGrab.name = 'SpotTargetHandle';
                  tGrab.userData.isSystemObject = true;
                  tGrab.userData.isLightTargetHandle = true;
                  tGrab.raycast = THREE.Mesh.prototype.raycast;
                  spotLight.target.userData = spotLight.target.userData || {};
                  spotLight.target.userData.isLightTarget = true;
                  spotLight.target.add(tGrab);
                } catch {}
                // 스포트라이트 타겟도 선택 가능 등록 (방향 조작을 위해)
                try { editorControls.addSelectableObject(spotLight.target); } catch {}
                break;
                
              case 'ambient_light':
                // 앰비언트 라이트 (위치가 없으므로 표시용 구체 생성)
                const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
                const ambientGeometry = new THREE.SphereGeometry(0.5, 16, 16);
                const ambientMaterial = new THREE.MeshBasicMaterial({ 
                  color: 0x404040, 
                  wireframe: true, 
                  transparent: true, 
                  opacity: 0.5 
                });
                assetObject = new THREE.Mesh(ambientGeometry, ambientMaterial);
                assetObject.position.copy(intersection);
                scene.add(ambientLight); // 실제 라이트도 씬에 추가
                break;
                
              case 'audio_source':
                // 오디오 소스 마커
                const audioGeometry = new THREE.SphereGeometry(0.3, 16, 16);
                const audioMaterial = new THREE.MeshStandardMaterial({ color: 0xff9900 });
                assetObject = new THREE.Mesh(audioGeometry, audioMaterial);
                assetObject.position.set(intersection.x, intersection.y + 1, intersection.z);
                break;
                
              case 'grid_helper':
                // 그리드 헬퍼
                assetObject = new THREE.GridHelper(10, 10);
                assetObject.position.copy(intersection);
                break;
                
              case 'axes_helper':
                // 축 헬퍼
                assetObject = new THREE.AxesHelper(2);
                assetObject.position.copy(intersection);
                // 선택/레이캐스트용 그랩 핸들(자식으로 추가)
                try {
                  const grabGeo = new THREE.SphereGeometry(0.2, 12, 12);
                  const grabMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.9 });
                  const grab = new THREE.Mesh(grabGeo, grabMat);
                  grab.name = 'AxesHelperHandle';
                  grab.userData.isSystemObject = true;
                  grab.userData.isHelperHandle = true;
                  grab.raycast = THREE.Mesh.prototype.raycast;
                  assetObject.add(grab);
                } catch {}
                break;
                
              default:
                // 기본 마커
                const defaultGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
                const defaultMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
                assetObject = new THREE.Mesh(defaultGeometry, defaultMaterial);
                assetObject.position.copy(intersection);
            }
            
            if (assetObject) {
              // 그림자 설정
              if (assetObject.isMesh) {
                assetObject.castShadow = true;
                assetObject.receiveShadow = true;
              }
              
              // 고유 ID 생성
              const uniqueId = `${objectData.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              assetObject.name = uniqueId;
              // 기존 userData 보존(헬퍼 참조 등) + 메타데이터 병합
              assetObject.userData = Object.assign(assetObject.userData || {}, {
                id: uniqueId,
                name: objectData.name,
                type: objectData.type,
                originalData: objectData
              });
              
              scene.add(assetObject);
              
                // 선택 가능한 오브젝트로 등록
              editorControls.addSelectableObject(assetObject);
              
              // 로드된 오브젝트로 기록
              loadedObjectsRef.current.set(uniqueId, assetObject);
              
              // 에디터 스토어에 객체 등록
              const addObject = useEditorStore.getState().addObject;
              // 라이트 계열 중 기즈모 이동 대상(directional/point/spot)만 type을 'light'로 저장
              const isLightAsset = ['directional_light','point_light','spot_light'].includes(objectData.type);
              const lightType = objectData.type === 'directional_light' ? 'directional' : (objectData.type === 'point_light' ? 'point' : (objectData.type === 'spot_light' ? 'spot' : undefined));
              addObject({
                id: uniqueId,
                name: objectData.name,
                type: isLightAsset ? 'light' : objectData.type,
                lightType: isLightAsset ? lightType : undefined,
                position: { x: assetObject.position.x, y: assetObject.position.y, z: assetObject.position.z },
                rotation: { x: assetObject.rotation.x, y: assetObject.rotation.y, z: assetObject.rotation.z },
                scale: { x: assetObject.scale.x, y: assetObject.scale.y, z: assetObject.scale.z },
                visible: true,
                userData: assetObject.userData
              });
              // 타겟/핸들에 소유자 ID 주입(선택 처리 및 동기화용)
              try {
                if (assetObject.isLight && assetObject.target && assetObject.target.isObject3D) {
                  assetObject.target.userData = assetObject.target.userData || {};
                  assetObject.target.userData.ownerId = uniqueId;
                  const tHandle = assetObject.target.children?.find?.(c => c.userData?.isLightTargetHandle);
                  if (tHandle) tHandle.userData.ownerId = uniqueId;
                }
              } catch {}
              
              // 새로 추가된 객체 선택
              setSelectedObject(uniqueId);
              
            }
            
            return; // 기본 geometry 처리 로직을 건너뛰기
          }
          
          // 커스텀 메쉬나 라이브러리 메쉬인 경우 별도 처리
          if (objectData.type === 'custom' || objectData.type === 'library') {
            
            // 마우스 위치를 3D 좌표로 변환
            const rect = canvas.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            // 바닥과의 교차점 계산 (y=0 평면)
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersection = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, intersection);
            
            // GLB 로더로 메쉬 로드
            const loader = getGLTFLoader();
            let modelUrl;
            let capturedGlbData = null;

            // 로드 계속 진행 함수 (먼저 선언해 hoist 문제 제거)
            function continueWithLoad() {
              loader.load(
                modelUrl,
                (gltf) => {
                  const model = gltf.scene;
                  model.position.copy(intersection);
                  
                  // 그림자 설정
                  model.traverse((child) => {
                    if (child.isMesh) {
                      child.castShadow = true;
                      child.receiveShadow = true;
                    }
                  });
                  
                  // 고유 ID 생성 (씬 추가 이전에 설정)
                  const uniqueId = `${objectData.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                  model.name = uniqueId;
                  model.userData = {
                    id: uniqueId,
                    name: objectData.name,
                    type: objectData.type,
                    originalData: objectData,
                    // 커스텀 메쉬의 경우 참조 id를 함께 보관해 일관성 유지
                    ...(objectData.type === 'custom' ? { customMeshId: objectData.id } : {})
                  };
                  // 서브메시에 소유자 id 주입(선택/정리 보존용)
                  try { model.traverse((n)=>{ n.userData = n.userData || {}; if (!n.userData.ownerId) n.userData.ownerId = uniqueId; }); } catch {}
                  
                  scene.add(model);
                  
                  // 선택 가능한 오브젝트로 등록
                  editorControls.addSelectableObject(model);
                  
                  // 로드된 오브젝트로 기록
                  loadedObjectsRef.current.set(uniqueId, model);
                  
                  // 에디터 스토어에 객체 등록
                  const addObject = useEditorStore.getState().addObject;
                  addObject({
                    id: uniqueId,
                    name: objectData.name,
                    type: 'glb',
                    // 첫 생성도 glbData를 저장하지 않고 참조 id(customMeshId)만 저장
                    ...(objectData.type === 'custom'
                      ? { customMeshId: objectData.id }
                      : { url: objectData.glbUrl }
                    ),
                    position: { x: intersection.x, y: intersection.y, z: intersection.z },
                    rotation: { x: model.rotation.x, y: model.rotation.y, z: model.rotation.z },
                    scale: { x: 1, y: 1, z: 1 },
                    visible: true,
                    userData: model.userData
                  });
                  
                  // 새로 추가된 객체 선택
                  setSelectedObject(uniqueId);
                  
                  // URL 정리 (커스텀 메쉬의 경우에만)
                  if (objectData.type === 'custom') {
                    URL.revokeObjectURL(modelUrl);
                  }
                },
                undefined,
                (error) => {
                  console.error('커스텀/라이브러리 메쉬 로드 실패:', error);
                  if (objectData.type === 'custom') {
                    URL.revokeObjectURL(modelUrl);
                  }
                }
              );
            }
            
            if (objectData.type === 'custom') {
              // 커스텀 메쉬: GLB 데이터를 Blob URL로 변환
              try {
                const glbMeshManager = getGLBMeshManager();
                const proceed = (data) => {
                  capturedGlbData = data;
                  modelUrl = glbMeshManager.createBlobURL(capturedGlbData);
                  continueWithLoad();
                };
                const handleErr = (error) => {
                  console.error('GLB 데이터 변환 실패:', error);
                };
                if (!objectData.glbData && objectData.id) {
                  glbMeshManager.getCustomMeshes().then(list => {
                    const found = list.find(m => m.id === objectData.id);
                    if (!found) throw new Error('NOT_FOUND');
                    proceed(found.glbData);
                  }).catch(handleErr);
                  return; // 비동기 처리 후 continueWithLoad에서 이어짐
                } else {
                  proceed(objectData.glbData);
                  return; // 동기 경로에서도 더 진행하지 않도록 종료
                }
              } catch (error) {
                console.error('GLB 데이터 변환 실패:', error);
                return;
              }
            } else if (objectData.type === 'library') {
              // 라이브러리 메쉬: glbUrl 사용
              modelUrl = objectData.glbUrl;
              continueWithLoad();
              return; // 기본 처리 로직으로 떨어지지 않도록 종료
            }
            
            return; // 기본 geometry 처리 로직을 건너뛰기
          }
          
          // 마우스 위치를 3D 좌표로 변환
          const rect = canvas.getBoundingClientRect();
          const mouse = new THREE.Vector2();
          mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, camera);
          
          // 바닥과의 교차점 계산 (y=0 평면)
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const intersection = new THREE.Vector3();
          raycaster.ray.intersectPlane(plane, intersection);
          
          // 기본 재질 생성
          const material = new THREE.MeshStandardMaterial({ 
            color: 0x4CAF50,
            roughness: 0.3,
            metalness: 0.1
          });
          
          let geometry;
          let mesh;
          
          // 기하학적 도형 생성
          switch (objectData.geometry) {
            case 'BoxGeometry':
              geometry = new THREE.BoxGeometry(...objectData.params);
              break;
            case 'SphereGeometry':
              geometry = new THREE.SphereGeometry(...objectData.params);
              break;
            case 'CylinderGeometry':
              geometry = new THREE.CylinderGeometry(...objectData.params);
              break;
            case 'ConeGeometry':
              geometry = new THREE.ConeGeometry(...objectData.params);
              break;
            case 'PlaneGeometry':
              geometry = new THREE.PlaneGeometry(...objectData.params);
              break;
            case 'TorusGeometry':
              geometry = new THREE.TorusGeometry(...objectData.params);
              break;
            case 'CustomGeometry':
              // 사용자 정의 객체 복제
              if (objectData.glbData) {
                try {
                  const glbMeshManager = getGLBMeshManager();
                  const url = glbMeshManager.createBlobURL(objectData.glbData);
                  
                  // GLB 파일 로드
                  const loader = getGLTFLoader();
                  loader.load(url, (gltf) => {
                  const model = gltf.scene;
                  model.position.copy(intersection);
                  
                  // 고유 ID 생성
                  const uniqueId = `${objectData.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                  model.name = uniqueId;
                  model.userData = {
                    id: uniqueId,
                    name: objectData.name,
                    type: objectData.type || 'custom',
                    originalName: objectData.name
                  };
                  
                  // 그림자 설정
                  model.traverse((child) => {
                    if (child.isMesh) {
                      child.castShadow = true;
                      child.receiveShadow = true;
                    }
                  });
                  
                  scene.add(model);
                  
                  // 선택 가능한 오브젝트로 등록
                  editorControls.addSelectableObject(model);
                  
                  // 로드된 오브젝트로 기록
                  loadedObjectsRef.current.set(uniqueId, model);
                  
                  // 에디터 스토어에 객체 등록
                  const addObject = useEditorStore.getState().addObject;
                  addObject({
                    id: uniqueId,
                    name: objectData.name,
                    type: 'mesh',
                    position: { x: intersection.x, y: intersection.y, z: intersection.z },
                    rotation: { x: model.rotation.x, y: model.rotation.y, z: model.rotation.z },
                    scale: { x: 1, y: 1, z: 1 },
                    visible: true,
                    userData: model.userData
                  });
                  
                  // 새로 추가된 객체 선택
                  setSelectedObject(uniqueId);
                  
                  // URL 정리
                  URL.revokeObjectURL(url);
                }, undefined, (error) => {
                  console.error('커스텀 GLB 로드 오류:', error);
                  URL.revokeObjectURL(url);
                });
                return; // 여기서 함수 종료
                } catch (error) {
                  console.error('GLB 데이터 변환 실패:', error);
                  return;
                }
              } else if (objectData.originalObject && objectData.originalObject.geometry) {
                geometry = objectData.originalObject.geometry.clone();
              } else {
                geometry = new THREE.BoxGeometry(1, 1, 1); // 기본값
              }
              break;
            case 'LibraryMesh':
              // 라이브러리 메쉬 로드
              if (objectData.glbUrl) {
                const loader = getGLTFLoader();
                loader.load(objectData.glbUrl, (gltf) => {
                  const model = gltf.scene;
                  model.position.copy(intersection);
                  
                  // 고유 ID 생성
                  const uniqueId = `${objectData.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                  model.name = uniqueId;
                  model.userData = {
                    id: uniqueId,
                    name: objectData.name,
                    type: objectData.type || 'library',
                    originalName: objectData.name
                  };
                  
                  // 그림자 설정
                  model.traverse((child) => {
                    if (child.isMesh) {
                      child.castShadow = true;
                      child.receiveShadow = true;
                    }
                  });
                  
                  scene.add(model);
                  
                  // 선택 가능한 오브젝트로 등록
                  editorControls.addSelectableObject(model);
                  
                  // 로드된 오브젝트로 기록
                  loadedObjectsRef.current.set(uniqueId, model);
                  
                  // 에디터 스토어에 객체 등록
                  const addObject = useEditorStore.getState().addObject;
                  addObject({
                    id: uniqueId,
                    name: objectData.name,
                    type: 'mesh',
                    position: { x: intersection.x, y: intersection.y, z: intersection.z },
                    rotation: { x: model.rotation.x, y: model.rotation.y, z: model.rotation.z },
                    scale: { x: 1, y: 1, z: 1 },
                    visible: true,
                    userData: model.userData
                  });
                  
                  // 새로 추가된 객체 선택
                  setSelectedObject(uniqueId);
                }, undefined, (error) => {
                  console.error('라이브러리 메쉬 로드 오류:', error);
                });
                return; // 여기서 함수 종료
              } else {
                geometry = new THREE.BoxGeometry(1, 1, 1); // 기본값
              }
              break;
            default:
              geometry = new THREE.BoxGeometry(1, 1, 1);
          }
          
          mesh = new THREE.Mesh(geometry, material);
          mesh.position.copy(intersection);
          
          // 평면의 경우 회전 조정
          if (objectData.geometry === 'PlaneGeometry') {
            mesh.rotation.x = -Math.PI / 2;
          }
          
          // 그림자 설정
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          
          // 고유 ID 생성
          const uniqueId = `${objectData.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          mesh.name = uniqueId;
          mesh.userData = {
            id: uniqueId,
            name: objectData.name,
            type: objectData.type || 'basic',
            originalName: objectData.name,
            geometry: objectData.geometry,
            params: objectData.params,
            ownerId: uniqueId
          };
          
          scene.add(mesh);
          
          // 선택 가능한 오브젝트로 등록
          editorControls.addSelectableObject(mesh);
          
          // 로드된 오브젝트로 기록
          loadedObjectsRef.current.set(uniqueId, mesh);
          
          // 에디터 스토어에 객체 등록
          const addObject = useEditorStore.getState().addObject;
          addObject({
            id: uniqueId,
            name: objectData.name,
            type: 'basic',
            geometry: objectData.geometry,
            params: objectData.params,
            position: { x: intersection.x, y: intersection.y, z: intersection.z },
            rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
            scale: { x: 1, y: 1, z: 1 },
            visible: true,
            userData: mesh.userData
          });
          
          // 새로 추가된 객체 선택
          setSelectedObject(uniqueId);
        }
      } catch (error) {
        console.warn('드롭된 데이터 파싱 실패:', error);
      }
    });

  canvas.addEventListener('dragleave', () => {
      if (dropIndicatorRef.current) {
        const di = useEditorStore.getState().dropIndicator;
        setDropFade(0.0, di?.outMs ?? 220);
      }
    });

  // on-demand 모드용 렌더 트리거 이벤트 등록
  const triggerEvents = ['mousedown','mouseup','mousemove','wheel','keydown','keyup','resize'];
  const onTrigger = () => { try { if ((useEditorStore.getState().renderMode || 'continuous') === 'on-demand') window.__requestRender?.(); } catch {} };
  triggerEvents.forEach(ev => window.addEventListener(ev, onTrigger, { passive: true }));
  canvas.addEventListener('dragover', onTrigger, { passive: true });
  canvas.addEventListener('drop', onTrigger, { passive: true });

    // Handle resize
    const handleResize = () => {
      // Safe mode 픽셀 비율 적용
      try {
        const st = useEditorStore.getState();
        const pr = st.safeMode?.enabled ? (st.safeMode.pixelRatio || 1.0) : Math.min(2, window.devicePixelRatio || 1);
        renderer.setPixelRatio(pr);
      } catch {}
      // EditorControls의 리사이즈 함수 사용 (카메라 타입에 따른 적절한 처리)
      if (editorControlsRef.current) {
        editorControlsRef.current.onWindowResize();
      } else {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
      
  // 포스트프로세싱 리사이즈
      if (postProcessingRef.current) {
        postProcessingRef.current.handleResize(window.innerWidth, window.innerHeight);
      }
      try { useEditorStore.getState().estimateVRAMUsage(); } catch {}
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
  try { triggerEvents.forEach(ev => window.removeEventListener(ev, onTrigger)); } catch {}
  try { canvas.removeEventListener('dragover', onTrigger); canvas.removeEventListener('drop', onTrigger); } catch {}
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement) {
        renderer.domElement.removeEventListener('contextmenu', handleCanvasContextMenu);
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
        renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      }
  if (editorControlsRef.current) { editorControlsRef.current.dispose(); }
  if (blenderControlsRef.current) { try { blenderControlsRef.current.dispose(); } catch {} }
      if (postProcessingRef.current) {
        postProcessingRef.current.dispose();
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [setScene]); // floorWidth, floorDepth 제거하여 씬 재초기화 방지

  // GLB/에셋 파일 로드를 위한 별도 useEffect (sceneReady 이후에도 실행)
  useEffect(() => {
    // 씬 및 컨트롤이 완전히 준비된 이후에만 오브젝트 동기화 진행
    if (!sceneReady) return;
    if (!sceneRef.current || !editorControlsRef.current) return;
    
    const scene = sceneRef.current;
  const loader = getGLTFLoader();
    
    // 새로 추가된 오브젝트들을 확인하고 GLB 파일 로드
    objects.forEach(obj => {
      // 이미 로드된 오브젝트는 건너뛰기
      if (loadedObjectsRef.current.has(obj.id)) return;
      
  if (obj.type === 'glb' && (obj.file || obj.url)) {
        // 중복 로드 방지
        if (loadingIdsRef.current.has(obj.id) || loadedObjectsRef.current.has(obj.id)) return;
        loadingIdsRef.current.add(obj.id);
        // GLB file loading started
        
        // GLB 파일 로드 (file 또는 url 사용)
        const glbSource = obj.file || obj.url;
        loader.load(
          glbSource,
          (gltf) => {
            // 이중 콜백/중복 추가 가드
            if (loadedObjectsRef.current.has(obj.id)) { try { loadingIdsRef.current.delete(obj.id); } catch {} return; }
            const model = gltf.scene;
            
            // 바운딩 박스 계산하여 모델 크기 확인 (피벗/원점 보정은 하지 않음)
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            // Model size and center calculated
            
            // 모델 위치 설정 (에디터에서 설정된 위치)
            model.position.set(obj.position.x, obj.position.y, obj.position.z);
            model.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
            model.scale.set(obj.scale.x, obj.scale.y, obj.scale.z); // 자동 스케일 조정 제거
            
            // 메타데이터 설정
            model.name = obj.name;
            model.userData = {
              ...(model.userData || {}),
              id: obj.id,
              type: obj.type,
              // 커스텀 메쉬 식별 보강
              customMeshId: obj.customMeshId || obj.userData?.customMeshId || obj.userData?.originalData?.id,
              originalData: obj.userData?.originalData || (obj.customMeshId ? { id: obj.customMeshId } : undefined)
            };
            // 서브메시에 소유자 id 표시(선택/계층 매핑 보강)
            try {
              model.traverse((n) => { if (!n.userData) n.userData = {}; if (!n.userData.ownerId) n.userData.ownerId = obj.id; });
            } catch {}
            
            // 가시성 설정
            model.visible = obj.visible !== false; // 기본값은 true, false면 숨김
            
            // 그림자 설정
            model.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                // Mesh found and configured for shadows
              }
            });
            
            // 현재 와이어프레임 상태 반영
            try {
              const s = useEditorStore.getState();
              const wf = !!s.isWireframe;
              model.traverse((child) => {
                if (child.isMesh && child.material) {
                  if (Array.isArray(child.material)) child.material.forEach((m)=> m.wireframe = wf)
                  else child.material.wireframe = wf
                }
              })
            } catch {}

            // 씬에 추가
            scene.add(model);
            // Model added to scene
            
            // 선택 가능한 오브젝트로 등록
            editorControlsRef.current.addSelectableObject(model);
            
            // 로드된 오브젝트로 기록
            loadedObjectsRef.current.set(obj.id, model);
            try { loadingIdsRef.current.delete(obj.id); } catch {}
            
            // 자동으로 선택 (스토어와 3D 뷰 모두)
            setSelectedObject(obj.id);

            // 로드 직후 스냅/기즈모 상태 재적용 (안전망)
            try { editorControlsRef.current.updateWireframe?.() } catch {}
            try { editorControlsRef.current.updateGridSnap?.() } catch {}
            try { editorControlsRef.current.updateGizmoSpace?.() } catch {}
            try { editorControlsRef.current.objectSelector?.updateGizmoSize?.() } catch {}
            editorControlsRef.current.selectObject(model);
            
            // GLB file loading completed
          },
          undefined,
          (error) => {
            // GLB file loading error
            console.error(`GLB 파일 로딩 실패: ${obj.name}`, error);
            console.error(`GLB 파일 경로: ${glbSource}`);
            console.error('객체 정보:', obj);
            
            // GLB 로딩 실패 시 기본 도형으로 대체
            
            // 기본 박스 생성
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshLambertMaterial({ 
              color: 0xff6b6b,  // 빨간색으로 에러 표시
              transparent: true,
              opacity: 0.7
            });
            const mesh = new THREE.Mesh(geometry, material);
            
            // 위치 및 기본 속성 설정
            mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
            mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
            mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
            mesh.name = `${obj.name} (로딩실패)`;
            mesh.userData = { id: obj.id, type: obj.type, loadError: true };
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.visible = obj.visible !== false;
            
            // 씬에 추가
            scene.add(mesh);
            editorControlsRef.current.addSelectableObject(mesh);
            loadedObjectsRef.current.set(obj.id, mesh);
            try { loadingIdsRef.current.delete(obj.id); } catch {}
            
            // 자동으로 선택 (스토어와 3D 뷰 모두)
            setSelectedObject(obj.id);
            editorControlsRef.current.selectObject(mesh);
          }
        );
      } else if (obj.type === 'glb' && (obj.customMeshId || obj.userData?.customMeshId || obj.userData?.originalData?.id || obj.glbData)) {
        // 커스텀 메쉬: id 참조 또는 임시 glbData
  const mgr = getGLBMeshManager();
  // 중복 로드 방지
  if (loadingIdsRef.current.has(obj.id) || loadedObjectsRef.current.has(obj.id)) return;
  loadingIdsRef.current.add(obj.id);
        const derivedId = obj.customMeshId || obj.userData?.customMeshId || obj.userData?.originalData?.id;
        const isValidGLBData = (d) => {
          if (!d) return false;
          if (d instanceof ArrayBuffer) return true;
          if (d instanceof Uint8Array) return true;
          if (Array.isArray(d)) return true;
          if (typeof d === 'object' && d.type === 'Buffer' && Array.isArray(d.data)) return true;
          return false;
        };

    const loadFromUrl = (u) => {
          loader.load(
            u,
            (gltf) => {
      // 중복 가드
      if (loadedObjectsRef.current.has(obj.id)) { try { URL.revokeObjectURL(u) } catch {}; try { loadingIdsRef.current.delete(obj.id) } catch {}; return; }
              const model = gltf.scene;
              // 바운딩 박스 계산(피벗/원점 보정은 하지 않음)
              const box = new THREE.Box3().setFromObject(model);
              const size = box.getSize(new THREE.Vector3());
              const center = box.getCenter(new THREE.Vector3());
              // 모델 위치 설정
              model.position.set(obj.position.x, obj.position.y, obj.position.z);
              model.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
              model.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
              // 메타데이터 설정
              model.name = obj.name;
              model.userData = {
                ...(model.userData || {}),
                id: obj.id,
                type: obj.type,
                customMeshId: obj.customMeshId || obj.userData?.customMeshId || obj.userData?.originalData?.id,
                originalData: obj.userData?.originalData || (obj.customMeshId ? { id: obj.customMeshId } : undefined)
              };
              try { model.traverse((n) => { if (!n.userData) n.userData = {}; if (!n.userData.ownerId) n.userData.ownerId = obj.id; }); } catch {}
              // 가시성/그림자
              model.visible = obj.visible !== false;
              model.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
              // 씬에 추가 및 선택 시스템 반영
              scene.add(model);
              editorControlsRef.current.addSelectableObject(model);
              loadedObjectsRef.current.set(obj.id, model);
              setSelectedObject(obj.id);
              editorControlsRef.current.selectObject(model);
              // URL 해제
              try { URL.revokeObjectURL(u); } catch {}
              try { loadingIdsRef.current.delete(obj.id); } catch {}
            },
            undefined,
            () => { try { URL.revokeObjectURL(u); } catch {} try { loadingIdsRef.current.delete(obj.id); } catch {} }
          );
        };

    if (derivedId) {
          mgr.getCustomMeshes().then((list) => {
      const found = (list || []).find(m => m.id === derivedId);
            if (!found || !found.glbData) throw new Error('CUSTOM_MESH_NOT_FOUND');
            const u = mgr.createBlobURL(found.glbData);
            loadFromUrl(u);
          }).catch((e) => {
            console.error('커스텀 메쉬 로드 실패:', e);
            try { loadingIdsRef.current.delete(obj.id); } catch {}
          });
    } else if (obj.glbData && isValidGLBData(obj.glbData)) {
          try {
            const u = mgr.createBlobURL(obj.glbData);
            loadFromUrl(u);
          } catch (e) {
            console.error('커스텀 GLB URL 생성 실패:', e);
            try { loadingIdsRef.current.delete(obj.id); } catch {}
          }
        } else {
          console.warn('유효하지 않은 glbData입니다. customMeshId 참조가 필요합니다:', obj);
          try { loadingIdsRef.current.delete(obj.id); } catch {}
        }
      } else if (
        obj.type === 'light' ||
        ['directional_light','point_light','spot_light','ambient_light','grid_helper','axes_helper','audio_source'].includes(obj.type)
      ) {
        // 에셋(라이트/헬퍼/오디오) 복원
        let assetObject = null;
        const kind = obj.type === 'light'
          ? obj.lightType
          : (obj.type === 'directional_light' ? 'directional'
            : obj.type === 'point_light' ? 'point'
            : obj.type === 'spot_light' ? 'spot'
            : obj.type);
        switch (kind) {
          case 'directional': {
            const light = new THREE.DirectionalLight(0xffffff, obj.intensity ?? 1);
            light.position.set(obj.position.x, obj.position.y, obj.position.z);
            const ty = (obj.position?.y ?? 0) - 1;
            light.target.position.set(obj.position.x, ty, obj.position.z);
            light.castShadow = !!obj.castShadow;
            scene.add(light.target);
            assetObject = light;
            try { editorControlsRef.current.addSelectableObject(light.target); } catch {}
            // 헬퍼 부착(선택): 시각적 확인용
            try { const helper = new THREE.DirectionalLightHelper(light, 1); light.userData = light.userData || {}; light.userData.lightHelper = helper; scene.add(helper); helper.update?.(); } catch {}
            break;
          }
          case 'point': {
            const light = new THREE.PointLight(0xffffff, obj.intensity ?? 1, obj.distance ?? 10, obj.decay ?? 2);
            light.position.set(obj.position.x, obj.position.y, obj.position.z);
            light.castShadow = !!obj.castShadow;
            assetObject = light;
            try { const helper = new THREE.PointLightHelper(light, 0.5); light.userData = light.userData || {}; light.userData.lightHelper = helper; scene.add(helper); helper.update?.(); } catch {}
            break;
          }
          case 'spot': {
            const light = new THREE.SpotLight(0xffffff, obj.intensity ?? 1, obj.distance ?? 10, obj.angle ?? Math.PI/6, obj.penumbra ?? 0.1, obj.decay ?? 2);
            light.position.set(obj.position.x, obj.position.y, obj.position.z);
            const ty = (obj.position?.y ?? 0) - 1;
            light.target.position.set(obj.position.x, ty, obj.position.z);
            light.castShadow = !!obj.castShadow;
            scene.add(light.target);
            assetObject = light;
            try { editorControlsRef.current.addSelectableObject(light.target); } catch {}
            try { const helper = new THREE.SpotLightHelper(light); light.userData = light.userData || {}; light.userData.lightHelper = helper; scene.add(helper); helper.update?.(); } catch {}
            break;
          }
          case 'ambient_light': {
            // 표시용 마커 + 실제 앰비언트 라이트
            const amb = new THREE.AmbientLight(obj.color ?? 0x404040, obj.intensity ?? 0.3);
            scene.add(amb);
            const marker = new THREE.Mesh(
              new THREE.SphereGeometry(0.5, 16, 16),
              new THREE.MeshBasicMaterial({ color: 0x404040, wireframe: true, transparent: true, opacity: 0.5 })
            );
            marker.position.set(obj.position.x, obj.position.y, obj.position.z);
            assetObject = marker;
            break;
          }
          case 'grid_helper': {
            const gh = new THREE.GridHelper(10, 10);
            gh.position.set(obj.position.x, obj.position.y, obj.position.z);
            assetObject = gh;
            break;
          }
          case 'axes_helper': {
            const ah = new THREE.AxesHelper(2);
            ah.position.set(obj.position.x, obj.position.y, obj.position.z);
            assetObject = ah;
            break;
          }
          case 'audio_source': {
            const marker = new THREE.Mesh(
              new THREE.SphereGeometry(0.3, 16, 16),
              new THREE.MeshStandardMaterial({ color: 0xff9900 })
            );
            marker.position.set(obj.position.x, obj.position.y, obj.position.z);
            assetObject = marker;
            break;
          }
          default:
            break;
        }

        if (assetObject) {
          assetObject.name = obj.name;
          assetObject.userData = { ...(assetObject.userData || {}), id: obj.id, type: obj.type };
          try { assetObject.traverse?.((n)=>{ n.userData = n.userData || {}; if (!n.userData.ownerId) n.userData.ownerId = obj.id; }); } catch {}
          assetObject.visible = obj.visible !== false;
          scene.add(assetObject);
          try { editorControlsRef.current.addSelectableObject(assetObject); } catch {}
          loadedObjectsRef.current.set(obj.id, assetObject);
          setSelectedObject(obj.id);
          try { editorControlsRef.current.selectObject(assetObject); } catch {}
        }
      } else if (obj.type === 'cube') {
        // 기존 큐브 오브젝트 처리
        const geometry = new THREE.BoxGeometry(obj.size.x, obj.size.y, obj.size.z);
        const material = new THREE.MeshLambertMaterial({ color: obj.material.color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
        mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
        mesh.name = obj.name;
  mesh.userData = { id: obj.id, type: obj.type };
  try { mesh.traverse?.((n)=>{ n.userData = n.userData || {}; if (!n.userData.ownerId) n.userData.ownerId = obj.id; }); } catch {}
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        scene.add(mesh);
        editorControlsRef.current.addSelectableObject(mesh);
        loadedObjectsRef.current.set(obj.id, mesh);
        
        // 자동으로 선택 (스토어와 3D 뷰 모두)
        setSelectedObject(obj.id);
        editorControlsRef.current.selectObject(mesh);
      } else if (obj.type === 'basic' || (obj.geometry && obj.params)) {
        // 기본 도형 처리 (라이브러리 패널에서 추가된 기본 도형들)
        
        
        const material = new THREE.MeshStandardMaterial({
          color: 0x4CAF50,
          roughness: 0.3,
          metalness: 0.1
        });
        
        let geometry;
        
        // 기하학적 도형 생성
        switch (obj.geometry) {
          case 'BoxGeometry':
            geometry = new THREE.BoxGeometry(...obj.params);
            break;
          case 'SphereGeometry':
            geometry = new THREE.SphereGeometry(...obj.params);
            break;
          case 'CylinderGeometry':
            geometry = new THREE.CylinderGeometry(...obj.params);
            break;
          case 'ConeGeometry':
            geometry = new THREE.ConeGeometry(...obj.params);
            break;
          case 'PlaneGeometry':
            geometry = new THREE.PlaneGeometry(...obj.params);
            break;
          case 'TorusGeometry':
            geometry = new THREE.TorusGeometry(...obj.params);
            break;
          default:
            geometry = new THREE.BoxGeometry(1, 1, 1);
        }
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
        mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
        mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
        mesh.name = obj.name;
  mesh.userData = { id: obj.id, type: obj.type };
  // 후속 정리 루틴 보존을 위해 소유자 id 주입
  try { mesh.traverse((n)=>{ n.userData = n.userData || {}; if (!n.userData.ownerId) n.userData.ownerId = obj.id; }); } catch {}
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.visible = obj.visible !== false;
        
        // 평면의 경우 회전 조정
        if (obj.geometry === 'PlaneGeometry') {
          mesh.rotation.x = -Math.PI / 2;
        }
        
        scene.add(mesh);
        editorControlsRef.current.addSelectableObject(mesh);
        loadedObjectsRef.current.set(obj.id, mesh);
        
        // 자동으로 선택 (스토어와 3D 뷰 모두)
        setSelectedObject(obj.id);
        editorControlsRef.current.selectObject(mesh);
        
        
      }
    });
    
    // 삭제된 오브젝트들 정리
    const currentObjectIds = new Set(objects.map(obj => obj.id));
    for (const [objectId, mesh] of loadedObjectsRef.current) {
      if (!currentObjectIds.has(objectId)) {
        // 시스템 객체는 삭제하지 않음
        if (mesh.userData?.isSystemObject) {
          continue;
        }
        
        scene.remove(mesh);
        editorControlsRef.current.removeSelectableObject(mesh);
        loadedObjectsRef.current.delete(objectId);
      }
    }

    // 추가 안전 정리: loadedObjectsRef에 기록되지 않은 유령 오브젝트(스토어에 없는 id)를 씬에서 제거
    try {
      const toRemove = [];
      const isLinkedOrAncestorLinked = (node) => {
        let cur = node;
        while (cur && cur !== scene) {
          const cid = cur.userData?.id;
          const oid = cur.userData?.ownerId;
          if ((cid && currentObjectIds.has(cid)) || (oid && currentObjectIds.has(oid))) return true;
          cur = cur.parent;
        }
        return false;
      };
      scene.traverse((child) => {
        if (!child || child === scene) return;
        // 시스템/아웃라인/헬퍼 등은 유지
        if (child.userData?.isSystemObject) return;
        if (child.userData?.isSelectionOutline) return;
        // TransformControls/기즈모/헬퍼 이름 기반 제외
        const lname = (child.name || '').toLowerCase();
        if (lname.includes('transformcontrols') || lname.includes('gizmo') || lname.includes('helper')) return;
        // 스토어에 연결된 객체(또는 그 조상에 연결된 루트)가 있으면 보존
        if (isLinkedOrAncestorLinked(child)) return;
        // 연결 정보가 없으면 제거 후보
        toRemove.push(child);
      });
      toRemove.forEach((obj) => {
        try { editorControlsRef.current?.removeSelectableObject?.(obj); } catch {}
        try { if (obj.parent) obj.parent.remove(obj); else scene.remove(obj); } catch {}
      });
    } catch {}
  }, [objects, setSelectedObject, sceneReady]);

  // 오브젝트 가시성 동기화
  useEffect(() => {
    if (!sceneRef.current) return;
    
    // 모든 로드된 오브젝트들의 가시성을 스토어 상태와 동기화
    objects.forEach(obj => {
      const threeObject = loadedObjectsRef.current.get(obj.id);
      if (threeObject) {
        threeObject.visible = obj.visible !== false; // undefined나 true면 보이게, false면 숨기게
      }
    });

    // 벽들의 가시성도 동기화 (벽이 Three.js 오브젝트로 구현되어 있다면)
    walls.forEach(wall => {
      const threeWall = loadedObjectsRef.current.get(wall.id);
      if (threeWall) {
        threeWall.visible = wall.visible !== false;
      }
    });
  }, [objects, walls]); // objects와 walls 배열이 변경될 때마다 실행

  return (
    <div 
      ref={mountRef} 
      style={{ 
        width: '100%', 
        height: '100vh',
        position: 'relative'
      }} 
    />
  );
}

export default PlainEditorCanvas;
