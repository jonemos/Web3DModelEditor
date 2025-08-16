import React, { useEffect, useRef } from 'react';
import './ContextMenu.css';

const ContextMenu = ({ x, y, isVisible, onClose, selectedObject, onAddToLibrary, onAddComment, hitInfo }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  // 메뉴가 화면 밖으로 나가지 않도록 위치 조정
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 150);

  return (
    <div 
      ref={menuRef}
      className="context-menu"
      style={{
        left: adjustedX,
        top: adjustedY,
      }}
    >
      <div className="context-menu-header">
        <span>메쉬 옵션</span>
      </div>
      
      <div className="context-menu-items">
        <button
          className={`context-menu-item ${hitInfo ? '' : 'disabled'}`}
          disabled={!hitInfo}
          onClick={() => {
            if (hitInfo && onAddComment) {
              onAddComment(hitInfo);
            }
            onClose();
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9,22V19H5A2,2 0 0,1 3,17V5A2,2 0 0,1 5,3H19A2,2 0 0,1 21,5V17A2,2 0 0,1 19,19H13L9,22M7,7V9H17V7H7M7,11V13H14V11H7Z"/>
          </svg>
          <span>코멘트</span>
        </button>

        <button 
          className="context-menu-item"
          onClick={() => {
            if (selectedObject && onAddToLibrary) {
              onAddToLibrary(selectedObject);
            }
            onClose();
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
          </svg>
          <span>라이브러리에 추가</span>
        </button>

        <button 
          className="context-menu-item disabled"
          disabled
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/>
          </svg>
          <span>복제 (곧 제공)</span>
        </button>
        
        <button 
          className="context-menu-item disabled"
          disabled
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
          </svg>
          <span>삭제 (곧 제공)</span>
        </button>
      </div>
      
      {selectedObject && (
        <div className="context-menu-info">
          <span className="selected-object-name">{selectedObject.name || '이름 없음'}</span>
        </div>
      )}
    </div>
  );
};

export default ContextMenu;
