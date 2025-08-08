import * as THREE from 'three'

/**
 * PropertiesManager - 통합 속성 관리 클래스
 * 3D 객체, 라이트, 카메라 등의 속성을 통합 관리합니다.
 */
export class PropertiesManager {
  constructor(editorControls) {
    this.editorControls = editorControls
    this.selectedObject = null
    this.threeObject = null
    this.changeCallbacks = []
  }

  /**
   * 속성 변경 콜백 등록
   */
  onPropertyChange(callback) {
    this.changeCallbacks.push(callback)
  }

  /**
   * 속성 변경 알림
   */
  notifyPropertyChange(type, property, value) {
    this.changeCallbacks.forEach(callback => {
      callback({ type, property, value, object: this.selectedObject })
    })
  }

  /**
   * 선택된 객체 설정
   */
  setSelectedObject(object) {
    this.selectedObject = object
    this.threeObject = null
    
    if (!object) {
      return
    }

    // 객체가 이미 Three.js 객체인지 확인
    if (object.isObject3D || object.isMesh || object.isLight || object.isCamera) {
      this.threeObject = object
    } 
    // EditorControls를 통해 실제 Three.js 객체 찾기
    else if (this.editorControls) {
      const objectId = object.id || object
      
      this.threeObject = this.editorControls.findObjectById(objectId)
      
      // 찾지 못한 경우 에디터컨트롤의 현재 선택된 객체 사용
      if (!this.threeObject && this.editorControls.selectedObjects && this.editorControls.selectedObjects.length > 0) {
        this.threeObject = this.editorControls.selectedObjects[0]
      }
    }
  }

  /**
   * 객체 타입 확인
   */
  getObjectType() {
    if (!this.threeObject) {
      return 'unknown'
    }
    
    if (this.threeObject.isLight) {
      return 'light'
    }
    if (this.threeObject.isCamera) {
      return 'camera'
    }
    if (this.threeObject.isHelper) {
      return 'helper'
    }
    if (this.threeObject.isMesh) {
      return 'mesh'
    }
    if (this.threeObject.isGroup) {
      return 'group'
    }
    
    return 'mesh'
  }

  /**
   * Transform 속성 설정
   */
  setTransformProperty(property, axis, value) {
    if (!this.threeObject) return false

    const numValue = parseFloat(value)
    if (isNaN(numValue)) return false

    switch (property) {
      case 'position':
        this.threeObject.position[axis] = numValue
        break
      case 'rotation':
        this.threeObject.rotation[axis] = (numValue * Math.PI) / 180
        break
      case 'scale':
        this.threeObject.scale[axis] = numValue
        break
    }

    this.notifyPropertyChange('transform', property, { [axis]: numValue })
    return true
  }

  /**
   * Transform 속성 가져오기
   */
  getTransformProperty(property, axis) {
    if (!this.threeObject) return 0

    if (property === 'rotation') {
      return ((this.threeObject[property][axis] * 180) / Math.PI).toFixed(1)
    }
    return this.threeObject[property][axis].toFixed(2)
  }

  /**
   * 라이트 속성 설정
   */
  setLightProperty(property, value) {
    if (!this.threeObject || !this.threeObject.isLight) return false

    switch (property) {
      case 'color':
        this.threeObject.color.setHex(value.replace('#', '0x'))
        break
      case 'intensity':
        this.threeObject.intensity = parseFloat(value)
        break
      case 'distance':
        if (this.threeObject.distance !== undefined) {
          this.threeObject.distance = parseFloat(value)
        }
        break
      case 'angle':
        if (this.threeObject.angle !== undefined) {
          this.threeObject.angle = parseFloat(value)
        }
        break
      case 'penumbra':
        if (this.threeObject.penumbra !== undefined) {
          this.threeObject.penumbra = parseFloat(value)
        }
        break
      case 'decay':
        if (this.threeObject.decay !== undefined) {
          this.threeObject.decay = parseFloat(value)
        }
        break
    }

    this.notifyPropertyChange('light', property, value)
    return true
  }

