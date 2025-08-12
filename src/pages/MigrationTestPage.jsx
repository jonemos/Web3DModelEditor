/**
 * Migration Test Page - 새로운 아키텍처 테스트
 */

import { useState, useEffect } from 'react'
import { createLegacyAdapter } from '../core/LegacyAdapter'
import { useEditorStore } from '../store/editorStore'

// 새로운 모던 컴포넌트들
import PlainEditorCanvasModern from '../components/editor/PlainEditorCanvas.Modern.jsx'

function MigrationTestPage() {
  const [adapter, setAdapter] = useState(null)
  const [status, setStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [useModernCanvas, setUseModernCanvas] = useState(false)
  
  const editorStore = useEditorStore()

  useEffect(() => {
    // 어댑터 생성
    const newAdapter = createLegacyAdapter(editorStore)
    setAdapter(newAdapter)
    
    // 초기 상태 로그
    addLog('Legacy Adapter created')
    
    return () => {
      if (newAdapter) {
        newAdapter.destroy()
      }
    }
  }, [])

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const enableNewArchitecture = async () => {
    if (!adapter) return
    
    try {
      addLog('Enabling new architecture...')
      
      // 가상의 canvas 요소 생성 (실제로는 Three.js 캔버스가 필요)
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      document.body.appendChild(canvas)
      
      await adapter.enableNewArchitecture(canvas)
      
      const newStatus = adapter.getMigrationStatus()
      setStatus(newStatus)
      addLog('✅ New architecture enabled successfully')
      
      // 테스트 정리
      document.body.removeChild(canvas)
      
    } catch (error) {
      addLog(`❌ Failed to enable new architecture: ${error.message}`)
    }
  }

  const testMigration = (feature) => {
    if (!adapter) return
    
    try {
      switch (feature) {
        case 'selectedObject':
          adapter.migrateSelectedObject()
          addLog('🔄 Migrated selectedObject to new system')
          break
        case 'transformMode':
          adapter.migrateTransformMode()
          addLog('🔄 Migrated transformMode to new system')
          break
        case 'gridVisible':
          adapter.migrateGridVisible()
          addLog('🔄 Migrated gridVisible to new system')
          break
        case 'all':
          adapter.migrateAll()
          addLog('🔄 Migrated all features to new system')
          break
        case 'rollback':
          adapter.rollbackAll()
          addLog('🔙 Rolled back all features to legacy system')
          break
      }
      
      const newStatus = adapter.getMigrationStatus()
      setStatus(newStatus)
      
    } catch (error) {
      addLog(`❌ Migration failed: ${error.message}`)
    }
  }

  // 새 캔버스 컴포넌트 토글
  const handleToggleModernCanvas = () => {
    setUseModernCanvas(!useModernCanvas)
    addLog(useModernCanvas ? '🔄 Legacy Canvas로 전환' : '🚀 Modern Canvas로 전환')
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🧪 Migration Test Dashboard</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Controls</h2>
        <button 
          onClick={enableNewArchitecture}
          disabled={status?.newArchitectureEnabled}
          style={{ marginRight: '10px', padding: '8px 12px' }}
        >
          Enable New Architecture
        </button>
        
        {status?.newArchitectureEnabled && (
          <>
            <button onClick={() => testMigration('selectedObject')} style={{ marginRight: '10px', padding: '8px 12px' }}>
              Migrate Selected Object
            </button>
            <button onClick={() => testMigration('transformMode')} style={{ marginRight: '10px', padding: '8px 12px' }}>
              Migrate Transform Mode
            </button>
            <button onClick={() => testMigration('gridVisible')} style={{ marginRight: '10px', padding: '8px 12px' }}>
              Migrate Grid Visible
            </button>
            <button onClick={() => testMigration('all')} style={{ marginRight: '10px', padding: '8px 12px' }}>
              Migrate All
            </button>
            <button onClick={() => testMigration('rollback')} style={{ padding: '8px 12px' }}>
              Rollback All
            </button>
          </>
        )}
      </div>

      {status && (
        <div style={{ marginBottom: '20px' }}>
          <h2>Migration Status</h2>
          <div style={{ background: '#f0f0f0', padding: '10px', borderRadius: '4px' }}>
            <p><strong>New Architecture:</strong> {status.newArchitectureEnabled ? '✅ Enabled' : '❌ Disabled'}</p>
            <p><strong>Services:</strong> {status.availableServices.join(', ')}</p>
            <p><strong>Plugins:</strong> {status.pluginCount}</p>
            
            {status.storeMigration && (
              <>
                <p><strong>Migration Progress:</strong> {status.storeMigration.percentage}% ({status.storeMigration.migratedFeatures}/{status.storeMigration.totalFeatures})</p>
                <ul>
                  {Object.entries(status.storeMigration.progress).map(([feature, migrated]) => (
                    <li key={feature}>
                      <strong>{feature}:</strong> {migrated ? '✅ New System' : '⚙️ Legacy System'}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      <div>
        <h2>Logs</h2>
        <div style={{ 
          background: '#1a1a1a', 
          color: '#00ff00', 
          padding: '10px', 
          borderRadius: '4px', 
          maxHeight: '300px', 
          overflowY: 'auto',
          fontFamily: 'Monaco, monospace'
        }}>
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MigrationTestPage
