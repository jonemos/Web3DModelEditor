/**
 * Configuration Management - 설정 관리 시스템
 * 
 * 각 모듈의 설정을 중앙에서 관리하여:
 * - 일관된 설정 인터페이스
 * - 환경별 설정 분리
 * - 런타임 설정 변경
 * - 설정 검증
 */

export class ConfigManager {
  constructor() {
    this.configs = new Map()
    this.watchers = new Map()
    this.validators = new Map()
    this.defaults = new Map()
    this.eventBus = new EventTarget()
  }

  /**
   * 설정 스키마 등록
   */
  registerSchema(namespace, schema) {
    this.defaults.set(namespace, schema.defaults || {})
    this.validators.set(namespace, schema.validate || (() => true))

    // 기본값으로 초기화
    this.configs.set(namespace, { ...schema.defaults })

    return this
  }

  /**
   * 설정 값 가져오기
   */
  get(namespace, key = null) {
    const config = this.configs.get(namespace)
    if (!config) {
      throw new Error(`Configuration namespace not found: ${namespace}`)
    }

    if (key === null) {
      return { ...config }
    }

    return this.getNestedValue(config, key)
  }

  /**
   * 설정 값 설정하기
   */
  set(namespace, key, value) {
    if (!this.configs.has(namespace)) {
      throw new Error(`Configuration namespace not found: ${namespace}`)
    }

    const oldValue = this.get(namespace, key)
    
    // 검증
    const validator = this.validators.get(namespace)
    if (validator && !validator(key, value, this.get(namespace))) {
      throw new Error(`Invalid configuration value: ${namespace}.${key} = ${value}`)
    }

    // 값 설정
    this.setNestedValue(this.configs.get(namespace), key, value)

    // 이벤트 발생
    this.emit('config:changed', {
      namespace,
      key,
      value,
      oldValue
    })

    // 와처 실행
    this.runWatchers(namespace, key, value, oldValue)

    return this
  }

  /**
   * 설정 변경 감시
   */
  watch(namespace, key, callback) {
    const watchKey = `${namespace}.${key}`
    
    if (!this.watchers.has(watchKey)) {
      this.watchers.set(watchKey, [])
    }

    this.watchers.get(watchKey).push(callback)

    // 언와치 함수 반환
    return () => {
      const watchers = this.watchers.get(watchKey)
      if (watchers) {
        const index = watchers.indexOf(callback)
        if (index > -1) {
          watchers.splice(index, 1)
        }
      }
    }
  }

  /**
   * 설정을 로컬스토리지에 저장
   */
  save(namespace = null) {
    if (namespace) {
      const config = this.configs.get(namespace)
      if (config) {
        localStorage.setItem(`config_${namespace}`, JSON.stringify(config))
      }
    } else {
      // 모든 설정 저장
      for (const [ns, config] of this.configs) {
        localStorage.setItem(`config_${ns}`, JSON.stringify(config))
      }
    }

    this.emit('config:saved', { namespace })
    return this
  }

  /**
   * 로컬스토리지에서 설정 로드
   */
  load(namespace = null) {
    if (namespace) {
      const saved = localStorage.getItem(`config_${namespace}`)
      if (saved) {
        try {
          const config = JSON.parse(saved)
          // 기본값과 병합
          const defaults = this.defaults.get(namespace) || {}
          this.configs.set(namespace, { ...defaults, ...config })
        } catch (error) {
          console.error(`Failed to load config for ${namespace}:`, error)
        }
      }
    } else {
      // 모든 설정 로드
      for (const namespace of this.configs.keys()) {
        this.load(namespace)
      }
    }

    this.emit('config:loaded', { namespace })
    return this
  }

  /**
   * 설정을 기본값으로 리셋
   */
  reset(namespace, key = null) {
    const defaults = this.defaults.get(namespace)
    if (!defaults) return this

    if (key) {
      const defaultValue = this.getNestedValue(defaults, key)
      this.set(namespace, key, defaultValue)
    } else {
      this.configs.set(namespace, { ...defaults })
      this.emit('config:reset', { namespace })
    }

    return this
  }

