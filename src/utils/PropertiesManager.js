import * as THREE from 'three'

/**
 * PropertiesManager - 객체 속성 관리 클래스
 * 3D 객체의 Transform, Material, Texture 등의 속성을 관리합니다.
 */
export class PropertiesManager {
  constructor() {
    this.selectedObject = null
    this.availableMaterials = []
    this.selectedMaterialIndex = 0
    this.materialTextures = {
      diffuse: null,
      normal: null,
      roughness: null,
      metallic: null,
      emissive: null
    }
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
    this.updateMaterialsList()
    this.selectedMaterialIndex = 0
    this.clearTextureCache()
  }

  /**
   * 객체의 메터리얼 목록 업데이트
   */
  updateMaterialsList() {
    this.availableMaterials = []
    
    if (!this.selectedObject || typeof this.selectedObject.traverse !== 'function') {
      return
    }

    this.selectedObject.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          // 다중 메터리얼
          child.material.forEach((mat, index) => {
            this.availableMaterials.push({
              material: mat,
              name: mat.name || `Material ${this.availableMaterials.length}`,
              meshName: child.name || 'Unnamed Mesh',
              materialIndex: index,
              mesh: child
            })
          })
        } else {
          // 단일 메터리얼
          this.availableMaterials.push({
            material: child.material,
            name: child.material.name || `Material ${this.availableMaterials.length}`,
            meshName: child.name || 'Unnamed Mesh',
            materialIndex: 0,
            mesh: child
          })
        }
      }
    })
  }

  /**
   * 텍스처 캐시 초기화
   */
  clearTextureCache() {
    Object.keys(this.materialTextures).forEach(key => {
      if (this.materialTextures[key]) {
        URL.revokeObjectURL(this.materialTextures[key])
        this.materialTextures[key] = null
      }
    })
  }

  /**
   * Transform 속성 변경
   */
  setTransformProperty(property, axis, value) {
    if (!this.selectedObject || typeof this.selectedObject.traverse !== 'function') {
      return false
    }

    const numValue = parseFloat(value)
    if (isNaN(numValue)) return false

    // 속성이 없으면 초기화
    if (!this.selectedObject[property]) {
      this.selectedObject[property] = new THREE.Vector3(0, 0, 0)
    }

    switch (property) {
      case 'position':
        this.selectedObject.position[axis] = numValue
        break
      case 'rotation':
        this.selectedObject.rotation[axis] = (numValue * Math.PI) / 180 // 도를 라디안으로
        break
      case 'scale':
        this.selectedObject.scale[axis] = numValue
        break
    }

    this.notifyPropertyChange('transform', property, { [axis]: numValue })
    return true
  }

  /**
   * Transform 속성 값 가져오기
   */
  getTransformProperty(property, axis) {
    if (!this.selectedObject || typeof this.selectedObject.traverse !== 'function') {
      return 0
    }

    if (!this.selectedObject[property]) return 0
    if (this.selectedObject[property][axis] === undefined) return 0

    if (property === 'rotation') {
      return ((this.selectedObject[property][axis] * 180) / Math.PI).toFixed(1)
    }
    return this.selectedObject[property][axis].toFixed(2)
  }

  /**
   * 메터리얼 선택
   */
  selectMaterial(index) {
    if (index >= 0 && index < this.availableMaterials.length) {
      this.selectedMaterialIndex = index
      this.notifyPropertyChange('material', 'selected', index)
      return true
    }
    return false
  }

  /**
   * 현재 선택된 메터리얼 가져오기
   */
  getCurrentMaterial() {
    if (this.availableMaterials.length === 0) return null
    return this.availableMaterials[this.selectedMaterialIndex]
  }

  /**
   * 메터리얼 속성 변경
   */
  setMaterialProperty(property, value) {
    const materialData = this.getCurrentMaterial()
    if (!materialData) return false

    const material = materialData.material

    switch (property) {
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
      case 'color':
        if (material.color) {
          material.color.setHex(value.replace('#', '0x'))
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
    }

    material.needsUpdate = true
    this.notifyPropertyChange('material', property, value)
    return true
  }

  /**
   * 메터리얼 속성 값 가져오기
   */
  getMaterialProperty(property) {
    const materialData = this.getCurrentMaterial()
    if (!materialData) {
      return property === 'color' || property === 'emissive' ? '#000000' : 0
    }

    const material = materialData.material

    switch (property) {
      case 'metalness':
        return material.metalness || 0
      case 'roughness':
        return material.roughness || 0.8
      case 'color':
        return material.color ? '#' + material.color.getHexString() : '#ffffff'
      case 'emissive':
        return material.emissive ? '#' + material.emissive.getHexString() : '#000000'
      case 'emissiveIntensity':
        return material.emissiveIntensity || 0
      default:
        return 0
    }
  }

  /**
   * 텍스처 업로드 및 적용
   */
  uploadTexture(textureType, file) {
    if (!file) return Promise.reject(new Error('파일이 없습니다'))
    
    const materialData = this.getCurrentMaterial()
    if (!materialData) return Promise.reject(new Error('메터리얼이 없습니다'))

    return new Promise((resolve, reject) => {
      // 기존 텍스처 URL 해제
      if (this.materialTextures[textureType]) {
        URL.revokeObjectURL(this.materialTextures[textureType])
      }

      const url = URL.createObjectURL(file)
      const loader = new THREE.TextureLoader()

      loader.load(
        url,
        (texture) => {
          // 텍스처 설정
          texture.wrapS = THREE.RepeatWrapping
          texture.wrapT = THREE.RepeatWrapping
          texture.flipY = false

          const material = materialData.material

          // 텍스처 타입에 따라 적용
          switch (textureType) {
            case 'diffuse':
              material.map = texture
              break
            case 'normal':
              material.normalMap = texture
              break
            case 'roughness':
              material.roughnessMap = texture
              break
            case 'metallic':
              material.metalnessMap = texture
              break
            case 'emissive':
              material.emissiveMap = texture
              break
          }

          material.needsUpdate = true
          this.materialTextures[textureType] = url

          this.notifyPropertyChange('texture', textureType, url)
          resolve({ textureType, url, texture })
        },
        undefined,
        (error) => {
          URL.revokeObjectURL(url)
          reject(error)
        }
      )
    })
  }

  /**
   * 텍스처 제거
   */
  removeTexture(textureType) {
    const materialData = this.getCurrentMaterial()
    if (!materialData) return false

    const material = materialData.material

    switch (textureType) {
      case 'diffuse':
        material.map = null
        break
      case 'normal':
        material.normalMap = null
        break
      case 'roughness':
        material.roughnessMap = null
        break
      case 'metallic':
        material.metalnessMap = null
        break
      case 'emissive':
        material.emissiveMap = null
        break
    }

    material.needsUpdate = true

    if (this.materialTextures[textureType]) {
      URL.revokeObjectURL(this.materialTextures[textureType])
      this.materialTextures[textureType] = null
    }

    this.notifyPropertyChange('texture', textureType, null)
    return true
  }

  /**
   * 객체 타입 확인
   */
  getObjectType() {
    if (!this.selectedObject) return null

    if (this.selectedObject.isLight) return 'light'
    if (this.selectedObject.isCamera) return 'camera'
    if (this.selectedObject.isHelper) return 'helper'
    if (this.selectedObject.isMesh) return 'mesh'
    if (this.selectedObject.isGroup) return 'group'

    return 'unknown'
  }

  /**
   * 객체 정보 가져오기
   */
  getObjectInfo() {
    if (!this.selectedObject) return null

    return {
      name: this.selectedObject.name || 'Unnamed Object',
      type: this.getObjectType(),
      materialsCount: this.availableMaterials.length,
      hasTextures: Object.values(this.materialTextures).some(tex => tex !== null),
      transform: {
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
    }
  }

  /**
   * 리소스 정리
   */
  dispose() {
    this.clearTextureCache()
    this.selectedObject = null
    this.availableMaterials = []
    this.changeCallbacks = []
  }
}
