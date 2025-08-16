import { useState, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { RGBELoader } from 'three-stdlib'
import { useEditorStore } from '../../../store/editorStore'
import './HDRIPanel.css'

function HDRIPanel({ scene, onClose }) {
  // 스토어에서 HDRI 설정과 액션들 가져오기
  const hdriSettings = useEditorStore(state => state.hdriSettings)
  const updateHDRISettings = useEditorStore(state => state.updateHDRISettings)
  const sunLightRef = useEditorStore(state => state.sunLightRef)
  const setSunLightRef = useEditorStore(state => state.setSunLightRef)
  const saveHDRISettings = useEditorStore(state => state.saveHDRISettings)
  
  // 로컬 상태 (UI 관련)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const fileInputRef = useRef(null)

  // 스토어 상태를 로컬 변수로 구조 분해
  const {
    currentHDRI,
    hdriIntensity,
    hdriRotation,
    sunLightEnabled,
    sunIntensity,
    timeOfDay,
    sunAzimuth,
    sunElevation,
    sunColor
  } = hdriSettings
  
  // Toast 표시 함수
  const showToast = (message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // HDRI 설정 로드 함수 (스토어 기반)
  const loadHDRISettings = () => {
    try {
      const savedSettings = localStorage.getItem('hdriSettings')
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)
        
        // 스토어에 설정 복원
        updateHDRISettings(settings)
        
        // HDRI 환경 복원
        if (settings.currentHDRI && settings.currentHDRI.type) {
          setTimeout(() => {
            applyDefaultHDRI(settings.currentHDRI.type, settings.currentHDRI)
          }, 100)
        }
        
        
        return true
      }
    } catch (error) {
      console.error('HDRI 설정 복원 실패:', error)
    }
    return false
  }

  // 기본 제공 HDRI 목록
  const defaultHDRIs = [
    {
      name: '컨트리 로드',
      type: 'preset',
      url: '/hdr/sunny_country_road_2k.hdr',
      description: '햇살 좋은 시골길'
    },
    {
      name: '기본 스카이박스',
      type: 'gradient',
      description: '그라디언트 스카이박스'
    },
    {
      name: '기본 배경',
      type: 'none',
      description: '회색 배경'
    }
  ]

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // 파일 형식 체크 - HDRI 파일과 일반 이미지 파일 모두 허용
    const hdriExtensions = ['.hdr', '.exr', '.hdri']
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp']
    const allValidExtensions = [...hdriExtensions, ...imageExtensions]
    
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    
    if (!allValidExtensions.includes(fileExtension)) {
      showToast('지원하는 형식: HDRI(.hdr, .exr, .hdri) 또는 이미지(.jpg, .png, .webp)', 'error')
      return
    }

    // 파일 크기 검증 (200MB 제한)
    const maxSize = 200 * 1024 * 1024 // 200MB
    if (file.size > maxSize) {
      showToast('파일 크기가 너무 큽니다 (최대 200MB)', 'error')
      return
    }

    // 최소 파일 크기 검증 (100 바이트)
    if (file.size < 100) {
      showToast('파일이 너무 작습니다', 'error')
      return
    }

    const isHDRIFile = hdriExtensions.includes(fileExtension)
    
    // HDRI 파일인 경우에만 헤더 검증
    if (isHDRIFile) {
      try {
        const buffer = await file.slice(0, 20).arrayBuffer()
        const bytes = new Uint8Array(buffer)
        const header = String.fromCharCode(...bytes.slice(0, 20))
        
        // HDR 파일의 매직 넘버 확인 (더 관대하게)
        if (fileExtension === '.hdr') {
          const isValidHdr = header.includes('#?RADIANCE') || 
                            header.includes('#?RGBE') || 
                            header.includes('RADIANCE') ||
                            bytes[0] === 0x23 // '#' 문자
          
          if (!isValidHdr) {
            console.warn('HDR 파일 형식이 표준과 다를 수 있습니다:', header)
            showToast('HDR 파일 형식이 표준과 다를 수 있습니다. 일반 이미지로 시도합니다.', 'info')
          }
        }
      } catch (headerError) {
        console.warn('파일 헤더 검증 실패 (계속 진행):', headerError)
      }
    } else {
      showToast('일반 이미지 파일을 환경맵으로 사용합니다', 'info')
    }

    setIsLoading(true)

    try {
      const url = URL.createObjectURL(file)
      await loadHDRI(url, file.name)
      showToast(`${isHDRIFile ? 'HDRI' : '이미지'} 환경이 로드되었습니다`, 'success')
    } catch (error) {
      console.error('파일 로드 실패:', error)
      let errorMessage = '파일을 로드할 수 없습니다'
      
      if (error.message.includes('Bad File Format')) {
        errorMessage = '파일 형식을 읽을 수 없습니다. 다른 파일을 시도해보세요.'
      } else if (error.message.includes('network')) {
        errorMessage = '네트워크 오류로 파일을 로드할 수 없습니다'
      } else if (error.message.includes('로드 시간 초과')) {
        errorMessage = '파일 로드 시간이 초과되었습니다'
      }
      
      showToast(errorMessage, 'error')
    } finally {
      setIsLoading(false)
      // 파일 입력 초기화
      event.target.value = ''
    }
  }

  const loadHDRI = async (url, name) => {
    if (!scene) {
      throw new Error('씬이 초기화되지 않았습니다')
    }

    // 타임아웃 설정 (30초)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('로드 시간 초과')), 30000)
    })
    
    try {
      // 먼저 RGBELoader로 시도
      const texture = await Promise.race([
        loadWithRGBELoader(url),
        timeoutPromise
      ])

      // HDRI 텍스처 설정
      texture.mapping = THREE.EquirectangularReflectionMapping
      
      // 기존 텍스처 정리
      if (currentHDRI?.texture) {
        currentHDRI.texture.dispose()
      }
      
      // 씬의 환경맵과 배경 설정
      scene.environment = texture
      scene.background = texture
      
      // 강도 적용
      if (scene.backgroundIntensity !== undefined) {
        scene.backgroundIntensity = hdriIntensity
      }
      if (scene.environmentIntensity !== undefined) {
        scene.environmentIntensity = hdriIntensity
      }

      updateHDRISettings({
        currentHDRI: {
          name: name,
          texture: texture,
          url: url
        }
      })

      
    } catch (error) {
      console.error('HDRI 로드 중 오류:', error)
      
      // URL 객체 정리
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
      
      // 일반 텍스처 로더로 폴백 시도
      if (error.message.includes('Bad File Format')) {
        try {
          
          const fallbackTexture = await loadWithTextureLoader(url)
          
          fallbackTexture.mapping = THREE.EquirectangularReflectionMapping
          
          // 기존 텍스처 정리
          if (currentHDRI?.texture) {
            currentHDRI.texture.dispose()
          }
          
          scene.environment = fallbackTexture
          scene.background = fallbackTexture
          
          updateHDRISettings({
            currentHDRI: {
              name: name + ' (폴백)',
              texture: fallbackTexture,
              url: url
            }
          })
          
          
          return
        } catch (fallbackError) {
          console.error('폴백 로더도 실패:', fallbackError)
        }
      }
      
      throw error
    }
  }

  // RGBELoader를 사용한 로딩
  const loadWithRGBELoader = async (url) => {
    const loader = new RGBELoader()
    
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (texture) => {
          // 텍스처 검증
          if (!texture || !texture.image) {
            reject(new Error('텍스처 데이터가 유효하지 않습니다'))
            return
          }
          resolve(texture)
        },
        undefined,
        (error) => {
          reject(error)
        }
      )
    })
  }

  // 일반 TextureLoader를 사용한 폴백 로딩
  const loadWithTextureLoader = async (url) => {
    const loader = new THREE.TextureLoader()
    
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (texture) => {
          if (!texture || !texture.image) {
            reject(new Error('폴백 텍스처 데이터가 유효하지 않습니다'))
            return
          }
          resolve(texture)
        },
        undefined,
        (error) => {
          reject(error)
        }
      )
    })
  }

  const applyDefaultHDRI = async (hdriType, hdriData = null) => {
    if (!scene) return

    switch (hdriType) {
      case 'preset':
        // 프리셋 HDRI 로드
        if (hdriData && hdriData.url) {
          try {
            setIsLoading(true)
            await loadHDRI(hdriData.url, hdriData.name)
            showToast(`${hdriData.name} 환경이 적용되었습니다`, 'success')
          } catch (error) {
            console.error('프리셋 HDRI 로드 실패:', error)
            showToast('프리셋 환경을 로드할 수 없습니다', 'error')
          } finally {
            setIsLoading(false)
          }
        }
        break
        
      case 'gradient':
        // 그라디언트 스카이박스 생성
        // 기존 배경 제거
        if (scene.background && scene.background.isTexture) {
          scene.background.dispose()
        }
        scene.background = new THREE.Color(0x87CEEB)
        scene.environment = null
        
        updateHDRISettings({
          currentHDRI: {
            name: '기본 스카이박스',
            type: 'gradient'
          }
        })
        break

      case 'none':
        // 초기화면의 회색 배경으로 설정
        if (scene.background && scene.background.isTexture) {
          scene.background.dispose()
        }
        scene.background = new THREE.Color(0x2a2a2a) // 회색 배경
        scene.environment = null
        
        updateHDRISettings({
          currentHDRI: {
            name: '기본 배경',
            type: 'none'
          }
        })
        break
    }
  }

  const handleIntensityChange = (value) => {
    updateHDRISettings({ hdriIntensity: value })
    if (scene && currentHDRI && currentHDRI.texture && currentHDRI.type !== 'none') {
      scene.backgroundIntensity = value
      scene.environmentIntensity = value
    }
  }

  const handleRotationChange = (value) => {
    updateHDRISettings({ hdriRotation: value })
    if (scene && currentHDRI && currentHDRI.texture && currentHDRI.type !== 'none') {
      // HDRI 회전 적용
      currentHDRI.texture.rotation = value * Math.PI / 180
    }
  }

  // 태양 조명 토글
  const handleSunLightToggle = (enabled) => {
    updateHDRISettings({ sunLightEnabled: enabled })
  }

  // 시간에 따른 태양 위치 업데이트
  const updateSunPosition = (light, hour) => {
    // 시간을 0-24시간에서 0-2π 라디안으로 변환
    // 6시(새벽) = -π/2, 12시(정오) = 0, 18시(저녁) = π/2
    const timeAngle = ((hour - 12) / 12) * Math.PI

    // 시간에 따른 기본 고도각 계산 (정오에 가장 높고, 새벽/저녁에 낮음)
    const timeElevation = Math.cos(timeAngle) * Math.PI / 3 // 최대 60도
    
    // 사용자 설정 고도각과 시간 기반 고도각을 결합
    const finalElevation = (sunElevation * Math.PI / 180) * (0.5 + 0.5 * Math.cos(timeAngle))
    
    // 사용자 설정 방위각과 시간 기반 방위각을 결합
    const finalAzimuth = (sunAzimuth + (timeAngle * 180 / Math.PI)) * Math.PI / 180

    // 태양의 방향 계산
    const distance = 100
    const x = Math.sin(finalAzimuth) * Math.cos(finalElevation) * distance
    const y = Math.sin(finalElevation) * distance
    const z = Math.cos(finalAzimuth) * Math.cos(finalElevation) * distance

    light.position.set(x, y, z)
    light.lookAt(0, 0, 0)

    // 시간에 따른 색상 변화
    updateSunColor(hour)
  }

  // 수동 태양 위치 업데이트 (방위각/고도각 조절 시 사용)
  const updateSunPositionManual = (light, azimuth, elevation) => {
    const azimuthRad = azimuth * Math.PI / 180
    const elevationRad = elevation * Math.PI / 180

    const distance = 100
    const x = Math.sin(azimuthRad) * Math.cos(elevationRad) * distance
    const y = Math.sin(elevationRad) * distance
    const z = Math.cos(azimuthRad) * Math.cos(elevationRad) * distance

    light.position.set(x, y, z)
    light.lookAt(0, 0, 0)
  }

  // 시간에 따른 태양 색상 업데이트
  const updateSunColor = (hour) => {
    let color = '#ffffff'
    
    if (hour >= 5 && hour < 7) {
      // 새벽 (5-7시): 주황/빨강
      color = '#ff6b47'
    } else if (hour >= 7 && hour < 10) {
      // 아침 (7-10시): 연한 주황
      color = '#ffaa80'
    } else if (hour >= 10 && hour < 16) {
      // 낮 (10-16시): 흰색
      color = '#ffffff'
    } else if (hour >= 16 && hour < 18) {
      // 늦은 오후 (16-18시): 연한 주황
      color = '#ffcc99'
    } else if (hour >= 18 && hour < 20) {
      // 저녁 (18-20시): 주황/빨강
      color = '#ff8c66'
    } else {
      // 밤 (20-5시): 어두운 파랑
      color = '#4a6fa5'
    }

    updateHDRISettings({ sunColor: color })
    
    if (sunLightRef) {
      sunLightRef.color.setHex(color.replace('#', '0x'))
    }
  }

  // 시간 변경 핸들러
  const handleTimeChange = (hour) => {
    updateHDRISettings({ timeOfDay: hour })
    
    if (sunLightRef) {
      // 시간 변화는 색상만 업데이트하고, 위치는 수동 설정값 유지
      updateSunColor(hour)
    }
  }

  // 태양 강도 변경 핸들러
  const handleSunIntensityChange = (intensity) => {
    updateHDRISettings({ sunIntensity: intensity })
    
    if (sunLightRef) {
      sunLightRef.intensity = intensity
    }
  }

  // 태양 방위각 변경 핸들러
  const handleSunAzimuthChange = (azimuth) => {
    updateHDRISettings({ sunAzimuth: azimuth })
    
    if (sunLightRef) {
      updateSunPositionManual(sunLightRef, azimuth, sunElevation)
    }
  }

  // 태양 고도각 변경 핸들러
  const handleSunElevationChange = (elevation) => {
    updateHDRISettings({ sunElevation: elevation })
    
    if (sunLightRef) {
      updateSunPositionManual(sunLightRef, sunAzimuth, elevation)
    }
  }

  // 컴포넌트 생명주기 관리 - 이제 태양 조명을 제거하지 않음 (스토어에서 관리)
  useEffect(() => {
    // 패널이 닫혀도 태양 조명은 유지됨
    return () => {
      // 컴포넌트 언마운트 시 특별한 정리 작업 없음
      
    }
  }, [scene])

  // 스토어 상태가 변경될 때마다 자동 저장
  useEffect(() => {
    if (scene) {
      // 설정 자동 저장
      setTimeout(() => saveHDRISettings(), 100)
    }
  }, [hdriSettings, scene, saveHDRISettings])

  // 태양 조명 활성화/비활성화 관리 - 스토어 기반
  // 이 로직은 EditorPage.jsx에서 처리하므로 제거

  // 설정이 복원된 후 HDRI 환경 재적용
  useEffect(() => {
    if (scene && currentHDRI && currentHDRI.type) {
      // 강도와 회전 재적용
      if (currentHDRI.texture && currentHDRI.type !== 'none') {
        if (scene.backgroundIntensity !== undefined) {
          scene.backgroundIntensity = hdriIntensity
        }
        if (scene.environmentIntensity !== undefined) {
          scene.environmentIntensity = hdriIntensity
        }
        currentHDRI.texture.rotation = hdriRotation * Math.PI / 180
      }
    }
  }, [scene, currentHDRI, hdriIntensity, hdriRotation])

  return (
    <div className="hdri-panel">
      <div className="hdri-header">
        <h3>HDRI 환경</h3>
        <div className="header-controls">
          <span className="auto-save-indicator" title="설정이 자동으로 저장됩니다">💾</span>
          <button className="close-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="hdri-content">
        {/* 현재 HDRI 정보 */}
        <div className="category-section">
          <h4 className="category-title">현재 환경</h4>
          <div className="current-hdri-display">
            {currentHDRI ? (
              <span className="hdri-name">{currentHDRI.name}</span>
            ) : (
              <span className="no-hdri">환경 없음</span>
            )}
          </div>
        </div>

        {/* 파일 업로드 */}
        <div className="category-section">
          <h4 className="category-title">환경맵 업로드</h4>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".hdr,.exr,.hdri,.jpg,.jpeg,.png,.webp,.bmp"
            style={{ display: 'none' }}
          />
          <button 
            className="hdri-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <div className="upload-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              </svg>
            </div>
            <span>{isLoading ? '로딩중...' : '파일 선택'}</span>
          </button>
          <div className="upload-hint">
            .hdr, .exr, .hdri 지원
          </div>
        </div>

        {/* 기본 환경 */}
        <div className="category-section">
          <h4 className="category-title">기본 환경</h4>
          <div className="hdri-grid">
            {defaultHDRIs.map((hdri, index) => (
              <div
                key={index}
                className={`hdri-item ${currentHDRI?.name === hdri.name ? 'active' : ''}`}
                onClick={() => applyDefaultHDRI(hdri.type, hdri)}
                title={hdri.description}
              >
                <div className="hdri-thumbnail">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    {hdri.type === 'preset' && (
                      <path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V10.5L17.5,9L16,10.5L14.5,9L11.5,12L9,9.5L7.5,11L6,9.5L5,10.5V5H19Z"/>
                    )}
                    {hdri.type === 'gradient' && (
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                    )}
                    {hdri.type === 'none' && (
                      <path d="M3,4H7V8H3V4M9,5V7H21V5H9M3,10H7V14H3V10M9,11V13H21V11H9M3,16H7V20H3V16M9,17V19H21V17H9"/>
                    )}
                  </svg>
                </div>
                <div className="hdri-label">{hdri.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 구분선 */}
        {currentHDRI && currentHDRI.type !== 'none' && <div className="section-divider"></div>}

        {/* 환경 설정 */}
        {currentHDRI && currentHDRI.type !== 'none' && (
          <div className="category-section">
            <h4 className="category-title">환경 설정</h4>
            
            <div className="setting-item">
              <label>강도</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={hdriIntensity}
                  onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
                  className="hdri-slider"
                />
                <span className="slider-value">{hdriIntensity.toFixed(1)}</span>
              </div>
            </div>

            <div className="setting-item">
              <label>회전</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={hdriRotation}
                  onChange={(e) => handleRotationChange(parseFloat(e.target.value))}
                  className="hdri-slider"
                />
                <span className="slider-value">{hdriRotation}°</span>
              </div>
            </div>
          </div>
        )}

        {/* 태양 조명 설정 - 독립적인 섹션 */}
        <div className="category-section">
          <h4 className="category-title">태양 조명</h4>
          
          <div className="setting-item">
            <label>활성화</label>
            <input
              type="checkbox"
              checked={sunLightEnabled}
              onChange={(e) => handleSunLightToggle(e.target.checked)}
              className="setting-checkbox"
            />
          </div>

          {sunLightEnabled && (
            <>
              <div className="setting-item">
                <label>시간</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="0"
                    max="24"
                    step="0.5"
                    value={timeOfDay}
                    onChange={(e) => handleTimeChange(Number(e.target.value))}
                    className="hdri-slider"
                  />
                  <span className="slider-value">{timeOfDay}시</span>
                </div>
              </div>

              <div className="setting-item">
                <label>강도</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.1"
                    value={sunIntensity}
                    onChange={(e) => handleSunIntensityChange(Number(e.target.value))}
                    className="hdri-slider"
                  />
                  <span className="slider-value">{sunIntensity}</span>
                </div>
              </div>

              <div className="setting-item">
                <label>방위각</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    value={sunAzimuth}
                    onChange={(e) => handleSunAzimuthChange(Number(e.target.value))}
                    className="hdri-slider"
                  />
                  <span className="slider-value">{sunAzimuth}°</span>
                </div>
              </div>

              <div className="setting-item">
                <label>고도각</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="0"
                    max="90"
                    step="1"
                    value={sunElevation}
                    onChange={(e) => handleSunElevationChange(Number(e.target.value))}
                    className="hdri-slider"
                  />
                  <span className="slider-value">{sunElevation}°</span>
                </div>
              </div>

              <div className="setting-item">
                <label>색상</label>
                <div className="color-preview" style={{ backgroundColor: sunColor, padding: '4px 8px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }}>
                  {timeOfDay < 6 || timeOfDay > 20 ? '밤' : 
                   timeOfDay < 10 ? '아침' : 
                   timeOfDay < 16 ? '낮' : '저녁'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Toast 알림 */}
      {toast && (
        <div className={`hdri-toast hdri-toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default HDRIPanel
