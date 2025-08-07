/**
 * Dependency Injection Provider for React
 */
import { createContext, useContext } from 'react';

const DIContext = createContext(null);

export function DIProvider({ children, container }) {
  return (
    <DIContext.Provider value={container}>
      {children}
    </DIContext.Provider>
  );
}

/**
 * React Hook for accessing the DI Container
 */
export function useDIContainer() {
  const container = useContext(DIContext);
  if (!container) {
    throw new Error('useDIContainer must be used within a DIProvider');
  }
  return container;
}

/**
 * DI Container 사용을 위한 React Hook
 */
export function useDI() {
  const container = useContext(DIContext);
  
  if (!container) {
    console.error('useDI called outside of DIProvider context');
    throw new Error('useDI must be used within a DIProvider');
  }

  const resolve = (token) => {
    try {
      const service = container.resolve(token);
      if (!service) {
        console.error(`Service '${token}' resolved to null/undefined`);
      }
      return service;
    } catch (error) {
      console.error(`Failed to resolve service '${token}':`, error);
      return null;
    }
  };
  
  return { resolve, container };
}
