import React, { useState, useRef } from 'react';
import './LibraryPanel.css';

const LibraryPanel = ({ onObjectDrop, onClose }) => {
  const [isDragging, setIsDragging] = useState(false);
  const draggedObject = useRef(null);

  // 3D 객체 라이브러리 데이터
  const objectLibrary = [
    {
      id: 'cube',
      name: '정육면체',
      thumbnail: '/icons/cube-icon.svg',
      type: 'basic',
      geometry: 'BoxGeometry',
      params: [1, 1, 1]
    },
    {
      id: 'sphere',
      name: '구체',
      thumbnail: '/icons/sphere-icon.svg',
      type: 'basic',
      geometry: 'SphereGeometry',
      params: [0.5, 32, 16]
    },
    {
      id: 'cylinder',
      name: '원기둥',
      thumbnail: '/icons/cylinder-icon.svg',
      type: 'basic',
      geometry: 'CylinderGeometry',
      params: [0.5, 0.5, 1, 32]
    },
    {
      id: 'cone',
      name: '원뿔',
      thumbnail: '/icons/cone-icon.svg',
      type: 'basic',
      geometry: 'ConeGeometry',
      params: [0.5, 1, 32]
    },
    {
      id: 'plane',
      name: '평면',
      thumbnail: '/icons/plane-icon.svg',
      type: 'basic',
      geometry: 'PlaneGeometry',
      params: [1, 1]
    },
    {
      id: 'torus',
      name: '도넛',
      thumbnail: '/icons/torus-icon.svg',
      type: 'basic',
      geometry: 'TorusGeometry',
      params: [0.5, 0.2, 16, 100]
    }
  ];

  const handleDragStart = (e, object) => {
    setIsDragging(true);
    draggedObject.current = object;
    
    // 드래그 이미지 설정
    const dragImage = new Image();
    dragImage.src = object.thumbnail;
    e.dataTransfer.setDragImage(dragImage, 25, 25);
    e.dataTransfer.setData('text/plain', JSON.stringify(object));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    draggedObject.current = null;
  };

  const handleClick = (object) => {
    // 클릭으로 객체를 중앙에 추가
    if (onObjectDrop) {
      onObjectDrop(object, { x: 0, y: 0, z: 0 });
    }
  };

  return (
    <div className="library-panel">
      <div className="library-header">
        <h3>3D 객체 라이브러리</h3>
        <button className="close-btn" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
          </svg>
        </button>
      </div>

      <div className="library-content">
        <div className="category-section">
          <h4>기본 도형</h4>
          <div className="object-grid">
            {objectLibrary.map((object) => (
              <div
                key={object.id}
                className="object-item"
                draggable
                onDragStart={(e) => handleDragStart(e, object)}
                onDragEnd={handleDragEnd}
                onClick={() => handleClick(object)}
                title={object.name}
              >
                <div className="object-thumbnail">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                    {object.id === 'cube' && (
                      <path d="M21,16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V7.5C3,7.12 3.21,6.79 3.53,6.62L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.79,6.79 21,7.12 21,7.5V16.5M12,4.15L6.04,7.5L12,10.85L17.96,7.5L12,4.15M5,15.91L11,19.29V12.58L5,9.21V15.91M19,15.91V9.21L13,12.58V19.29L19,15.91Z"/>
                    )}
                    {object.id === 'sphere' && (
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                    )}
                    {object.id === 'cylinder' && (
                      <path d="M12,2C8.14,2 5,3.79 5,6V18C5,20.21 8.14,22 12,22C15.86,22 19,20.21 19,18V6C19,3.79 15.86,2 12,2M12,4C14.67,4 17,4.9 17,6C17,7.1 14.67,8 12,8C9.33,8 7,7.1 7,6C7,4.9 9.33,4 12,4M7,9.5C8.21,10.72 9.86,11.26 12,11.26C14.14,11.26 15.79,10.72 17,9.5V18C17,19.1 14.67,20 12,20C9.33,20 7,19.1 7,18V9.5Z"/>
                    )}
                    {object.id === 'cone' && (
                      <path d="M12,2L1,21H23L12,2M12,6L19.53,19H4.47L12,6Z"/>
                    )}
                    {object.id === 'plane' && (
                      <path d="M3,3V21H21V3H3M19,19H5V5H19V19Z"/>
                    )}
                    {object.id === 'torus' && (
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/>
                    )}
                  </svg>
                </div>
                <span className="object-name">{object.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="library-instructions">
          <p>💡 팁: 객체를 3D 뷰로 드래그하거나 클릭하여 씬에 추가하세요</p>
        </div>
      </div>
    </div>
  );
};

export default LibraryPanel;
