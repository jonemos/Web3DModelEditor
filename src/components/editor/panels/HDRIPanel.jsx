import { useState, useRef } from 'react'
import * as THREE from 'three'
import { RGBELoader } from 'three-stdlib'
import './HDRIPanel.css'

function HDRIPanel({ scene, onClose }) {
  const [currentHDRI, setCurrentHDRI] = useState(null)
  const [hdriIntensity, setHdriIntensity] = useState(1)
  const [hdriRotation, setHdriRotation] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState(null)
  
  // Toast 표시 함수
  const showToast = (message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }
  const fileInputRef = useRef(null)

  // 기본 제공 HDRI 목록 (예시)
  const defaultHDRIs = [
    {
      name: '기본 스카이박스',
      type: 'gradient',
      description: '그라디언트 스카이박스'
    },
    {
      name: '없음',
      type: 'none',
      description: '배경 제거'
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

      setCurrentHDRI({
        name: name,
        texture: texture,
        url: url
      })

      console.log(`HDRI "${name}" 로드 완료`)
    } catch (error) {
      console.error('HDRI 로드 중 오류:', error)
      
      // URL 객체 정리
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
      
      // 일반 텍스처 로더로 폴백 시도
      if (error.message.includes('Bad File Format')) {
        try {
          console.log('RGBELoader 실패, TextureLoader로 폴백 시도...')
          const fallbackTexture = await loadWithTextureLoader(url)
          
          fallbackTexture.mapping = THREE.EquirectangularReflectionMapping
          
          // 기존 텍스처 정리
          if (currentHDRI?.texture) {
            currentHDRI.texture.dispose()
          }
          
          scene.environment = fallbackTexture
          scene.background = fallbackTexture
          
          setCurrentHDRI({
            name: name + ' (폴백)',
            texture: fallbackTexture,
            url: url
          })
          
          console.log(`폴백 로더로 "${name}" 로드 완료`)
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

  const applyDefaultHDRI = (hdriType) => {
    if (!scene) return

    switch (hdriType) {
      case 'gradient':
        // 그라디언트 스카이박스 생성
        const sphereGeometry = new THREE.SphereGeometry(500, 32, 32)
        const sphereMaterial = new THREE.MeshBasicMaterial({
          side: THREE.BackSide,
          color: 0x87CEEB // 하늘색
        })
        
        // 기존 배경 제거
        if (scene.background && scene.background.isTexture) {
          scene.background.dispose()
        }
        scene.background = new THREE.Color(0x87CEEB)
        scene.environment = null
        
        setCurrentHDRI({
          name: '기본 스카이박스',
          type: 'gradient'
        })
        break

      case 'none':
        // 배경 제거
        if (scene.background && scene.background.isTexture) {
          scene.background.dispose()
        }
        scene.background = null
        scene.environment = null
        
        setCurrentHDRI(null)
        break
    }
  }

  const handleIntensityChange = (value) => {
    setHdriIntensity(value)
    if (scene && currentHDRI && currentHDRI.texture) {
      scene.backgroundIntensity = value
      scene.environmentIntensity = value
    }
  }

  const handleRotationChange = (value) => {
    setHdriRotation(value)
    if (scene && currentHDRI && currentHDRI.texture) {
      // HDRI 회전 적용
      currentHDRI.texture.rotation = value * Math.PI / 180
    }
  }

  return (
    <div className="hdri-panel">
      <div className="panel-header">
        <h3>HDRI 환경</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="panel-content">
        {/* 현재 HDRI 정보 */}
        <div className="current-hdri">
          <h4>현재 환경</h4>
          <div className="hdri-info">
            {currentHDRI ? (
              <span>{currentHDRI.name}</span>
            ) : (
              <span className="no-hdri">환경 없음</span>
            )}
          </div>
        </div>

        {/* 파일 업로드 */}
        <div className="hdri-upload">
          <h4>환경맵 파일 업로드</h4>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".hdr,.exr,.hdri,.jpg,.jpeg,.png,.webp,.bmp"
            style={{ display: 'none' }}
          />
          <button 
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            {isLoading ? '로딩 중...' : '환경맵 파일 선택'}
          </button>
          <small>지원 형식: .hdr, .exr, .hdri</small>
        </div>

        {/* 기본 환경 */}
        <div className="default-hdris">
          <h4>기본 환경</h4>
          {defaultHDRIs.map((hdri, index) => (
            <button
              key={index}
              className={`hdri-item ${currentHDRI?.name === hdri.name ? 'active' : ''}`}
              onClick={() => applyDefaultHDRI(hdri.type)}
            >
              <div className="hdri-name">{hdri.name}</div>
              <div className="hdri-description">{hdri.description}</div>
            </button>
          ))}
        </div>

        {/* 환경 설정 */}
        {currentHDRI && (
          <div className="hdri-settings">
            <h4>환경 설정</h4>
            
            <div className="setting-group">
              <label>강도</label>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={hdriIntensity}
                onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
              />
              <span>{hdriIntensity}</span>
            </div>

            <div className="setting-group">
              <label>회전</label>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={hdriRotation}
                onChange={(e) => handleRotationChange(parseFloat(e.target.value))}
              />
              <span>{hdriRotation}°</span>
            </div>
          </div>
        )}
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
