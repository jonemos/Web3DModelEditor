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
  // 선택/활성 색상 구분
  selectedColor: 0xff7a00, // 주황
  activeColor: 0xffd400,   // 노랑
  hiddenEdgeColor: 0x190a05,
  hiddenEdgeAlpha: 1.0 // 0..1, 배경색과의 혼합 비율로 의사 알파 구현
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
  }

  /**
   * 이펙트 컴포저 초기화
   */
  initializeComposer() {
    // 기존 컴포저가 있으면 정리
    if (this.composer) {
      try {
        // 기존 패스들 dispose
        for (const p of this.composer.passes || []) {
          try { p.dispose && p.dispose(); } catch {}
        }
        this.composer.dispose();
      } catch {}
    }
    // 새 컴포저 생성
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
    // 기존 패스들 제거 전 dispose (렌더 패스 제외)
    try {
      const toDispose = (this.composer.passes || []).filter(p => p !== this.renderPass);
      for (const p of toDispose) {
        try { p.dispose && p.dispose(); } catch {}
      }
    } catch {}
    // 렌더 패스만 유지
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
    
    // Outline (선택/활성 두 패스로 분리)
    if (this.effectSettings.outline.enabled) {
      this.addOutlineEffect('selected');
      this.addOutlineEffect('active');
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
    // Windows/ANGLE 환경에서 FXAA 셰이더가 경고를 발생시키는 것을 방지하기 위해
    // 동일 토글로 SMAA를 적용합니다. (품질도 대체로 더 우수)
    // 필요 시 진짜 FXAA로 강제 전환할 수 있게 분기 지점만 남겨둡니다.
    const forceFXAA = false; // true로 바꾸면 순정 FXAA 사용
    if (!forceFXAA) {
      const pixelRatio = this.renderer.getPixelRatio();
      const smaaPass = new SMAAPass(
        Math.max(1, Math.floor(window.innerWidth * pixelRatio)),
        Math.max(1, Math.floor(window.innerHeight * pixelRatio))
      );
      this.composer.addPass(smaaPass);
      this.activeEffects.set('fxaa', smaaPass);
      return;
    }

    // 순정 FXAA 경로 (경고가 발생할 수 있음)
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
  addOutlineEffect(kind = 'selected') {
    const settings = this.effectSettings.outline;
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    const outlinePass = new OutlinePass(resolution, this.scene, this.camera);
    outlinePass.edgeStrength = settings.edgeStrength;
    outlinePass.edgeGlow = settings.edgeGlow;
    outlinePass.edgeThickness = settings.edgeThickness;
    outlinePass.pulsePeriod = settings.pulsePeriod;
    const col = (kind === 'active') ? settings.activeColor : settings.selectedColor;
    outlinePass.visibleEdgeColor.setHex(col);
    // 숨김 색상은 배경색과 혼합하여 의사 알파 적용
    try {
      const bg = this.scene.background instanceof THREE.Color ? this.scene.background : new THREE.Color(0x000000);
      const c = new THREE.Color(settings.hiddenEdgeColor);
      const mixed = c.clone().lerp(bg, Math.max(0, Math.min(1, 1 - (settings.hiddenEdgeAlpha ?? 1.0))));
      outlinePass.hiddenEdgeColor.copy(mixed);
    } catch {
      outlinePass.hiddenEdgeColor.setHex(settings.hiddenEdgeColor);
    }
    this.composer.addPass(outlinePass);
    const key = kind === 'active' ? 'outlineActive' : 'outlineSelected';
    this.activeEffects.set(key, outlinePass);
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
  if (!(effectName in this.effectSettings)) return;
  this.effectSettings[effectName].enabled = enabled;
  this.updateComposer();
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
    
    // AA 패스 해상도 업데이트 (SMAA 또는 FXAA 모두 지원)
    const aaPass = this.activeEffects.get('fxaa');
    if (aaPass) {
      const pixelRatio = this.renderer.getPixelRatio();
      // SMAA 경로: setSize 제공
      if (typeof aaPass.setSize === 'function') {
        aaPass.setSize(
          Math.max(1, Math.floor(width * pixelRatio)),
          Math.max(1, Math.floor(height * pixelRatio))
        );
      }
      // FXAA 경로: resolution 유니폼 갱신
      else if (aaPass.material?.uniforms?.resolution) {
        aaPass.material.uniforms['resolution'].value.x = 1 / (width * pixelRatio);
        aaPass.material.uniforms['resolution'].value.y = 1 / (height * pixelRatio);
      }
    }

    // OutlinePass 해상도 업데이트
    const oSel = this.activeEffects.get('outlineSelected');
    if (oSel && oSel.resolution) {
      try { oSel.resolution.set(width, height); } catch {}
    }
    const oAct = this.activeEffects.get('outlineActive');
    if (oAct && oAct.resolution) {
      try { oAct.resolution.set(width, height); } catch {}
    }
  }

  /**
   * Outline 효과의 선택된 오브젝트 설정
   */
  setOutlineSelectedObjects(objects) {
    const outlinePass = this.activeEffects.get('outlineSelected');
    if (outlinePass && Array.isArray(objects)) {
      outlinePass.selectedObjects = objects;
    }
  }

  setOutlineActiveObjects(objects) {
    const outlinePass = this.activeEffects.get('outlineActive');
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
    try {
      // 활성 효과 dispose
      for (const p of this.activeEffects.values()) {
        try { p.dispose && p.dispose(); } catch {}
      }
      this.activeEffects.clear();
      if (this.composer) {
        for (const p of this.composer.passes || []) {
          try { p.dispose && p.dispose(); } catch {}
        }
        this.composer.dispose();
      }
    } catch {}
    this.composer = null;
    this.renderPass = null;
    this.outputPass = null;
    
    
  }
}

export default PostProcessingManager;
