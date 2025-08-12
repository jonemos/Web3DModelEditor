/**
 * Grid Plugin - 그리드 시스템을 플러그인으로 구현
 * 
 * 기존의 그리드 기능을 독립적인 플러그인으로 분리
 */

import { EventTypes } from '../core/EventBus.js'

export class GridPlugin {
  constructor() {
    this.name = 'grid'
    this.version = '1.0.0'
    this.description = '3D 그리드 시스템'
    
    this.context = null
    this.configManager = null
    this.sceneService = null
    
    this.gridHelper = null
    this.isVisible = true
    this.size = 10
    this.divisions = 10
    this.colorCenter = 0x888888
    this.colorGrid = 0x444444
  }

  /**
   * 플러그인 초기화
   */
  async init(context) {
    this.context = context
    
    // 서비스 가져오기
    this.configManager = context.getService('configManager') 
    this.sceneService = context.getService('sceneService')
    
    // 설정 로드
    this.loadSettings()
    
    // 그리드 생성
    await this.createGrid()
    
    // 이벤트 리스너 등록
    this.setupEventListeners()
    
    // UI 등록
    this.registerUI()
    
    // 명령어 등록
    this.registerCommands()
    
    console.log('Grid Plugin initialized')
  }

  /**
   * 플러그인 정리
   */
  destroy() {
    if (this.gridHelper) {
      const scene = this.sceneService.getScene()
      if (scene) {
        scene.remove(this.gridHelper)
      }
      this.gridHelper.dispose()
      this.gridHelper = null
    }
    
    console.log('Grid Plugin destroyed')
  }

  /**
   * 설정 로드
   */
  loadSettings() {
    if (this.configManager) {
      this.isVisible = this.configManager.get('editor', 'viewport.gridVisible') ?? true
      this.size = this.configManager.get('editor', 'viewport.gridSize') ?? 10
      this.divisions = this.configManager.get('editor', 'viewport.gridDivisions') ?? 10
    }
  }

  /**
   * 그리드 생성
   */
  async createGrid() {
    const THREE = await import('three')
    const scene = this.sceneService.getScene()
    
    if (!scene) {
      console.error('Scene not available for grid creation')
      return
    }

    // 기존 그리드 제거
    if (this.gridHelper) {
      scene.remove(this.gridHelper)
      this.gridHelper.dispose()
    }

    // 새 그리드 생성
    this.gridHelper = new THREE.GridHelper(
      this.size, 
      this.divisions, 
      this.colorCenter, 
      this.colorGrid
    )
    
    this.gridHelper.name = 'GridHelper'
    this.gridHelper.userData.isEditorHelper = true
    this.gridHelper.visible = this.isVisible

    scene.add(this.gridHelper)
    
    console.log(`Grid created: size=${this.size}, divisions=${this.divisions}, visible=${this.isVisible}`)
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 설정 변경 감지
    if (this.configManager) {
      this.configManager.watch('editor', 'viewport.gridVisible', (newValue) => {
        this.setVisibility(newValue)
      })

      this.configManager.watch('editor', 'viewport.gridSize', (newValue) => {
        this.setSize(newValue)
      })

      this.configManager.watch('editor', 'viewport.gridDivisions', (newValue) => {
        this.setDivisions(newValue)
      })
    }

    // 씬 변경 감지
    this.context.on(EventTypes.SCENE_LOADED, () => {
      this.createGrid()
    })

    this.context.on(EventTypes.SCENE_CLEARED, () => {
      this.createGrid()
    })
  }

  /**
   * UI 등록
   */
  registerUI() {
    // 툴바에 그리드 토글 버튼 추가 (나중에 구현)
    if (this.context.registerToolbarButton) {
      this.context.registerToolbarButton({
        id: 'grid_toggle',
        icon: 'grid',
        tooltip: 'Toggle Grid (G)',
        action: () => this.toggle(),
        shortcut: 'KeyG',
        group: 'viewport',
        isActive: () => this.isVisible
      })
    }

    // 설정 패널 추가 (나중에 구현)
    if (this.context.registerPanel) {
      this.context.registerPanel({
        id: 'grid_settings',
        title: 'Grid Settings',
        component: this.createSettingsPanel(),
        category: 'viewport'
      })
    }
  }

  /**
   * 명령어 등록
   */
  registerCommands() {
    if (this.context.registerCommand) {
      this.context.registerCommand('grid.toggle', () => {
        this.toggle()
      })

      this.context.registerCommand('grid.setSize', (params) => {
        this.setSize(params.size)
      })

      this.context.registerCommand('grid.setDivisions', (params) => {
        this.setDivisions(params.divisions)
      })

      this.context.registerCommand('grid.setVisibility', (params) => {
        this.setVisibility(params.visible)
      })
    }
  }

  /**
   * 그리드 가시성 토글
   */
  toggle() {
    this.setVisibility(!this.isVisible)
  }

  /**
   * 그리드 가시성 설정
   */
  setVisibility(visible) {
    this.isVisible = visible
    
    if (this.gridHelper) {
      this.gridHelper.visible = visible
    }

    // 설정 저장
    if (this.configManager) {
      this.configManager.set('editor', 'viewport.gridVisible', visible)
    }

    // 이벤트 발생
    this.context.emit(EventTypes.GRID_TOGGLED, {
      visible: visible
    })

    console.log(`Grid visibility: ${visible}`)
  }

