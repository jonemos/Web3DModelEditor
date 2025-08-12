/**
 * Transform Plugin - 변형 도구를 플러그인으로 구현한 예시
 * 
 * 기존의 TransformManager를 플러그인 형태로 재구성
 */

import { BaseService } from '../core/ServiceRegistry.js'
import { EventTypes } from '../core/EventBus.js'

export class TransformPlugin {
  constructor() {
    this.name = 'transform'
    this.version = '1.0.0'
    this.description = '3D 객체 변형 도구'
    
    this.context = null
    this.transformService = null
    this.selectionService = null
    this.configManager = null
    
    this.mode = 'translate'
    this.space = 'world'
    this.gizmo = null
  }

  /**
   * 플러그인 초기화
   */
  init(context) {
    this.context = context
    
    // 서비스 가져오기
    this.transformService = context.getService('transformService')
    this.selectionService = context.getService('selectionService')
    this.configManager = context.getService('configManager')
    
    // 이벤트 리스너 등록
    this.setupEventListeners()
    
    // UI 등록
    this.registerUI()
    
    // 명령어 등록
    this.registerCommands()
    
    console.log('Transform Plugin initialized')
  }

  /**
   * 플러그인 정리
   */
  destroy() {
    if (this.gizmo) {
      try {
        // 씬에서 gizmo 제거
        const sceneService = this.context.getService('sceneService')
        if (sceneService) {
          const scene = sceneService.getScene()
          if (scene && scene.remove) {
            scene.remove(this.gizmo)
          }
        }
        
        // gizmo 정리
        this.gizmo.dispose()
        this.gizmo = null
      } catch (error) {
        console.error('[TransformPlugin] Error destroying gizmo:', error)
      }
    }
    
    // 이벤트 리스너 정리는 플러그인 시스템에서 자동으로 처리
    console.log('Transform Plugin destroyed')
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 선택 변경 감지
    this.context.on(EventTypes.OBJECT_SELECTED, async (event) => {
      await this.updateGizmoTarget(event.detail.object)
    })

    this.context.on(EventTypes.OBJECT_DESELECTED, (event) => {
      if (this.selectionService.getSelectedObjects().length === 0) {
        this.hideGizmo()
      }
    })

    // 설정 변경 감지
    this.configManager.watch('editor', 'transform.mode', (newMode) => {
      this.setMode(newMode)
    })

    this.configManager.watch('editor', 'transform.space', (newSpace) => {
      this.setSpace(newSpace)
    })
  }

  /**
   * UI 등록
   */
  registerUI() {
    // 툴바에 변형 도구 버튼들 추가 (나중에 구현)
    if (this.context.registerToolbarButton) {
      this.context.registerToolbarButton({
        id: 'transform_translate',
        icon: 'move',
        tooltip: 'Move (W)',
        action: () => this.setMode('translate'),
        shortcut: 'KeyW',
        group: 'transform'
      })

      this.context.registerToolbarButton({
        id: 'transform_rotate',
        icon: 'rotate',
        tooltip: 'Rotate (E)',
        action: () => this.setMode('rotate'),
        shortcut: 'KeyE',
        group: 'transform'
      })

      this.context.registerToolbarButton({
        id: 'transform_scale',
        icon: 'scale',
        tooltip: 'Scale (R)',
        action: () => this.setMode('scale'),
        shortcut: 'KeyR',
        group: 'transform'
      })
    }

    // 설정 패널 추가 (나중에 구현)
    if (this.context.registerPanel) {
      this.context.registerPanel({
        id: 'transform_settings',
        title: 'Transform Settings',
        component: this.createSettingsPanel(),
        category: 'tools'
      })
    }
  }

  /**
   * 명령어 등록
   */
  registerCommands() {
    this.context.registerCommand('transform.setMode', (params) => {
      this.setMode(params.mode)
    })

    this.context.registerCommand('transform.setSpace', (params) => {
      this.setSpace(params.space)
    })

    this.context.registerCommand('transform.toggle', () => {
      const modes = ['translate', 'rotate', 'scale']
      const currentIndex = modes.indexOf(this.mode)
      const nextMode = modes[(currentIndex + 1) % modes.length]
      this.setMode(nextMode)
    })
  }

  /**
   * 변형 모드 설정
   */
  setMode(mode) {
    if (this.mode === mode) return

    this.mode = mode
    
    if (this.gizmo) {
      this.gizmo.setMode(mode)
    }

    // 설정 저장
    this.configManager.set('editor', 'transform.mode', mode)

    // 이벤트 발생
    this.context.emit(EventTypes.EDITOR_MODE_CHANGED, {
      type: 'transform',
      mode: mode
    })
  }

  /**
   * 좌표계 설정
   */
  setSpace(space) {
    if (this.space === space) return

    this.space = space
    
    if (this.gizmo) {
      this.gizmo.setSpace(space)
    }

    // 설정 저장
    this.configManager.set('editor', 'transform.space', space)
  }

  /**
   * 기즈모 타겟 업데이트
   */
  async updateGizmoTarget(object) {
    if (!this.gizmo) {
      await this.createGizmo()
    }

    if (this.gizmo && object) {
      try {
        this.gizmo.attach(object)
        this.showGizmo()
      } catch (error) {
        console.error('[TransformPlugin] Error attaching object to gizmo:', error)
      }
    }
  }

