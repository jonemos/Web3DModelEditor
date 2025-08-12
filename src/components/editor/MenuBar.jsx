import React, { useState } from 'react';
import './MenuBar.css';

const MenuBar = ({ onMenuAction, isNewArchitectureEnabled, migrationStatus }) => {
  const [activeMenu, setActiveMenu] = useState(null);

  const menus = [
    {
      title: '파일',
      items: [
        { label: '새 맵', action: 'new-map', shortcut: 'Ctrl+N' },
        { label: '불러오기', action: 'load-map', shortcut: 'Ctrl+O' },
        { label: '저장하기', action: 'save-map', shortcut: 'Ctrl+S' },
        { type: 'separator' },
        { label: '임포트', action: 'import' },
        { label: '익스포트', action: 'export' },
        { type: 'separator' },
        { label: '나가기', action: 'exit', shortcut: 'Alt+F4' }
      ]
    },
    {
      title: '에디터',
      items: [
        { label: '실행 취소', action: 'undo', shortcut: 'Ctrl+Z' },
        { label: '다시 실행', action: 'redo', shortcut: 'Ctrl+Y' },
        { type: 'separator' },
        { label: '복사', action: 'copy', shortcut: 'Ctrl+C' },
        { label: '붙여넣기', action: 'paste', shortcut: 'Ctrl+V' },
        { label: '삭제', action: 'delete', shortcut: 'Delete' },
        { type: 'separator' },
        { label: '전체 선택', action: 'select-all', shortcut: 'Ctrl+A' },
        { label: '선택 해제', action: 'deselect-all', shortcut: 'Ctrl+D' }
      ]
    },
    {
      title: '시스템',
      items: [
        { 
          label: isNewArchitectureEnabled ? '✅ 새 아키텍처 (활성)' : '🔧 새 아키텍처 활성화', 
          action: isNewArchitectureEnabled ? 'show-migration-status' : 'enable-new-architecture'
        },
        ...(isNewArchitectureEnabled ? [
          { label: '🔌 플러그인 관리', action: 'manage-plugins' },
          { label: '⚡ 명령어 히스토리', action: 'show-command-history' },
          { label: '📊 시스템 상태', action: 'show-system-status' },
          { type: 'separator' }
        ] : []),
        { label: '⚙️ 기존 시스템 설정', action: 'legacy-settings' }
      ]
    },
    {
      title: '윈도우',
      items: [
        { label: '뷰포트 리셋', action: 'reset-viewport' },
        { label: '카메라 리셋', action: 'reset-camera' },
        { type: 'separator' },
        { label: '그리드 토글', action: 'toggle-grid' },
        { label: '통계 표시', action: 'toggle-stats' },
        { type: 'separator' },
        { label: '인스펙터', action: 'toggle-inspector', shortcut: 'I' },
        { type: 'separator' },
        { label: '전체화면', action: 'fullscreen', shortcut: 'F11' }
      ]
    },
    {
      title: '정보',
      items: [
        { label: '단축키', action: 'show-shortcuts' },
        { label: '도움말', action: 'show-help', shortcut: 'F1' },
        { type: 'separator' },
        { label: '프로그램 정보', action: 'about' }
      ]
    }
  ];

  const handleMenuClick = (menuIndex) => {
    setActiveMenu(activeMenu === menuIndex ? null : menuIndex);
  };

  const handleMenuItemClick = (action) => {
    setActiveMenu(null);
    if (onMenuAction) {
      onMenuAction(action);
    }
  };

  // 메뉴 영역 외부 클릭 시 메뉴 닫기
  const handleOutsideClick = (e) => {
    if (!e.target.closest('.menu-bar')) {
      setActiveMenu(null);
    }
  };

  // 메뉴 영역 외부 클릭 감지
  React.useEffect(() => {
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  return (
    <div className="menu-bar">
      <div className="menu-items">
        {menus.map((menu, index) => (
          <div 
            key={index} 
            className={`menu-item ${activeMenu === index ? 'active' : ''}`}
            onClick={() => handleMenuClick(index)}
          >
            <span className="menu-title">{menu.title}</span>
            
            {activeMenu === index && (
              <div className="dropdown-menu">
                {menu.items.map((item, itemIndex) => (
                  item.type === 'separator' ? (
                    <div key={itemIndex} className="menu-separator" />
                  ) : (
                    <div 
                      key={itemIndex}
                      className="dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuItemClick(item.action);
                      }}
                    >
                      <span className="item-label">{item.label}</span>
                      {item.shortcut && (
                        <span className="item-shortcut">{item.shortcut}</span>
                      )}
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MenuBar;
