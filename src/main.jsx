import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Quiet console noise unless explicitly enabled
// Set window.__ENABLE_VERBOSE_LOGS__ = true in DevTools to re-enable on the fly
(() => {
  try {
    const w = window;
    const verbose = !!w.__ENABLE_VERBOSE_LOGS__;
    if (!verbose) {
      const noop = () => {};
      // Preserve warn/error by default; silence log/info/debug
      console.log = noop;
      console.info = noop;
      console.debug = noop;
    }
  } catch {}
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
