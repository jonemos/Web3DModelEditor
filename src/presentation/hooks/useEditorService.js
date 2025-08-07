/**
 * 에디터 서비스 사용을 위한 React Hook
 */

import { useDI } from '../../infrastructure/react/providers/DIProvider.jsx';

export function useEditorService() {
  const { resolve } = useDI();
  return resolve('EditorService');
}

export function useSceneManager() {
  const { resolve } = useDI();
  return resolve('SceneManager');
}

export function useObjectFactory() {
  const { resolve } = useDI();
  return resolve('ObjectFactory');
}

export function useSelectionManager() {
  const { resolve } = useDI();
  return resolve('SelectionManager');
}

export function useHistoryManager() {
  const { resolve } = useDI();
  return resolve('HistoryManager');
}
