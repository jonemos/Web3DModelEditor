import React, { useState, useRef, useEffect } from 'react';
import { generateThumbnail } from '../../../utils/thumbnailGenerator';
import { useEditorStore } from '../../../store/editorStore';
import { MeshLibraryManager } from '../../../utils/meshLibraryManager';
import './LibraryPanel.css';

console.log('🔥 실제 LibraryPanel 파일 로드됨');

const LibraryPanel = ({ onObjectDrop, onClose, forceRefresh = 0 }) => {
  console.log('🔥 실제 LibraryPanel 컴포넌트 렌더링 시작');
  
  const [isDragging, setIsDragging] = useState(false);
  const [customObjects, setCustomObjects] = useState([]);
  const [libraryMeshes, setLibraryMeshes] = useState([]); // 라이브러리 메쉬 상태 추가
  const draggedObject = useRef(null);
  const { customMeshes, loadCustomMeshes } = useEditorStore();
  const libraryManager = useRef(new MeshLibraryManager());

  console.log('🔥 실제 LibraryPanel - customMeshes 상태:', customMeshes.length, '개');

  // 3D 객체 라이브러리 데이터
  const objectLibrary = [
    {
      id: 'cube',
      name: '정육면체',
      type: 'basic',
      geometry: 'BoxGeometry',
      params: [1, 1, 1]
    },
    {
      id: 'sphere',
      name: '구체',
      type: 'basic',
      geometry: 'SphereGeometry',
      params: [0.5, 32, 16]
    },
    {
      id: 'cylinder',
      name: '원기둥',
      type: 'basic',
      geometry: 'CylinderGeometry',
      params: [0.5, 0.5, 1, 32]
    },
    {
      id: 'cone',
      name: '원뿔',
      type: 'basic',
      geometry: 'ConeGeometry',
      params: [0.5, 1, 32]
    },
    {
      id: 'plane',
      name: '평면',
      type: 'basic',
      geometry: 'PlaneGeometry',
      params: [1, 1]
    },
    {
      id: 'torus',
      name: '도넛',
      type: 'basic',
      geometry: 'TorusGeometry',
      params: [0.5, 0.2, 16, 100]
    }
  ];

  // 컴포넌트 마운트 시 커스텀 메쉬 로드
  useEffect(() => {
    console.log('=== 실제 LibraryPanel useEffect 시작 ===');
    const meshes = libraryManager.current.getCustomMeshes();
    console.log('실제 LibraryPanel 마운트 시 로드된 커스텀 메쉬:', meshes.length, '개');
    console.log('메쉬 상세 데이터:', meshes);
    loadCustomMeshes(meshes);
    console.log('=== 실제 LibraryPanel useEffect 끝 ===');
  }, [loadCustomMeshes]);

  // 커스텀 메쉬 추가 이벤트 리스너
  useEffect(() => {
    const handleCustomMeshAdded = (event) => {
      console.log('실제 LibraryPanel: 커스텀 메쉬 추가 이벤트 수신:', event.detail);
      const meshes = libraryManager.current.getCustomMeshes();
      loadCustomMeshes(meshes);
    };

    window.addEventListener('customMeshAdded', handleCustomMeshAdded);
    
    return () => {
      window.removeEventListener('customMeshAdded', handleCustomMeshAdded);
    };
  }, [loadCustomMeshes]);

  // customMeshes 상태 변화 감지
  useEffect(() => {
    console.log('실제 LibraryPanel customMeshes 업데이트:', customMeshes.length, '개', customMeshes);
  }, [customMeshes]);

  // 사용자 정의 객체 로드 (기존 로직 유지)
  useEffect(() => {
    const loadCustomObjects = () => {
      const saved = JSON.parse(localStorage.getItem('customObjects') || '[]');
      setCustomObjects(saved);
    };
    
    loadCustomObjects();
  }, [forceRefresh]); // forceRefresh가 변경될 때마다 다시 로드

  // 라이브러리 메쉬 로드
  useEffect(() => {
    const loadLibraryMeshes = async () => {
      try {
        // library/mesh 폴더의 GLB 파일 목록
        const meshFiles = [
          { filename: '111.glb', name: '메쉬 111' },
          { filename: '222.glb', name: '메쉬 222' }
        ];

        const meshObjects = [];
        
        // 각 파일에 대해 존재 여부 확인 및 썸네일 생성
        for (const file of meshFiles) {
          const glbUrl = `/library/mesh/${file.filename}`;
          
          // 파일 존재 여부 확인
          try {
            const response = await fetch(glbUrl, { method: 'HEAD' });
            if (!response.ok) {
              console.warn(`GLB 파일이 존재하지 않습니다: ${glbUrl}`);
              continue; // 파일이 없으면 건너뛰기
            }
          } catch (error) {
            console.warn(`GLB 파일 확인 실패: ${glbUrl}`, error);
            continue; // 파일 확인 실패 시 건너뛰기
          }
          
          const meshObject = {
            id: `library_${file.filename.replace('.glb', '')}`,
            name: file.name,
            type: 'library',
            geometry: 'LibraryMesh',
            glbUrl: glbUrl,
            filename: file.filename,
            thumbnail: null,
            isLoadingThumbnail: true
          };
          
          meshObjects.push(meshObject);
        }
        
        // 먼저 기본 객체들을 설정
        setLibraryMeshes(meshObjects);
        
        // 각 객체의 썸네일을 비동기로 생성
        for (let i = 0; i < meshObjects.length; i++) {
          const meshObject = meshObjects[i];
          
          try {
            const thumbnailUrl = await generateThumbnail(meshObject.glbUrl);
            
            // 썸네일이 생성되면 해당 객체만 업데이트
            setLibraryMeshes(prevMeshes => 
              prevMeshes.map(mesh => 
                mesh.id === meshObject.id 
                  ? { ...mesh, thumbnail: thumbnailUrl, isLoadingThumbnail: false }
                  : mesh
              )
            );
          } catch (error) {
            console.error(`${meshObject.filename} 썸네일 생성 실패:`, error);
            
            // 썸네일 생성 실패 시 로딩 상태만 해제
            setLibraryMeshes(prevMeshes => 
              prevMeshes.map(mesh => 
                mesh.id === meshObject.id 
                  ? { ...mesh, isLoadingThumbnail: false }
                  : mesh
              )
            );
          }
        }
        
      } catch (error) {
        console.error('라이브러리 메쉬 로드 실패:', error);
      }
    };

    loadLibraryMeshes();
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  const handleDragStart = (e, object) => {
    console.log('LibraryPanel handleDragStart 호출됨:', object);
    
    setIsDragging(true);
    draggedObject.current = object;
    
    // 커스텀 메쉬의 경우 GLB 데이터를 처리
    let dataToTransfer = object;
    if (object.type === 'custom') {
      console.log('커스텀 메쉬 드래그 처리:', object.name);
      console.log('GLB 데이터:', typeof object.glbData, object.glbData);
      
      // 커스텀 메쉬의 경우 type을 'custom'으로 유지하여 EditorUI에서 올바르게 처리되도록 함
      dataToTransfer = {
        ...object,
        type: 'custom' // type을 'custom'으로 유지
      };
      console.log('커스텀 메쉬 드래그용 변환된 객체:', dataToTransfer);
    }
    
    // 드래그 이미지를 위한 캔버스 생성
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    
    // 배경 그리기
    ctx.fillStyle = 'rgba(100, 150, 255, 0.8)';
    ctx.fillRect(0, 0, 50, 50);
    
    // 텍스트 그리기
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(object.name, 25, 30);
    
    // 캔버스를 드래그 이미지로 설정
    e.dataTransfer.setDragImage(canvas, 25, 25);
    e.dataTransfer.setData('text/plain', JSON.stringify(dataToTransfer));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    draggedObject.current = null;
  };

  const handleClick = (object) => {
    console.log('LibraryPanel handleClick 호출됨:', object);
    
    // 클릭으로 객체를 중앙에 추가
    if (onObjectDrop) {
      if (object.type === 'custom') {
        console.log('커스텀 메쉬 클릭 처리:', object.name);
        console.log('GLB 데이터:', typeof object.glbData, object.glbData);
        
        try {
          // 커스텀 메쉬의 경우 type을 'custom'으로 유지하여 EditorUI에서 올바르게 처리되도록 함
          const customObject = {
            ...object,
            type: 'custom' // type을 'custom'으로 유지
          };
          console.log('커스텀 메쉬 변환된 객체:', customObject);
          onObjectDrop(customObject, { x: 0, y: 0, z: 0 });
        } catch (error) {
          console.error('커스텀 메쉬 처리 실패:', error);
          alert('커스텀 메쉬를 로드할 수 없습니다. 데이터가 손상되었을 수 있습니다.');
        }
      } else {
        console.log('기본/라이브러리 메쉬 클릭 처리:', object.name);
        onObjectDrop(object, { x: 0, y: 0, z: 0 });
      }
    } else {
      console.warn('onObjectDrop 함수가 정의되지 않음');
    }
  };

  const handleDeleteCustomObject = (objectToDelete, event) => {
    event.stopPropagation(); // 부모 클릭 이벤트 방지
    
    if (window.confirm(`"${objectToDelete.name}"을(를) 라이브러리에서 삭제하시겠습니까?`)) {
      // URL 객체 해제 (메모리 누수 방지)
      if (objectToDelete.glbUrl) {
        URL.revokeObjectURL(objectToDelete.glbUrl);
      }
      
      // 로컬 스토리지에서 제거
      const savedCustomObjects = JSON.parse(localStorage.getItem('customObjects') || '[]');
      const filteredObjects = savedCustomObjects.filter(obj => obj.id !== objectToDelete.id);
      localStorage.setItem('customObjects', JSON.stringify(filteredObjects));
      
      // 상태 업데이트
      setCustomObjects(filteredObjects);
    }
  };

  const handleDeleteCustomMesh = (meshToDelete, event) => {
    event.stopPropagation(); // 부모 클릭 이벤트 방지
    
    if (window.confirm(`"${meshToDelete.name}"을(를) 라이브러리에서 삭제하시겠습니까?`)) {
      // 로컬 스토리지에서 삭제
      libraryManager.current.deleteCustomMesh(meshToDelete.id);
      
      // 메쉬 목록 새로고침
      const meshes = libraryManager.current.getCustomMeshes();
      loadCustomMeshes(meshes);
      
      console.log('커스텀 메쉬 삭제 완료:', meshToDelete.name);
    }
  };

  return (
    <div className="library-panel">
      <div className="library-header">
        <button className="close-btn" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
          </svg>
        </button>
      </div>

      <div className="library-content">
        <div className="category-section">
          <div className="object-grid">
            {objectLibrary.map((object) => (
              <div
                key={object.id}
                className="object-item"
                draggable
                onDragStart={(e) => handleDragStart(e, object)}
                onDragEnd={handleDragEnd}
                onClick={() => handleClick(object)}
                title={object.name}
              >
                <div className="object-thumbnail">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    {object.id === 'cube' && (
                      <path d="M21,16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V7.5C3,7.12 3.21,6.79 3.53,6.62L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.79,6.79 21,7.12 21,7.5V16.5M12,4.15L6.04,7.5L12,10.85L17.96,7.5L12,4.15M5,15.91L11,19.29V12.58L5,9.21V15.91M19,15.91V9.21L13,12.58V19.29L19,15.91Z"/>
                    )}
                    {object.id === 'sphere' && (
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                    )}
                    {object.id === 'cylinder' && (
                      <path d="M12,2C8.14,2 5,3.79 5,6V18C5,20.21 8.14,22 12,22C15.86,22 19,20.21 19,18V6C19,3.79 15.86,2 12,2M12,4C14.67,4 17,4.9 17,6C17,7.1 14.67,8 12,8C9.33,8 7,7.1 7,6C7,4.9 9.33,4 12,4M7,9.5C8.21,10.72 9.86,11.26 12,11.26C14.14,11.26 15.79,10.72 17,9.5V18C17,19.1 14.67,20 12,20C9.33,20 7,19.1 7,18V9.5Z"/>
                    )}
                    {object.id === 'cone' && (
                      <path d="M12,2L1,21H23L12,2M12,6L19.53,19H4.47L12,6Z"/>
                    )}
                    {object.id === 'plane' && (
                      <path d="M3,3V21H21V3H3M19,19H5V5H19V19Z"/>
                    )}
                    {object.id === 'torus' && (
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/>
                    )}
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 구분선 */}
        {libraryMeshes.length > 0 && <div className="section-divider"></div>}

        {/* 라이브러리 메쉬 섹션 */}
        {libraryMeshes.length > 0 && (
          <div className="category-section">
            <div className="object-grid">
              {libraryMeshes.map((object) => (
                <div
                  key={object.id}
                  className="object-item library-mesh"
                  draggable
                  onDragStart={(e) => handleDragStart(e, object)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleClick(object)}
                  title={`${object.name} (라이브러리)`}
                >
                  <div className="object-thumbnail">
                    {object.isLoadingThumbnail ? (
                      <div className="thumbnail-loading">
                        <div className="loading-spinner"></div>
                      </div>
                    ) : object.thumbnail ? (
                      <img 
                        src={object.thumbnail} 
                        alt={object.name}
                        className="thumbnail-image"
                      />
                    ) : (
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,2L2,7L12,12L22,7L12,2M2,17L12,22L22,17L20.84,16.47L12,21.17L3.16,16.47L2,17Z"/>
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 구분선 */}
        <div className="section-divider"></div>

        {/* 커스텀 메쉬 섹션 */}
        <div className="category-section">
          <div className="object-grid">
            {customMeshes.length > 0 ? (
              customMeshes.map((mesh) => (
                <div
                  key={mesh.id}
                  className="object-item custom-mesh"
                  draggable
                  onDragStart={(e) => handleDragStart(e, mesh)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleClick(mesh)}
                  title={mesh.name}
                >
                  <div className="object-thumbnail">
                    <img 
                      src={mesh.thumbnail} 
                      alt={mesh.name}
                      width="40" 
                      height="40"
                      onError={(e) => {
                        // 썸네일 로드 실패 시 기본 아이콘 표시
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <svg 
                      width="40" 
                      height="40" 
                      viewBox="0 0 24 24" 
                      fill="currentColor"
                      style={{ display: 'none' }}
                    >
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                    </svg>
                  </div>
                  <button 
                    className="delete-btn"
                    onClick={(e) => handleDeleteCustomMesh(mesh, e)}
                    title="삭제"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                    </svg>
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-library">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
                <p>메쉬를 우클릭하여<br/>라이브러리에 추가하세요</p>
              </div>
            )}
          </div>
        </div>

        {/* 구분선 */}
        {customObjects.length > 0 && <div className="section-divider"></div>}

        {/* 사용자 정의 객체 섹션 */}
        {customObjects.length > 0 && (
          <div className="category-section">
            <h4>사용자 정의</h4>
            <div className="object-grid">
            {/* 사용자 정의 객체들 */}
            {customObjects.map((object) => (
              <div
                key={object.id}
                className="object-item custom-object"
                draggable
                onDragStart={(e) => handleDragStart(e, object)}
                onDragEnd={handleDragEnd}
                onClick={() => handleClick(object)}
                title={`${object.name} (사용자 정의)`}
              >
                <div className="object-thumbnail">
                  {object.thumbnail ? (
                    <img 
                      src={object.thumbnail} 
                      alt={object.name}
                      style={{ 
                        width: '24px', 
                        height: '24px', 
                        objectFit: 'cover',
                        borderRadius: '2px'
                      }}
                    />
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,2L13.09,8.26L22,9L14.74,14.74L17.18,22L12,18.5L6.82,22L9.26,14.74L2,9L10.91,8.26L12,2Z"/>
                    </svg>
                  )}
                </div>
                <button 
                  className="delete-btn"
                  onClick={(e) => handleDeleteCustomObject(object, e)}
                  title="삭제"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                  </svg>
                </button>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryPanel;
