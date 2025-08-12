/**
 * HDRIPanel Modern - 새 아키텍처와 통합된 HDRI 패널
 * 
 * 주요 특징:
 * - 환경 맵 관리
 * - 명령 시스템을 통한 HDRI 적용
 * - 실시간 프리뷰
 * - 환경 설정 조절
 */

import React, { useState, useEffect } from 'react';
import { app } from '../../../core/ApplicationBootstrap.js';
import { eventBus, EventTypes } from '../../../core/EventBus.js';
import './HDRIPanel.css';

const HDRIPanelModern = ({ 
  isVisible = true,
  onClose = null,
  isNewArchitectureEnabled = false 
}) => {
  const [availableHDRIs, setAvailableHDRIs] = useState([]);
  const [currentHDRI, setCurrentHDRI] = useState(null);
  const [environmentSettings, setEnvironmentSettings] = useState({
    intensity: 1.0,
    rotation: 0,
    blur: 0,
    backgroundVisible: true,
    backgroundIntensity: 1.0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [services, setServices] = useState({});

  // 기본 HDRI 목록
  const defaultHDRIs = [
    {
      id: 'studio',
      name: 'Studio',
      description: '스튜디오 조명',
      url: '/hdr/studio.hdr',
      thumbnail: '/hdr/thumbnails/studio.jpg',
      category: 'studio'
    },
    {
      id: 'outdoor',
      name: 'Outdoor',
      description: '야외 환경',
      url: '/hdr/outdoor.hdr',
      thumbnail: '/hdr/thumbnails/outdoor.jpg',
      category: 'outdoor'
    },
    {
      id: 'sunny_country_road',
      name: 'Sunny Country Road',
      description: '햇살 좋은 시골길',
      url: '/hdr/sunny_country_road_2k.hdr',
      thumbnail: '/hdr/thumbnails/sunny_country_road.jpg',
      category: 'outdoor'
    },
    {
      id: 'none',
      name: 'None',
      description: '환경 맵 없음',
      url: null,
      thumbnail: null,
      category: 'basic'
    }
  ];

  // 서비스 초기화
  useEffect(() => {
    if (!isNewArchitectureEnabled) return;

    const checkServices = () => {
      if (app.isInitialized) {
        const serviceRegistry = app.serviceRegistry;
        const commandManager = app.commandManager;
        const sceneService = serviceRegistry.get('sceneService');
        const renderingService = serviceRegistry.get('renderingService');
        
        setServices({
          serviceRegistry,
          commandManager,
          sceneService,
          renderingService
        });
      }
    };

    checkServices();
    eventBus.on(EventTypes.APP_INITIALIZED, checkServices);

    return () => {
      eventBus.off(EventTypes.APP_INITIALIZED, checkServices);
    };
  }, [isNewArchitectureEnabled]);

  // HDRI 목록 초기화
  useEffect(() => {
    setAvailableHDRIs(defaultHDRIs);
    
    // 플러그인에서 추가 HDRI 로드
    if (isNewArchitectureEnabled && services.sceneService) {
      loadPluginHDRIs();
    }
  }, [isNewArchitectureEnabled, services.sceneService]);

  // 플러그인 HDRI 로드
  const loadPluginHDRIs = () => {
    if (app.pluginSystem) {
      app.pluginSystem.plugins.forEach((plugin, pluginName) => {
        if (plugin.getHDRIs && typeof plugin.getHDRIs === 'function') {
          try {
            const pluginHDRIs = plugin.getHDRIs();
            setAvailableHDRIs(prev => [...prev, ...pluginHDRIs]);
          } catch (error) {
            console.error(`❌ Failed to load HDRIs from plugin ${pluginName}:`, error);
          }
        }
      });
    }
  };

  // HDRI 적용
  const applyHDRI = async (hdri) => {
    if (!services.commandManager) return;

    setIsLoading(true);
    try {
      await services.commandManager.executeCommand('setEnvironmentMap', {
        hdriId: hdri.id,
        url: hdri.url,
        settings: environmentSettings
      });
      
      setCurrentHDRI(hdri);
      console.log('✅ HDRI applied:', hdri.name);
    } catch (error) {
      console.error('❌ Failed to apply HDRI:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 환경 설정 업데이트
  const updateEnvironmentSetting = async (setting, value) => {
    if (!services.commandManager || !currentHDRI) return;

    const newSettings = {
      ...environmentSettings,
      [setting]: value
    };

    try {
      await services.commandManager.executeCommand('updateEnvironmentSettings', {
        hdriId: currentHDRI.id,
        settings: newSettings
      });
      
      setEnvironmentSettings(newSettings);
    } catch (error) {
      console.error('❌ Failed to update environment setting:', error);
    }
  };

  // HDRI 카드 렌더링
  const renderHDRICard = (hdri) => {
    const isActive = currentHDRI?.id === hdri.id;
    
    return (
      <div
        key={hdri.id}
        className={`hdri-card ${isActive ? 'active' : ''}`}
        onClick={() => applyHDRI(hdri)}
      >
        <div className="hdri-thumbnail">
          {hdri.thumbnail ? (
            <img 
              src={hdri.thumbnail} 
              alt={hdri.name}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className="hdri-placeholder"
            style={{ display: hdri.thumbnail ? 'none' : 'flex' }}
          >
            {hdri.id === 'none' ? '🚫' : '🌅'}
          </div>
        </div>
        
        <div className="hdri-info">
          <h4>{hdri.name}</h4>
          <p>{hdri.description}</p>
          <span className="hdri-category">{hdri.category}</span>
        </div>
        
        {isActive && (
          <div className="active-indicator">✓</div>
        )}
      </div>
    );
  };

  // 환경 설정 패널 렌더링
  const renderEnvironmentSettings = () => {
    if (!currentHDRI || currentHDRI.id === 'none') return null;

    return (
      <div className="environment-settings">
        <h4>환경 설정</h4>
        
        <div className="setting-group">
          <label>강도 (Intensity)</label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={environmentSettings.intensity}
              onChange={(e) => updateEnvironmentSetting('intensity', parseFloat(e.target.value))}
            />
            <span className="slider-value">{environmentSettings.intensity.toFixed(1)}</span>
          </div>
        </div>

        <div className="setting-group">
          <label>회전 (Rotation)</label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={(environmentSettings.rotation * 180 / Math.PI) % 360}
              onChange={(e) => updateEnvironmentSetting('rotation', parseFloat(e.target.value) * Math.PI / 180)}
            />
            <span className="slider-value">{Math.round((environmentSettings.rotation * 180 / Math.PI) % 360)}°</span>
          </div>
        </div>

        <div className="setting-group">
          <label>블러 (Blur)</label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={environmentSettings.blur}
              onChange={(e) => updateEnvironmentSetting('blur', parseFloat(e.target.value))}
            />
            <span className="slider-value">{environmentSettings.blur.toFixed(2)}</span>
          </div>
        </div>

        <div className="setting-group">
          <label>
            <input
              type="checkbox"
              checked={environmentSettings.backgroundVisible}
              onChange={(e) => updateEnvironmentSetting('backgroundVisible', e.target.checked)}
            />
            배경으로 표시
          </label>
        </div>

        {environmentSettings.backgroundVisible && (
          <div className="setting-group">
            <label>배경 강도</label>
            <div className="slider-container">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={environmentSettings.backgroundIntensity}
                onChange={(e) => updateEnvironmentSetting('backgroundIntensity', parseFloat(e.target.value))}
              />
              <span className="slider-value">{environmentSettings.backgroundIntensity.toFixed(1)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 카테고리별 그룹화
  const groupedHDRIs = availableHDRIs.reduce((groups, hdri) => {
    const category = hdri.category || 'other';
    if (!groups[category]) groups[category] = [];
    groups[category].push(hdri);
    return groups;
  }, {});

  if (!isVisible) return null;

  return (
    <div className="hdri-panel modern-hdri-panel">
      {/* 헤더 */}
      <div className="panel-header">
        <h3>🌅 HDRI Environment</h3>
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

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">⏳</div>
          <p>HDRI 로딩 중...</p>
        </div>
      )}

      {/* HDRI 목록 */}
      <div className="hdri-sections">
        {Object.entries(groupedHDRIs).map(([category, hdris]) => (
          <div key={category} className="hdri-category">
            <h4 className="category-title">
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </h4>
            <div className="hdri-grid">
              {hdris.map(renderHDRICard)}
            </div>
          </div>
        ))}
      </div>

      {/* 환경 설정 */}
      {renderEnvironmentSettings()}

      {/* 도움말 */}
      <div className="hdri-help">
        <small>
          💡 HDRI는 환경 조명과 반사를 제공합니다
          {isNewArchitectureEnabled && ' (명령 시스템 통합)'}
        </small>
      </div>
    </div>
  );
};

export default HDRIPanelModern;
