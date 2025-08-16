import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFExporter } from 'three-stdlib'
import { useEditorStore } from '../../store/editorStore'
import InspectorPanel from './panels/InspectorPanel'
import LibraryPanel from './panels/LibraryPanel'
import AssetsPanel from './panels/AssetsPanel'
import PostProcessingPanel from './panels/PostProcessingPanel'
import HDRIPanel from './panels/HDRIPanel'
import ContextMenu from './ContextMenu'
import Toast from '../ui/Toast'
import './EditorUI.css'

function EditorUI({ editorControls, postProcessingManager, onAddToLibrary, showInspector, onToggleInspector }) {
  const {
    selectedObject,
    transformMode,
    objects,
    walls,
    savedObjects,
    selectedIds,
    setSelectedIds,
    setParent,
    reorderSiblings,
    setTransformMode,
    addWall,
    addObject,
  removeObject,
  removeObjectById,
    addAsset,
    saveMap,
    loadMap,
    clearMap,
    toggleObjectVisibility,
    toggleObjectFreeze,
    renameObject,
  setSelectedObject,
  // annotations store API
  annotations,
  addAnnotation,
  removeAnnotation
  } = useEditorStore()

  const viewReady = useEditorStore(s => s.viewReady)
  const uiReady = useEditorStore(s => s.uiReady)
  const envReady = useEditorStore(s => s.envReady)
  const [mapName, setMapName] = useState('')
  const [assetName, setAssetName] = useState('')
  const showLibrary = useEditorStore((s) => s.showLibrary)
  const showAssets = useEditorStore((s) => s.showAssets)
  const showHDRI = useEditorStore((s) => s.showHDRI)
  const isPostProcessingPanelOpen = useEditorStore((s) => s.isPostProcessingPanelOpen)
  const setShowLibrary = useEditorStore((s) => s.setShowLibrary)
  const setShowAssets = useEditorStore((s) => s.setShowAssets)
  const setShowHDRI = useEditorStore((s) => s.setShowHDRI)
  const setIsPostProcessingPanelOpen = useEditorStore((s) => s.setIsPostProcessingPanelOpen)
  const allReady = viewReady && uiReady && envReady
  const [contextMenu, setContextMenu] = useState({
    isVisible: false,
    x: 0,
  y: 0,
  hit: null
  })
  const [forceRefresh, setForceRefresh] = useState(0)
  const [toast, setToast] = useState({
    message: '',
    type: 'info',
    isVisible: false
  })

  // Toast 함수들
  const showToast = (message, type = 'info') => {
    setToast({
      message,
      type,
      isVisible: true
    })
    setTimeout(() => {
      setToast(prev => ({ ...prev, isVisible: false }))
    }, 3000)
  }

  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }))
  }

  // 디버깅용 로그
  // Console output removed
  // Console output removed
  // Console output removed

  // 컨텍스트 메뉴 핸들러 함수 추가
  const handleContextMenu = (e) => {
    // 우클릭 위치에서 레이캐스트
    e.preventDefault();
    let hit = null;
    try {
      if (editorControls && editorControls.raycastMeshAtNDC) {
        const rect = editorControls.renderer?.domElement?.getBoundingClientRect?.();
        if (rect) {
          const ndc = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          const inter = editorControls.raycastMeshAtNDC(ndc);
          if (inter && inter.point) hit = { point: inter.point.clone(), object: inter.object };
        }
      }
    } catch {}
    setContextMenu({
      isVisible: true,
      x: e.clientX,
      y: e.clientY,
      hit
    });
  };

  // 전역 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F키 - 포커스
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        if (selectedObject?.id) {
          // 선택된 오브젝트가 있으면 포커스
          handleObjectFocus(selectedObject)
        }
      }
    }

    // 커스텀 컨텍스트 메뉴 이벤트 리스너
    const handleEditorContextMenu = (e) => {
      handleContextMenu(e.detail.originalEvent);
    };

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('editorContextMenu', handleEditorContextMenu)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('editorContextMenu', handleEditorContextMenu)
    }
  }, [selectedObject])

  const handleAddWall = () => {
    const newWall = {
      id: Date.now(),
  position: { x: 0, y: 2.5, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
      name: `wall_${walls.length + 1}`
    }
    addWall(newWall)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    const fileName = file.name.replace(/\.[^/.]+$/, "")
    
    if (assetName) {
      addAsset(assetName, url)
      setAssetName('')
    } else {
      addAsset(fileName, url)
    }
  }

  const handleAddObject = (assetUrl, assetName) => {
    const newObject = {
      id: Date.now(),
      url: assetUrl,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
      name: assetName
    }
    addObject(newObject)
  }

  const handleSaveMap = () => {
    if (!mapName) {
      alert('맵 이름을 입력하세요')
      return
    }
    saveMap(mapName)
    alert(`맵 '${mapName}'이 저장되었습니다.`)
    setMapName('')
  }

  const handleLoadMap = () => {
    if (!mapName) {
      alert('불러올 맵 이름을 입력하세요')
      return
    }
    const success = loadMap(mapName)
    if (success) {
      alert(`맵 '${mapName}'을 불러왔습니다.`)
    } else {
      alert('맵을 찾을 수 없습니다.')
    }
    setMapName('')
  }

  const handleClearMap = () => {
    if (window.confirm('모든 오브젝트를 삭제하시겠습니까?')) {
      clearMap()
    }
  }

  const handleObjectVisibilityToggle = (obj) => {
    toggleObjectVisibility(obj)
  }

  const handleObjectFreezeToggle = (obj) => {
    toggleObjectFreeze(obj)
  }

  const handleObjectSelect = (obj) => {
    // null 체크 추가
    if (!obj) {
      // Console output removed
      // EditorControls를 통해 선택 해제
      if (editorControls) {
        editorControls.deselectAllObjects()
      }
      setSelectedObject(null)
      return
    }
    
    // 오브젝트 선택 로직
    // Console output removed
    
    // EditorControls를 통해 실제 Three.js 오브젝트 선택
    if (editorControls) {
      // loadedObjects에서 실제 Three.js 오브젝트 찾기 (ownerId도 보조)
      const threeObject = editorControls.findObjectById(obj.id)
      if (threeObject) {
        // EditorControls의 선택 기능 사용
        editorControls.selectObject(threeObject)
        // Console output removed
      } else {
        // Console output removed
      }
    } else {
      // Console output removed
    }
    
    // 스토어에서 선택된 오브젝트 설정
  // selectedObject는 id로 저장해 모든 액션에서 일관되게 참조
  setSelectedObject(obj?.id ?? obj)
  }

  const handleObjectFocus = (obj) => {
    // F키와 같은 것처럼 오브젝트에 포커스
    // Console output removed
    
    // 먼저 오브젝트를 선택
    handleObjectSelect(obj)
    
    // EditorControls를 통해 포커스 기능 실행
    if (editorControls) {
      const threeObject = editorControls.findObjectById(obj.id)
      if (threeObject) {
        // 포커스 기능 (F키와 동일)
        editorControls.focusOnObject(threeObject)
        // Console output removed
      }
    }
  }

  const handleObjectRename = (obj, newName) => {
    // 오브젝트 이름 변경
    // Console output removed
    renameObject(obj.id, newName)
    
    // 선택된 오브젝트가 이름이 변경된 오브젝트라면 업데이트
    if (selectedObject?.id === obj.id) {
      const updatedSelectedObject = {
        ...selectedObject,
        name: newName
      }
      setSelectedObject(updatedSelectedObject)
    }
  }

  const handleObjectUpdate = (updatedObject) => {
    // 오브젝트 속성 업데이트
    
    
    // EditorControls를 통해 3D 뷰의 오브젝트도 업데이트
    if (editorControls && updatedObject.id) {
      const threeObject = editorControls.findObjectById(updatedObject.id)
      if (threeObject) {
        // 위치, 회전, 스케일 업데이트
        if (updatedObject.position) {
          threeObject.position.set(
            updatedObject.position.x,
            updatedObject.position.y,
            updatedObject.position.z
          )
        }
        if (updatedObject.rotation) {
          threeObject.rotation.set(
            updatedObject.rotation.x,
            updatedObject.rotation.y,
            updatedObject.rotation.z
          )
        }
        if (updatedObject.scale) {
          threeObject.scale.set(
            updatedObject.scale.x,
            updatedObject.scale.y,
            updatedObject.scale.z
          )
        }
        if (updatedObject.name) {
          threeObject.name = updatedObject.name
        }
      }
    }
    
    // 스토어의 selectedObject 업데이트
    if (selectedObject?.id === updatedObject.id) {
      setSelectedObject(updatedObject)
    }
  }

  const handleObjectRemove = (obj) => {
    // Console output removed
    // Console output removed
    
    // 1단계: 기즈모와 아웃라인 우선 해제 (최우선)
    if (editorControls && editorControls.objectSelector) {
      // Console output removed
      
      // 기즈모 해제
      if (editorControls.objectSelector.transformControls) {
        try {
          editorControls.objectSelector.transformControls.detach()
          // Console output removed
        } catch (error) {
          // Console output removed
        }
      }
      
      // 아웃라인 제거 (Three.js 객체에서 직접)
      try {
        const threeObject = editorControls.findObjectById(obj.id)
        if (threeObject) {
          editorControls.objectSelector.removeSelectionOutline(threeObject)
          // Console output removed
        }
      } catch (error) {
        // Console output removed
      }
    }
    
    // 2단계: 선택 해제 및 전체 정리
    if (selectedObject && selectedObject.id === obj.id) {
      // Console output removed
      
      if (editorControls) {
        try {
          editorControls.deselectAllObjects()
          // Console output removed
        } catch (error) {
          // Console output removed
        }
      }
      
      // UI 상태 초기화
      setSelectedObject(null)
      // Console output removed
    }
    
    // 3단계: 시간차 지연 후 씬에서 객체 완전 제거
    // Console output removed
    setTimeout(() => {
      try {
        // 참조 동일성에 의존하지 않고 안전하게 삭제
        removeObjectById?.(obj?.id)
        // Console output removed
      } catch (error) {
        // Console output removed
      }
    }, 50) // 지연을 50ms로 증가하여 더 안전하게
  }

  const handleLibraryToggle = () => {
    const next = !showLibrary
    setShowLibrary(next)
    if (next) {
      if (showAssets) setShowAssets(false)
      if (isPostProcessingPanelOpen) setIsPostProcessingPanelOpen(false)
      if (showHDRI) setShowHDRI(false)
    }
  }

  const handleAssetsToggle = () => {
    const next = !showAssets
    setShowAssets(next)
    if (next) {
      if (showLibrary) setShowLibrary(false)
      if (isPostProcessingPanelOpen) setIsPostProcessingPanelOpen(false)
      if (showHDRI) setShowHDRI(false)
    }
  }

  const handlePostProcessingToggle = () => {
    const next = !isPostProcessingPanelOpen
    setIsPostProcessingPanelOpen(next)
    if (next) {
      if (showLibrary) setShowLibrary(false)
      if (showAssets) setShowAssets(false)
      if (showHDRI) setShowHDRI(false)
    }
  }

  const handleHDRIToggle = () => {
    const next = !showHDRI
    setShowHDRI(next)
    if (next) {
      if (showLibrary) setShowLibrary(false)
      if (showAssets) setShowAssets(false)
      if (isPostProcessingPanelOpen) setIsPostProcessingPanelOpen(false)
    }
  }

  const handleAssetDrop = (assetData, position) => {
    const genId = (base) => `${base || 'obj'}_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
    let newObject;

    switch (assetData.type) {
      case 'start_position':
        newObject = {
          id: genId(assetData.name || assetData.type),
          type: 'start_position',
          name: assetData.name,
          position: position || { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        };
        break;
      case 'directional_light':
        newObject = {
          id: genId(assetData.name || assetData.type),
          type: 'directional_light',
          name: assetData.name,
          position: position || { x: 5, y: 10, z: 5 },
          rotation: { x: -Math.PI/4, y: Math.PI/4, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          intensity: 1,
          color: 0xffffff,
          castShadow: true
        };
        break;
      case 'point_light':
        newObject = {
          id: genId(assetData.name || assetData.type),
          type: 'point_light',
          name: assetData.name,
          position: position || { x: 0, y: 3, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          intensity: 1,
          color: 0xffffff,
          distance: 10,
          decay: 2
        };
        break;
      case 'spot_light':
        newObject = {
          id: genId(assetData.name || assetData.type),
          type: 'spot_light',
          name: assetData.name,
          position: position || { x: 0, y: 5, z: 0 },
          rotation: { x: -Math.PI/2, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          intensity: 1,
          color: 0xffffff,
          distance: 10,
          angle: Math.PI/6,
          penumbra: 0.1
        };
        break;
      case 'ambient_light':
        newObject = {
          id: genId(assetData.name || assetData.type),
          type: 'ambient_light',
          name: assetData.name,
          position: position || { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          intensity: 0.3,
          color: 0x404040
        };
        break;
      case 'audio_source':
        newObject = {
          id: genId(assetData.name || assetData.type),
          type: 'audio_source',
          name: assetData.name,
          position: position || { x: 0, y: 1, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          volume: 1,
          loop: false,
          autoplay: false
        };
        break;
      default:
        newObject = {
          id: genId(assetData.name || assetData.type),
          type: assetData.type,
          name: assetData.name,
          position: position || { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        };
    }

  addObject(newObject);
  // selectedObject를 id로 유지해 일관성 개선
  setTimeout(() => { setSelectedObject(newObject.id); }, 100);
  }

  const handleLibraryDrop = async (objectData, position) => {
    const genId = (base) => `${base || 'obj'}_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
    let newObject;

    if (objectData.type === 'library') {
      newObject = {
        id: genId(objectData.name || objectData.id || 'library'),
        type: 'glb',
        url: objectData.glbUrl,
        position: position || { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        name: objectData.name
      };
    } else if (objectData.type === 'custom') {
      newObject = {
        id: genId(objectData.name || objectData.id || 'custom'),
        type: 'glb',
        customMeshId: objectData.id,
        position: position || { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        name: objectData.name || 'Custom Mesh'
      };
    } else {
      newObject = {
        id: genId(objectData.name || objectData.type),
        type: objectData.type || 'basic',
        geometry: objectData.geometry,
        params: objectData.params,
        position: position || { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        name: objectData.name
      };
    }

  addObject(newObject);
  // selectedObject를 id로 유지해 일관성 개선
  setTimeout(() => { setSelectedObject(newObject.id); }, 100);
  }

  const handleCloseContextMenu = () => {
    setContextMenu({
      isVisible: false,
      x: 0,
      y: 0,
      hit: null
    })
  }

  // ===== 주석(코멘트) 시스템 =====
  // 런타임 렌더용 메모리 구조: DOM/Three 참조 보유
  const annotationsRef = useRef([]); // {id, ownerId, targetObject, localPoint(Vector3), el}
  const lineCanvasRef = useRef(null);

  const ensureAnnotationLayers = () => {
    let layer = document.querySelector('.annotation-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'annotation-layer';
      Object.assign(layer.style, {
        position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 30
      });
      document.body.appendChild(layer);
    }
    if (!lineCanvasRef.current) {
      let line = document.querySelector('.annotation-line-layer');
      if (!line) {
        line = document.createElement('canvas');
        line.className = 'annotation-line-layer';
        Object.assign(line.style, {
          position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 29
        });
        document.body.appendChild(line);
      }
      lineCanvasRef.current = line;
    }
    return { layer, lineCanvas: lineCanvasRef.current };
  };

  const worldToScreen = (world) => {
    const cam = editorControls?.cameraController?.getCamera?.();
    const renderer = editorControls?.renderer;
    if (!cam || !renderer) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const p = world.clone().project(cam);
    return {
      x: rect.left + (p.x + 1) * 0.5 * rect.width,
      y: rect.top + (1 - (p.y + 1) * 0.5) * rect.height,
      z: p.z
    };
  };

  const updateAnnotations = () => {
    const { layer, lineCanvas } = ensureAnnotationLayers();
    const cam = editorControls?.cameraController?.getCamera?.();
    if (!cam || !editorControls?.renderer) return;
    const ctx = lineCanvas.getContext('2d');
    const w = (lineCanvas.width = window.innerWidth);
    const h = (lineCanvas.height = window.innerHeight);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();

    const scene = editorControls?.scene;
    const keep = [];
    for (const a of annotationsRef.current) {
      // 대상 객체 리바인딩 시도 (씬이 갱신된 경우)
      if ((!a.targetObject || !a.targetObject.parent) && a.ownerId && editorControls?.findObjectById) {
        try { a.targetObject = editorControls.findObjectById(a.ownerId) } catch {}
      }
      // 오브젝트가 씬에 남아있는지 확인
      let inScene = false; let p = a.targetObject;
      while (p) { if (p === scene) { inScene = true; break; } p = p.parent; }
      if (!a.targetObject || !inScene) { try { a.el?.style && (a.el.style.display = 'none'); } catch {}; continue; }
      // 월드 포인트 계산
      try { a.targetObject.updateMatrixWorld?.(true); } catch {}
      const world = a.localPoint.clone();
      a.targetObject.localToWorld(world);
      const scr = worldToScreen(world);
      if (!scr) { keep.push(a); continue; }
      // UI 박스 위치 (화면 고정: 픽셀 크기 유지)
      const el = a.el;
          const ox = 20, oy = -20; // 살짝 오프셋 - 기존 대비 2배 길이
      el.style.left = `${Math.round(scr.x + ox)}px`;
      el.style.top = `${Math.round(scr.y + oy)}px`;
      try { el.style.display = 'block'; } catch {}
      // 라인: 포인트 → 박스 좌상단
      const box = el.getBoundingClientRect();
      ctx.moveTo(scr.x, scr.y);
      ctx.lineTo(box.left, box.top);
      keep.push(a);
    }
    ctx.stroke();
    annotationsRef.current = keep;
  };

  useEffect(() => {
    let raf;
    const tick = () => { updateAnnotations(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorControls]);

  const handleAddComment = (hitInfo) => {
    const text = prompt('코멘트를 입력하세요:');
    if (!text) return;
    if (!hitInfo?.object || !hitInfo?.point) return;
    // 소유 루트 식별 (userData.id 보유 조상), 없으면 ownerId 사용
    const findRootInfo = (obj) => {
      let rootId = null; let cur = obj;
      while (cur) { if (cur.userData?.id) { rootId = cur.userData.id; break; } cur = cur.parent; }
      if (!rootId) rootId = obj.userData?.ownerId ?? null;
      const rootObj = rootId && editorControls?.findObjectById ? editorControls.findObjectById(rootId) : null;
      return { rootId, rootObj };
    };
    const { rootId, rootObj } = findRootInfo(hitInfo.object);
    if (!rootId || !rootObj) return; // 루트 식별 실패 시 저장 생략

    // 루트 기준 로컬 포인트로 변환
    const localV = hitInfo.point.clone();
    try { rootObj.worldToLocal(localV); } catch {}

    // 스토어에 영속 추가 (동일 id 사용)
    const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    try { addAnnotation?.({ id, ownerId: rootId, text, local: { x: localV.x, y: localV.y, z: localV.z } }) } catch {}

    // UI 박스 생성 및 런타임 등록
    const { layer } = ensureAnnotationLayers();
    const el = document.createElement('div');
    el.className = 'annotation-box';
    el.innerHTML = `<div class="annotation-text"></div><button class="annotation-close">✕</button>`;
    const textEl = el.querySelector('.annotation-text');
    textEl.textContent = text;
    Object.assign(el.style, {
      position: 'fixed', minWidth: '180px', maxWidth: '260px',
      padding: '8px 10px', background: 'rgba(0,0,0,0.66)', color: '#fff',
      border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.35)', fontSize: '12px', lineHeight: '1.4',
      pointerEvents: 'auto'
    });
    const closeBtn = el.querySelector('.annotation-close');
    Object.assign(closeBtn.style, {
      position: 'absolute', top: '4px', right: '6px', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer'
    });
    layer.appendChild(el);
    annotationsRef.current.push({ id, ownerId: rootId, targetObject: rootObj, localPoint: localV.clone(), el });

    const onClose = () => {
      try { el.remove(); } catch {}
      annotationsRef.current = annotationsRef.current.filter(a => a.id !== id);
      try { removeAnnotation?.(id) } catch {}
      updateAnnotations();
    };
    closeBtn.addEventListener('click', onClose);

    updateAnnotations();
  };

  // 저장된 주석 → DOM/참조로 동기화
  useEffect(() => {
    const anns = Array.isArray(annotations) ? annotations : [];
    const existing = new Map(annotationsRef.current.map(a => [a.id, a]));
    const presentIds = new Set();
    const { layer } = ensureAnnotationLayers();
    // 추가/갱신
    for (const ann of anns) {
      presentIds.add(ann.id);
      if (!existing.has(ann.id)) {
        // 새 DOM 생성
        const el = document.createElement('div');
        el.className = 'annotation-box';
        el.innerHTML = `<div class="annotation-text"></div><button class="annotation-close">✕</button>`;
        const textEl = el.querySelector('.annotation-text');
        textEl.textContent = String(ann.text || '');
        Object.assign(el.style, {
          position: 'fixed', minWidth: '180px', maxWidth: '260px',
          padding: '8px 10px', background: 'rgba(0,0,0,0.66)', color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)', fontSize: '12px', lineHeight: '1.4',
          pointerEvents: 'auto', display: 'none'
        });
        const closeBtn = el.querySelector('.annotation-close');
        Object.assign(closeBtn.style, {
          position: 'absolute', top: '4px', right: '6px', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer'
        });
        layer.appendChild(el);

        const target = ann.ownerId && editorControls?.findObjectById ? editorControls.findObjectById(ann.ownerId) : null;
        const entry = {
          id: ann.id,
          ownerId: ann.ownerId ?? null,
          targetObject: target || null,
          localPoint: new THREE.Vector3(ann.local?.x || 0, ann.local?.y || 0, ann.local?.z || 0),
          el
        };
        const onClose = () => {
          try { el.remove(); } catch {}
          annotationsRef.current = annotationsRef.current.filter(a => a.id !== ann.id);
          try { removeAnnotation?.(ann.id) } catch {}
          updateAnnotations();
        };
        closeBtn.addEventListener('click', onClose);
        annotationsRef.current.push(entry);
      } else {
        // 텍스트 갱신
        try {
          existing.get(ann.id).el.querySelector('.annotation-text').textContent = String(ann.text || '');
        } catch {}
      }
    }
    // 제거된 항목 정리
    const next = [];
    for (const a of annotationsRef.current) {
      if (presentIds.has(a.id)) next.push(a); else { try { a.el.remove(); } catch {} }
    }
    annotationsRef.current = next;
    // 즉시 한 번 그려주기
    updateAnnotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, editorControls]);

  return (
    <div className="editor-ui">
      {/* 좌측 도구 모음 */}
      <div className="tool-panel">
        <div className="tool-section">
          <button 
            className={`tool-btn assets-btn ${showAssets ? 'active' : ''}`}
            onClick={handleAssetsToggle}
            title="기본 에셋"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2L13.09,8.26L22,9L14.74,14.74L17.18,22L12,18.5L6.82,22L9.26,14.74L2,9L10.91,8.26L12,2Z"/>
            </svg>
          </button>
          <button 
            className={`tool-btn library-btn ${showLibrary ? 'active' : ''}`}
            onClick={handleLibraryToggle}
            title="라이브러리"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4,6H20V8H4V6M4,11H20V13H4V11M4,16H20V18H4V16Z"/>
            </svg>
          </button>
          <button 
            className={`tool-btn post-processing-btn ${isPostProcessingPanelOpen ? 'active' : ''}`}
            onClick={handlePostProcessingToggle}
            title="포스트프로세싱 효과"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9,12L11,14L15,10L20,15H4L9,12Z"/>
            </svg>
          </button>
          <button 
            className={`tool-btn hdri-btn ${showHDRI ? 'active' : ''}`}
            onClick={handleHDRIToggle}
            title="HDRI 환경"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17Z"/>
            </svg>
          </button>

          {/* 포스트프로세싱 패널 - 버튼 바로 옆에 */}
          {isPostProcessingPanelOpen && (
            <PostProcessingPanel 
              postProcessingManager={postProcessingManager}
              onClose={() => setIsPostProcessingPanelOpen(false)}
            />
          )}
        </div>
      </div>

      {/* 기본 에셋 패널 */}
      {showAssets && (
        <AssetsPanel 
          onAssetDrop={handleAssetDrop}
          onClose={() => setShowAssets(false)}
        />
      )}

      {/* 라이브러리 패널 */}
      {showLibrary && (
        <LibraryPanel 
          onObjectDrop={handleLibraryDrop}
          onClose={() => setShowLibrary(false)}
          forceRefresh={forceRefresh}
        />
      )}

  {/* 포스트프로세싱 패널 (툴바 인라인 렌더로 대체됨) */}

      {/* HDRI 패널 */}
      {showHDRI && (
        <HDRIPanel 
          scene={editorControls?.scene}
          onClose={() => setShowHDRI(false)}
        />
      )}

      {/* Toast 메시지 비활성화 */}
      {/*
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
      */}

      {/* 컨텍스트 메뉴 */}
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        isVisible={contextMenu.isVisible}
        onClose={handleCloseContextMenu}
        selectedObject={selectedObject}
  onAddToLibrary={onAddToLibrary}
  onAddComment={handleAddComment}
  hitInfo={contextMenu.hit}
      />

      {/* 우측 패널 - 인스펙터 */}
      {showInspector && (
        <InspectorPanel
          // SceneHierarchy 관련 props
          objects={objects}
          walls={walls}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          setParent={setParent}
          reorderSiblings={reorderSiblings}
          selectedObject={selectedObject}
          onObjectVisibilityToggle={handleObjectVisibilityToggle}
          onObjectFreezeToggle={handleObjectFreezeToggle}
          onObjectSelect={handleObjectSelect}
          onObjectRemove={handleObjectRemove}
          onObjectFocus={handleObjectFocus}
          onObjectRename={handleObjectRename}
          onContextMenu={(e, obj) => {
            e.preventDefault();
            
            // 객체를 먼저 선택
            handleObjectSelect(obj);
            // 컨텍스트 메뉴 표시
            setContextMenu({
              isVisible: true,
              x: e.clientX,
              y: e.clientY
            });
          }}
          editorControls={editorControls}
          postProcessingManager={postProcessingManager}
          
          // ObjectProperties 관련 props
          onObjectUpdate={handleObjectUpdate}
          
          onClose={() => onToggleInspector(false)}
        />
      )}
    </div>
  )
}

export default EditorUI
