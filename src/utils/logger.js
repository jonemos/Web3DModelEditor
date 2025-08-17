const levelPriority = { error: 0, warn: 1, info: 2, debug: 3 };

function getLevel() {
  try {
    const v = import.meta.env?.VITE_LOG_LEVEL || 'info';
    const key = String(v).toLowerCase();
    return levelPriority[key] !== undefined ? key : 'info';
  } catch {
    return 'info';
  }
}

function shouldLog(lvl) {
  const cur = getLevel();
  return levelPriority[lvl] <= levelPriority[cur];
}

export const logger = {
  info: (...args) => { if (shouldLog('info')) console.info('[INFO]', ...args); },
  warn: (...args) => { if (shouldLog('warn')) console.warn('[WARN]', ...args); },
  error: (...args) => { if (shouldLog('error')) console.error('[ERROR]', ...args); },
  debug: (...args) => { if (shouldLog('debug')) console.debug?.('[DEBUG]', ...args); },
};
