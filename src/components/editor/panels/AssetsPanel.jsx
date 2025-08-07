import React from 'react';
import './AssetsPanel.css';

const AssetsPanel = ({ onAssetDrop, onClose }) => {
  // 기본 렌더링 에셋 라이브러리
  const renderingAssets = [
    {
      id: 'start_position',
      name: '스타트 위치',
      type: 'start_position',
      description: '플레이어 시작 위치 마커'
    },
    {
      id: 'directional_light',
      name: '디렉셔널 라이트',
      type: 'directional_light',
      description: '방향성 조명 (태양광)'
    },
    {
      id: 'point_light',
      name: '포인트 라이트',
      type: 'point_light',
      description: '점 조명'
    },
    {
      id: 'spot_light',
      name: '스포트 라이트',
      type: 'spot_light',
      description: '스포트 조명'
    },
    {
      id: 'ambient_light',
      name: '앰비언트 라이트',
      type: 'ambient_light',
      description: '환경 조명'
    },
    {
      id: 'fog',
      name: '포그',
      type: 'fog',
      description: '씬 안개 효과'
    },
    {
      id: 'skybox',
      name: '스카이박스',
      type: 'skybox',
      description: '배경 하늘'
    },
    {
      id: 'post_process',
      name: '포스트 프로세스',
      type: 'post_process',
      description: '후처리 효과'
    },
    {
      id: 'camera_helper',
      name: '카메라 헬퍼',
      type: 'camera_helper',
      description: '카메라 가이드라인'
    },
    {
      id: 'grid_helper',
      name: '그리드 헬퍼',
      type: 'grid_helper',
      description: '바닥 그리드'
    },
    {
      id: 'axes_helper',
      name: '축 헬퍼',
      type: 'axes_helper',
      description: 'XYZ 축 표시'
    },
    {
      id: 'audio_source',
      name: '오디오 소스',
      type: 'audio_source',
      description: '3D 사운드 소스'
    }
  ];

  const handleAssetClick = (asset) => {
    console.log('에셋 클릭:', asset.name);
    if (onAssetDrop) {
      onAssetDrop(asset, { x: 0, y: 0, z: 0 });
    }
  };

  const handleDragStart = (e, asset) => {
    console.log('에셋 드래그 시작:', asset.name);
    
    // 드래그 이미지를 위한 캔버스 생성
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    
    // 배경 그리기
    ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
    ctx.fillRect(0, 0, 50, 50);
    
    // 아이콘 그리기 (이모지는 캔버스에서 렌더링이 어려우므로 텍스트로 대체)
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(asset.name.substring(0, 6), 25, 20);
    ctx.fillText('Asset', 25, 35);
    
    e.dataTransfer.setDragImage(canvas, 25, 25);
    e.dataTransfer.setData('text/plain', JSON.stringify(asset));
  };

  return (
    <div className="assets-panel">
      <div className="assets-header">
        <h3>기본 에셋</h3>
        <button className="close-btn" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
          </svg>
        </button>
      </div>

      <div className="assets-content">
        <div className="assets-grid">
          {renderingAssets.map((asset) => (
            <div
              key={asset.id}
              className="asset-item"
              draggable
              onDragStart={(e) => handleDragStart(e, asset)}
              onClick={() => handleAssetClick(asset)}
              title={`${asset.name}: ${asset.description}`}
            >
              <div className="asset-name">
                {asset.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AssetsPanel;
