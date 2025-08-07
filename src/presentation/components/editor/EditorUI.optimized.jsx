/**
 * 리팩토링된 EditorUI - 낮은 결합도와 높은 응집도 적용
 */
import React, { useMemo } from 'react';
import { useDI } from '../../core/di/DIContainer.js';
import { useEventBus } from '../../core/events/EventBus.js';
import { useStateManager } from '../../core/state/Observable.js';
import { SERVICE_TOKENS } from '../../core/di/DIContainer.js';
import { EVENT_TYPES } from '../../core/events/EventBus.js';

// 개별 패널 컴포넌트들 (높은 응집도)
import { ToolbarPanel } from './panels/ToolbarPanel';
import { PropertiesPanel } from './panels/PropertiesPanel';
import { HierarchyPanel } from './panels/HierarchyPanel';
import { LibraryPanel } from './panels/LibraryPanel';
import { StatusBar } from './panels/StatusBar';

/**
 * 메인 에디터 UI 컨테이너
 * - 의존성 주입을 통한 낮은 결합도
 * - 이벤트 기반 통신
 * - 상태 관리 분리
 */
export const EditorUI = React.memo(function EditorUI() {
  // 의존성 주입을 통한 서비스 접근
  const editorService = useDI(SERVICE_TOKENS.EDITOR_SERVICE);
  const stateManager = useDI(SERVICE_TOKENS.STATE_MANAGER);
  
  // 상태 구독 (반응형)
  const selectedObject = useStateManager(stateManager, 'editor.selectedObject');
  const transformMode = useStateManager(stateManager, 'editor.transformMode');
  const uiState = useStateManager(stateManager, 'ui.sidebarVisible');
  
  // 이벤트 발행 함수
  const emit = useEventBus();
  
  // 메모이제이션된 패널 설정
  const panelConfig = useMemo(() => ({
    toolbar: {
      visible: true,
      position: 'top',
      tools: ['select', 'translate', 'rotate', 'scale']
    },
    properties: {
      visible: selectedObject !== null,
      position: 'right',
      width: 300
    },
    hierarchy: {
      visible: uiState,
      position: 'left',
      width: 250
    },
    library: {
      visible: false, // 필요시 토글
      position: 'bottom',
      height: 200
    }
  }), [selectedObject, uiState]);

  // 패널 간 통신을 위한 이벤트 핸들러들
  const handleToolChange = React.useCallback((tool) => {
    stateManager.set('editor.transformMode', tool);
    emit(EVENT_TYPES.EDITOR.TOOL_CHANGED, { tool });
  }, [stateManager, emit]);

  const handleObjectSelect = React.useCallback((object) => {
    editorService.selectObject(object);
  }, [editorService]);

  const handleObjectAdd = React.useCallback(async (type, config) => {
    try {
      const object = await editorService.addObject(type, config);
      emit(EVENT_TYPES.UI.TOAST_SHOWN, {
        message: `${type} 추가됨`,
        type: 'success'
      });
      return object;
    } catch (error) {
      emit(EVENT_TYPES.UI.TOAST_SHOWN, {
        message: `오브젝트 추가 실패: ${error.message}`,
        type: 'error'
      });
    }
  }, [editorService, emit]);

  return (
    <div className="editor-ui">
      {/* 상단 툴바 */}
      {panelConfig.toolbar.visible && (
        <ToolbarPanel
          position={panelConfig.toolbar.position}
          tools={panelConfig.toolbar.tools}
          activeTool={transformMode}
          onToolChange={handleToolChange}
        />
      )}

      {/* 메인 작업 영역 */}
      <div className="editor-workspace">
        {/* 좌측 패널 */}
        {panelConfig.hierarchy.visible && (
          <div 
            className="editor-sidebar left"
            style={{ width: panelConfig.hierarchy.width }}
          >
            <HierarchyPanel
              onObjectSelect={handleObjectSelect}
              selectedObject={selectedObject}
            />
          </div>
        )}

        {/* 중앙 3D 뷰포트 */}
        <div className="editor-viewport">
          {/* 3D Canvas는 별도 컴포넌트에서 관리 */}
        </div>

        {/* 우측 패널 */}
        {panelConfig.properties.visible && (
          <div 
            className="editor-sidebar right"
            style={{ width: panelConfig.properties.width }}
          >
            <PropertiesPanel
              selectedObject={selectedObject}
              transformMode={transformMode}
            />
          </div>
        )}
      </div>

      {/* 하단 패널 */}
      {panelConfig.library.visible && (
        <div 
          className="editor-bottom-panel"
          style={{ height: panelConfig.library.height }}
        >
          <LibraryPanel
            onObjectAdd={handleObjectAdd}
          />
        </div>
      )}

      {/* 상태바 */}
      <StatusBar />
    </div>
  );
});

/**
 * 툴바 패널 - 단일 책임 원칙
 */
const ToolbarPanel = React.memo(function ToolbarPanel({ 
  tools, 
  activeTool, 
  onToolChange,
  position = 'top' 
}) {
  const toolConfig = {
    select: { icon: '↖️', label: '선택', shortcut: 'Q' },
    translate: { icon: '↔️', label: '이동', shortcut: 'W' },
    rotate: { icon: '🔄', label: '회전', shortcut: 'E' },
    scale: { icon: '🔍', label: '크기', shortcut: 'R' }
  };

  return (
    <div className={`toolbar-panel toolbar-${position}`}>
      <div className="toolbar-group">
        {tools.map(tool => (
          <button
            key={tool}
            className={`toolbar-btn ${activeTool === tool ? 'active' : ''}`}
            onClick={() => onToolChange(tool)}
            title={`${toolConfig[tool].label} (${toolConfig[tool].shortcut})`}
          >
            <span className="tool-icon">{toolConfig[tool].icon}</span>
            <span className="tool-label">{toolConfig[tool].label}</span>
          </button>
        ))}
      </div>
      
      {/* 추가 툴바 그룹들 */}
      <div className="toolbar-group">
        <ToolbarSeparator />
        <UndoRedoButtons />
        <ToolbarSeparator />
        <ViewportControls />
      </div>
    </div>
  );
});

