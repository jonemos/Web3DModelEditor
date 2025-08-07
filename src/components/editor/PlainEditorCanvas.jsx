import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { useEditorStore } from '../../store/editorStore';
import { EditorControls } from './EditorControls.js';

function PlainEditorCanvas({ onEditorControlsReady, onContextMenu }) {
  const mountRef = useRef(null);
  const editorControlsRef = useRef(null);
  const sceneRef = useRef(null);
  const loadedObjectsRef = useRef(new Map()); // 로드된 오브젝트들을 추적
  
  const { 
    floorWidth, 
    floorDepth,
    objects,
    walls,
    setScene,
    setSelectedObject
  } = useEditorStore();

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333); // Dark gray background

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(20, 30, 20);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // 깊이 테스트 설정 (기즈모가 제대로 렌더링되도록)
    renderer.sortObjects = false;
    renderer.autoClear = false;
    
    // Mount the renderer
    mountRef.current.appendChild(renderer.domElement);

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
    };

    // 에디터 컨트롤 초기화
    const editorControls = new EditorControls(scene, camera, renderer, useEditorStore, handleCameraChange);
    editorControlsRef.current = editorControls;
    
    // EditorControls가 준비되었음을 부모 컴포넌트에 알림
    if (onEditorControlsReady) {
      onEditorControlsReady(editorControls);
    }

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    // Add floor
    const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorDepth);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Add grid helper
    const gridHelper = new THREE.GridHelper(floorWidth, floorWidth);
    gridHelper.position.y = 0.01;
    gridHelper.material.color.setHex(0x666666);
    scene.add(gridHelper);

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

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Rotate cube slowly for visual feedback
      cube.rotation.y += 0.005;
      
      // 선택된 오브젝트들의 아웃라인 업데이트 (애니메이션 중인 오브젝트용)
      if (editorControlsRef.current) {
        editorControlsRef.current.updateSelectedOutlines();
      }
      
      // 렌더링 (기즈모를 위한 특별한 렌더링)
      renderer.clear();
      // EditorControls의 현재 카메라 사용 (Perspective/Orthographic 토글 대응)
      const currentCamera = editorControlsRef.current ? editorControlsRef.current.camera : camera;
      renderer.render(scene, currentCamera);
    };
    animate();

    // 드래그 앤 드롭 이벤트 핸들러 추가
    const canvas = renderer.domElement;
    
    canvas.addEventListener('dragover', (event) => {
      event.preventDefault();
    });

    canvas.addEventListener('drop', (event) => {
      event.preventDefault();
      
      try {
        const data = event.dataTransfer.getData('text/plain');
        if (data) {
          const objectData = JSON.parse(data);
          console.log('드롭된 객체 데이터:', objectData);
          
          // 커스텀 메쉬나 라이브러리 메쉬인 경우 별도 처리
          if (objectData.type === 'custom' || objectData.type === 'library') {
            console.log('커스텀/라이브러리 메쉬 드롭 처리:', objectData.type, objectData.name);
            
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
            const loader = new GLTFLoader();
            let modelUrl;
            
            if (objectData.type === 'custom') {
              // 커스텀 메쉬: GLB 데이터를 Blob URL로 변환
              console.log('커스텀 메쉬 GLB 데이터:', typeof objectData.glbData, objectData.glbData);
              
              let binaryData;
              if (objectData.glbData instanceof ArrayBuffer) {
                binaryData = objectData.glbData;
              } else if (objectData.glbData instanceof Uint8Array) {
                binaryData = objectData.glbData.buffer;
              } else if (Array.isArray(objectData.glbData)) {
                binaryData = new Uint8Array(objectData.glbData).buffer;
              } else if (typeof objectData.glbData === 'object' && objectData.glbData.type === 'Buffer') {
                binaryData = new Uint8Array(objectData.glbData.data || objectData.glbData).buffer;
              } else {
                console.error('지원되지 않는 GLB 데이터 형식:', typeof objectData.glbData, objectData.glbData);
                return;
              }
              
              const blob = new Blob([binaryData], { type: 'model/gltf-binary' });
              modelUrl = URL.createObjectURL(blob);
            } else if (objectData.type === 'library') {
              // 라이브러리 메쉬: glbUrl 사용
              modelUrl = objectData.glbUrl;
            }
            
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
                
                scene.add(model);
                
                // 선택 가능한 오브젝트로 등록
                editorControls.addSelectableObject(model);
                
                // 고유 ID 생성
                const uniqueId = `${objectData.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                model.name = uniqueId;
                model.userData = {
                  id: uniqueId,
                  name: objectData.name,
                  type: objectData.type,
                  originalData: objectData
                };
                
                // 로드된 오브젝트로 기록
                loadedObjectsRef.current.set(uniqueId, model);
                
                // 에디터 스토어에 객체 등록
                const addObject = useEditorStore.getState().addObject;
                addObject({
                  id: uniqueId,
                  name: objectData.name,
                  type: 'mesh',
                  position: [intersection.x, intersection.y, intersection.z],
                  rotation: [model.rotation.x, model.rotation.y, model.rotation.z],
                  scale: [1, 1, 1],
                  visible: true,
                  userData: model.userData
                });
                
                // 새로 추가된 객체 선택
                setSelectedObject(uniqueId);
                
                // URL 정리 (커스텀 메쉬의 경우에만)
                if (objectData.type === 'custom') {
                  URL.revokeObjectURL(modelUrl);
                }
                
                console.log('커스텀/라이브러리 메쉬 로드 완료:', uniqueId);
              },
              undefined,
              (error) => {
                console.error('커스텀/라이브러리 메쉬 로드 실패:', error);
                if (objectData.type === 'custom') {
                  URL.revokeObjectURL(modelUrl);
                }
              }
            );
            
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
                console.log('커스텀 지오메트리 GLB 데이터 처리:', typeof objectData.glbData, objectData.glbData);
                
                // GLB 데이터를 올바른 형태로 변환
                let binaryData;
                if (objectData.glbData instanceof ArrayBuffer) {
                  binaryData = objectData.glbData;
                } else if (objectData.glbData instanceof Uint8Array) {
                  binaryData = objectData.glbData.buffer;
                } else if (Array.isArray(objectData.glbData)) {
                  // 배열 형태로 저장된 경우
                  binaryData = new Uint8Array(objectData.glbData).buffer;
                } else if (typeof objectData.glbData === 'object' && objectData.glbData.type === 'Buffer') {
                  // Node.js Buffer 객체
                  binaryData = new Uint8Array(objectData.glbData.data || objectData.glbData).buffer;
                } else {
                  console.error('지원되지 않는 GLB 데이터 형식:', typeof objectData.glbData, objectData.glbData);
                  return;
                }
                
                // GLB 데이터에서 Blob 생성
                const blob = new Blob([binaryData], { type: 'model/gltf-binary' });
                const url = URL.createObjectURL(blob);
                
                // GLB 파일 로드
                const loader = new GLTFLoader();
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
                    position: [intersection.x, intersection.y, intersection.z],
                    rotation: [model.rotation.x, model.rotation.y, model.rotation.z],
                    scale: [1, 1, 1],
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
              } else if (objectData.originalObject && objectData.originalObject.geometry) {
                geometry = objectData.originalObject.geometry.clone();
              } else {
                geometry = new THREE.BoxGeometry(1, 1, 1); // 기본값
              }
              break;
            case 'LibraryMesh':
              // 라이브러리 메쉬 로드
              if (objectData.glbUrl) {
                const loader = new GLTFLoader();
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
                    position: [intersection.x, intersection.y, intersection.z],
                    rotation: [model.rotation.x, model.rotation.y, model.rotation.z],
                    scale: [1, 1, 1],
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
            originalName: objectData.name
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
            type: 'mesh',
            position: [intersection.x, intersection.y, intersection.z],
            rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
            scale: [1, 1, 1],
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

    // Handle resize
    const handleResize = () => {
      // EditorControls의 리사이즈 함수 사용 (카메라 타입에 따른 적절한 처리)
      if (editorControlsRef.current) {
        editorControlsRef.current.onWindowResize();
      } else {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement) {
        renderer.domElement.removeEventListener('contextmenu', handleCanvasContextMenu);
      }
      if (editorControlsRef.current) {
        editorControlsRef.current.dispose();
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [floorWidth, floorDepth, setScene]);

  // GLB 파일 로드를 위한 별도 useEffect
  useEffect(() => {
    if (!sceneRef.current || !editorControlsRef.current) return;
    
    const scene = sceneRef.current;
    const loader = new GLTFLoader();
    
    // 새로 추가된 오브젝트들을 확인하고 GLB 파일 로드
    objects.forEach(obj => {
      // 이미 로드된 오브젝트는 건너뛰기
      if (loadedObjectsRef.current.has(obj.id)) return;
      
      if (obj.type === 'glb' && (obj.file || obj.url)) {
        // GLB file loading started
        
        // GLB 파일 로드 (file 또는 url 사용)
        const glbSource = obj.file || obj.url;
        loader.load(
          glbSource,
          (gltf) => {
            const model = gltf.scene;
            
            // GLB loaded successfully
            console.log(`GLB 파일 로딩 성공: ${obj.name}`, model);
            console.log(`GLB 파일 경로: ${glbSource}`);
            
            // 바운딩 박스 계산하여 모델 크기 확인
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            // Model size and center calculated
            
            // 모델이 너무 크거나 작으면 스케일 조정
            const maxSize = Math.max(size.x, size.y, size.z);
            let targetScale = 1;
            
            if (maxSize > 10) {
              // 너무 크면 스케일 다운
              targetScale = 5 / maxSize;
              // Model is too large, scaling down
            } else if (maxSize < 0.1) {
              // 너무 작으면 스케일 업
              targetScale = 1 / maxSize;
              // Model is too small, scaling up
            }
            
            // 모델을 원점 중심으로 이동 (선택사항)
            model.position.sub(center);
            
            // 모델 위치 설정 (에디터에서 설정된 위치)
            model.position.set(obj.position.x, obj.position.y, obj.position.z);
            model.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
            model.scale.set(
              obj.scale.x * targetScale, 
              obj.scale.y * targetScale, 
              obj.scale.z * targetScale
            );
            
            // 메타데이터 설정
            model.name = obj.name;
            model.userData = { id: obj.id, type: obj.type };
            
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
            
            // 씬에 추가
            scene.add(model);
            // Model added to scene
            
            // 선택 가능한 오브젝트로 등록
            editorControlsRef.current.addSelectableObject(model);
            
            // 로드된 오브젝트로 기록
            loadedObjectsRef.current.set(obj.id, model);
            
            // 자동으로 선택
            setSelectedObject(obj.id);
            
            // GLB file loading completed
          },
          (progress) => {
            // GLB loading progress
            console.log(`GLB 로딩 진행 중: ${obj.name}`, progress);
          },
          (error) => {
            // GLB file loading error
            console.error(`GLB 파일 로딩 실패: ${obj.name}`, error);
            console.error(`GLB 파일 경로: ${glbSource}`);
            console.error('객체 정보:', obj);
            
            // GLB 로딩 실패 시 기본 도형으로 대체
            console.warn(`GLB 로딩 실패로 인해 기본 박스로 대체: ${obj.name}`);
            
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
            setSelectedObject(obj.id);
          }
        );
      } else if (obj.type === 'glb' && obj.glbData) {
        // GLB 데이터가 있는 경우 (사용자 정의 객체)
        console.log('GLB 데이터 로딩 시작:', obj.name, typeof obj.glbData, obj.glbData);
        
        // GLB 데이터를 올바른 형태로 변환
        let binaryData;
        if (obj.glbData instanceof ArrayBuffer) {
          binaryData = obj.glbData;
        } else if (obj.glbData instanceof Uint8Array) {
          binaryData = obj.glbData.buffer;
        } else if (Array.isArray(obj.glbData)) {
          // 배열 형태로 저장된 경우
          binaryData = new Uint8Array(obj.glbData).buffer;
        } else if (typeof obj.glbData === 'object' && obj.glbData.type === 'Buffer') {
          // Node.js Buffer 객체
          binaryData = new Uint8Array(obj.glbData.data || obj.glbData).buffer;
        } else {
          console.error('지원되지 않는 GLB 데이터 형식:', typeof obj.glbData, obj.glbData);
          return;
        }
        
        console.log('변환된 GLB 데이터:', binaryData.byteLength, 'bytes');
        
        // Blob에서 URL 생성
        const blob = new Blob([binaryData], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        
        loader.load(
          url,
          (gltf) => {
            const model = gltf.scene;
            
            // GLB data loaded successfully
            
            // 바운딩 박스 계산하여 모델 크기 확인
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            // 모델이 너무 크거나 작으면 스케일 조정
            const maxSize = Math.max(size.x, size.y, size.z);
            let targetScale = 1;
            
            if (maxSize > 10) {
              targetScale = 5 / maxSize;
            } else if (maxSize < 0.1) {
              targetScale = 1 / maxSize;
            }
            
            // 모델을 원점 중심으로 이동
            model.position.sub(center);
            
            // 모델 위치 설정
            model.position.set(obj.position.x, obj.position.y, obj.position.z);
            model.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
            model.scale.set(
              obj.scale.x * targetScale, 
              obj.scale.y * targetScale, 
              obj.scale.z * targetScale
            );
            
            // 메타데이터 설정
            model.name = obj.name;
            model.userData = { id: obj.id, type: obj.type };
            
            // 가시성 설정
            model.visible = obj.visible !== false;
            
            // 그림자 설정
            model.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            
            // 씬에 추가
            scene.add(model);
            
            // 선택 가능한 오브젝트로 등록
            editorControlsRef.current.addSelectableObject(model);
            
            // 로드된 오브젝트로 기록
            loadedObjectsRef.current.set(obj.id, model);
            
            // 자동으로 선택
            setSelectedObject(obj.id);
            
            // URL 해제 (메모리 누수 방지)
            URL.revokeObjectURL(url);
            
            // GLB data loading completed
          },
          (progress) => {
            // GLB data loading progress
          },
          (error) => {
            // GLB data loading error
            URL.revokeObjectURL(url); // 에러 시에도 URL 해제
          }
        );
      } else if (obj.type === 'cube') {
        // 기존 큐브 오브젝트 처리
        const geometry = new THREE.BoxGeometry(obj.size.x, obj.size.y, obj.size.z);
        const material = new THREE.MeshLambertMaterial({ color: obj.material.color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
        mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
        mesh.name = obj.name;
        mesh.userData = { id: obj.id, type: obj.type };
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        scene.add(mesh);
        editorControlsRef.current.addSelectableObject(mesh);
        loadedObjectsRef.current.set(obj.id, mesh);
      }
    });
    
    // 삭제된 오브젝트들 정리
    const currentObjectIds = new Set(objects.map(obj => obj.id));
    for (const [objectId, mesh] of loadedObjectsRef.current) {
      if (!currentObjectIds.has(objectId)) {
        scene.remove(mesh);
        editorControlsRef.current.removeSelectableObject(mesh);
        loadedObjectsRef.current.delete(objectId);
      }
    }
  }, [objects, setSelectedObject]);

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
