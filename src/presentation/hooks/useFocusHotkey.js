/**
 * F키 포커스 기능을 위한 커스텀 훅
 * Clean Architecture 패턴에 맞게 분리된 커스텀 훅
 */

import { useEffect } from 'react';
import { useEditorService } from './useEditorService.js';
import { useEventBus } from '../../infrastructure/events/EventBus.js';

/**
 * F키 포커스 기능을 제공하는 훅
 * @param {function} showToast - 토스트 메시지 표시 함수
 * @returns {object} 포커스 관련 함수들
 */
export function useFocusHotkey(showToast) {
  const editorService = useEditorService();
  const eventBus = useEventBus();

  // F키 포커스 기능 실행
  const executeF키Focus = () => {
    try {
      const selectedObjects = editorService.getSelectedObjects();
      
      if (!selectedObjects || selectedObjects.length === 0) {
        showToast('선택된 오브젝트가 없습니다. 먼저 오브젝트를 선택해주세요.', 'warning');
        return false;
      }

      // EditorService를 통해 포커스 요청
      const success = editorService.focusOnSelectedObject();
      
      if (success) {
        const objectName = selectedObjects[selectedObjects.length - 1];
        showToast(`'${objectName}'으로 포커스했습니다.`, 'success');
      }
      
      return success;
    } catch (error) {
      console.error('F키 포커스 실행 중 오류:', error);
      showToast('포커스 실행 중 오류가 발생했습니다.', 'error');
      return false;
    }
  };

  // 선택된 오브젝트의 이름 가져오기
  const getSelectedObjectName = () => {
    const selectedObjects = editorService.getSelectedObjects();
    if (selectedObjects && selectedObjects.length > 0) {
      return selectedObjects[selectedObjects.length - 1];
    }
    return null;
  };

  // 포커스 가능 여부 확인
  const canFocus = () => {
    const selectedObjects = editorService.getSelectedObjects();
    return selectedObjects && selectedObjects.length > 0;
  };

  return {
    executeF키Focus,
    getSelectedObjectName,
    canFocus
  };
}
