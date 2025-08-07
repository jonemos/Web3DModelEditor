import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { appBootstrapper } from './application/bootstrap/ApplicationBootstrapper.js'
import './index.css'

// 애플리케이션 초기화
async function initializeApp() {
  try {
    console.log('🔄 Starting application initialization...');
    await appBootstrapper.initialize();
    console.log('🚀 Application initialized successfully');
    console.log('📦 DI Container available:', !!appBootstrapper.container);
    console.log('📝 EventBus available:', !!appBootstrapper.container?.resolve('EventBus'));
    
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  } catch (error) {
    console.error('❌ Failed to initialize application:', error);
    document.getElementById('root').innerHTML = '<h1>Application failed to load</h1>';
  }
}

initializeApp();
