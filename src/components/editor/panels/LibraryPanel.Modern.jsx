/**
 * LibraryPanel Modern - 파일 I/O 시스템과 통합된 라이브러리 패널
 * 
 * 주요 특징:
 * - FileIOPlugin과 명령 시스템 통합
 * - 실시간 로딩 상태 표시
 * - 드래그 앤 드롭 지원
 * - 썸네일 캐싱
 * - 진행률 표시
 */

import React, { useState, useEffect, useRef } from 'react';
import { app } from '../../../core/ApplicationBootstrap.js';
import { eventBus, EventTypes } from '../../../core/EventBus.js';
import './LibraryPanel.css';

const LibraryPanelModern = ({ 
  isVisible = true, 
  onMeshSelect = null,
  isNewArchitectureEnabled = false 
}) => {
  const [libraryMeshes, setLibraryMeshes] = useState([]);
  const [customMeshes, setCustomMeshes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingOperations, setLoadingOperations] = useState(new Map());
  const [selectedTab, setSelectedTab] = useState('library');
  const [services, setServices] = useState({});
  const draggedItemRef = useRef(null);

  // 서비스 초기화
  useEffect(() => {
    if (!isNewArchitectureEnabled) return;

    const checkServices = () => {
      if (app.isInitialized) {
        const fileIOPlugin = app.serviceRegistry?.get('fileIOPlugin');
        const commandManager = app.commandManager;
        
        setServices({
          fileIOPlugin,
          commandManager
        });
        
        console.log('📚 LibraryPanel Modern: Services ready', { fileIOPlugin: !!fileIOPlugin, commandManager: !!commandManager });
      }
    };

    checkServices();
    eventBus.on(EventTypes.APP_INITIALIZED, checkServices);

    return () => {
      eventBus.off(EventTypes.APP_INITIALIZED, checkServices);
    };
  }, [isNewArchitectureEnabled]);

  // 이벤트 리스너 설정
  useEffect(() => {
    if (!isNewArchitectureEnabled) return;

    // 라이브러리 새로고침 이벤트
    const handleLibraryRefreshStart = (event) => {
      setIsLoading(true);
      console.log('📚 Library refresh started');
    };

    const handleLibraryRefreshComplete = (event) => {
      const { meshes } = event.detail;
      setLibraryMeshes(meshes);
      setIsLoading(false);
      console.log('✅ Library refresh complete:', meshes.length, 'meshes');
    };

    const handleLibraryRefreshError = (event) => {
      const { error } = event.detail;
      setIsLoading(false);
      console.error('❌ Library refresh error:', error);
    };

    // 썸네일 생성 이벤트
    const handleThumbnailGenerated = (event) => {
      const { glbUrl, thumbnail } = event.detail;
      
      setLibraryMeshes(prev => prev.map(mesh => 
        mesh.glbUrl === glbUrl 
          ? { ...mesh, thumbnail, isLoadingThumbnail: false }
          : mesh
      ));
    };

    // 파일 로드 이벤트
    const handleFileLoadStart = (event) => {
      const { operationId, fileName } = event.detail;
      setLoadingOperations(prev => new Map(prev.set(operationId, {
        fileName,
        status: 'loading',
        progress: 0
      })));
    };

    const handleFileLoadProgress = (event) => {
      const { operationId, progress } = event.detail;
      setLoadingOperations(prev => {
        const op = prev.get(operationId);
        if (op) {
          return new Map(prev.set(operationId, { ...op, progress }));
        }
        return prev;
      });
    };

    const handleFileLoadComplete = (event) => {
      const { operationId } = event.detail;
      setLoadingOperations(prev => {
        const newMap = new Map(prev);
        newMap.delete(operationId);
        return newMap;
      });
    };

    const handleFileLoadError = (event) => {
      const { operationId } = event.detail;
      setLoadingOperations(prev => {
        const newMap = new Map(prev);
        newMap.delete(operationId);
        return newMap;
      });
    };

    // 커스텀 메쉬 이벤트
    const handleCustomMeshSaved = (event) => {
      const { meshData } = event.detail;
      setCustomMeshes(prev => [...prev, meshData]);
    };

    const handleCustomMeshDeleted = (event) => {
      const { meshId } = event.detail;
      setCustomMeshes(prev => prev.filter(mesh => mesh.id !== meshId));
    };

    // 이벤트 리스너 등록
    eventBus.on(EventTypes.LIBRARY_REFRESH_START, handleLibraryRefreshStart);
    eventBus.on(EventTypes.LIBRARY_REFRESH_COMPLETE, handleLibraryRefreshComplete);
    eventBus.on(EventTypes.LIBRARY_REFRESH_ERROR, handleLibraryRefreshError);
    eventBus.on(EventTypes.FILE_THUMBNAIL_GENERATED, handleThumbnailGenerated);
    eventBus.on(EventTypes.FILE_LOAD_START, handleFileLoadStart);
    eventBus.on(EventTypes.FILE_LOAD_PROGRESS, handleFileLoadProgress);
    eventBus.on(EventTypes.FILE_LOAD_COMPLETE, handleFileLoadComplete);
    eventBus.on(EventTypes.FILE_LOAD_ERROR, handleFileLoadError);
    eventBus.on(EventTypes.CUSTOM_MESH_SAVED, handleCustomMeshSaved);
    eventBus.on(EventTypes.CUSTOM_MESH_DELETED, handleCustomMeshDeleted);

    return () => {
      eventBus.off(EventTypes.LIBRARY_REFRESH_START, handleLibraryRefreshStart);
      eventBus.off(EventTypes.LIBRARY_REFRESH_COMPLETE, handleLibraryRefreshComplete);
      eventBus.off(EventTypes.LIBRARY_REFRESH_ERROR, handleLibraryRefreshError);
      eventBus.off(EventTypes.FILE_THUMBNAIL_GENERATED, handleThumbnailGenerated);
      eventBus.off(EventTypes.FILE_LOAD_START, handleFileLoadStart);
      eventBus.off(EventTypes.FILE_LOAD_PROGRESS, handleFileLoadProgress);
      eventBus.off(EventTypes.FILE_LOAD_COMPLETE, handleFileLoadComplete);
      eventBus.off(EventTypes.FILE_LOAD_ERROR, handleFileLoadError);
      eventBus.off(EventTypes.CUSTOM_MESH_SAVED, handleCustomMeshSaved);
      eventBus.off(EventTypes.CUSTOM_MESH_DELETED, handleCustomMeshDeleted);
    };
  }, [isNewArchitectureEnabled]);

  // 초기 라이브러리 로드
  useEffect(() => {
    if (!isNewArchitectureEnabled || !services.commandManager) return;

    // 라이브러리 새로고침 명령 실행
    services.commandManager.executeCommand('refreshLibrary')
      .catch(error => {
        console.error('Initial library load failed:', error);
      });

    // 커스텀 메쉬 로드
    if (services.fileIOPlugin) {
      const glbManager = services.fileIOPlugin.getGLBManager();
      if (glbManager) {
        const customMeshes = glbManager.getCustomMeshes();
        setCustomMeshes(customMeshes);
      }
    }
  }, [services.commandManager, services.fileIOPlugin, isNewArchitectureEnabled]);

  // 썸네일 생성
  const generateThumbnail = async (mesh) => {
    if (!services.fileIOPlugin || mesh.thumbnail) return;

    try {
      const glbManager = services.fileIOPlugin.getGLBManager();
      const thumbnail = await glbManager.generateThumbnailFromURL(mesh.glbUrl);
      
      // 상태 업데이트는 이벤트를 통해 자동으로 처리됨
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
    }
  };

  // 메쉬 로드 (명령 시스템 통합)
  const loadMesh = async (mesh, position = { x: 0, y: 0, z: 0 }) => {
    if (!services.commandManager) return;

    try {
      const commandId = mesh.type === 'library' ? 'loadLibraryMesh' : 'loadCustomMesh';
      
      await services.commandManager.executeCommand(commandId, {
        meshId: mesh.id,
        position
      });

      console.log('✅ Mesh loaded via command system:', mesh.name);
      
      if (onMeshSelect) {
        onMeshSelect(mesh);
      }
    } catch (error) {
      console.error('❌ Mesh load failed:', error);
    }
  };

  // 드래그 앤 드롭 처리
  const handleDragStart = (event, mesh) => {
    draggedItemRef.current = mesh;
    event.dataTransfer.setData('application/json', JSON.stringify(mesh));
    event.dataTransfer.effectAllowed = 'copy';
  };

  // 커스텀 메쉬 삭제
  const deleteCustomMesh = async (meshId) => {
    if (!services.commandManager) return;

    try {
      await services.commandManager.executeCommand('deleteCustomMesh', { meshId });
      console.log('✅ Custom mesh deleted via command system:', meshId);
    } catch (error) {
      console.error('❌ Custom mesh deletion failed:', error);
    }
  };

  // 라이브러리 새로고침
  const refreshLibrary = async () => {
    if (!services.commandManager) return;

    try {
      await services.commandManager.executeCommand('refreshLibrary');
    } catch (error) {
      console.error('❌ Library refresh failed:', error);
    }
  };

  // 메쉬 카드 렌더링
  const renderMeshCard = (mesh, index) => {
    const isLoadingThumbnail = mesh.isLoadingThumbnail && !mesh.thumbnail;
    const hasOperation = Array.from(loadingOperations.values()).some(op => 
      op.fileName === mesh.filename || op.fileName === mesh.fileName
    );

    return (
      <div
        key={mesh.id}
        className="library-mesh-card modern-mesh-card"
        draggable={true}
        onDragStart={(e) => handleDragStart(e, mesh)}
        onClick={() => loadMesh(mesh)}
        onMouseEnter={() => generateThumbnail(mesh)}
      >
        {/* 썸네일 영역 */}
        <div className="mesh-thumbnail">
          {isLoadingThumbnail ? (
            <div className="thumbnail-loading">
              <div className="loading-spinner"></div>
              <span>썸네일 생성 중...</span>
            </div>
          ) : mesh.thumbnail ? (
            <img src={mesh.thumbnail} alt={mesh.name} />
          ) : (
            <div className="thumbnail-placeholder">
              <span>📦</span>
            </div>
          )}
          
          {/* 로딩 오버레이 */}
          {hasOperation && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <span>로딩 중...</span>
            </div>
          )}
        </div>

        {/* 메쉬 정보 */}
        <div className="mesh-info">
          <div className="mesh-name" title={mesh.name}>
            {mesh.name}
          </div>
          <div className="mesh-details">
            <span className="mesh-type">{mesh.type}</span>
            {mesh.fileSize && (
              <span className="mesh-size">{mesh.fileSize}</span>
            )}
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="mesh-actions">
          {mesh.type === 'custom' && (
            <button
              className="delete-button"
              onClick={(e) => {
                e.stopPropagation();
                deleteCustomMesh(mesh.id);
              }}
              title="삭제"
            >
              🗑️
            </button>
          )}
        </div>

        {/* 아키텍처 상태 표시 */}
        {isNewArchitectureEnabled && (
          <div className="architecture-badge modern">🚀</div>
        )}
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <div className="library-panel modern-library-panel">
      {/* 헤더 */}
      <div className="panel-header">
        <h3>📚 라이브러리</h3>
        <div className="header-actions">
          <button
            className="refresh-button"
            onClick={refreshLibrary}
            disabled={isLoading}
            title="새로고침"
          >
            {isLoading ? '⏳' : '🔄'}
          </button>
          {isNewArchitectureEnabled && (
            <div className="architecture-indicator">
              <span className="modern-badge">Modern</span>
            </div>
          )}
        </div>
      </div>

      {/* 탭 영역 */}
      <div className="panel-tabs">
        <button
          className={`tab-button ${selectedTab === 'library' ? 'active' : ''}`}
          onClick={() => setSelectedTab('library')}
        >
          라이브러리 ({libraryMeshes.length})
        </button>
        <button
          className={`tab-button ${selectedTab === 'custom' ? 'active' : ''}`}
          onClick={() => setSelectedTab('custom')}
        >
          커스텀 ({customMeshes.length})
        </button>
      </div>

      {/* 진행 상태 표시 */}
      {loadingOperations.size > 0 && (
        <div className="loading-status">
          <div className="status-header">
            <span>📁 로딩 중: {loadingOperations.size}개</span>
          </div>
          {Array.from(loadingOperations.values()).map((op, index) => (
            <div key={index} className="operation-progress">
              <span className="operation-name">{op.fileName}</span>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${op.progress}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 메쉬 그리드 */}
      <div className="panel-content">
        {selectedTab === 'library' && (
          <div className="mesh-grid">
            {isLoading && libraryMeshes.length === 0 ? (
              <div className="loading-message">
                <div className="loading-spinner large"></div>
                <span>라이브러리 로딩 중...</span>
              </div>
            ) : libraryMeshes.length > 0 ? (
              libraryMeshes.map(renderMeshCard)
            ) : (
              <div className="empty-message">
                <span>📭 라이브러리가 비어있습니다</span>
                <button onClick={refreshLibrary}>새로고침</button>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'custom' && (
          <div className="mesh-grid">
            {customMeshes.length > 0 ? (
              customMeshes.map(renderMeshCard)
            ) : (
              <div className="empty-message">
                <span>📦 커스텀 메쉬가 없습니다</span>
                <small>에디터에서 객체를 선택한 후 저장하세요</small>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 사용법 안내 */}
      <div className="panel-footer">
        <small>
          💡 메쉬를 클릭하거나 드래그하여 씬에 추가하세요
          {isNewArchitectureEnabled && ' (명령 시스템 통합)'}
        </small>
      </div>
    </div>
  );
};

export default LibraryPanelModern;
