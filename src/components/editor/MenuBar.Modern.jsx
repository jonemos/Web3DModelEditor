/**
 * MenuBar Modern - 플러그인 시스템과 통합된 메뉴바
 * 
 * 주요 특징:
 * - 동적 메뉴 등록 (플러그인에서 메뉴 추가 가능)
 * - 명령 시스템 통합
 * - 서비스 레지스트리 지원
 * - 실시간 플러그인 상태 표시
 */

import React, { useState, useEffect } from 'react';
import { app } from '../../core/ApplicationBootstrap.js';
import { eventBus, EventTypes } from '../../core/EventBus.js';
import './MenuBar.css';

const MenuBarModern = ({ 
  onMenuAction, 
  isNewArchitectureEnabled = false, 
  migrationStatus = {} 
}) => {
  const [activeMenu, setActiveMenu] = useState(null);
  const [services, setServices] = useState({});
  const [dynamicMenus, setDynamicMenus] = useState([]);
  const [commandHistory, setCommandHistory] = useState([]);
  const [pluginStatus, setPluginStatus] = useState([]);

  // 서비스 초기화
  useEffect(() => {
    if (!isNewArchitectureEnabled) return;

    const checkServices = () => {
      if (app.isInitialized) {
        const serviceRegistry = app.serviceRegistry;
        const commandManager = app.commandManager;
        
        setServices({
          serviceRegistry,
          commandManager,
          pluginSystem: app.pluginSystem || null
        });
      }
    };

    checkServices();
    eventBus.on(EventTypes.APP_INITIALIZED, checkServices);

    return () => {
      eventBus.off(EventTypes.APP_INITIALIZED, checkServices);
    };
  }, [isNewArchitectureEnabled]);

  // 동적 메뉴 등록 시스템
  useEffect(() => {
    if (!services.serviceRegistry) return;

    const handleMenuRegistered = (event) => {
      const { menuId, title, items, category } = event.detail;
      setDynamicMenus(prev => [
        ...prev.filter(m => m.id !== menuId),
        { id: menuId, title, items, category }
      ]);
    };

    const handleMenuUnregistered = (event) => {
      const { menuId } = event.detail;
      setDynamicMenus(prev => prev.filter(m => m.id !== menuId));
    };

    eventBus.on(EventTypes.MENU_REGISTERED, handleMenuRegistered);
    eventBus.on(EventTypes.MENU_UNREGISTERED, handleMenuUnregistered);

    return () => {
      eventBus.off(EventTypes.MENU_REGISTERED, handleMenuRegistered);
      eventBus.off(EventTypes.MENU_UNREGISTERED, handleMenuUnregistered);
    };
  }, [services.serviceRegistry]);

  // 명령 히스토리 추적
  useEffect(() => {
    if (!services.commandManager) return;

    const handleCommandExecuted = (event) => {
      const { command, timestamp } = event.detail;
      setCommandHistory(prev => [
        { command, timestamp, type: 'execute' },
        ...prev.slice(0, 49) // 최근 50개만 유지
      ]);
    };

    const handleCommandUndone = (event) => {
      const { command, timestamp } = event.detail;
      setCommandHistory(prev => [
        { command, timestamp, type: 'undo' },
        ...prev.slice(0, 49)
      ]);
    };

    eventBus.on(EventTypes.COMMAND_EXECUTED, handleCommandExecuted);
    eventBus.on(EventTypes.COMMAND_UNDONE, handleCommandUndone);

    return () => {
      eventBus.off(EventTypes.COMMAND_EXECUTED, handleCommandExecuted);
      eventBus.off(EventTypes.COMMAND_UNDONE, handleCommandUndone);
    };
  }, [services.commandManager]);

  // 플러그인 상태 추적
  useEffect(() => {
    if (!services.pluginSystem) return;

    const handlePluginLoaded = (event) => {
      const { pluginName, pluginInfo } = event.detail;
      setPluginStatus(prev => [
        ...prev.filter(p => p.name !== pluginName),
        { name: pluginName, status: 'loaded', info: pluginInfo }
      ]);
    };

    const handlePluginUnloaded = (event) => {
      const { pluginName } = event.detail;
      setPluginStatus(prev => prev.filter(p => p.name !== pluginName));
    };

    eventBus.on(EventTypes.PLUGIN_LOADED, handlePluginLoaded);
    eventBus.on(EventTypes.PLUGIN_UNLOADED, handlePluginUnloaded);

    return () => {
      eventBus.off(EventTypes.PLUGIN_LOADED, handlePluginLoaded);
      eventBus.off(EventTypes.PLUGIN_UNLOADED, handlePluginUnloaded);
    };
  }, [services.pluginSystem]);

  // 명령 실행
  const executeCommand = async (commandId, params = {}) => {
    if (!services.commandManager) {
      console.warn('Command Manager not available');
      return;
    }

    try {
      await services.commandManager.executeCommand(commandId, params);
      console.log(`✅ Menu command executed: ${commandId}`);
    } catch (error) {
      console.error(`❌ Menu command failed: ${commandId}`, error);
    }
  };

  // 기본 메뉴 구조
  const getBaseMenus = () => [
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
        { 
          label: '실행 취소', 
          action: isNewArchitectureEnabled ? 'cmd:undo' : 'undo', 
          shortcut: 'Ctrl+Z' 
        },
        { 
          label: '다시 실행', 
          action: isNewArchitectureEnabled ? 'cmd:redo' : 'redo', 
          shortcut: 'Ctrl+Y' 
        },
        { type: 'separator' },
        { label: '복사', action: 'copy', shortcut: 'Ctrl+C' },
        { label: '붙여넣기', action: 'paste', shortcut: 'Ctrl+V' },
        { 
          label: '삭제', 
          action: isNewArchitectureEnabled ? 'cmd:deleteObject' : 'delete', 
          shortcut: 'Delete' 
        },
        { type: 'separator' },
        { label: '전체 선택', action: 'select-all', shortcut: 'Ctrl+A' },
        { 
          label: '선택 해제', 
          action: isNewArchitectureEnabled ? 'cmd:deselectAll' : 'deselect-all', 
          shortcut: 'Ctrl+D' 
        }
      ]
    },
    {
      title: '변형',
      items: [
        { 
          label: '이동 모드', 
          action: isNewArchitectureEnabled ? 'cmd:setTransformMode:translate' : 'transform-move', 
          shortcut: 'W' 
        },
        { 
          label: '회전 모드', 
          action: isNewArchitectureEnabled ? 'cmd:setTransformMode:rotate' : 'transform-rotate', 
          shortcut: 'E' 
        },
        { 
          label: '크기 모드', 
          action: isNewArchitectureEnabled ? 'cmd:setTransformMode:scale' : 'transform-scale', 
          shortcut: 'R' 
        },
        { type: 'separator' },
        { label: '좌표계 전환', action: 'toggle-transform-space', shortcut: 'Q' },
        { label: '스냅 토글', action: 'toggle-snap', shortcut: 'X' }
      ]
    },
    {
      title: '카메라',
      items: [
        { 
          label: '카메라 리셋', 
          action: isNewArchitectureEnabled ? 'cmd:resetCamera' : 'camera-reset', 
          shortcut: 'Numpad 0' 
        },
        { 
          label: '투영 모드 전환', 
          action: isNewArchitectureEnabled ? 'cmd:toggleCameraProjection' : 'camera-projection', 
          shortcut: 'Numpad 5' 
        },
        { label: '선택 객체 포커스', action: 'camera-focus', shortcut: 'F' },
        { type: 'separator' },
        { label: '정면 뷰', action: 'camera-view-front', shortcut: 'Numpad 1' },
        { label: '측면 뷰', action: 'camera-view-side', shortcut: 'Numpad 3' },
        { label: '상단 뷰', action: 'camera-view-top', shortcut: 'Numpad 7' }
      ]
    },
    {
      title: '그리드',
      items: [
        { 
          label: '그리드 토글', 
          action: isNewArchitectureEnabled ? 'cmd:toggleGrid' : 'grid-toggle', 
          shortcut: 'G' 
        },
        { 
          label: '그리드 크기 변경', 
          action: isNewArchitectureEnabled ? 'cmd:setGridSize' : 'grid-size' 
        },
        { 
          label: '그리드 분할 변경', 
          action: isNewArchitectureEnabled ? 'cmd:setGridDivisions' : 'grid-divisions' 
        }
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
          { type: 'separator' },
          { label: '🎯 서비스 레지스트리', action: 'show-service-registry' },
          { label: '🔄 이벤트 버스', action: 'show-event-bus' }
        ] : []),
        { type: 'separator' },
        { label: '⚙️ 설정', action: 'settings' },
        { label: '❓ 도움말', action: 'help' }
      ]
    }
  ];

  // 모든 메뉴 (기본 + 동적)
  const getAllMenus = () => {
    const baseMenus = getBaseMenus();
    
    // 카테고리별로 동적 메뉴 그룹화
    const menusByCategory = dynamicMenus.reduce((acc, menu) => {
      const category = menu.category || '플러그인';
      if (!acc[category]) acc[category] = [];
      acc[category].push(menu);
      return acc;
    }, {});

    // 동적 메뉴를 카테고리별로 추가
    Object.entries(menusByCategory).forEach(([category, menus]) => {
      baseMenus.push({
        title: category,
        items: menus.flatMap(menu => menu.items)
      });
    });

    return baseMenus;
  };

  // 메뉴 아이템 클릭 처리
  const handleMenuItemClick = (action) => {
    setActiveMenu(null);

    // 명령 시스템 통합
    if (action.startsWith('cmd:')) {
      const [, commandId, ...params] = action.split(':');
      
      if (commandId === 'setTransformMode' && params.length > 0) {
        executeCommand('setTransformMode', { mode: params[0] });
      } else {
        executeCommand(commandId);
      }
      return;
    }

    // 특별한 액션들
    switch (action) {
      case 'show-command-history':
        showCommandHistory();
        break;
      case 'show-system-status':
        showSystemStatus();
        break;
      case 'manage-plugins':
        showPluginManager();
        break;
      case 'show-service-registry':
        showServiceRegistry();
        break;
      case 'show-event-bus':
        showEventBusStatus();
        break;
      default:
        // 기본 액션은 부모 컴포넌트에 전달
        if (onMenuAction) {
          onMenuAction(action);
        }
    }
  };

  // 명령 히스토리 표시
  const showCommandHistory = () => {
    console.log('📜 Command History:', commandHistory);
    // TODO: 모달이나 패널로 히스토리 표시
  };

  // 시스템 상태 표시
  const showSystemStatus = () => {
    const status = {
      isNewArchitectureEnabled,
      services: Object.keys(services),
      pluginsLoaded: pluginStatus.length,
      commandHistoryLength: commandHistory.length,
      dynamicMenusCount: dynamicMenus.length
    };
    console.log('📊 System Status:', status);
    // TODO: 시스템 상태 패널 표시
  };

  // 플러그인 매니저 표시
  const showPluginManager = () => {
    console.log('🔌 Plugin Status:', pluginStatus);
    // TODO: 플러그인 관리 패널 표시
  };

  // 서비스 레지스트리 상태 표시
  const showServiceRegistry = () => {
    if (services.serviceRegistry) {
      const registeredServices = services.serviceRegistry.getAllServices?.() || {};
      console.log('🎯 Service Registry:', registeredServices);
    }
  };

  // 이벤트 버스 상태 표시
  const showEventBusStatus = () => {
    if (eventBus.getStats) {
      console.log('🔄 Event Bus Stats:', eventBus.getStats());
    }
  };

  return (
    <div className="menu-bar modern-menu-bar">
      {/* 아키텍처 상태 표시 */}
      <div className="architecture-indicator">
        <span className={`indicator ${isNewArchitectureEnabled ? 'modern' : 'legacy'}`}>
          {isNewArchitectureEnabled ? '🚀' : '⚡'}
        </span>
        {isNewArchitectureEnabled && pluginStatus.length > 0 && (
          <span className="plugin-count">{pluginStatus.length}</span>
        )}
      </div>

      {/* 메뉴 항목들 */}
      {getAllMenus().map((menu, index) => (
        <div key={index} className="menu-item">
          <button
            className={`menu-button ${activeMenu === index ? 'active' : ''}`}
            onClick={() => setActiveMenu(activeMenu === index ? null : index)}
          >
            {menu.title}
          </button>
          
          {activeMenu === index && (
            <div className="menu-dropdown">
              {menu.items.map((item, itemIndex) => (
                item.type === 'separator' ? (
                  <div key={itemIndex} className="menu-separator" />
                ) : (
                  <button
                    key={itemIndex}
                    className="menu-dropdown-item"
                    onClick={() => handleMenuItemClick(item.action)}
                  >
                    <span className="menu-label">{item.label}</span>
                    {item.shortcut && (
                      <span className="menu-shortcut">{item.shortcut}</span>
                    )}
                  </button>
                )
              ))}
            </div>
          )}
        </div>
      ))}

      {/* 개발 환경에서 디버그 정보 */}
      {process.env.NODE_ENV === 'development' && isNewArchitectureEnabled && (
        <div className="debug-info">
          <small>
            Services: {Object.keys(services).length} | 
            Plugins: {pluginStatus.length} | 
            Commands: {commandHistory.length}
          </small>
        </div>
      )}
    </div>
  );
};

export default MenuBarModern;
