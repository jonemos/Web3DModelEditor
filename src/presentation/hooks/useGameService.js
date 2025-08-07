/**
 * 게임 서비스 사용을 위한 React Hook
 */

import { useDI } from '../../infrastructure/react/providers/DIProvider.jsx';

export function useGameService() {
  const { resolve } = useDI();
  return resolve('GameService');
}

export function useRenderManager() {
  const { resolve } = useDI();
  return resolve('RenderManager');
}

export function usePerformanceMonitor() {
  const { resolve } = useDI();
  return resolve('PerformanceMonitor');
}
