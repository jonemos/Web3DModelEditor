/**
 * Migration Test Page - 새로운 아키텍처 테스트
 */

import { useState, useEffect } from 'react'
import { createLegacyAdapter } from '../core/LegacyAdapter'
import { useEditorStore, editorStoreInstance } from '../store/editorStore' // editorStoreInstance 추가

// 새로운 모던 컴포넌트들
import PlainEditorCanvasModern from '../components/editor/PlainEditorCanvas.Modern.jsx'

function MigrationTestPageNew() {
  const [adapter, setAdapter] = useState(null)
  const [status, setStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [useModernCanvas, setUseModernCanvas] = useState(false)
  
  const editorStore = useEditorStore()

  useEffect(() => {
    // 어댑터 생성 - editorStoreInstance 사용
    const newAdapter = createLegacyAdapter(editorStoreInstance)
    setAdapter(newAdapter)
    
    addLog('🏗️ Legacy Adapter 생성됨')
  }, [])

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const enableNewArchitecture = async () => {
    if (!adapter) return
    
    try {
      addLog('🚀 새 아키텍처 활성화 시작...')
      await adapter.enableNewArchitecture()
      
      const newStatus = adapter.getMigrationStatus()
      setStatus(newStatus)
      
      addLog('✅ 새 아키텍처 활성화 완료')
    } catch (error) {
      addLog(`❌ 아키텍처 활성화 실패: ${error.message}`)
    }
  }

  const testMigration = async (feature) => {
    if (!adapter) return
    
    try {
      addLog(`🔄 ${feature} 마이그레이션 시작...`)
      
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

  const loadPlugin = async (pluginName) => {
    if (!adapter || !status?.newArchitectureEnabled) {
      addLog('❌ 플러그인을 로드하려면 먼저 새 아키텍처를 활성화해야 합니다')
      return
    }

    try {
      addLog(`🔌 ${pluginName} 플러그인 로드 중...`)
      
      if (pluginName === 'transform') {
        if (adapter.legacyAdapter && adapter.legacyAdapter.services.get('transform')) {
          const transformService = adapter.legacyAdapter.services.get('transform')
          await transformService.loadPlugin?.()
          addLog('✅ 변형 플러그인 로드 완료')
        } else {
          addLog('⚠️ 변형 서비스를 찾을 수 없음')
        }
      } else if (pluginName === 'grid') {
        if (adapter.legacyAdapter && adapter.legacyAdapter.services.get('scene')) {
          addLog('✅ 그리드 플러그인 로드 완료')
        } else {
          addLog('⚠️ 씬 서비스를 찾을 수 없음')
        }
      }
    } catch (error) {
      addLog(`❌ ${pluginName} 플러그인 로드 실패: ${error.message}`)
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🔬 Migration Test Lab v2</h1>
      
      {/* 캔버스 선택 */}
      <div style={{ marginBottom: '20px', padding: '15px', background: '#f0f0f0', borderRadius: '8px' }}>
        <h2>🎨 Canvas Type Selection</h2>
        <button 
          onClick={handleToggleModernCanvas}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            background: useModernCanvas ? '#4CAF50' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {useModernCanvas ? '🚀 Modern Canvas (Active)' : '📜 Legacy Canvas (Active)'}
        </button>
        <span style={{ color: '#666' }}>
          {useModernCanvas 
            ? 'Using new architecture-aware canvas with hybrid mode' 
            : 'Using original canvas component placeholder'
          }
        </span>
      </div>

      {/* 3D Canvas */}
      <div style={{ marginBottom: '20px', border: '2px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
        {useModernCanvas ? (
          <PlainEditorCanvasModern 
            onEditorControlsReady={(controls) => addLog('🎮 Modern EditorControls ready')}
            onPostProcessingReady={(postProcessing) => addLog('✨ PostProcessing ready')}
            onContextMenu={(e) => e.preventDefault()}
          />
        ) : (
          <div style={{ 
            height: '400px', 
            background: '#2a2a2a', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'white'
          }}>
            <div style={{ textAlign: 'center' }}>
              <h3>📜 Legacy Canvas Placeholder</h3>
              <p>Original PlainEditorCanvas would be here</p>
              <p style={{ color: '#888' }}>Switch to Modern Canvas to see the new implementation</p>
            </div>
          </div>
        )}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>🎛️ Architecture Controls</h2>
        <button 
          onClick={enableNewArchitecture}
          disabled={status?.newArchitectureEnabled}
          style={{ 
            marginRight: '10px', 
            padding: '8px 12px',
            background: status?.newArchitectureEnabled ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: status?.newArchitectureEnabled ? 'not-allowed' : 'pointer'
          }}
        >
          {status?.newArchitectureEnabled ? '✅ New Architecture Enabled' : '🚀 Enable New Architecture'}
        </button>
        
        {status?.newArchitectureEnabled && (
          <>
            <button onClick={() => testMigration('selectedObject')} style={{ marginRight: '10px', padding: '8px 12px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              🎯 Migrate Selected Object
            </button>
            <button onClick={() => testMigration('transformMode')} style={{ marginRight: '10px', padding: '8px 12px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              🔄 Migrate Transform Mode
            </button>
            <button onClick={() => testMigration('gridVisible')} style={{ marginRight: '10px', padding: '8px 12px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              📏 Migrate Grid Visible
            </button>
            <button onClick={() => testMigration('all')} style={{ marginRight: '10px', padding: '8px 12px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              🔄 Migrate All
            </button>
            <button onClick={() => testMigration('rollback')} style={{ marginRight: '10px', padding: '8px 12px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              🔙 Rollback All
            </button>
          </>
        )}
      </div>

      {/* Plugin Test Section */}
      {status?.newArchitectureEnabled && (
        <div style={{ marginBottom: '20px' }}>
          <h2>🔌 Plugin Testing</h2>
          <button 
            onClick={() => loadPlugin('transform')} 
            style={{ marginRight: '10px', padding: '8px 12px', background: '#9C27B0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            🔄 Load Transform Plugin
          </button>
          <button 
            onClick={() => loadPlugin('grid')} 
            style={{ marginRight: '10px', padding: '8px 12px', background: '#9C27B0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            📏 Load Grid Plugin
          </button>
        </div>
      )}

      {/* Status Display */}
      {status && (
        <div style={{ marginBottom: '20px', padding: '15px', background: '#e8f5e8', borderRadius: '8px' }}>
          <h2>📊 Migration Status</h2>
          <div style={{ marginBottom: '10px' }}>
            <strong>New Architecture:</strong> {status.newArchitectureEnabled ? '✅ Enabled' : '❌ Disabled'}
          </div>
          
          {status.newArchitectureEnabled && (
            <>
              <h3>Feature Migration Status:</h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {Object.entries(status.migrationProgress).map(([feature, migrated]) => (
                  <li key={feature} style={{ marginBottom: '5px' }}>
                    <strong>{feature}:</strong> {migrated ? '✅ New System' : '⚙️ Legacy System'}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Logs */}
      <div>
        <h2>📝 System Logs</h2>
        <div style={{ 
          background: '#1a1a1a', 
          color: '#00ff00', 
          padding: '15px', 
          borderRadius: '8px', 
          maxHeight: '300px', 
          overflowY: 'auto',
          fontFamily: 'Monaco, Consolas, monospace',
          fontSize: '13px'
        }}>
          {logs.length === 0 && (
            <div style={{ color: '#666', fontStyle: 'italic' }}>No logs yet...</div>
          )}
          {logs.map((log, index) => (
            <div key={index} style={{ marginBottom: '2px' }}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MigrationTestPageNew