  /**
   * 그리드 크기 설정
   */
  setSize(size) {
    if (size <= 0) return

    this.size = size
    
    // 설정 저장
    if (this.configManager) {
      this.configManager.set('editor', 'viewport.gridSize', size)
    }

    // 그리드 재생성
    this.createGrid()

    console.log(`Grid size set to: ${size}`)
  }

  /**
   * 그리드 분할 수 설정
   */
  setDivisions(divisions) {
    if (divisions <= 0) return

    this.divisions = divisions

    // 설정 저장
    if (this.configManager) {
      this.configManager.set('editor', 'viewport.gridDivisions', divisions)
    }

    // 그리드 재생성
    this.createGrid()

    console.log(`Grid divisions set to: ${divisions}`)
  }

  /**
   * 그리드 색상 설정
   */
  setColors(centerColor, gridColor) {
    this.colorCenter = centerColor
    this.colorGrid = gridColor

    // 그리드 재생성
    this.createGrid()
  }

  /**
   * 설정 패널 컴포넌트 생성
   */
  createSettingsPanel() {
    return {
      render: () => {
        return `
          <div class="grid-settings">
            <div class="setting-group">
              <label>Grid Visible</label>
              <input type="checkbox" id="grid-visible" ${this.isVisible ? 'checked' : ''} />
            </div>
            
            <div class="setting-group">
              <label>Grid Size</label>
              <input type="range" id="grid-size" min="1" max="50" value="${this.size}" />
              <span id="grid-size-value">${this.size}</span>
            </div>
            
            <div class="setting-group">
              <label>Grid Divisions</label>
              <input type="range" id="grid-divisions" min="2" max="50" value="${this.divisions}" />
              <span id="grid-divisions-value">${this.divisions}</span>
            </div>
            
            <div class="setting-group">
              <label>Center Color</label>
              <input type="color" id="grid-center-color" value="#${this.colorCenter.toString(16).padStart(6, '0')}" />
            </div>
            
            <div class="setting-group">
              <label>Grid Color</label>
              <input type="color" id="grid-grid-color" value="#${this.colorGrid.toString(16).padStart(6, '0')}" />
            </div>
          </div>
        `
      },
      
      mount: (element) => {
        // 이벤트 리스너 연결
        element.querySelector('#grid-visible').addEventListener('change', (e) => {
          this.setVisibility(e.target.checked)
        })

        const sizeSlider = element.querySelector('#grid-size')
        const sizeValue = element.querySelector('#grid-size-value')
        sizeSlider.addEventListener('input', (e) => {
          const value = parseInt(e.target.value)
          sizeValue.textContent = value
          this.setSize(value)
        })

        const divisionsSlider = element.querySelector('#grid-divisions')
        const divisionsValue = element.querySelector('#grid-divisions-value')
        divisionsSlider.addEventListener('input', (e) => {
          const value = parseInt(e.target.value)
          divisionsValue.textContent = value
          this.setDivisions(value)
        })

        element.querySelector('#grid-center-color').addEventListener('change', (e) => {
          const centerColor = parseInt(e.target.value.replace('#', ''), 16)
          const gridColor = this.colorGrid
          this.setColors(centerColor, gridColor)
        })

        element.querySelector('#grid-grid-color').addEventListener('change', (e) => {
          const gridColor = parseInt(e.target.value.replace('#', ''), 16)
          const centerColor = this.colorCenter
          this.setColors(centerColor, gridColor)
        })
      }
    }
  }

  /**
   * 플러그인 API
   */
  getAPI() {
    return {
      toggle: this.toggle.bind(this),
      setVisibility: this.setVisibility.bind(this),
      setSize: this.setSize.bind(this),
      setDivisions: this.setDivisions.bind(this),
      setColors: this.setColors.bind(this),
      isVisible: () => this.isVisible,
      getSize: () => this.size,
      getDivisions: () => this.divisions
    }
  }

  /**
   * 플러그인 훅들
   */
  hooks = {
    // 씬이 로드될 때
    'scene:loaded': (sceneData) => {
      // 그리드 관련 설정 복원
      if (sceneData.gridSettings) {
        this.setSize(sceneData.gridSettings.size || this.size)
        this.setDivisions(sceneData.gridSettings.divisions || this.divisions)
        this.setVisibility(sceneData.gridSettings.visible ?? this.isVisible)
      }
    },

    // 씬을 저장할 때
    'scene:saving': (sceneData) => {
      // 그리드 설정 저장
      sceneData.gridSettings = {
        size: this.size,
        divisions: this.divisions,
        visible: this.isVisible,
        colorCenter: this.colorCenter,
        colorGrid: this.colorGrid
      }
    },

    // 키보드 입력 처리
    'input:keydown': (event) => {
      if (event.code === 'KeyG' && !event.ctrlKey && !event.altKey) {
        this.toggle()
        event.preventDefault()
        return true
      }
      return false
    }
  }
}

// 플러그인 등록 헬퍼
export function registerGridPlugin(pluginSystem) {
  const plugin = new GridPlugin()
  return pluginSystem.registerPlugin('grid', plugin)
}