/**
 * 실행 취소/다시 실행 버튼
 */
const UndoRedoButtons = React.memo(function UndoRedoButtons() {
  const commandService = useDI(SERVICE_TOKENS.COMMAND_SERVICE);
  const canUndo = useStateManager(stateManager, 'ui.canUndo');
  const canRedo = useStateManager(stateManager, 'ui.canRedo');

  const handleUndo = React.useCallback(() => {
    if (commandService.canUndo()) {
      commandService.undo();
    }
  }, [commandService]);

  const handleRedo = React.useCallback(() => {
    if (commandService.canRedo()) {
      commandService.redo();
    }
  }, [commandService]);

  return (
    <>
      <button
        className={`toolbar-btn ${!canUndo ? 'disabled' : ''}`}
        onClick={handleUndo}
        disabled={!canUndo}
        title="실행 취소 (Ctrl+Z)"
      >
        ↶ 실행 취소
      </button>
      <button
        className={`toolbar-btn ${!canRedo ? 'disabled' : ''}`}
        onClick={handleRedo}
        disabled={!canRedo}
        title="다시 실행 (Ctrl+Y)"
      >
        ↷ 다시 실행
      </button>
    </>
  );
});

/**
 * 뷰포트 컨트롤
 */
const ViewportControls = React.memo(function ViewportControls() {
  const emit = useEventBus();
  const gridVisible = useStateManager(stateManager, 'editor.gridVisible');

  const handleGridToggle = React.useCallback(() => {
    const newGridVisible = !gridVisible;
    stateManager.set('editor.gridVisible', newGridVisible);
    emit(EVENT_TYPES.EDITOR.SCENE_UPDATED, { gridVisible: newGridVisible });
  }, [gridVisible, emit]);

  const handleCameraReset = React.useCallback(() => {
    emit(EVENT_TYPES.EDITOR.CAMERA_CHANGED, { action: 'reset' });
  }, [emit]);

  return (
    <>
      <button
        className={`toolbar-btn ${gridVisible ? 'active' : ''}`}
        onClick={handleGridToggle}
        title="격자 표시 토글"
      >
        🔲 격자
      </button>
      <button
        className="toolbar-btn"
        onClick={handleCameraReset}
        title="카메라 리셋"
      >
        📷 리셋
      </button>
    </>
  );
});

/**
 * 툴바 구분선
 */
const ToolbarSeparator = React.memo(function ToolbarSeparator() {
  return <div className="toolbar-separator" />;
});

/**
 * 속성 패널 - 선택된 오브젝트의 속성 편집
 */
const PropertiesPanel = React.memo(function PropertiesPanel({ 
  selectedObject, 
  transformMode 
}) {
  const editorService = useDI(SERVICE_TOKENS.EDITOR_SERVICE);
  
  // 속성 변경 핸들러
  const handlePropertyChange = React.useCallback((property, value) => {
    if (!selectedObject) return;
    
    // 명령 패턴을 통한 변경 (Undo/Redo 지원)
    const oldValue = selectedObject[property];
    const command = new TransformObjectCommand(
      selectedObject.userData.id,
      { [property]: value },
      { [property]: oldValue }
    );
    
    editorService.executeCommand(command);
  }, [selectedObject, editorService]);

  if (!selectedObject) {
    return (
      <div className="properties-panel">
        <div className="panel-header">속성</div>
        <div className="panel-content">
          <p>선택된 오브젝트가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="properties-panel">
      <div className="panel-header">
        속성 - {selectedObject.name}
      </div>
      <div className="panel-content">
        <TransformProperties
          object={selectedObject}
          onChange={handlePropertyChange}
        />
        <MaterialProperties
          object={selectedObject}
          onChange={handlePropertyChange}
        />
      </div>
    </div>
  );
});

/**
 * 계층 구조 패널
 */
const HierarchyPanel = React.memo(function HierarchyPanel({
  onObjectSelect,
  selectedObject
}) {
  const sceneManager = useDI(SERVICE_TOKENS.SCENE_MANAGER);
  const [sceneObjects, setSceneObjects] = React.useState([]);

  // 씬 오브젝트 목록 구독
  useEventBus(EVENT_TYPES.EDITOR.OBJECT_ADDED, () => {
    setSceneObjects(sceneManager.getAllObjects());
  });

  useEventBus(EVENT_TYPES.EDITOR.OBJECT_REMOVED, () => {
    setSceneObjects(sceneManager.getAllObjects());
  });

  React.useEffect(() => {
    setSceneObjects(sceneManager.getAllObjects());
  }, [sceneManager]);

  return (
    <div className="hierarchy-panel">
      <div className="panel-header">씬 계층 구조</div>
      <div className="panel-content">
        <ObjectTree
          objects={sceneObjects}
          selectedObject={selectedObject}
          onObjectSelect={onObjectSelect}
        />
      </div>
    </div>
  );
});

export default EditorUI;
