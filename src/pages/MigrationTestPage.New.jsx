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

  // 명령 시스템 테스트 함수들
  const testSelectObjectCommand = async () => {
    if (!adapter || !status?.newArchitectureEnabled) {
      addLog('❌ 명령을 실행하려면 먼저 새 아키텍처를 활성화해야 합니다')
      return
    }

    try {
      const commandManager = adapter.legacyAdapter.services.get('commandManager')
      if (!commandManager) {
        addLog('❌ CommandManager 서비스를 찾을 수 없습니다')
        return
      }

      // 가상의 객체 데이터로 테스트
      const mockObject = { 
        id: 'test-object-' + Date.now(), 
        name: 'Test Object', 
        type: 'Mesh',
        userData: { selected: false }
      }
      
      await commandManager.execute('selectObject', { object: mockObject })
      addLog(`✅ Select Object 명령 실행 완료 - Object: ${mockObject.name}`)
    } catch (error) {
      addLog(`❌ Select Object 명령 실행 실패: ${error.message}`)
    }
  }

  const testDeselectAllCommand = async () => {
    if (!adapter || !status?.newArchitectureEnabled) {
      addLog('❌ 명령을 실행하려면 먼저 새 아키텍처를 활성화해야 합니다')
      return
    }

    try {
      const commandManager = adapter.legacyAdapter.services.get('commandManager')
      if (!commandManager) {
        addLog('❌ CommandManager 서비스를 찾을 수 없습니다')
        return
      }

      await commandManager.execute('deselectAll')
      addLog('✅ Deselect All 명령 실행 완료')
    } catch (error) {
      addLog(`❌ Deselect All 명령 실행 실패: ${error.message}`)
    }
  }

  const testTransformModeCommand = async () => {
    if (!adapter || !status?.newArchitectureEnabled) {
      addLog('❌ 명령을 실행하려면 먼저 새 아키텍처를 활성화해야 합니다')
      return
    }

    try {
      const commandManager = adapter.legacyAdapter.services.get('commandManager')
      if (!commandManager) {
        addLog('❌ CommandManager 서비스를 찾을 수 없습니다')
        return
      }

      const modes = ['translate', 'rotate', 'scale']
      const randomMode = modes[Math.floor(Math.random() * modes.length)]
      
      await commandManager.execute('setTransformMode', { mode: randomMode })
      addLog(`✅ Set Transform Mode 명령 실행 완료 - Mode: ${randomMode}`)
    } catch (error) {
      addLog(`❌ Set Transform Mode 명령 실행 실패: ${error.message}`)
    }
  }

  const testUndoCommand = async () => {
    if (!adapter || !status?.newArchitectureEnabled) {
      addLog('❌ 명령을 실행하려면 먼저 새 아키텍처를 활성화해야 합니다')
      return
    }

    try {
      const commandManager = adapter.legacyAdapter.services.get('commandManager')
      if (!commandManager) {
        addLog('❌ CommandManager 서비스를 찾을 수 없습니다')
        return
      }

      const result = await commandManager.undo()
      if (result) {
        addLog('✅ Undo 명령 실행 완료')
      } else {
        addLog('⚠️ 실행 취소할 명령이 없습니다')
      }
    } catch (error) {
      addLog(`❌ Undo 명령 실행 실패: ${error.message}`)
    }
  }

  const testRedoCommand = async () => {
    if (!adapter || !status?.newArchitectureEnabled) {
      addLog('❌ 명령을 실행하려면 먼저 새 아키텍처를 활성화해야 합니다')
      return
    }

    try {
      const commandManager = adapter.legacyAdapter.services.get('commandManager')
      if (!commandManager) {
        addLog('❌ CommandManager 서비스를 찾을 수 없습니다')
        return
      }

      const result = await commandManager.redo()
      if (result) {
        addLog('✅ Redo 명령 실행 완료')
      } else {
        addLog('⚠️ 다시 실행할 명령이 없습니다')
      }
    } catch (error) {
      addLog(`❌ Redo 명령 실행 실패: ${error.message}`)
    }
  }

  const testRotateCommand = async () => {
    if (!adapter || !status?.newArchitectureEnabled) {
      addLog('❌ 명령을 실행하려면 먼저 새 아키텍처를 활성화해야 합니다')
      return
    }

    try {
      const commandManager = adapter.legacyAdapter.services.get('commandManager')
      if (!commandManager) {
        addLog('❌ CommandManager 서비스를 찾을 수 없습니다')
        return
      }

      // 가상의 객체 생성 및 회전 테스트
      const mockObject = {
        rotation: { x: 0, y: 0, z: 0, copy: function(other) { Object.assign(this, other) } },
        name: 'Test Rotation Object'
      }
      
      await commandManager.execute('rotateObject', { 
        object: mockObject, 
        axis: 'y', 
        degrees: 45 
      })
      addLog(`✅ Rotate Object 명령 실행 완료 - Y축 45도 회전`)
    } catch (error) {
      addLog(`❌ Rotate Object 명령 실행 실패: ${error.message}`)
    }
  }

  const testMoveCommand = async () => {
    if (!adapter || !status?.newArchitectureEnabled) {
      addLog('❌ 명령을 실행하려면 먼저 새 아키텍처를 활성화해야 합니다')
      return
    }

    try {
      const commandManager = adapter.legacyAdapter.services.get('commandManager')
      if (!commandManager) {
        addLog('❌ CommandManager 서비스를 찾을 수 없습니다')
        return
      }

      // 가상의 객체 생성 및 이동 테스트
      const mockObject = {
        position: { x: 0, y: 0, z: 0, add: function(delta) { this.x += delta.x; this.y += delta.y; this.z += delta.z }, copy: function(other) { Object.assign(this, other) } },
        name: 'Test Move Object'
      }
      
      const delta = { x: 2, y: 1, z: 0, clone: function() { return {...this} }, negate: function() { return {x: -this.x, y: -this.y, z: -this.z} } }
      
      await commandManager.execute('moveObject', { 
        object: mockObject, 
        delta 
      })
      addLog(`✅ Move Object 명령 실행 완료 - (2, 1, 0) 이동`)
    } catch (error) {
      addLog(`❌ Move Object 명령 실행 실패: ${error.message}`)
    }
  }

  const testScaleCommand = async () => {
    if (!adapter || !status?.newArchitectureEnabled) {
      addLog('❌ 명령을 실행하려면 먼저 새 아키텍처를 활성화해야 합니다')
      return
    }

    try {
      const commandManager = adapter.legacyAdapter.services.get('commandManager')
      if (!commandManager) {
        addLog('❌ CommandManager 서비스를 찾을 수 없습니다')
        return
      }

      // 가상의 객체 생성 및 스케일 테스트
      const mockObject = {
        scale: { x: 1, y: 1, z: 1, multiplyScalar: function(s) { this.x *= s; this.y *= s; this.z *= s }, copy: function(other) { Object.assign(this, other) } },
        name: 'Test Scale Object'
      }
      
      await commandManager.execute('scaleObject', { 
        object: mockObject, 
        scaleFactor: 1.5 
      })
      addLog(`✅ Scale Object 명령 실행 완료 - 1.5배 확대`)
    } catch (error) {
      addLog(`❌ Scale Object 명령 실행 실패: ${error.message}`)
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

      {/* Command System Test Section */}
      {status?.newArchitectureEnabled && (
        <div style={{ marginBottom: '20px' }}>
          <h2>⚡ Command System Testing</h2>
          <button 
            onClick={testSelectObjectCommand} 
            style={{ marginRight: '10px', padding: '8px 12px', background: '#FF5722', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            🎯 Test Select Object Command
          </button>
          <button 
            onClick={testDeselectAllCommand} 
            style={{ marginRight: '10px', padding: '8px 12px', background: '#795548', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            ❌ Test Deselect All Command
          </button>
          <button 
            onClick={testTransformModeCommand} 
            style={{ marginRight: '10px', padding: '8px 12px', background: '#607D8B', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            🔄 Test Transform Mode Command
          </button>
          <button 
            onClick={testUndoCommand} 
            style={{ marginRight: '10px', padding: '8px 12px', background: '#FFC107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            ↶ Test Undo
          </button>
          <button 
            onClick={testRedoCommand} 
            style={{ marginRight: '10px', padding: '8px 12px', background: '#CDDC39', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            ↷ Test Redo
          </button>
          <button 
            onClick={testRotateCommand} 
            style={{ marginRight: '10px', padding: '8px 12px', background: '#E91E63', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            🔄 Test Rotate Object
          </button>
          <button 
            onClick={testMoveCommand} 
            style={{ marginRight: '10px', padding: '8px 12px', background: '#00BCD4', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            ↔️ Test Move Object
          </button>
          <button 
            onClick={testScaleCommand} 
            style={{ marginRight: '10px', padding: '8px 12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            📏 Test Scale Object
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
