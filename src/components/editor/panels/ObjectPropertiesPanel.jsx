import { useState, useEffect, memo } from 'react'
import * as THREE from 'three'
import './ObjectPropertiesPanel.css'

const ObjectPropertiesPanel = memo(function ObjectPropertiesPanel({ selectedObject }) {
  const [materialTextures, setMaterialTextures] = useState({
    diffuse: null,
    normal: null,
    roughness: null
  })
  const [selectedMaterialIndex, setSelectedMaterialIndex] = useState(0)
  const [availableMaterials, setAvailableMaterials] = useState([])

  // 선택된 오브젝트가 변경될 때 메터리얼 리스트 업데이트
  useEffect(() => {
    if (selectedObject && typeof selectedObject.traverse === 'function') {
      // Three.js 오브젝트인 경우에만 traverse 사용
      const materials = []
      
      selectedObject.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            // 다중 메터리얼인 경우
            child.material.forEach((mat, index) => {
              materials.push({
                material: mat,
                name: mat.name || `Material ${materials.length}`,
                meshName: child.name || 'Unnamed Mesh',
                materialIndex: index
              })
            })
          } else {
            // 단일 메터리얼인 경우
            materials.push({
              material: child.material,
              name: child.material.name || `Material ${materials.length}`,
              meshName: child.name || 'Unnamed Mesh',
              materialIndex: 0
            })
          }
        }
      })
      
      setAvailableMaterials(materials)
      setSelectedMaterialIndex(0) // 첫 번째 메터리얼로 리셋
    } else {
      setAvailableMaterials([])
      setSelectedMaterialIndex(0)
    }
  }, [selectedObject])

  const handleTransformChange = (property, axis, value) => {
    if (!selectedObject || typeof selectedObject.traverse !== 'function') return
    
    const newValue = parseFloat(value)
    if (isNaN(newValue)) return

    // 해당 속성이 없으면 초기화
    if (!selectedObject[property]) {
      selectedObject[property] = { x: 0, y: 0, z: 0 }
    }

    if (property === 'position') {
      selectedObject.position[axis] = newValue
    } else if (property === 'rotation') {
      selectedObject.rotation[axis] = (newValue * Math.PI) / 180 // 도를 라디안으로 변환
    } else if (property === 'scale') {
      selectedObject.scale[axis] = newValue
    }
  }

  const getTransformValue = (property, axis) => {
    if (!selectedObject || typeof selectedObject.traverse !== 'function') return 0
    
    // selectedObject[property]가 undefined이거나 null인 경우 기본값 반환
    if (!selectedObject[property]) return 0
    
    // selectedObject[property][axis]가 undefined인 경우 기본값 반환
    if (selectedObject[property][axis] === undefined) return 0
    
    if (property === 'rotation') {
      return ((selectedObject[property][axis] * 180) / Math.PI).toFixed(1) // 라디안을 도로 변환
    }
    return selectedObject[property][axis].toFixed(2)
  }

  const handleTextureUpload = (textureType, file) => {
    if (!file || !selectedObject || typeof selectedObject.traverse !== 'function' || availableMaterials.length === 0) return
    
    const url = URL.createObjectURL(file)
    const selectedMaterial = availableMaterials[selectedMaterialIndex]
    
    if (!selectedMaterial) return
    
    // Three.js TextureLoader를 사용하여 텍스처 로드
    const loader = new THREE.TextureLoader()
    loader.load(url, (texture) => {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.flipY = false
      
      const material = selectedMaterial.material
      
      // PBR 메터리얼로 업그레이드 (필요한 경우)
      if (!material.isMeshStandardMaterial) {
        // Material is not a MeshStandardMaterial, texture may not apply correctly
      }
      
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
      }
      
      material.needsUpdate = true
      
      // 로컬 상태 업데이트
      setMaterialTextures(prev => ({
        ...prev,
        [textureType]: url
      }))
    })
  }

  const handleMaterialPropertyChange = (property, value) => {
    if (!selectedObject || typeof selectedObject.traverse !== 'function' || availableMaterials.length === 0) return
    
    const selectedMaterial = availableMaterials[selectedMaterialIndex]
    if (!selectedMaterial) return
    
    const material = selectedMaterial.material
    
    // PBR 메터리얼인지 확인
    if (!material.isMeshStandardMaterial) {
      // Material is not a MeshStandardMaterial, property may not apply correctly
    }
    
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
    }
    
    material.needsUpdate = true
  }

  const getMaterialValue = (property) => {
    if (!selectedObject || typeof selectedObject.traverse !== 'function' || availableMaterials.length === 0) {
      return property === 'color' ? '#ffffff' : 0
    }
    
    const selectedMaterial = availableMaterials[selectedMaterialIndex]
    if (!selectedMaterial) {
      return property === 'color' ? '#ffffff' : 0
    }
    
    const material = selectedMaterial.material
    
    switch (property) {
      case 'metalness':
        return material.metalness || 0
      case 'roughness':
        return material.roughness || 0.8
      case 'color':
        return material.color ? '#' + material.color.getHexString() : '#ffffff'
      default:
        return 0
    }
  }

  if (!selectedObject) {
    return null
  }

  return (
    <div className="panel-section properties-section">
      <h3>속성</h3>
      <div className="properties-container">
        <div className="property-group">
          <h4>위치 (Position)</h4>
          <div className="vector-inputs">
            <label>
              X:
              <input 
                type="number"
                step="0.1"
                value={getTransformValue('position', 'x')}
                onChange={(e) => handleTransformChange('position', 'x', e.target.value)}
                className="vector-input"
              />
            </label>
            <label>
              Y:
              <input 
                type="number"
                step="0.1"
                value={getTransformValue('position', 'y')}
                onChange={(e) => handleTransformChange('position', 'y', e.target.value)}
                className="vector-input"
              />
            </label>
            <label>
              Z:
              <input 
                type="number"
                step="0.1"
                value={getTransformValue('position', 'z')}
                onChange={(e) => handleTransformChange('position', 'z', e.target.value)}
                className="vector-input"
              />
            </label>
          </div>
        </div>

        <div className="property-group">
          <h4>회전 (Rotation)</h4>
          <div className="vector-inputs">
            <label>
              X:
              <input 
                type="number"
                step="1"
                value={getTransformValue('rotation', 'x')}
                onChange={(e) => handleTransformChange('rotation', 'x', e.target.value)}
                className="vector-input"
              />
              °
            </label>
            <label>
              Y:
              <input 
                type="number"
                step="1"
                value={getTransformValue('rotation', 'y')}
                onChange={(e) => handleTransformChange('rotation', 'y', e.target.value)}
                className="vector-input"
              />
              °
            </label>
            <label>
              Z:
              <input 
                type="number"
                step="1"
                value={getTransformValue('rotation', 'z')}
                onChange={(e) => handleTransformChange('rotation', 'z', e.target.value)}
                className="vector-input"
              />
              °
            </label>
          </div>
        </div>

        <div className="property-group">
          <h4>크기 (Scale)</h4>
          <div className="vector-inputs">
            <label>
              X:
              <input 
                type="number"
                step="0.1"
                min="0.1"
                value={getTransformValue('scale', 'x')}
                onChange={(e) => handleTransformChange('scale', 'x', e.target.value)}
                className="vector-input"
              />
            </label>
            <label>
              Y:
              <input 
                type="number"
                step="0.1"
                min="0.1"
                value={getTransformValue('scale', 'y')}
                onChange={(e) => handleTransformChange('scale', 'y', e.target.value)}
                className="vector-input"
              />
            </label>
            <label>
              Z:
              <input 
                type="number"
                step="0.1"
                min="0.1"
                value={getTransformValue('scale', 'z')}
                onChange={(e) => handleTransformChange('scale', 'z', e.target.value)}
                className="vector-input"
              />
            </label>
          </div>
        </div>

        <div className="property-group material-group">
          <h4>메터리얼 (Material)</h4>
          
          {/* 메터리얼 선택 */}
          {availableMaterials.length > 1 && (
            <div className="material-selector">
              <label className="material-select-label">
                메터리얼 선택:
                <select 
                  value={selectedMaterialIndex}
                  onChange={(e) => setSelectedMaterialIndex(Number(e.target.value))}
                  className="material-select"
                >
                  {availableMaterials.map((mat, index) => (
                    <option key={index} value={index}>
                      {mat.name} ({mat.meshName})
                    </option>
                  ))}
                </select>
              </label>
              <div className="material-info">
                현재: {availableMaterials[selectedMaterialIndex]?.name} 
                {availableMaterials[selectedMaterialIndex]?.material.isMeshStandardMaterial ? 
                  ' (PBR)' : ' (Basic)'}
              </div>
            </div>
          )}
          
          {/* 메터리얼이 없는 경우 */}
          {availableMaterials.length === 0 && (
            <div className="no-material">
              메터리얼이 없습니다
            </div>
          )}

          {/* 기본 속성 */}
          {availableMaterials.length > 0 && (
            <div className="material-properties">
              <label className="material-property">
                색상:
                <input 
                  type="color"
                  value={getMaterialValue('color')}
                  onChange={(e) => handleMaterialPropertyChange('color', e.target.value)}
                  className="color-input"
                />
              </label>
              
              <label className="material-property">
                메탈릭: {getMaterialValue('metalness')}
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={getMaterialValue('metalness')}
                  onChange={(e) => handleMaterialPropertyChange('metalness', e.target.value)}
                  className="material-slider"
                />
              </label>
              
              <label className="material-property">
                러프니스: {getMaterialValue('roughness')}
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={getMaterialValue('roughness')}
                  onChange={(e) => handleMaterialPropertyChange('roughness', e.target.value)}
                  className="material-slider"
                />
              </label>
            </div>
          )}

          {/* 텍스처 업로드 */}
          {availableMaterials.length > 0 && (
            <div className="texture-uploads">
              <div className="texture-upload-group">
                <label className="texture-label">
                  디퓨즈 텍스처:
                  <input 
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleTextureUpload('diffuse', e.target.files[0])}
                    className="texture-input"
                  />
                </label>
                {materialTextures.diffuse && (
                  <div className="texture-preview">
                    <img src={materialTextures.diffuse} alt="Diffuse" />
                  </div>
                )}
              </div>
              
              <div className="texture-upload-group">
                <label className="texture-label">
                  노멀 맵:
                  <input 
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleTextureUpload('normal', e.target.files[0])}
                    className="texture-input"
                  />
                </label>
                {materialTextures.normal && (
                  <div className="texture-preview">
                    <img src={materialTextures.normal} alt="Normal" />
                  </div>
                )}
              </div>
              
              <div className="texture-upload-group">
                <label className="texture-label">
                  러프니스 맵:
                  <input 
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleTextureUpload('roughness', e.target.files[0])}
                    className="texture-input"
                  />
                </label>
                {materialTextures.roughness && (
                  <div className="texture-preview">
                    <img src={materialTextures.roughness} alt="Roughness" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default ObjectPropertiesPanel
