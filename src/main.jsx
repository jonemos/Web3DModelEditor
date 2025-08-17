import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { logger } from './utils/logger.js'
// Example logs to verify behavior
logger.debug('App starting (debug)');
logger.info('App starting (info)');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
