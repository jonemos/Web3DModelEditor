import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { useEditorStore } from '../../store/editorStore';
import { EditorControls } from './EditorControls.js';
import { PostProcessingManager } from './PostProcessingManager.js';
import TransformManagerModern from './TransformManager.Modern.js';
import GridManagerModern from './GridManager.Modern.js';
import { getGLBMeshManager } from '../../utils/GLBMeshManager';

// 새 아키텍처 통합
import { app } from '../../core/ApplicationBootstrap.js';
import { eventBus, EventTypes } from '../../core/EventBus.js';

function PlainEditorCanvasModern({ onEditorControlsReady, onPostProcessingReady, onContextMenu }) {
  const mountRef = useRef(null);
  const editorControlsRef = useRef(null);
  const postProcessingRef = useRef(null);
  const transformManagerRef = useRef(null);
  const gridManagerRef = useRef(null);
  const sceneRef = useRef(null);
  const loadedObjectsRef = useRef(new Map());
  
  // 새 아키텍처 서비스들
  const [services, setServices] = useState({});
  const [isNewArchitectureReady, setIsNewArchitectureReady] = useState(false);
  
  // 기존 Zustand 스토어 (호환성 유지)
  const { 
    objects,
    walls,
    setScene,
    setSelectedObject
  } = useEditorStore();

  // 새 아키텍처 초기화 체크
  useEffect(() => {
    const checkNewArchitecture = () => {
      if (app.isInitialized) {
        const sceneService = app.services.get('scene');
        const selectionService = app.services.get('selection');
        const objectManagementService = app.services.get('objectManagement');
        
        if (sceneService && selectionService && objectManagementService) {
          setServices({
            scene: sceneService,
            selection: selectionService,
            objectManagement: objectManagementService
          });
          setIsNewArchitectureReady(true);
          console.log('✅ Modern Canvas: New architecture services ready');
        }
      }
    };

    checkNewArchitecture();
    
    // 아키텍처 초기화 이벤트 리스너
    const handleArchitectureReady = () => {
      checkNewArchitecture();
    };
    
    eventBus.on(EventTypes.APP_INITIALIZED, handleArchitectureReady);
    
    return () => {
      eventBus.off(EventTypes.APP_INITIALIZED, handleArchitectureReady);
    };
  }, []);

  // 새 아키텍처와 기존 시스템 하이브리드 씬 초기화
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a2a);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(15, 20, 15);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.sortObjects = false;
    renderer.autoClear = false;
    
    mountRef.current.appendChild(renderer.domElement);
    sceneRef.current = scene;

    // 새 아키텍처가 준비되었다면 서비스에 씬 등록
    if (isNewArchitectureReady && services.scene) {
      services.scene.setScene(scene);
      services.scene.setCamera(camera);
      services.scene.setRenderer(renderer);
      console.log('✅ Modern Canvas: Scene registered with new architecture');
    }

    // 기존 시스템에도 씬 등록 (호환성)
    setScene(scene, camera, renderer);

    // 기본 조명 설정
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // EditorControls 초기화 (하이브리드 모드)
    const editorControls = new EditorControls(
      scene, 
      camera, 
      renderer, 
      isNewArchitectureReady ? services : null // 새 아키텍처 서비스 전달
    );
    editorControlsRef.current = editorControls;

    if (onEditorControlsReady) {
      onEditorControlsReady(editorControls);
    }

    // TransformManager.Modern 초기화 (새 아키텍처 활성화시)
    let transformManager = null;
    if (isNewArchitectureReady && services.serviceRegistry) {
      transformManager = new TransformManagerModern({
        mode: 'translate',
        space: 'world',
        snapEnabled: false,
        gridSize: 1.0
      });
      
      // 새 아키텍처에 연결
      transformManager.connectToNewArchitecture(services.serviceRegistry)
        .then((connected) => {
          if (connected) {
            transformManager.initialize();
            
            // 서비스 레지스트리에 등록
            services.serviceRegistry.registerSingleton('transformManager', transformManager);
            console.log('✅ TransformManager.Modern registered with new architecture');
          }
        })
        .catch(error => {
          console.error('❌ Failed to initialize TransformManager.Modern:', error);
        });
        
      transformManagerRef.current = transformManager;
    }

    // GridManager.Modern 초기화 (새 아키텍처 활성화시)
    let gridManager = null;
    if (isNewArchitectureReady && services.serviceRegistry) {
      gridManager = new GridManagerModern({
        size: 10,
        divisions: 10,
        visible: true,
        colorCenter: 0x888888,
        colorGrid: 0x444444
      });
      
      // 새 아키텍처에 연결
      gridManager.connectToNewArchitecture(services.serviceRegistry)
        .then((connected) => {
          if (connected) {
            gridManager.initialize();
            
            // 서비스 레지스트리에 등록
            services.serviceRegistry.registerSingleton('gridManager', gridManager);
            console.log('✅ GridManager.Modern registered with new architecture');
          }
        })
        .catch(error => {
          console.error('❌ Failed to initialize GridManager.Modern:', error);
        });
        
      gridManagerRef.current = gridManager;
        
      gridManagerRef.current = gridManager;
    }

    // PostProcessing 초기화
    const postProcessing = new PostProcessingManager(scene, camera, renderer);
    postProcessingRef.current = postProcessing;

    if (onPostProcessingReady) {
      onPostProcessingReady(postProcessing);
    }

    // 렌더 루프
    function animate() {
      requestAnimationFrame(animate);
      
      if (editorControls) {
        editorControls.update();
      }
      
      if (postProcessing) {
        postProcessing.render();
      } else {
        renderer.render(scene, camera);
      }
    }
    animate();

    // 윈도우 리사이즈 핸들러
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      
      if (postProcessing) {
        postProcessing.handleResize();
      }
    };
    window.addEventListener('resize', handleResize);

    // 정리
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      
      if (editorControls) {
        editorControls.dispose();
      }
      
      if (postProcessing) {
        postProcessing.dispose();
      }
      
      // TransformManager 정리
      if (transformManager) {
        transformManager.destroy();
      }
      
      // GridManager 정리
      if (gridManager) {
        gridManager.destroy();
      }
      
      renderer.dispose();
    };
  }, [isNewArchitectureReady, services]);

  // 새 아키텍처 이벤트 리스너 설정
  useEffect(() => {
    if (!isNewArchitectureReady) return;

    const handleObjectSelected = (event) => {
      const { object } = event.detail;
      setSelectedObject(object); // 기존 스토어와 동기화
      console.log('🎯 Modern Canvas: Object selected via new architecture:', object);
    };

    const handleObjectAdded = (event) => {
      const { object } = event.detail;
      console.log('➕ Modern Canvas: Object added via new architecture:', object);
      // 필요하다면 추가 처리
    };

    eventBus.on(EventTypes.OBJECT_SELECTED, handleObjectSelected);
    eventBus.on(EventTypes.OBJECT_ADDED, handleObjectAdded);

    return () => {
      eventBus.off(EventTypes.OBJECT_SELECTED, handleObjectSelected);
      eventBus.off(EventTypes.OBJECT_ADDED, handleObjectAdded);
    };
  }, [isNewArchitectureReady, setSelectedObject]);

  // 기존 객체들을 새 아키텍처로 마이그레이션 (선택적)
  useEffect(() => {
    if (!isNewArchitectureReady || !services.objectManagement) return;

    // objects 배열의 변화를 새 아키텍처에 반영
    objects.forEach(obj => {
      if (obj.mesh && !obj.isMigrated) {
        // 새 아키텍처 시스템에 객체 등록
        services.objectManagement.addObject(obj.mesh, {
          id: obj.id,
          name: obj.name || 'Object',
          type: obj.type || 'mesh'
        });
        obj.isMigrated = true; // 중복 마이그레이션 방지
      }
    });
  }, [objects, isNewArchitectureReady, services]);

  return (
    <div 
      ref={mountRef} 
      style={{ width: '100%', height: '100vh', position: 'relative' }}
      onContextMenu={onContextMenu}
    >
      {/* 새 아키텍처 상태 표시 (개발용) */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: isNewArchitectureReady ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.2)',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          {isNewArchitectureReady ? '🟢 New Arch Ready' : '🔴 Legacy Mode'}
        </div>
      )}
    </div>
  );
}

export default PlainEditorCanvasModern;
