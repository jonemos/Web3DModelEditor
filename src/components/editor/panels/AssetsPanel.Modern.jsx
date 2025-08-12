/**
 * AssetsPanel Modern - 새 아키텍처와 통합된 에셋 패널
 * 
 * 주요 특징:
 * - 플러그인을 통한 동적 에셋 등록
 * - 명령 시스템을 통한 에셋 배치
 * - 드래그 앤 드롭 지원
 * - 에셋 카테고리화
 */

import React, { useState, useEffect } from 'react';
import { app } from '../../../core/ApplicationBootstrap.js';
import { eventBus, EventTypes } from '../../../core/EventBus.js';
import './AssetsPanel.css';

const AssetsPanelModern = ({ 
  isVisible = true,
  onClose = null,
  isNewArchitectureEnabled = false 
}) => {
  const [selectedCategory, setSelectedCategory] = useState('primitives');
  const [assets, setAssets] = useState({});
  const [services, setServices] = useState({});

  // 기본 에셋 정의
  const defaultAssets = {
    primitives: [
      {
        id: 'cube',
        name: '정육면체',
        type: 'primitive',
        category: 'primitives',
        description: '기본 정육면체',
        icon: '🧊',
        parameters: { width: 1, height: 1, depth: 1 }
      },
      {
        id: 'sphere',
        name: '구체',
        type: 'primitive',
        category: 'primitives',
        description: '기본 구체',
        icon: '⚪',
        parameters: { radius: 0.5, segments: 32 }
      },
      {
        id: 'plane',
        name: '평면',
        type: 'primitive',
        category: 'primitives',
        description: '기본 평면',
        icon: '▭',
        parameters: { width: 2, height: 2 }
      },
      {
        id: 'cylinder',
        name: '원기둥',
        type: 'primitive',
        category: 'primitives',
        description: '기본 원기둥',
        icon: '🥫',
        parameters: { radiusTop: 0.5, radiusBottom: 0.5, height: 1 }
      }
    ],
    lights: [
      {
        id: 'point_light',
        name: '포인트 라이트',
        type: 'light',
        category: 'lights',
        description: '점 조명',
        icon: '💡',
        parameters: { color: 0xffffff, intensity: 1, distance: 0 }
      },
      {
        id: 'directional_light',
        name: '디렉셔널 라이트',
        type: 'light',
        category: 'lights',
        description: '방향성 조명',
        icon: '☀️',
        parameters: { color: 0xffffff, intensity: 1 }
      },
      {
        id: 'spot_light',
        name: '스포트 라이트',
        type: 'light',
        category: 'lights',
        description: '스포트 조명',
        icon: '🔦',
        parameters: { color: 0xffffff, intensity: 1, distance: 0, angle: Math.PI / 3 }
      },
      {
        id: 'ambient_light',
        name: '앰비언트 라이트',
        type: 'light',
        category: 'lights',
        description: '환경 조명',
        icon: '🌕',
        parameters: { color: 0x404040, intensity: 0.5 }
      }
    ],
    helpers: [
      {
        id: 'axes_helper',
        name: '축 헬퍼',
        type: 'helper',
        category: 'helpers',
        description: 'XYZ 축 표시',
        icon: '📐',
        parameters: { size: 1 }
      },
      {
        id: 'grid_helper',
        name: '그리드 헬퍼',
        type: 'helper',
        category: 'helpers',
        description: '그리드 표시',
        icon: '▦',
        parameters: { size: 10, divisions: 10 }
      },
      {
        id: 'box_helper',
        name: '박스 헬퍼',
        type: 'helper',
        category: 'helpers',
        description: '바운딩 박스 표시',
        icon: '⬜',
        parameters: {}
      }
    ],
    gameplay: [
      {
        id: 'start_position',
        name: '스타트 위치',
        type: 'gameplay',
        category: 'gameplay',
        description: '플레이어 시작 위치',
        icon: '🎯',
        parameters: {}
      },
      {
        id: 'checkpoint',
        name: '체크포인트',
        type: 'gameplay',
        category: 'gameplay',
        description: '게임 체크포인트',
        icon: '🏁',
        parameters: {}
      },
      {
        id: 'spawn_point',
        name: '스폰 포인트',
        type: 'gameplay',
        category: 'gameplay',
        description: '객체 스폰 위치',
        icon: '📍',
        parameters: {}
      }
    ]
  };

  // 서비스 초기화
  useEffect(() => {
    if (!isNewArchitectureEnabled) return;

    const checkServices = () => {
      if (app.isInitialized) {
        const serviceRegistry = app.serviceRegistry;
        const commandManager = app.commandManager;
        
        setServices({
          serviceRegistry,
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

  // 에셋 목록 초기화
  useEffect(() => {
    setAssets(defaultAssets);

    // 플러그인에서 등록한 에셋들 로드
    if (isNewArchitectureEnabled && services.serviceRegistry) {
      loadPluginAssets();
    }

    // 에셋 등록 이벤트 리스너
    const handleAssetRegistered = (event) => {
      const { category, asset } = event.detail;
      setAssets(prev => ({
        ...prev,
        [category]: [...(prev[category] || []), asset]
      }));
    };

    eventBus.on(EventTypes.ASSET_REGISTERED, handleAssetRegistered);

    return () => {
      eventBus.off(EventTypes.ASSET_REGISTERED, handleAssetRegistered);
    };
  }, [isNewArchitectureEnabled, services.serviceRegistry]);

  // 플러그인 에셋 로드
  const loadPluginAssets = () => {
    // 각 플러그인에서 제공하는 에셋들을 가져옴
    if (app.pluginSystem) {
      app.pluginSystem.plugins.forEach((plugin, pluginName) => {
        if (plugin.getAssets && typeof plugin.getAssets === 'function') {
          try {
            const pluginAssets = plugin.getAssets();
            Object.entries(pluginAssets).forEach(([category, categoryAssets]) => {
              setAssets(prev => ({
                ...prev,
                [category]: [...(prev[category] || []), ...categoryAssets]
              }));
            });
          } catch (error) {
            console.error(`❌ Failed to load assets from plugin ${pluginName}:`, error);
          }
        }
      });
    }
  };

  // 에셋 배치 처리
  const handleAssetPlace = async (asset, position = { x: 0, y: 0, z: 0 }) => {
    if (!services.commandManager) {
      console.warn('CommandManager not available, falling back to legacy mode');
      return;
    }

    try {
      await services.commandManager.executeCommand('placeAsset', {
        assetType: asset.type,
        assetId: asset.id,
        parameters: asset.parameters,
        position
      });
    } catch (error) {
      console.error('❌ Failed to place asset:', error);
    }
  };

  // 드래그 시작 처리
  const handleDragStart = (e, asset) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'asset',
      asset
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // 에셋 카드 렌더링
  const renderAssetCard = (asset) => (
    <div
      key={asset.id}
      className="asset-card modern-asset-card"
      draggable={true}
      onDragStart={(e) => handleDragStart(e, asset)}
      onClick={() => handleAssetPlace(asset)}
      title={asset.description}
    >
      <div className="asset-icon">
        {asset.icon}
      </div>
      <div className="asset-info">
        <div className="asset-name">{asset.name}</div>
        <div className="asset-type">{asset.type}</div>
      </div>
      {isNewArchitectureEnabled && (
        <div className="modern-indicator">🚀</div>
      )}
    </div>
  );

  // 카테고리 탭 렌더링
  const renderCategoryTabs = () => (
    <div className="category-tabs">
      {Object.keys(assets).map(category => (
        <button
          key={category}
          className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
          onClick={() => setSelectedCategory(category)}
        >
          {category.charAt(0).toUpperCase() + category.slice(1)}
          <span className="asset-count">({assets[category]?.length || 0})</span>
        </button>
      ))}
    </div>
  );

  if (!isVisible) return null;

  const currentAssets = assets[selectedCategory] || [];

  return (
    <div className="assets-panel modern-assets-panel">
      {/* 헤더 */}
      <div className="panel-header">
        <h3>🎨 Assets</h3>
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

      {/* 카테고리 탭 */}
      {renderCategoryTabs()}

      {/* 에셋 그리드 */}
      <div className="assets-grid">
        {currentAssets.length === 0 ? (
          <div className="empty-category">
            <p>이 카테고리에 에셋이 없습니다</p>
            <small>플러그인을 통해 에셋을 추가할 수 있습니다</small>
          </div>
        ) : (
          currentAssets.map(renderAssetCard)
        )}
      </div>

      {/* 도움말 */}
      <div className="assets-help">
        <small>
          💡 에셋을 클릭하여 배치하거나 드래그하여 원하는 위치에 놓으세요
          {isNewArchitectureEnabled && ' (명령 시스템 통합)'}
        </small>
      </div>
    </div>
  );
};

export default AssetsPanelModern;
