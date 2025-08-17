import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Toast from '../components/ui/Toast';
import { on as onEventBus } from '../utils/eventBus.js';

const ToastContext = createContext({
  showToast: (_msg, _type = 'info', _duration = 3000) => {},
});

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    if (!message) return;
    setToast({ message, type, duration });
  }, []);

  const onClose = useCallback(() => setToast(null), []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  // Bridge: listen to event bus 'toast' events
  useEffect(() => {
    const off = onEventBus('toast', ({ message, type, duration }) => showToast(message, type, duration));
    return () => { try { off?.() } catch {} };
  }, [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          duration={toast.duration}
          onClose={onClose}
        />
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