  /**
   * 기즈모 생성
   */
  async createGizmo() {
    // 이미 생성된 경우 중복 생성 방지
    if (this.gizmo) {
      console.log('[TransformPlugin] Gizmo already exists')
      return
    }
    
    try {
      // Three.js 동적 import
      const THREE = await import('three')
      const { TransformControls } = await import('three/addons/controls/TransformControls.js')
      
      // 씬 서비스 유효성 체크
      const sceneService = this.context.getService('sceneService')
      if (!sceneService) {
        console.error('[TransformPlugin] SceneService not found')
        return
      }
      
      const scene = sceneService.getScene()
      const camera = sceneService.getCamera()
      const renderer = sceneService.getRenderer()

      if (!scene || !camera || !renderer) {
        console.error('[TransformPlugin] Scene, camera, or renderer not available', {
          scene: !!scene,
          camera: !!camera,
          renderer: !!renderer
        })
        return
      }

      // Three.js TransformControls 생성
      this.gizmo = new TransformControls(camera, renderer.domElement)
      
      // TransformControls 유효성 체크
      if (!(this.gizmo instanceof TransformControls)) {
        console.error('[TransformPlugin] Failed to create TransformControls')
        this.gizmo = null
        return
      }
      
      this.gizmo.setMode(this.mode)
      this.gizmo.setSpace(this.space)

      // 기즈모 이벤트 처리
      this.gizmo.addEventListener('change', () => {
        this.context.emit(EventTypes.OBJECT_TRANSFORMED, {
          object: this.gizmo.object
        })
      })

      // 씬에 추가 (유효성 체크 후)
      if (scene && scene.add && typeof scene.add === 'function') {
        scene.add(this.gizmo)
        console.log('[TransformPlugin] Gizmo added to scene successfully')
      } else {
        console.error('[TransformPlugin] Scene.add is not available')
        this.gizmo = null
      }
      
    } catch (error) {
      console.error('[TransformPlugin] Error creating gizmo:', error)
      this.gizmo = null
    }
  }

  /**
   * 기즈모 표시
   */
  showGizmo() {
    if (this.gizmo) {
      this.gizmo.visible = true
    }
  }

  /**
   * 기즈모 숨김
   */
  hideGizmo() {
    if (this.gizmo) {
      this.gizmo.visible = false
      this.gizmo.detach()
    }
  }

  /**
   * 설정 패널 컴포넌트 생성
   */
  createSettingsPanel() {
    return {
      render: () => {
        return `
          <div class="transform-settings">
            <div class="setting-group">
              <label>Transform Mode</label>
              <select id="transform-mode" value="${this.mode}">
                <option value="translate">Translate</option>
                <option value="rotate">Rotate</option>
                <option value="scale">Scale</option>
              </select>
            </div>
            
            <div class="setting-group">
              <label>Coordinate Space</label>
              <select id="transform-space" value="${this.space}">
                <option value="world">World</option>
                <option value="local">Local</option>
              </select>
            </div>
            
            <div class="setting-group">
              <label>Snap to Grid</label>
              <input type="checkbox" id="snap-enabled" />
            </div>
          </div>
        `
      },
      
      mount: (element) => {
        // 이벤트 리스너 연결
        element.querySelector('#transform-mode').addEventListener('change', (e) => {
          this.setMode(e.target.value)
        })

        element.querySelector('#transform-space').addEventListener('change', (e) => {
          this.setSpace(e.target.value)
        })
      }
    }
  }

  /**
   * 플러그인 API
   */
  getAPI() {
    return {
      setMode: this.setMode.bind(this),
      setSpace: this.setSpace.bind(this),
      getMode: () => this.mode,
      getSpace: () => this.space,
      showGizmo: this.showGizmo.bind(this),
      hideGizmo: this.hideGizmo.bind(this)
    }
  }

  /**
   * 플러그인 훅들
   */
  hooks = {
    // 씬이 로드될 때
    'scene:loaded': (sceneData) => {
      // 변형 관련 설정 복원
      if (sceneData.transformSettings) {
        this.setMode(sceneData.transformSettings.mode)
        this.setSpace(sceneData.transformSettings.space)
      }
    },

    // 씬을 저장할 때
    'scene:saving': (sceneData) => {
      // 변형 설정 저장
      sceneData.transformSettings = {
        mode: this.mode,
        space: this.space
      }
    },

    // 키보드 입력 처리
    'input:keydown': (event) => {
      switch (event.code) {
        case 'KeyW':
          if (!event.ctrlKey && !event.altKey) {
            this.setMode('translate')
            event.preventDefault()
            return true
          }
          break
        case 'KeyE':
          if (!event.ctrlKey && !event.altKey) {
            this.setMode('rotate')
            event.preventDefault()
            return true
          }
          break
        case 'KeyR':
          if (!event.ctrlKey && !event.altKey) {
            this.setMode('scale')
            event.preventDefault()
            return true
          }
          break
      }
      return false
    }
  }
}

// 플러그인 등록 헬퍼
export function registerTransformPlugin(pluginSystem) {
  const plugin = new TransformPlugin()
  return pluginSystem.registerPlugin('transform', plugin)
}
