/**
 * InspectorPanel Modern - 새 아키텍처와 통합된 인스펙터 패널
 * 
 * 주요 특징:
 * - 서비스 레지스트리 통합
 * - 명령 시스템을 통한 속성 변경
 * - 실시간 씬 하이어라키
 * - 플러그인 기반 속성 에디터
 */

import React, { useState, useEffect, useRef } from 'react';
import { app } from '../../../core/ApplicationBootstrap.js';
import { eventBus, EventTypes } from '../../../core/EventBus.js';
import SceneHierarchyPanelModern from './SceneHierarchyPanel.Modern.jsx';
import './InspectorPanel.css';

const InspectorPanelModern = ({ 
  isVisible = true,
  onClose = null,
  isNewArchitectureEnabled = false 
}) => {
  const [activeTab, setActiveTab] = useState('hierarchy');
  const [selectedObject, setSelectedObject] = useState(null);
  const [objectProperties, setObjectProperties] = useState({});
  const [services, setServices] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);

  // 서비스 초기화
  useEffect(() => {
    if (!isNewArchitectureEnabled) return;

    const checkServices = () => {
      if (app.isInitialized) {
        const serviceRegistry = app.serviceRegistry;
        const selectionService = serviceRegistry.get('selectionService');
        const objectManagementService = serviceRegistry.get('objectManagement');
        const sceneService = serviceRegistry.get('sceneService');
        const commandManager = app.commandManager;
        
        setServices({
          serviceRegistry,
          selectionService,
          objectManagementService,
          sceneService,
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

  // 선택된 객체 이벤트 리스너
  useEffect(() => {
    if (!services.selectionService) return;

    const handleObjectSelected = (event) => {
      const { object } = event.detail;
      setSelectedObject(object);
      updateObjectProperties(object);
    };

    const handleObjectDeselected = () => {
      setSelectedObject(null);
      setObjectProperties({});
    };

    eventBus.on(EventTypes.OBJECT_SELECTED, handleObjectSelected);
    eventBus.on(EventTypes.OBJECT_DESELECTED, handleObjectDeselected);

    return () => {
      eventBus.off(EventTypes.OBJECT_SELECTED, handleObjectSelected);
      eventBus.off(EventTypes.OBJECT_DESELECTED, handleObjectDeselected);
    };
  }, [services.selectionService]);

  // 객체 속성 업데이트
  const updateObjectProperties = (object) => {
    if (!object) return;

    const properties = {
      position: { x: object.position.x, y: object.position.y, z: object.position.z },
      rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
      scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z },
      visible: object.visible,
      name: object.name || 'Untitled',
      type: object.type || 'Object3D'
    };

    setObjectProperties(properties);
  };

  // 속성 변경 처리 (명령 시스템 통합)
  const handlePropertyChange = async (property, value) => {
    if (!selectedObject || !services.commandManager || isUpdating) return;

    setIsUpdating(true);
    try {
      await services.commandManager.executeCommand('updateObjectProperty', {
        object: selectedObject,
        property,
        value,
        previousValue: objectProperties[property]
      });
    } catch (error) {
      console.error('❌ Failed to update object property:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // 벡터 속성 변경 처리
  const handleVectorPropertyChange = async (property, axis, value) => {
    if (!selectedObject || !services.commandManager || isUpdating) return;

    const numValue = parseFloat(value) || 0;
    const newVector = { ...objectProperties[property], [axis]: numValue };

    setIsUpdating(true);
    try {
      await services.commandManager.executeCommand('updateObjectVectorProperty', {
        object: selectedObject,
        property,
        value: newVector,
        previousValue: objectProperties[property]
      });
    } catch (error) {
      console.error('❌ Failed to update object vector property:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // 벡터 입력 컴포넌트
  const VectorInput = ({ label, property, min, max, step = 0.01 }) => {
    const value = objectProperties[property] || { x: 0, y: 0, z: 0 };
    
    return (
      <div className="vector-input">
        <label>{label}</label>
        <div className="vector-controls">
          {['x', 'y', 'z'].map(axis => (
            <div key={axis} className="axis-control">
              <span className={`axis-label ${axis}`}>{axis.toUpperCase()}</span>
              <input
                type="number"
                value={value[axis]?.toFixed(3) || '0.000'}
                onChange={(e) => handleVectorPropertyChange(property, axis, e.target.value)}
                min={min}
                max={max}
                step={step}
                disabled={isUpdating}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 속성 패널 렌더링
  const renderPropertiesPanel = () => {
    if (!selectedObject) {
      return (
        <div className="no-selection">
          <p>객체를 선택하여 속성을 편집하세요</p>
        </div>
      );
    }

    return (
      <div className="properties-panel">
        <div className="object-info">
          <h4>{objectProperties.name}</h4>
          <span className="object-type">{objectProperties.type}</span>
        </div>

        <div className="properties-sections">
          {/* Transform 섹션 */}
          <div className="property-section">
            <h5>Transform</h5>
            <VectorInput label="Position" property="position" />
            <VectorInput label="Rotation" property="rotation" min={-Math.PI} max={Math.PI} />
            <VectorInput label="Scale" property="scale" min={0} max={10} />
          </div>

          {/* 기본 속성 섹션 */}
          <div className="property-section">
            <h5>Properties</h5>
            <div className="property-row">
              <label>Name</label>
              <input
                type="text"
                value={objectProperties.name || ''}
                onChange={(e) => handlePropertyChange('name', e.target.value)}
                disabled={isUpdating}
              />
            </div>
            <div className="property-row">
              <label>Visible</label>
              <input
                type="checkbox"
                checked={objectProperties.visible || false}
                onChange={(e) => handlePropertyChange('visible', e.target.checked)}
                disabled={isUpdating}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <div className="inspector-panel modern-inspector-panel">
      {/* 헤더 */}
      <div className="panel-header">
        <h3>🔍 Inspector</h3>
        <div className="header-actions">
          {isNewArchitectureEnabled && (
            <div className="architecture-indicator">
              <span className="modern-badge">Modern</span>
            </div>
          )}
          {onClose && (
            <button className="close-button" onClick={onClose}>×</button>
          )}
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="panel-tabs">
        <button
          className={`tab-button ${activeTab === 'hierarchy' ? 'active' : ''}`}
          onClick={() => setActiveTab('hierarchy')}
        >
          Hierarchy
        </button>
        <button
          className={`tab-button ${activeTab === 'properties' ? 'active' : ''}`}
          onClick={() => setActiveTab('properties')}
        >
          Properties
        </button>
      </div>

      {/* 탭 내용 */}
      <div className="tab-content">
        {activeTab === 'hierarchy' && (
          <SceneHierarchyPanelModern 
            isNewArchitectureEnabled={isNewArchitectureEnabled}
          />
        )}
        {activeTab === 'properties' && renderPropertiesPanel()}
      </div>
    </div>
  );
};

export default InspectorPanelModern;
