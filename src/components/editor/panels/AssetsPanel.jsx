import React from 'react';
import './AssetsPanel.css';

const AssetsPanel = ({ onAssetDrop, onClose }) => {
  // 기본 렌더링 에셋 라이브러리
  const renderingAssets = [
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
      id: 'axes_helper',
      name: '축 헬퍼',
      type: 'axes_helper',
      description: 'XYZ 축 표시'
    }
  ];

  const handleAssetClick = (asset) => {
    if (onAssetDrop) {
      onAssetDrop(asset, { x: 0, y: 0, z: 0 });
    }
  };

  const handleDragStart = (e, asset) => {
    
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