  /**
   * 라이트 속성 가져오기
   */
  getLightProperty(property) {
    if (!this.threeObject || !this.threeObject.isLight) return null

    switch (property) {
      case 'type':
        return this.threeObject.type
      case 'color':
        return '#' + this.threeObject.color.getHexString()
      case 'intensity':
        return this.threeObject.intensity
      case 'distance':
        return this.threeObject.distance || 0
      case 'angle':
        return this.threeObject.angle || 0
      case 'penumbra':
        return this.threeObject.penumbra || 0
      case 'decay':
        return this.threeObject.decay || 1
      default:
        return null
    }
  }

  /**
   * 카메라 속성 설정
   */
  setCameraProperty(property, value) {
    if (!this.threeObject || !this.threeObject.isCamera) return false

    switch (property) {
      case 'fov':
        if (this.threeObject.isPerspectiveCamera) {
          this.threeObject.fov = parseFloat(value)
          this.threeObject.updateProjectionMatrix()
        }
        break
      case 'near':
        this.threeObject.near = parseFloat(value)
        this.threeObject.updateProjectionMatrix()
        break
      case 'far':
        this.threeObject.far = parseFloat(value)
        this.threeObject.updateProjectionMatrix()
        break
    }

    this.notifyPropertyChange('camera', property, value)
    return true
  }

  /**
   * 카메라 속성 가져오기
   */
  getCameraProperty(property) {
    if (!this.threeObject || !this.threeObject.isCamera) return null

    switch (property) {
      case 'type':
        return this.threeObject.type
      case 'fov':
        return this.threeObject.fov || 75
      case 'near':
        return this.threeObject.near || 0.1
      case 'far':
        return this.threeObject.far || 1000
      default:
        return null
    }
  }

  /**
   * 메시 머티리얼 속성 설정
   */
  setMaterialProperty(property, value) {
    if (!this.threeObject || !this.threeObject.isMesh) return false

    const material = this.threeObject.material
    if (!material) return false

    switch (property) {
      case 'color':
        if (material.color) {
          material.color.setHex(value.replace('#', '0x'))
        }
        break
      case 'metalness':
        if (material.metalness !== undefined) {
          material.metalness = parseFloat(value)
        }
        break
      case 'roughness':
        if (material.roughness !== undefined) {
          material.roughness = parseFloat(value)
        }
        break
      case 'emissive':
        if (material.emissive) {
          material.emissive.setHex(value.replace('#', '0x'))
        }
        break
      case 'emissiveIntensity':
        if (material.emissiveIntensity !== undefined) {
          material.emissiveIntensity = parseFloat(value)
        }
        break
      case 'opacity':
        material.opacity = parseFloat(value)
        material.transparent = material.opacity < 1
        break
    }

    material.needsUpdate = true
    this.notifyPropertyChange('material', property, value)
    return true
  }

  /**
   * 메시 머티리얼 속성 가져오기
   */
  getMaterialProperty(property) {
    if (!this.threeObject || !this.threeObject.isMesh) return null

    const material = this.threeObject.material
    if (!material) return null

    switch (property) {
      case 'color':
        return material.color ? '#' + material.color.getHexString() : '#ffffff'
      case 'metalness':
        return material.metalness || 0
      case 'roughness':
        return material.roughness || 0.8
      case 'emissive':
        return material.emissive ? '#' + material.emissive.getHexString() : '#000000'
      case 'emissiveIntensity':
        return material.emissiveIntensity || 0
      case 'opacity':
        return material.opacity || 1
      default:
        return null
    }
  }

  /**
   * 객체 정보 가져오기
   */
  getObjectInfo() {
    if (!this.threeObject) {
      return null
    }

    const info = {
      name: this.threeObject.name || 'Unnamed Object',
      type: this.getObjectType(),
      id: this.threeObject.userData?.id || this.threeObject.id,
      position: {
        x: this.getTransformProperty('position', 'x'),
        y: this.getTransformProperty('position', 'y'),
        z: this.getTransformProperty('position', 'z')
      },
      rotation: {
        x: this.getTransformProperty('rotation', 'x'),
        y: this.getTransformProperty('rotation', 'y'),
        z: this.getTransformProperty('rotation', 'z')
      },
      scale: {
        x: this.getTransformProperty('scale', 'x'),
        y: this.getTransformProperty('scale', 'y'),
        z: this.getTransformProperty('scale', 'z')
      }
    }
    
    return info
  }

  /**
   * 리소스 정리
   */
  dispose() {
    this.selectedObject = null
    this.threeObject = null
    this.editorControls = null
    this.changeCallbacks = []
  }
}