  /**
   * 중첩된 객체에서 값 가져오기
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined
    }, obj)
  }

  /**
   * 중첩된 객체에 값 설정하기
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.')
    const lastKey = keys.pop()
    
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {}
      }
      return current[key]
    }, obj)

    target[lastKey] = value
  }

  /**
   * 와처 실행
   */
  runWatchers(namespace, key, value, oldValue) {
    const watchKey = `${namespace}.${key}`
    const watchers = this.watchers.get(watchKey)
    
    if (watchers) {
      watchers.forEach(callback => {
        try {
          callback(value, oldValue, key, namespace)
        } catch (error) {
          console.error('Config watcher error:', error)
        }
      })
    }
  }

  /**
   * 이벤트 발생
   */
  emit(eventName, data) {
    const event = new CustomEvent(eventName, { detail: data })
    this.eventBus.dispatchEvent(event)
  }

  /**
   * 이벤트 리스닝
   */
  on(eventName, callback) {
    this.eventBus.addEventListener(eventName, callback)
  }

  /**
   * 모든 설정 가져오기
   */
  getAllConfigs() {
    const result = {}
    for (const [namespace, config] of this.configs) {
      result[namespace] = { ...config }
    }
    return result
  }

  /**
   * 설정 검증
   */
  validate(namespace) {
    const config = this.configs.get(namespace)
    const validator = this.validators.get(namespace)
    
    if (!config || !validator) return true

    return validator(null, null, config)
  }
}

// 기본 설정 스키마들
export const EditorConfigSchema = {
  defaults: {
    viewport: {
      gridVisible: true,
      gridSize: 1,
      snapToGrid: false,
      cameraSpeed: 1.0,
      mouseSensitivity: 0.002
    },
    transform: {
      mode: 'translate',
      space: 'world',
      snapEnabled: false,
      snapValue: 0.1
    },
    rendering: {
      shadows: true,
      wireframe: false,
      backgroundColor: '#2a2a2a',
      antialias: true
    },
    ui: {
      theme: 'dark',
      language: 'ko',
      panelPositions: {},
      shortcuts: {
        translate: 'KeyW',
        rotate: 'KeyE',
        scale: 'KeyR',
        focus: 'KeyF',
        delete: 'Delete'
      }
    }
  },
  validate: (key, value, config) => {
    if (key === 'viewport.gridSize' && value <= 0) return false
    if (key === 'transform.mode' && !['translate', 'rotate', 'scale'].includes(value)) return false
    return true
  }
}

export const GameConfigSchema = {
  defaults: {
    graphics: {
      quality: 'high',
      shadows: true,
      postProcessing: true,
      fov: 75
    },
    controls: {
      mouseSensitivity: 0.002,
      invertY: false,
      keyBindings: {
        forward: 'KeyW',
        backward: 'KeyS',
        left: 'KeyA',
        right: 'KeyD',
        jump: 'Space',
        run: 'ShiftLeft'
      }
    },
    audio: {
      masterVolume: 1.0,
      musicVolume: 0.8,
      sfxVolume: 1.0,
      muted: false
    }
  },
  validate: (key, value, config) => {
    if (key?.includes('Volume') && (value < 0 || value > 1)) return false
    if (key === 'graphics.quality' && !['low', 'medium', 'high', 'ultra'].includes(value)) return false
    return true
  }
}

// 글로벌 설정 매니저
export const configManager = new ConfigManager()

// 기본 스키마 등록
configManager
  .registerSchema('editor', EditorConfigSchema)
  .registerSchema('game', GameConfigSchema)

// 자동 저장 설정 (변경 시 자동으로 로컬스토리지에 저장)
configManager.on('config:changed', (event) => {
  const { namespace } = event.detail
  // 디바운스를 위해 약간의 딜레이
  setTimeout(() => {
    configManager.save(namespace)
  }, 100)
})
