// Minimal event bus to decouple store from UI
const listeners = new Map();

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
}

export function off(event, handler) {
  listeners.get(event)?.delete(handler);
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const h of set) {
    try { h(payload); } catch {}
  }
}

export function toast(message, type = 'info', duration = 3000) {
  emit('toast', { message, type, duration });
}
