import React, { useState, useEffect, useRef } from 'react'
import PlainEditorCanvasModern from '../components/editor/PlainEditorCanvas.Modern'
import { LegacyAdapter } from '../core/LegacyAdapter'
import { useEditorStore } from '../store/editorStore'

function MigrationTestPageNew() {
  const [adapter, setAdapter] = useState(null)
  const [status, setStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const logsRef = useRef(null)
  const legacyStore = useEditorStore()

  const addLog = (message) => {
    setLogs(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      timestamp: new Date().toLocaleTimeString()
    }])
    // 로그 자동 스크롤
    setTimeout(() => {
      if (logsRef.current) {
        logsRef.current.scrollTop = logsRef.current.scrollHeight
      }
    }, 100)
  }

  useEffect(() => {
    const initAdapter = async () => {
      try {
        addLog('📋 Legacy Adapter 초기화 중...')
        const adapter = new LegacyAdapter(legacyStore)
        setAdapter(adapter)
        
        addLog('✅ Legacy Adapter 초기화 완료')
        
        // 초기 상태 조회
        const initialStatus = await adapter.getStatus()
        setStatus(initialStatus)
        addLog('📊 초기 상태 조회 완료')
        
      } catch (error) {
        addLog(`❌ 초기화 실패: ${error.message}`)
        console.error('Adapter 초기화 실패:', error)
      }
    }

    initAdapter()
  }, [])

  const renderStatusDisplay = () => {
    if (!status) {
      return (
        <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <h3>Migration Status</h3>
          <div>로딩 중...</div>
        </div>
      )
    }

    return (
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
        <h3>Migration Status</h3>
        <div style={{ marginBottom: '10px' }}>
          <strong>New Architecture:</strong> {status.newArchitectureEnabled ? '✅ Enabled' : '❌ Disabled'}
        </div>
        <div style={{ marginBottom: '10px' }}>
          <strong>Services:</strong> {status.services?.length || 0} registered
        </div>
        <div style={{ marginBottom: '10px' }}>
          <strong>Commands:</strong> {status.commands?.length || 0} available
        </div>
        {status.storeMigration && (
          <div style={{ marginBottom: '10px' }}>
            <strong>Store Migration:</strong>
            <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
              {status.storeMigration.migrationProgress && Object.entries(status.storeMigration.migrationProgress || {}).map(([key, value]) => (
                <li key={key}>
                  {key}: {value ? '✅' : '❌'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  const enableNewArchitecture = async () => {
    if (!adapter) return
    
    try {
      addLog('🚀 새 아키텍처 활성화 시작...')
      await adapter.enableNewArchitecture()
      addLog('✅ 새 아키텍처 활성화 완료')
      
      // 상태 업데이트
      const newStatus = await adapter.getStatus()
      setStatus(newStatus)
      addLog('📊 상태 업데이트 완료')
      
    } catch (error) {
      addLog(`❌ 새 아키텍처 활성화 실패: ${error.message}`)
      console.error('새 아키텍처 활성화 실패:', error)
    }
  }

  const testMigration = async (feature) => {
    if (!adapter) return
    
    try {
      addLog(`🧪 ${feature} 마이그레이션 테스트 시작...`)
      const result = await adapter.testMigration(feature)
      addLog(`✅ ${feature} 마이그레이션 테스트 완료: ${JSON.stringify(result)}`)
      
      // 상태 업데이트
      const newStatus = await adapter.getStatus()
      setStatus(newStatus)
      
    } catch (error) {
      addLog(`❌ ${feature} 마이그레이션 테스트 실패: ${error.message}`)
      console.error(`${feature} 마이그레이션 테스트 실패:`, error)
    }
  }

  const testCommand = async (commandName, params = {}) => {
    if (!adapter) return
    
    try {
      addLog(`⚡ 명령어 테스트: ${commandName}`)
      const result = await adapter.executeCommand(commandName, params)
      addLog(`✅ 명령어 실행 완료: ${JSON.stringify(result)}`)
      
    } catch (error) {
      addLog(`❌ 명령어 실행 실패: ${error.message}`)
      console.error('명령어 실행 실패:', error)
    }
  }

  const runFullMigrationTest = async () => {
    if (!adapter) return
    
    try {
      addLog('🔄 전체 마이그레이션 테스트 시작...')
      
      // 1. 새 아키텍처 활성화
      await enableNewArchitecture()
      
      // 2. 개별 기능 테스트
      const features = ['camera', 'objects', 'transform']
      for (const feature of features) {
        await testMigration(feature)
        await new Promise(resolve => setTimeout(resolve, 500)) // 잠시 대기
      }
      
      // 3. 명령어 테스트
      const commands = [
        { name: 'scene.addObject', params: { type: 'cube' } },
        { name: 'camera.reset', params: {} },
        { name: 'grid.toggle', params: {} }
      ]
      
      for (const cmd of commands) {
        await testCommand(cmd.name, cmd.params)
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      
      addLog('🎉 전체 마이그레이션 테스트 완료!')
      
    } catch (error) {
      addLog(`❌ 전체 마이그레이션 테스트 실패: ${error.message}`)
      console.error('전체 마이그레이션 테스트 실패:', error)
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* 왼쪽 패널: 테스트 컨트롤 */}
      <div style={{
        width: '400px',
        padding: '20px',
        borderRight: '1px solid #ccc',
        overflowY: 'auto',
        backgroundColor: '#f5f5f5'
      }}>
        <h2>Migration Test (New Architecture)</h2>
        
        {/* 상태 표시 */}
        {renderStatusDisplay()}
        
        {/* 테스트 버튼들 */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Tests</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={enableNewArchitecture}
              disabled={!adapter}
              style={{
                padding: '8px 12px',
                backgroundColor: '#007acc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: adapter ? 'pointer' : 'not-allowed'
              }}
            >
              Enable New Architecture
            </button>
            
            <button 
              onClick={() => testMigration('camera')}
              disabled={!adapter}
              style={{
                padding: '8px 12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: adapter ? 'pointer' : 'not-allowed'
              }}
            >
              Test Camera Migration
            </button>
            
            <button 
              onClick={() => testMigration('objects')}
              disabled={!adapter}
              style={{
                padding: '8px 12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: adapter ? 'pointer' : 'not-allowed'
              }}
            >
              Test Objects Migration
            </button>
            
            <button 
              onClick={() => testMigration('transform')}
              disabled={!adapter}
              style={{
                padding: '8px 12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: adapter ? 'pointer' : 'not-allowed'
              }}
            >
              Test Transform Migration
            </button>
            
            <button 
              onClick={runFullMigrationTest}
              disabled={!adapter}
              style={{
                padding: '8px 12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: adapter ? 'pointer' : 'not-allowed'
              }}
            >
              Run Full Test Suite
            </button>
          </div>
        </div>
        
        {/* 명령어 테스트 */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Command Tests</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              onClick={() => testCommand('scene.addObject', { type: 'cube' })}
              disabled={!adapter}
              style={{
                padding: '6px 10px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: adapter ? 'pointer' : 'not-allowed',
                fontSize: '12px'
              }}
            >
              Add Cube
            </button>
            
            <button 
              onClick={() => testCommand('camera.reset')}
              disabled={!adapter}
              style={{
                padding: '6px 10px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: adapter ? 'pointer' : 'not-allowed',
                fontSize: '12px'
              }}
            >
              Reset Camera
            </button>
            
            <button 
              onClick={() => testCommand('grid.toggle')}
              disabled={!adapter}
              style={{
                padding: '6px 10px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: adapter ? 'pointer' : 'not-allowed',
                fontSize: '12px'
              }}
            >
              Toggle Grid
            </button>
          </div>
        </div>
        
        {/* 로그 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>Logs</h3>
            <button 
              onClick={clearLogs}
              style={{
                padding: '4px 8px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Clear
            </button>
          </div>
          <div 
            ref={logsRef}
            style={{
              height: '200px',
              overflowY: 'auto',
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              padding: '10px',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'Consolas, monospace'
            }}
          >
            {logs.map(log => (
              <div key={log.id} style={{ marginBottom: '4px' }}>
                <span style={{ color: '#569cd6' }}>[{log.timestamp}]</span> {log.message}
              </div>
            ))}
            {logs.length === 0 && (
              <div style={{ color: '#6c757d', fontStyle: 'italic' }}>
                로그가 여기에 표시됩니다...
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 오른쪽 패널: 3D 캔버스 */}
      <div style={{ flex: 1, position: 'relative' }}>
        <PlainEditorCanvasModern />
        
        {/* 오버레이 정보 */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          Modern Architecture Canvas
          {status?.newArchitectureEnabled && (
            <div style={{ color: '#4caf50' }}>✅ New Architecture Active</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MigrationTestPageNew
