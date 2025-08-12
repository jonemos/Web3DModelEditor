/**
 * SceneHierarchyPanel Modern - 새 아키텍처와 통합된 씬 하이어라키 패널
 * 
 * 주요 특징:
 * - 서비스 레지스트리 통합
 * - 실시간 씬 구조 반영
 * - 명령 시스템을 통한 객체 조작
 * - 드래그 앤 드롭 재정렬
 */

import React, { useState, useEffect, useRef } from 'react';
import { app } from '../../../core/ApplicationBootstrap.js';
import { eventBus, EventTypes } from '../../../core/EventBus.js';
import './SceneHierarchyPanel.css';

const SceneHierarchyPanelModern = ({ 
  isNewArchitectureEnabled = false 
}) => {
  const [sceneObjects, setSceneObjects] = useState([]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [expandedObjects, setExpandedObjects] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [services, setServices] = useState({});
  const inputRef = useRef(null);

  // 서비스 초기화
  useEffect(() => {
    if (!isNewArchitectureEnabled) return;

    const checkServices = () => {
      if (app.isInitialized) {
        const serviceRegistry = app.serviceRegistry;
        const sceneService = serviceRegistry.get('sceneService');
        const selectionService = serviceRegistry.get('selectionService');
        const objectManagementService = serviceRegistry.get('objectManagement');
        const commandManager = app.commandManager;
        
        setServices({
          serviceRegistry,
          sceneService,
          selectionService,
          objectManagementService,
          commandManager
        });
      }
    };

    checkServices();
    eventBus.on(EventTypes.APP_INITIALIZED, checkServices);

    return () => {
      eventBus.off(EventTypes.APP_INITIALIZED, checkServices);
    };
  }, [isNewArchitectureEnabled]);

  // 씬 객체 목록 업데이트
  useEffect(() => {
    if (!services.sceneService) return;

    const updateSceneObjects = () => {
      try {
        const objects = services.sceneService.getAllObjects();
        const hierarchyData = buildHierarchy(objects);
        setSceneObjects(hierarchyData);
      } catch (error) {
        console.error('❌ Failed to update scene objects:', error);
      }
    };

    // 초기 로드
    updateSceneObjects();

    // 이벤트 리스너
    const handleObjectAdded = () => updateSceneObjects();
    const handleObjectRemoved = () => updateSceneObjects();
    const handleObjectUpdated = () => updateSceneObjects();

    eventBus.on(EventTypes.OBJECT_ADDED, handleObjectAdded);
    eventBus.on(EventTypes.OBJECT_REMOVED, handleObjectRemoved);
    eventBus.on(EventTypes.OBJECT_UPDATED, handleObjectUpdated);

    return () => {
      eventBus.off(EventTypes.OBJECT_ADDED, handleObjectAdded);
      eventBus.off(EventTypes.OBJECT_REMOVED, handleObjectRemoved);
      eventBus.off(EventTypes.OBJECT_UPDATED, handleObjectUpdated);
    };
  }, [services.sceneService]);

  // 선택된 객체 동기화
  useEffect(() => {
    if (!services.selectionService) return;

    const handleObjectSelected = (event) => {
      const { object } = event.detail;
      setSelectedObjectId(object?.uuid || null);
    };

    const handleObjectDeselected = () => {
      setSelectedObjectId(null);
    };

    eventBus.on(EventTypes.OBJECT_SELECTED, handleObjectSelected);
    eventBus.on(EventTypes.OBJECT_DESELECTED, handleObjectDeselected);

    return () => {
      eventBus.off(EventTypes.OBJECT_SELECTED, handleObjectSelected);
      eventBus.off(EventTypes.OBJECT_DESELECTED, handleObjectDeselected);
    };
  }, [services.selectionService]);

  // 하이어라키 구조 생성
  const buildHierarchy = (objects) => {
    const hierarchy = [];
    const objectMap = new Map();

    // 모든 객체를 맵에 저장
    objects.forEach(obj => {
      objectMap.set(obj.uuid, {
        ...obj,
        children: [],
        level: 0
      });
    });

    // 부모-자식 관계 설정
    objects.forEach(obj => {
      const objData = objectMap.get(obj.uuid);
      if (obj.parent && obj.parent.uuid && objectMap.has(obj.parent.uuid)) {
        const parent = objectMap.get(obj.parent.uuid);
        parent.children.push(objData);
        objData.level = parent.level + 1;
      } else {
        hierarchy.push(objData);
      }
    });

    return hierarchy;
  };

  // 객체 선택 처리
  const handleObjectSelect = async (objectId) => {
    if (!services.selectionService || !services.commandManager) return;

    try {
      await services.commandManager.executeCommand('selectObject', { objectId });
    } catch (error) {
      console.error('❌ Failed to select object:', error);
    }
  };

  // 객체 삭제 처리
  const handleObjectDelete = async (objectId) => {
    if (!services.commandManager) return;
    
    if (!confirm('정말로 이 객체를 삭제하시겠습니까?')) return;

    try {
      await services.commandManager.executeCommand('deleteObject', { objectId });
    } catch (error) {
      console.error('❌ Failed to delete object:', error);
    }
  };

  // 객체 가시성 토글
  const handleVisibilityToggle = async (objectId) => {
    if (!services.commandManager) return;

    try {
      await services.commandManager.executeCommand('toggleObjectVisibility', { objectId });
    } catch (error) {
      console.error('❌ Failed to toggle visibility:', error);
    }
  };

  // 객체 포커스 (카메라 이동)
  const handleObjectFocus = async (objectId) => {
    if (!services.commandManager) return;

    try {
      await services.commandManager.executeCommand('focusOnObject', { objectId });
    } catch (error) {
      console.error('❌ Failed to focus on object:', error);
    }
  };

  // 이름 편집 시작
  const startNameEdit = (obj) => {
    setEditingId(obj.uuid);
    setEditingName(obj.name || 'Untitled');
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  // 이름 편집 완료
  const finishNameEdit = async () => {
    if (!editingId || !services.commandManager) return;

    try {
      await services.commandManager.executeCommand('renameObject', {
        objectId: editingId,
        newName: editingName
      });
    } catch (error) {
      console.error('❌ Failed to rename object:', error);
    } finally {
      setEditingId(null);
      setEditingName('');
    }
  };

  // 이름 편집 취소
  const cancelNameEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  // 확장/축소 토글
  const toggleExpanded = (objectId) => {
    const newExpanded = new Set(expandedObjects);
    if (newExpanded.has(objectId)) {
      newExpanded.delete(objectId);
    } else {
      newExpanded.add(objectId);
    }
    setExpandedObjects(newExpanded);
  };

  // 객체 트리 아이템 렌더링
  const renderObjectItem = (obj, level = 0) => {
    const isSelected = selectedObjectId === obj.uuid;
    const isExpanded = expandedObjects.has(obj.uuid);
    const hasChildren = obj.children && obj.children.length > 0;
    const isEditing = editingId === obj.uuid;

    return (
      <div key={obj.uuid} className="hierarchy-item-container">
        <div 
          className={`hierarchy-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
        >
          {/* 확장/축소 버튼 */}
          <button
            className={`expand-button ${hasChildren ? 'visible' : 'hidden'}`}
            onClick={() => toggleExpanded(obj.uuid)}
          >
            {isExpanded ? '▼' : '▶'}
          </button>

          {/* 객체 아이콘 */}
          <span className="object-icon">
            {obj.type === 'Mesh' ? '🧊' : 
             obj.type === 'Group' ? '📁' : 
             obj.type === 'Light' ? '💡' : '🔲'}
          </span>

          {/* 객체 이름 */}
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={finishNameEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') finishNameEdit();
                if (e.key === 'Escape') cancelNameEdit();
              }}
              className="name-input"
            />
          ) : (
            <span
              className="object-name"
              onClick={() => handleObjectSelect(obj.uuid)}
              onDoubleClick={() => startNameEdit(obj)}
            >
              {obj.name || 'Untitled'}
            </span>
          )}

          {/* 액션 버튼들 */}
          <div className="object-actions">
            <button
              className={`visibility-button ${obj.visible ? 'visible' : 'hidden'}`}
              onClick={() => handleVisibilityToggle(obj.uuid)}
              title={obj.visible ? '숨기기' : '보이기'}
            >
              {obj.visible ? '👁️' : '🙈'}
            </button>
            <button
              className="focus-button"
              onClick={() => handleObjectFocus(obj.uuid)}
              title="포커스"
            >
              🎯
            </button>
            <button
              className="delete-button"
              onClick={() => handleObjectDelete(obj.uuid)}
              title="삭제"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* 자식 객체들 */}
        {hasChildren && isExpanded && (
          <div className="children-container">
            {obj.children.map(child => renderObjectItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="scene-hierarchy-panel modern-hierarchy-panel">
      {/* 헤더 */}
      <div className="hierarchy-header">
        <span>씬 객체 ({sceneObjects.length})</span>
        {isNewArchitectureEnabled && (
          <div className="modern-indicator">🚀</div>
        )}
      </div>

      {/* 객체 목록 */}
      <div className="hierarchy-list">
        {sceneObjects.length === 0 ? (
          <div className="empty-scene">
            <p>씬에 객체가 없습니다</p>
            <small>라이브러리에서 객체를 추가해보세요</small>
          </div>
        ) : (
          sceneObjects.map(obj => renderObjectItem(obj))
        )}
      </div>
    </div>
  );
};

export default SceneHierarchyPanelModern;
