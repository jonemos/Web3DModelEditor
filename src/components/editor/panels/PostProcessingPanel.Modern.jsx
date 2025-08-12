/**
 * PostProcessingPanel Modern - 새 아키텍처와 통합된 포스트 프로세싱 패널
 * 
 * 주요 특징:
 * - 플러그인 기반 포스트 프로세싱 효과
 * - 명령 시스템을 통한 설정 변경
 * - 실시간 프리뷰
 * - 프리셋 관리
 */

import React, { useState, useEffect } from 'react';
import { app } from '../../../core/ApplicationBootstrap.js';
import { eventBus, EventTypes } from '../../../core/EventBus.js';
import './PostProcessingPanel.css';

const PostProcessingPanelModern = ({ 
  isVisible = true,
  onClose = null,
  isNewArchitectureEnabled = false 
}) => {
  const [effectsEnabled, setEffectsEnabled] = useState(false);
  const [availableEffects, setAvailableEffects] = useState([]);
  const [activeEffects, setActiveEffects] = useState(new Set());
  const [effectSettings, setEffectSettings] = useState({});
  const [presets, setPresets] = useState([]);
  const [services, setServices] = useState({});

  // 기본 효과 정의
  const defaultEffects = [
    {
      id: 'bloom',
      name: 'Bloom',
      description: '밝은 영역에 글로우 효과',
      category: 'lighting',
      parameters: {
        strength: { value: 1.0, min: 0, max: 3, step: 0.1 },
        radius: { value: 0.4, min: 0, max: 1, step: 0.01 },
        threshold: { value: 0.85, min: 0, max: 1, step: 0.01 }
      }
    },
    {
      id: 'ssao',
      name: 'SSAO',
      description: '스크린 스페이스 앰비언트 오클루전',
      category: 'lighting',
      parameters: {
        intensity: { value: 0.5, min: 0, max: 2, step: 0.1 },
        radius: { value: 0.1, min: 0, max: 1, step: 0.01 },
        bias: { value: 0.025, min: 0, max: 0.1, step: 0.001 }
      }
    },
    {
      id: 'fxaa',
      name: 'FXAA',
      description: 'Fast Approximate Anti-Aliasing',
      category: 'quality',
      parameters: {}
    },
    {
      id: 'smaa',
      name: 'SMAA',
      description: 'Subpixel Morphological Anti-Aliasing',
      category: 'quality',
      parameters: {
        preset: { value: 'high', options: ['low', 'medium', 'high', 'ultra'] }
      }
    },
    {
      id: 'tonemap',
      name: 'Tone Mapping',
      description: '톤 매핑',
      category: 'color',
      parameters: {
        type: { value: 'aces', options: ['linear', 'reinhard', 'cineon', 'aces'] },
        exposure: { value: 1.0, min: 0, max: 3, step: 0.1 }
      }
    },
    {
      id: 'colorCorrection',
      name: 'Color Correction',
      description: '색상 보정',
      category: 'color',
      parameters: {
        brightness: { value: 0, min: -1, max: 1, step: 0.01 },
        contrast: { value: 0, min: -1, max: 1, step: 0.01 },
        saturation: { value: 0, min: -1, max: 1, step: 0.01 }
      }
    }
  ];

  // 기본 프리셋
  const defaultPresets = [
    {
      id: 'realistic',
      name: '사실적',
      description: '사실적인 렌더링',
      effects: ['fxaa', 'ssao', 'tonemap'],
      settings: {
        ssao: { intensity: 0.3, radius: 0.05 },
        tonemap: { type: 'aces', exposure: 1.0 }
      }
    },
    {
      id: 'cinematic',
      name: '영화적',
      description: '영화 같은 느낌',
      effects: ['bloom', 'smaa', 'tonemap', 'colorCorrection'],
      settings: {
        bloom: { strength: 1.2, threshold: 0.8 },
        tonemap: { type: 'cineon', exposure: 1.2 },
        colorCorrection: { contrast: 0.1, saturation: 0.05 }
      }
    },
    {
      id: 'performance',
      name: '성능 우선',
      description: '최적화된 설정',
      effects: ['fxaa'],
      settings: {}
    }
  ];

  // 서비스 초기화
  useEffect(() => {
    if (!isNewArchitectureEnabled) return;

    const checkServices = () => {
      if (app.isInitialized) {
        const serviceRegistry = app.serviceRegistry;
        const commandManager = app.commandManager;
        const renderingService = serviceRegistry.get('renderingService');
        
        setServices({
          serviceRegistry,
          commandManager,
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

  // 효과 목록 초기화
  useEffect(() => {
    setAvailableEffects(defaultEffects);
    setPresets(defaultPresets);

    // 초기 설정 로드
    defaultEffects.forEach(effect => {
      const defaultSettings = {};
      Object.entries(effect.parameters).forEach(([key, param]) => {
        defaultSettings[key] = param.value;
      });
      setEffectSettings(prev => ({
        ...prev,
        [effect.id]: defaultSettings
      }));
    });

    // 플러그인 효과 로드
    if (isNewArchitectureEnabled && services.renderingService) {
      loadPluginEffects();
    }
  }, [isNewArchitectureEnabled, services.renderingService]);

  // 플러그인 효과 로드
  const loadPluginEffects = () => {
    if (app.pluginSystem) {
      app.pluginSystem.plugins.forEach((plugin, pluginName) => {
        if (plugin.getPostProcessingEffects && typeof plugin.getPostProcessingEffects === 'function') {
          try {
            const pluginEffects = plugin.getPostProcessingEffects();
            setAvailableEffects(prev => [...prev, ...pluginEffects]);
          } catch (error) {
            console.error(`❌ Failed to load effects from plugin ${pluginName}:`, error);
          }
        }
      });
    }
  };

  // 포스트 프로세싱 활성화/비활성화
  const togglePostProcessing = async () => {
    if (!services.commandManager) return;

    try {
      await services.commandManager.executeCommand('togglePostProcessing', {
        enabled: !effectsEnabled
      });
      setEffectsEnabled(!effectsEnabled);
    } catch (error) {
      console.error('❌ Failed to toggle post processing:', error);
    }
  };

  // 효과 토글
  const toggleEffect = async (effectId) => {
    if (!services.commandManager) return;

    const newActiveEffects = new Set(activeEffects);
    const isActive = newActiveEffects.has(effectId);

    try {
      if (isActive) {
        await services.commandManager.executeCommand('disablePostProcessingEffect', {
          effectId
        });
        newActiveEffects.delete(effectId);
      } else {
        await services.commandManager.executeCommand('enablePostProcessingEffect', {
          effectId,
          settings: effectSettings[effectId] || {}
        });
        newActiveEffects.add(effectId);
      }
      setActiveEffects(newActiveEffects);
    } catch (error) {
      console.error('❌ Failed to toggle effect:', error);
    }
  };

  // 효과 설정 변경
  const updateEffectSetting = async (effectId, parameter, value) => {
    if (!services.commandManager) return;

    const newSettings = {
      ...effectSettings[effectId],
      [parameter]: value
    };

    try {
      await services.commandManager.executeCommand('updatePostProcessingEffect', {
        effectId,
        settings: newSettings
      });

      setEffectSettings(prev => ({
        ...prev,
        [effectId]: newSettings
      }));
    } catch (error) {
      console.error('❌ Failed to update effect setting:', error);
    }
  };

  // 프리셋 적용
  const applyPreset = async (preset) => {
    if (!services.commandManager) return;

    try {
      await services.commandManager.executeCommand('applyPostProcessingPreset', {
        presetId: preset.id,
        effects: preset.effects,
        settings: preset.settings
      });

      // UI 상태 업데이트
      setActiveEffects(new Set(preset.effects));
      setEffectSettings(prev => ({
        ...prev,
        ...preset.settings
      }));
    } catch (error) {
      console.error('❌ Failed to apply preset:', error);
    }
  };

  // 파라미터 입력 컴포넌트
  const ParameterInput = ({ effectId, paramKey, param, value }) => {
    if (param.options) {
      // 드롭다운
      return (
        <select
          value={value || param.value}
          onChange={(e) => updateEffectSetting(effectId, paramKey, e.target.value)}
        >
          {param.options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    } else if (typeof param.value === 'number') {
      // 숫자 슬라이더
      return (
        <div className="parameter-slider">
          <input
            type="range"
            min={param.min}
            max={param.max}
            step={param.step}
            value={value || param.value}
            onChange={(e) => updateEffectSetting(effectId, paramKey, parseFloat(e.target.value))}
          />
          <span className="parameter-value">
            {(value || param.value).toFixed(param.step < 0.01 ? 3 : 2)}
          </span>
        </div>
      );
    } else {
      // 텍스트 입력
      return (
        <input
          type="text"
          value={value || param.value}
          onChange={(e) => updateEffectSetting(effectId, paramKey, e.target.value)}
        />
      );
    }
  };

  // 효과 카드 렌더링
  const renderEffectCard = (effect) => {
    const isActive = activeEffects.has(effect.id);
    const settings = effectSettings[effect.id] || {};

    return (
      <div key={effect.id} className={`effect-card ${isActive ? 'active' : ''}`}>
        <div className="effect-header">
          <div className="effect-info">
            <h4>{effect.name}</h4>
            <p>{effect.description}</p>
            <span className="effect-category">{effect.category}</span>
          </div>
          <label className="effect-toggle">
            <input
              type="checkbox"
              checked={isActive}
              onChange={() => toggleEffect(effect.id)}
              disabled={!effectsEnabled}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {/* 파라미터 설정 */}
        {isActive && Object.keys(effect.parameters).length > 0 && (
          <div className="effect-parameters">
            {Object.entries(effect.parameters).map(([paramKey, param]) => (
              <div key={paramKey} className="parameter-group">
                <label>{paramKey}</label>
                <ParameterInput
                  effectId={effect.id}
                  paramKey={paramKey}
                  param={param}
                  value={settings[paramKey]}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <div className="postprocessing-panel modern-postprocessing-panel">
      {/* 헤더 */}
      <div className="panel-header">
        <h3>✨ Post Processing</h3>
        <div className="header-actions">
          <label className="master-toggle">
            <input
              type="checkbox"
              checked={effectsEnabled}
              onChange={togglePostProcessing}
            />
            <span className="toggle-slider"></span>
          </label>
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

      {/* 프리셋 섹션 */}
      <div className="presets-section">
        <h4>프리셋</h4>
        <div className="preset-buttons">
          {presets.map(preset => (
            <button
              key={preset.id}
              className="preset-button"
              onClick={() => applyPreset(preset)}
              disabled={!effectsEnabled}
              title={preset.description}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* 효과 목록 */}
      <div className="effects-section">
        <h4>효과</h4>
        <div className="effects-list">
          {availableEffects.map(renderEffectCard)}
        </div>
      </div>

      {/* 도움말 */}
      <div className="postprocessing-help">
        <small>
          💡 포스트 프로세싱 효과는 렌더링 성능에 영향을 줄 수 있습니다
          {isNewArchitectureEnabled && ' (명령 시스템 통합)'}
        </small>
      </div>
    </div>
  );
};

export default PostProcessingPanelModern;
