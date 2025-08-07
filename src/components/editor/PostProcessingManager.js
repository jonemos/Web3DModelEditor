/**
 * PostProcessingManager - Three.js 포스트프로세싱 효과 관리 클래스
 * 다양한 카메라 효과를 제공하고 관리합니다
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 기본 효과들
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { DotScreenPass } from 'three/addons/postprocessing/DotScreenPass.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

// 셰이더들
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { ColorCorrectionShader } from 'three/addons/shaders/ColorCorrectionShader.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { SepiaShader } from 'three/addons/shaders/SepiaShader.js';
import { BleachBypassShader } from 'three/addons/shaders/BleachBypassShader.js';
import { TechnicolorShader } from 'three/addons/shaders/TechnicolorShader.js';
import { HueSaturationShader } from 'three/addons/shaders/HueSaturationShader.js';
import { BrightnessContrastShader } from 'three/addons/shaders/BrightnessContrastShader.js';

export class PostProcessingManager {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    
    // 컴포저와 패스들
    this.composer = null;
    this.renderPass = null;
    this.outputPass = null;
    
    // 활성 효과들 저장
    this.activeEffects = new Map();
    
    // 효과 설정 저장
    this.effectSettings = {
      bloom: {
        enabled: false,
        strength: 1.5,
        radius: 0.4,
        threshold: 0.85
      },
      film: {
        enabled: false,
        noiseIntensity: 0.5,
        scanlinesIntensity: 0.05,
        scanlinesCount: 648,
        grayscale: false
      },
      fxaa: {
        enabled: false
      },
      ssao: {
        enabled: false,
        kernelRadius: 8,
        minDistance: 0.005,
        maxDistance: 0.1
      },
      outline: {
        enabled: false,
        edgeStrength: 3.0,
        edgeGlow: 0.0,
        edgeThickness: 1.0,
        pulsePeriod: 0,
        visibleEdgeColor: 0xffffff,
        hiddenEdgeColor: 0x190a05
      },
      colorCorrection: {
        enabled: false,
        powRGB: { x: 2.0, y: 2.0, z: 2.0 },
        mulRGB: { x: 1.0, y: 1.0, z: 1.0 },
        addRGB: { x: 0.0, y: 0.0, z: 0.0 }
      },
      vignette: {
        enabled: false,
        offset: 1.0,
        darkness: 1.0
      },
      sepia: {
        enabled: false,
        amount: 1.0
      },
      hueSaturation: {
        enabled: false,
        hue: 0.0,
        saturation: 0.0
      },
      brightnessContrast: {
        enabled: false,
        brightness: 0.0,
        contrast: 0.0
      },
      glitch: {
        enabled: false,
        factor: 0.1
      },
      pixelate: {
        enabled: false,
        pixelSize: 6
      },
      dotScreen: {
        enabled: false,
        center: { x: 0.5, y: 0.5 },
        angle: 1.57,
        scale: 1.0
      }
    };
    
    this.initializeComposer();
    
    console.log('PostProcessingManager initialized');
  }

  /**
   * 이펙트 컴포저 초기화
   */
  initializeComposer() {
    // 컴포저 생성
    this.composer = new EffectComposer(this.renderer);
    
    // 기본 렌더 패스
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    
    // 출력 패스 (마지막에 추가)
    this.outputPass = new OutputPass();
    
    // 초기에는 기본 렌더만 활성화
    this.updateComposer();
  }

  /**
   * 컴포저 업데이트 (활성 효과들로 재구성)
   */
  updateComposer() {
    // 기존 패스들 제거 (렌더 패스 제외)
    this.composer.passes = [this.renderPass];
    this.activeEffects.clear();
    
    // 효과들을 설정된 순서대로 추가
    this.addActiveEffects();
    
    // 마지막에 출력 패스 추가
    this.composer.addPass(this.outputPass);
  }

  /**
   * 활성 효과들 추가
   */
  addActiveEffects() {
    // SSAO (가장 먼저 적용)
    if (this.effectSettings.ssao.enabled) {
      this.addSSAOEffect();
    }
    
    // Bloom
    if (this.effectSettings.bloom.enabled) {
      this.addBloomEffect();
    }
    
    // Outline
    if (this.effectSettings.outline.enabled) {
      this.addOutlineEffect();
    }
    
    // Color Correction
    if (this.effectSettings.colorCorrection.enabled) {
      this.addColorCorrectionEffect();
    }
    
    // Brightness/Contrast
    if (this.effectSettings.brightnessContrast.enabled) {
      this.addBrightnessContrastEffect();
    }
    
    // Hue/Saturation
    if (this.effectSettings.hueSaturation.enabled) {
      this.addHueSaturationEffect();
    }
    
    // Sepia
    if (this.effectSettings.sepia.enabled) {
      this.addSepiaEffect();
    }
    
    // Vignette
    if (this.effectSettings.vignette.enabled) {
      this.addVignetteEffect();
    }
    
    // Pixelate
    if (this.effectSettings.pixelate.enabled) {
      this.addPixelateEffect();
    }
    
    // Dot Screen
    if (this.effectSettings.dotScreen.enabled) {
      this.addDotScreenEffect();
    }
    
    // Glitch
    if (this.effectSettings.glitch.enabled) {
      this.addGlitchEffect();
    }
    
    // Film (노이즈, 마지막 근처에 적용)
    if (this.effectSettings.film.enabled) {
      this.addFilmEffect();
    }
    
    // FXAA (안티앨리어싱, 마지막에 적용)
    if (this.effectSettings.fxaa.enabled) {
      this.addFXAAEffect();
    }
  }

  // ======================
  // 개별 효과 추가 메서드들
  // ======================

  /**
   * Bloom 효과 추가
   */
  addBloomEffect() {
    const settings = this.effectSettings.bloom;
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    
    const bloomPass = new UnrealBloomPass(resolution, settings.strength, settings.radius, settings.threshold);
    this.composer.addPass(bloomPass);
    this.activeEffects.set('bloom', bloomPass);
  }

  /**
   * Film 효과 추가
   */
  addFilmEffect() {
    const settings = this.effectSettings.film;
    
    const filmPass = new FilmPass(
      settings.noiseIntensity,
      settings.scanlinesIntensity,
      settings.scanlinesCount,
      settings.grayscale
    );
    this.composer.addPass(filmPass);
    this.activeEffects.set('film', filmPass);
  }

  /**
   * FXAA 안티앨리어싱 추가
   */
  addFXAAEffect() {
    const fxaaPass = new ShaderPass(FXAAShader);
    const pixelRatio = this.renderer.getPixelRatio();
    
    fxaaPass.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
    
    this.composer.addPass(fxaaPass);
    this.activeEffects.set('fxaa', fxaaPass);
  }

  /**
   * SSAO 효과 추가
   */
  addSSAOEffect() {
    const settings = this.effectSettings.ssao;
    
    const ssaoPass = new SSAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
    ssaoPass.kernelRadius = settings.kernelRadius;
    ssaoPass.minDistance = settings.minDistance;
    ssaoPass.maxDistance = settings.maxDistance;
    
    this.composer.addPass(ssaoPass);
    this.activeEffects.set('ssao', ssaoPass);
  }

  /**
   * Outline 효과 추가
   */
  addOutlineEffect() {
    const settings = this.effectSettings.outline;
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    
    const outlinePass = new OutlinePass(resolution, this.scene, this.camera);
    outlinePass.edgeStrength = settings.edgeStrength;
    outlinePass.edgeGlow = settings.edgeGlow;
    outlinePass.edgeThickness = settings.edgeThickness;
    outlinePass.pulsePeriod = settings.pulsePeriod;
    outlinePass.visibleEdgeColor.setHex(settings.visibleEdgeColor);
    outlinePass.hiddenEdgeColor.setHex(settings.hiddenEdgeColor);
    
    this.composer.addPass(outlinePass);
    this.activeEffects.set('outline', outlinePass);
  }

  /**
   * Color Correction 효과 추가
   */
  addColorCorrectionEffect() {
    const settings = this.effectSettings.colorCorrection;
    
    const colorCorrectionPass = new ShaderPass(ColorCorrectionShader);
    colorCorrectionPass.material.uniforms['powRGB'].value = new THREE.Vector3(
      settings.powRGB.x, settings.powRGB.y, settings.powRGB.z
    );
    colorCorrectionPass.material.uniforms['mulRGB'].value = new THREE.Vector3(
      settings.mulRGB.x, settings.mulRGB.y, settings.mulRGB.z
    );
    colorCorrectionPass.material.uniforms['addRGB'].value = new THREE.Vector3(
      settings.addRGB.x, settings.addRGB.y, settings.addRGB.z
    );
    
    this.composer.addPass(colorCorrectionPass);
    this.activeEffects.set('colorCorrection', colorCorrectionPass);
  }

  /**
   * Vignette 효과 추가
   */
  addVignetteEffect() {
    const settings = this.effectSettings.vignette;
    
    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.material.uniforms['offset'].value = settings.offset;
    vignettePass.material.uniforms['darkness'].value = settings.darkness;
    
    this.composer.addPass(vignettePass);
    this.activeEffects.set('vignette', vignettePass);
  }

  /**
   * Sepia 효과 추가
   */
  addSepiaEffect() {
    const settings = this.effectSettings.sepia;
    
    const sepiaPass = new ShaderPass(SepiaShader);
    sepiaPass.material.uniforms['amount'].value = settings.amount;
    
    this.composer.addPass(sepiaPass);
    this.activeEffects.set('sepia', sepiaPass);
  }

  /**
   * Hue/Saturation 효과 추가
   */
  addHueSaturationEffect() {
    const settings = this.effectSettings.hueSaturation;
    
    const hueSaturationPass = new ShaderPass(HueSaturationShader);
    hueSaturationPass.material.uniforms['hue'].value = settings.hue;
    hueSaturationPass.material.uniforms['saturation'].value = settings.saturation;
    
    this.composer.addPass(hueSaturationPass);
    this.activeEffects.set('hueSaturation', hueSaturationPass);
  }

  /**
   * Brightness/Contrast 효과 추가
   */
  addBrightnessContrastEffect() {
    const settings = this.effectSettings.brightnessContrast;
    
    const brightnessContrastPass = new ShaderPass(BrightnessContrastShader);
    brightnessContrastPass.material.uniforms['brightness'].value = settings.brightness;
    brightnessContrastPass.material.uniforms['contrast'].value = settings.contrast;
    
    this.composer.addPass(brightnessContrastPass);
    this.activeEffects.set('brightnessContrast', brightnessContrastPass);
  }

  /**
   * Glitch 효과 추가
   */
  addGlitchEffect() {
    const glitchPass = new GlitchPass();
    glitchPass.factor = this.effectSettings.glitch.factor;
    
    this.composer.addPass(glitchPass);
    this.activeEffects.set('glitch', glitchPass);
  }

  /**
   * Pixelate 효과 추가
   */
  addPixelateEffect() {
    const settings = this.effectSettings.pixelate;
    
    const pixelatePass = new RenderPixelatedPass(settings.pixelSize, this.scene, this.camera);
    
    this.composer.addPass(pixelatePass);
    this.activeEffects.set('pixelate', pixelatePass);
  }

  /**
   * Dot Screen 효과 추가
   */
  addDotScreenEffect() {
    const settings = this.effectSettings.dotScreen;
    
    const dotScreenPass = new DotScreenPass(
      new THREE.Vector2(settings.center.x, settings.center.y),
      settings.angle,
      settings.scale
    );
    
    this.composer.addPass(dotScreenPass);
    this.activeEffects.set('dotScreen', dotScreenPass);
  }

  // ======================
  // 공개 API 메서드들
  // ======================

  /**
   * 효과 활성화/비활성화
   */
  setEffectEnabled(effectName, enabled) {
    if (this.effectSettings[effectName]) {
      this.effectSettings[effectName].enabled = enabled;
      this.updateComposer();
      console.log(`Effect '${effectName}' ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * 효과 설정 업데이트
   */
  updateEffectSettings(effectName, settings) {
    if (this.effectSettings[effectName]) {
      Object.assign(this.effectSettings[effectName], settings);
      
      // 효과가 활성화되어 있으면 컴포저 업데이트
      if (this.effectSettings[effectName].enabled) {
        this.updateComposer();
      }
      
      console.log(`Updated settings for '${effectName}'`);
    }
  }

  /**
   * 렌더링 실행
   */
  render() {
    this.composer.render();
  }

  /**
   * 리사이즈 처리
   */
  handleResize(width, height) {
    this.composer.setSize(width, height);
    
    // FXAA 해상도 업데이트
    const fxaaPass = this.activeEffects.get('fxaa');
    if (fxaaPass) {
      const pixelRatio = this.renderer.getPixelRatio();
      fxaaPass.material.uniforms['resolution'].value.x = 1 / (width * pixelRatio);
      fxaaPass.material.uniforms['resolution'].value.y = 1 / (height * pixelRatio);
    }
  }

  /**
   * Outline 효과의 선택된 오브젝트 설정
   */
  setOutlineSelectedObjects(objects) {
    const outlinePass = this.activeEffects.get('outline');
    if (outlinePass && Array.isArray(objects)) {
      outlinePass.selectedObjects = objects;
    }
  }

  /**
   * 현재 설정 반환
   */
  getSettings() {
    return JSON.parse(JSON.stringify(this.effectSettings));
  }

  /**
   * 설정 로드
   */
  loadSettings(settings) {
    Object.assign(this.effectSettings, settings);
    this.updateComposer();
  }

  /**
   * 정리
   */
  dispose() {
    if (this.composer) {
      this.composer.dispose();
    }
    
    this.activeEffects.clear();
    this.composer = null;
    this.renderPass = null;
    this.outputPass = null;
    
    console.log('PostProcessingManager disposed');
  }
}

export default PostProcessingManager;
