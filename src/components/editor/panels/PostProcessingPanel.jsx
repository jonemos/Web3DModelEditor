/**
 * PostProcessingPanel - 포스트프로세싱 효과 제어 패널
 */
import React, { useState, useEffect } from 'react';
import './PostProcessingPanel.css';

const PostProcessingPanel = ({ postProcessingManager, onClose }) => {
  const [settings, setSettings] = useState({});
  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    if (postProcessingManager) {
      setSettings(postProcessingManager.getSettings());
    }
  }, [postProcessingManager]);

  const handleEffectToggle = (effectName) => {
    if (!postProcessingManager) return;

    const newEnabled = !settings[effectName]?.enabled;
    postProcessingManager.setEffectEnabled(effectName, newEnabled);
    
    setSettings(prev => ({
      ...prev,
      [effectName]: {
        ...prev[effectName],
        enabled: newEnabled
      }
    }));
  };

  const handleSettingChange = (effectName, settingName, value) => {
    if (!postProcessingManager) return;

    const newSettings = { [settingName]: value };
    postProcessingManager.updateEffectSettings(effectName, newSettings);
    
    setSettings(prev => ({
      ...prev,
      [effectName]: {
        ...prev[effectName],
        [settingName]: value
      }
    }));
  };

  const renderBasicEffects = () => (
    <div className="effect-group">
      <h3>기본 효과</h3>
      
      {/* Bloom */}
      <div className="effect-item">
        <div className="effect-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.bloom?.enabled || false}
              onChange={() => handleEffectToggle('bloom')}
            />
            Bloom (발광)
          </label>
        </div>
        {settings.bloom?.enabled && (
          <div className="effect-controls">
            <div className="control-row">
              <label>강도:</label>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={settings.bloom?.strength || 1.5}
                onChange={(e) => handleSettingChange('bloom', 'strength', parseFloat(e.target.value))}
              />
              <span>{settings.bloom?.strength || 1.5}</span>
            </div>
            <div className="control-row">
              <label>반경:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.bloom?.radius || 0.4}
                onChange={(e) => handleSettingChange('bloom', 'radius', parseFloat(e.target.value))}
              />
              <span>{settings.bloom?.radius || 0.4}</span>
            </div>
            <div className="control-row">
              <label>임계값:</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={settings.bloom?.threshold || 0.85}
                onChange={(e) => handleSettingChange('bloom', 'threshold', parseFloat(e.target.value))}
              />
              <span>{settings.bloom?.threshold || 0.85}</span>
            </div>
          </div>
        )}
      </div>

      {/* FXAA */}
      <div className="effect-item">
        <div className="effect-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.fxaa?.enabled || false}
              onChange={() => handleEffectToggle('fxaa')}
            />
            FXAA (안티앨리어싱)
          </label>
        </div>
      </div>

      {/* SSAO */}
      <div className="effect-item">
        <div className="effect-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.ssao?.enabled || false}
              onChange={() => handleEffectToggle('ssao')}
            />
            SSAO (주변광 차폐)
          </label>
        </div>
        {settings.ssao?.enabled && (
          <div className="effect-controls">
            <div className="control-row">
              <label>커널 반경:</label>
              <input
                type="range"
                min="1"
                max="32"
                step="1"
                value={settings.ssao?.kernelRadius || 8}
                onChange={(e) => handleSettingChange('ssao', 'kernelRadius', parseInt(e.target.value))}
              />
              <span>{settings.ssao?.kernelRadius || 8}</span>
            </div>
          </div>
        )}
      </div>

      {/* Outline */}
      <div className="effect-item">
        <div className="effect-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.outline?.enabled || false}
              onChange={() => handleEffectToggle('outline')}
            />
            Outline (윤곽선)
          </label>
        </div>
        {settings.outline?.enabled && (
          <div className="effect-controls">
            <div className="control-row">
              <label>강도:</label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={settings.outline?.edgeStrength || 3.0}
                onChange={(e) => handleSettingChange('outline', 'edgeStrength', parseFloat(e.target.value))}
              />
              <span>{settings.outline?.edgeStrength || 3.0}</span>
            </div>
            <div className="control-row">
              <label>두께:</label>
              <input
                type="range"
                min="0"
                max="4"
                step="0.1"
                value={settings.outline?.edgeThickness || 1.0}
                onChange={(e) => handleSettingChange('outline', 'edgeThickness', parseFloat(e.target.value))}
              />
              <span>{settings.outline?.edgeThickness || 1.0}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderColorEffects = () => (
    <div className="effect-group">
      <h3>색상 효과</h3>
      
      {/* Color Correction */}
      <div className="effect-item">
        <div className="effect-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.colorCorrection?.enabled || false}
              onChange={() => handleEffectToggle('colorCorrection')}
            />
            Color Correction (색상 보정)
          </label>
        </div>
        {settings.colorCorrection?.enabled && (
          <div className="effect-controls">
            <div className="control-row">
              <label>Red Power:</label>
              <input
                type="range"
                min="0.1"
                max="4"
                step="0.1"
                value={settings.colorCorrection?.powRGB?.x || 2.0}
                onChange={(e) => handleSettingChange('colorCorrection', 'powRGB', {
                  ...settings.colorCorrection.powRGB,
                  x: parseFloat(e.target.value)
                })}
              />
              <span>{settings.colorCorrection?.powRGB?.x || 2.0}</span>
            </div>
          </div>
        )}
      </div>

      {/* Brightness/Contrast */}
      <div className="effect-item">
        <div className="effect-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.brightnessContrast?.enabled || false}
              onChange={() => handleEffectToggle('brightnessContrast')}
            />
            Brightness/Contrast (밝기/대비)
          </label>
        </div>
        {settings.brightnessContrast?.enabled && (
          <div className="effect-controls">
            <div className="control-row">
              <label>밝기:</label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={settings.brightnessContrast?.brightness || 0.0}
                onChange={(e) => handleSettingChange('brightnessContrast', 'brightness', parseFloat(e.target.value))}
              />
              <span>{settings.brightnessContrast?.brightness || 0.0}</span>
            </div>
            <div className="control-row">
              <label>대비:</label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={settings.brightnessContrast?.contrast || 0.0}
                onChange={(e) => handleSettingChange('brightnessContrast', 'contrast', parseFloat(e.target.value))}
              />
              <span>{settings.brightnessContrast?.contrast || 0.0}</span>
            </div>
          </div>
        )}
      </div>

      {/* Hue/Saturation */}
      <div className="effect-item">
        <div className="effect-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.hueSaturation?.enabled || false}
              onChange={() => handleEffectToggle('hueSaturation')}
            />
            Hue/Saturation (색조/채도)
          </label>
        </div>
        {settings.hueSaturation?.enabled && (
          <div className="effect-controls">
            <div className="control-row">
              <label>색조:</label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={settings.hueSaturation?.hue || 0.0}
                onChange={(e) => handleSettingChange('hueSaturation', 'hue', parseFloat(e.target.value))}
              />
              <span>{settings.hueSaturation?.hue || 0.0}</span>
            </div>
            <div className="control-row">
              <label>채도:</label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={settings.hueSaturation?.saturation || 0.0}
                onChange={(e) => handleSettingChange('hueSaturation', 'saturation', parseFloat(e.target.value))}
              />
              <span>{settings.hueSaturation?.saturation || 0.0}</span>
            </div>
          </div>
        )}
      </div>

      {/* Sepia */}
      <div className="effect-item">
        <div className="effect-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.sepia?.enabled || false}
              onChange={() => handleEffectToggle('sepia')}
            />
            Sepia (세피아)
          </label>
        </div>
        {settings.sepia?.enabled && (
          <div className="effect-controls">
            <div className="control-row">
              <label>강도:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.sepia?.amount || 1.0}
                onChange={(e) => handleSettingChange('sepia', 'amount', parseFloat(e.target.value))}
              />
              <span>{settings.sepia?.amount || 1.0}</span>
            </div>
          </div>
        )}
      </div>

      {/* Vignette */}
      <div className="effect-item">
        <div className="effect-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.vignette?.enabled || false}
              onChange={() => handleEffectToggle('vignette')}
            />
            Vignette (비네트)
          </label>
        </div>
        {settings.vignette?.enabled && (
          <div className="effect-controls">
            <div className="control-row">
              <label>오프셋:</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={settings.vignette?.offset || 1.0}
                onChange={(e) => handleSettingChange('vignette', 'offset', parseFloat(e.target.value))}
              />
              <span>{settings.vignette?.offset || 1.0}</span>
            </div>
            <div className="control-row">
              <label>어둠:</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={settings.vignette?.darkness || 1.0}
                onChange={(e) => handleSettingChange('vignette', 'darkness', parseFloat(e.target.value))}
              />
              <span>{settings.vignette?.darkness || 1.0}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderArtisticEffects = () => (
    <div className="effect-group">
      <h3>아티스틱 효과</h3>
      
      {/* Film */}
      <div className="effect-item">
        <div className="effect-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.film?.enabled || false}
              onChange={() => handleEffectToggle('film')}
            />
            Film (필름 효과)
          </label>
        </div>
        {settings.film?.enabled && (
          <div className="effect-controls">
            <div className="control-row">
              <label>노이즈:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.film?.noiseIntensity || 0.5}
                onChange={(e) => handleSettingChange('film', 'noiseIntensity', parseFloat(e.target.value))}
              />
              <span>{settings.film?.noiseIntensity || 0.5}</span>
            </div>
            <div className="control-row">
              <label>스캔라인:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.film?.scanlinesIntensity || 0.05}
                onChange={(e) => handleSettingChange('film', 'scanlinesIntensity', parseFloat(e.target.value))}
              />
              <span>{settings.film?.scanlinesIntensity || 0.05}</span>
            </div>
            <div className="control-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.film?.grayscale || false}
                  onChange={(e) => handleSettingChange('film', 'grayscale', e.target.checked)}
                />
                흑백
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Pixelate */}
      <div className="effect-item">
        <div className="effect-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.pixelate?.enabled || false}
              onChange={() => handleEffectToggle('pixelate')}
            />
            Pixelate (픽셀화)
          </label>
        </div>
        {settings.pixelate?.enabled && (
          <div className="effect-controls">
            <div className="control-row">
              <label>픽셀 크기:</label>
              <input
                type="range"
                min="2"
                max="20"
                step="1"
                value={settings.pixelate?.pixelSize || 6}
                onChange={(e) => handleSettingChange('pixelate', 'pixelSize', parseInt(e.target.value))}
              />
              <span>{settings.pixelate?.pixelSize || 6}</span>
            </div>
          </div>
        )}
      </div>

      {/* Dot Screen */}
      <div className="effect-item">
        <div className="effect-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.dotScreen?.enabled || false}
              onChange={() => handleEffectToggle('dotScreen')}
            />
            Dot Screen (도트 스크린)
          </label>
        </div>
        {settings.dotScreen?.enabled && (
          <div className="effect-controls">
            <div className="control-row">
              <label>스케일:</label>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={settings.dotScreen?.scale || 1.0}
                onChange={(e) => handleSettingChange('dotScreen', 'scale', parseFloat(e.target.value))}
              />
              <span>{settings.dotScreen?.scale || 1.0}</span>
            </div>
          </div>
        )}
      </div>

      {/* Glitch */}
      <div className="effect-item">
        <div className="effect-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.glitch?.enabled || false}
              onChange={() => handleEffectToggle('glitch')}
            />
            Glitch (글리치)
          </label>
        </div>
        {settings.glitch?.enabled && (
          <div className="effect-controls">
            <div className="control-row">
              <label>강도:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.glitch?.factor || 0.1}
                onChange={(e) => handleSettingChange('glitch', 'factor', parseFloat(e.target.value))}
              />
              <span>{settings.glitch?.factor || 0.1}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="post-processing-panel">
      <div className="panel-header">
        <h2>포스트프로세싱 효과</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="panel-tabs">
        <button 
          className={`tab-button ${activeTab === 'basic' ? 'active' : ''}`}
          onClick={() => setActiveTab('basic')}
        >
          기본
        </button>
        <button 
          className={`tab-button ${activeTab === 'color' ? 'active' : ''}`}
          onClick={() => setActiveTab('color')}
        >
          색상
        </button>
        <button 
          className={`tab-button ${activeTab === 'artistic' ? 'active' : ''}`}
          onClick={() => setActiveTab('artistic')}
        >
          아티스틱
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'basic' && renderBasicEffects()}
        {activeTab === 'color' && renderColorEffects()}
        {activeTab === 'artistic' && renderArtisticEffects()}
      </div>
    </div>
  );
};

export default PostProcessingPanel;
