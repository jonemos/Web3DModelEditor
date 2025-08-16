import { useState, useEffect, useRef, memo } from 'react'
import { setParent as setParent3D, clearParent as clearParent3D } from '../../../utils/HierarchyUtils'
import { useEditorStore } from '../../../store/editorStore'
import { PropertiesManager } from '../../../utils/PropertiesManager'
import HierarchyTreePanel from './HierarchyTreePanel.jsx'
import './InspectorPanel.css'
import { useEditorStore as useEditorStoreHook } from '../../../store/editorStore'

const InspectorPanel = memo(function InspectorPanel({
  // SceneHierarchy 관련 props
  objects,
  walls,
  selectedIds,
  setSelectedIds,
  setParent,
  reorderSiblings,
  selectedObject,
  onObjectVisibilityToggle,
  onObjectFreezeToggle,
  onObjectSelect,
  onObjectRemove,
  onObjectFocus,
  onObjectRename,
  onContextMenu,
  editorControls,
  postProcessingManager,
  
  // ObjectProperties 관련 props
  onObjectUpdate,
  
  onClose
}) {
  // 내부 소형 컴포넌트: 뷰 통계 표시
  const ViewStats = () => {
    const stats = useEditorStoreHook((s) => s.stats)
    return (
      <div style={{marginTop: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, fontSize: 13, lineHeight: 1.6}}>
        <div style={{display:'grid', gridTemplateColumns:'120px 1fr', gap:'6px 12px'}}>
          <div>FPS</div><div>{stats?.fps ?? 0}</div>
          <div>오브젝트</div><div>{stats?.objects ?? 0}</div>
          <div>버텍스</div><div>{stats?.vertices ?? 0}</div>
          <div>폴리곤(트라이)</div><div>{stats?.triangles ?? 0}</div>
        </div>
      </div>
    )
  }
  // 아코디언(블렌더 스타일) 섹션 접힘 상태
  const [collapsed, setCollapsed] = useState({
    transform: false,
    object: false,
    material: false,
    light: false,
    camera: false,
    part: false
  })
  const [propertiesManager, setPropertiesManager] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0) // 강제 리렌더링용
  // rAF 기반 변화 감지 및 스로틀용 ref들
  const lastSnapshotRef = useRef(null)
  const lastUiUpdateRef = useRef(0)
  const rafIdRef = useRef(0)
  const isDraggingRef = useRef(false)

  // PropertiesManager 초기화
  useEffect(() => {
    const manager = new PropertiesManager(editorControls)
    
    // 속성 변경 콜백 등록: 국소 업데이트(스로틀)
    manager.onPropertyChange((changeData) => {
      try { onObjectUpdate && onObjectUpdate(changeData) } catch {}
      const now = Date.now()
      if (now - (lastUiUpdateRef.current || 0) >= 50) {
        lastUiUpdateRef.current = now
        setRefreshKey(prev => prev + 1)
      }
    })
    
    setPropertiesManager(manager)
    
    return () => {
      manager.dispose()
    }
  }, [editorControls, onObjectUpdate])

  // 선택 변경 시 PropertiesManager 업데이트 (기즈모 상호작용 중에는 반짝임 방지)
  useEffect(() => {
    if (!propertiesManager) return
    const sel = selectedObject || (editorControls?.selectedObjects?.[0] ?? null)
    propertiesManager.setSelectedObject(sel)
    setRefreshKey(prev => prev + 1)
  }, [propertiesManager, selectedObject, editorControls])

  // TransformControls 이벤트와 연동하여, 드래그 중에만 rAF로 동기화
  useEffect(() => {
    if (!selectedObject || !propertiesManager || !editorControls) return

    const epsilon = 1e-4
    const readSnapshot = () => {
      const o = propertiesManager.threeObject
      if (!o) return null
      return {
        p: [o.position.x, o.position.y, o.position.z],
        r: [o.rotation.x, o.rotation.y, o.rotation.z],
        s: [o.scale.x, o.scale.y, o.scale.z]
      }
    }
    const changed = (a, b) => {
      if (!a || !b) return true
      for (let i = 0; i < 3; i++) {
        if (Math.abs(a.p[i] - b.p[i]) > epsilon) return true
        if (Math.abs(a.r[i] - b.r[i]) > epsilon) return true
        if (Math.abs(a.s[i] - b.s[i]) > epsilon) return true
      }
      return false
    }

    const startRAF = () => {
      try { if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current) } catch {}
      lastSnapshotRef.current = readSnapshot()
      setRefreshKey(prev => prev + 1)
      const tick = () => {
        if (!isDraggingRef.current) { rafIdRef.current = 0; return }
        const cur = readSnapshot()
        const now = Date.now()
        if (cur && changed(cur, lastSnapshotRef.current)) {
          if (now - (lastUiUpdateRef.current || 0) >= 80) {
            lastSnapshotRef.current = cur
            lastUiUpdateRef.current = now
            setRefreshKey(prev => prev + 1)
          }
        }
        rafIdRef.current = requestAnimationFrame(tick)
      }
      rafIdRef.current = requestAnimationFrame(tick)
    }
    const stopRAF = () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = 0
      setRefreshKey(prev => prev + 1) // 최종 스냅샷 적용
    }

    const throttledBump = () => {
      const now = Date.now()
      if (now - (lastUiUpdateRef.current || 0) >= 100) {
        lastUiUpdateRef.current = now
        setRefreshKey(prev => prev + 1)
      }
    }

    const objTc = editorControls?.objectSelector?.transformControls
    const partTc = editorControls?._partTransformControls

    const onDragChanged = (e) => {
      isDraggingRef.current = !!e?.value
      if (isDraggingRef.current) startRAF(); else stopRAF()
    }
    const onObjectChange = () => {
      if (!isDraggingRef.current) throttledBump()
    }

    objTc?.addEventListener?.('dragging-changed', onDragChanged)
    objTc?.addEventListener?.('objectChange', onObjectChange)
    partTc?.addEventListener?.('dragging-changed', onDragChanged)
    partTc?.addEventListener?.('objectChange', onObjectChange)

    return () => {
      try { objTc?.removeEventListener?.('dragging-changed', onDragChanged) } catch {}
      try { objTc?.removeEventListener?.('objectChange', onObjectChange) } catch {}
      try { partTc?.removeEventListener?.('dragging-changed', onDragChanged) } catch {}
      try { partTc?.removeEventListener?.('objectChange', onObjectChange) } catch {}
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = 0
      isDraggingRef.current = false
    }
  }, [selectedObject, propertiesManager, editorControls])

  const objectType = propertiesManager?.getObjectType() || 'unknown'
  const objectInfo = propertiesManager?.getObjectInfo()
  const lastValidSelRef = useRef(null)

  // 선택 객체의 sticky 유지: 기즈모 클릭/드래그 중엔 마지막 유효 객체로 유지
  useEffect(() => {
    if (!propertiesManager) return
    const gizmoActive = !!(editorControls?._gizmoPointerDown || editorControls?.objectSelector?.transformControls?.dragging)
    // 현재 info가 유효하면 갱신
    if (propertiesManager.getObjectInfo()) {
      lastValidSelRef.current = propertiesManager.threeObject || lastValidSelRef.current
      return
    }
    // 유효하지 않은데 기즈모 상호작용 중이면 이전을 복원
    if (gizmoActive && lastValidSelRef.current) {
      try { propertiesManager.setSelectedObject(lastValidSelRef.current) } catch {}
      setRefreshKey(prev => prev + 1)
    }
  }, [propertiesManager, editorControls])
  const selectedPartInfo = editorControls?.getSelectedPartInfo?.() || null

  // 탭 목록 정의
  const getAvailableTabs = () => {
    if (!selectedObject) return []
    
    const tabs = [
      { id: 'transform', label: '트랜스폼', icon: '🔄' }
    ]

    // Object 속성 탭 (모든 객체에 대해)
    tabs.push({ id: 'object', label: '오브젝트', icon: '📦' })

    if (objectType === 'mesh') {
      tabs.push({ id: 'material', label: '머티리얼', icon: '🎨' })
    }
    
    if (objectType === 'light') {
      tabs.push({ id: 'light', label: '라이트', icon: '💡' })
    }
    
    if (objectType === 'camera') {
      tabs.push({ id: 'camera', label: '카메라', icon: '📷' })
    }

    // Part Inspect 탭: 메시일 때 노출
    if (objectType === 'mesh') {
      tabs.push({ id: 'part', label: '파트', icon: '🧩' })
    }

    return tabs
  }

  const availableTabs = getAvailableTabs()

  // 섹션 접힘 토글
  const toggleSection = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }))

  // Object 탭 렌더링
  const renderObjectTab = () => {
    if (!objectInfo) {
      return <div style={{color: 'red', padding: '20px'}}>objectInfo가 없습니다</div>
    }

    return (
      <div className="object-properties">
        <div className="property-group">
          <label>Name</label>
          <input
            type="text"
            value={objectInfo.name}
            onChange={(e) => {
              if (propertiesManager?.threeObject) {
                propertiesManager.threeObject.name = e.target.value
                propertiesManager.notifyPropertyChange('object', 'name', e.target.value)
              }
            }}
          />
        </div>

        <div className="property-group">
          <label>Type</label>
          <span className="readonly-value">{objectInfo.type}</span>
        </div>

        <div className="property-group">
          <label>ID</label>
          <span className="readonly-value">{objectInfo.id}</span>
        </div>

        <div className="property-group">
          <label>Visible</label>
          <input
            type="checkbox"
            checked={propertiesManager?.threeObject?.visible !== false}
            onChange={(e) => {
              if (propertiesManager?.threeObject) {
                propertiesManager.threeObject.visible = e.target.checked
                propertiesManager.notifyPropertyChange('object', 'visible', e.target.checked)
              }
            }}
          />
        </div>

        <div className="property-group">
          <label>Cast Shadow</label>
          <input
            type="checkbox"
            checked={propertiesManager?.threeObject?.castShadow || false}
            onChange={(e) => {
              if (propertiesManager?.threeObject) {
                propertiesManager.threeObject.castShadow = e.target.checked
                propertiesManager.notifyPropertyChange('object', 'castShadow', e.target.checked)
              }
            }}
          />
        </div>

        <div className="property-group">
          <label>Receive Shadow</label>
          <input
            type="checkbox"
            checked={propertiesManager?.threeObject?.receiveShadow || false}
            onChange={(e) => {
              if (propertiesManager?.threeObject) {
                propertiesManager.threeObject.receiveShadow = e.target.checked
                propertiesManager.notifyPropertyChange('object', 'receiveShadow', e.target.checked)
              }
            }}
          />
        </div>
      </div>
    )
  }

  // Transform 탭 렌더링
  const renderTransformTab = () => {
    if (!objectInfo) {
      return <div style={{color: 'red', padding: '20px'}}>objectInfo가 없습니다</div>
    }

    return (
      <div className="transform-properties">
        {/* Position */}
        <div className="transform-row">
          <div className="transform-label">Position</div>
          <div className="transform-inputs">
            <div className="transform-input-group">
              <span className="input-label">X</span>
              <input
                type="number"
                step="0.1"
                value={objectInfo.position.x}
                onChange={(e) => propertiesManager?.setTransformProperty('position', 'x', e.target.value)}
              />
            </div>
            <div className="transform-input-group">
              <span className="input-label">Y</span>
              <input
                type="number"
                step="0.1"
                value={objectInfo.position.y}
                onChange={(e) => propertiesManager?.setTransformProperty('position', 'y', e.target.value)}
              />
            </div>
            <div className="transform-input-group">
              <span className="input-label">Z</span>
              <input
                type="number"
                step="0.1"
                value={objectInfo.position.z}
                onChange={(e) => propertiesManager?.setTransformProperty('position', 'z', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Rotation */}
        <div className="transform-row">
          <div className="transform-label">Rotation</div>
          <div className="transform-inputs">
            <div className="transform-input-group">
              <span className="input-label">X</span>
              <input
                type="number"
                step="1"
                value={objectInfo.rotation.x}
                onChange={(e) => propertiesManager?.setTransformProperty('rotation', 'x', e.target.value)}
              />
            </div>
            <div className="transform-input-group">
              <span className="input-label">Y</span>
              <input
                type="number"
                step="1"
                value={objectInfo.rotation.y}
                onChange={(e) => propertiesManager?.setTransformProperty('rotation', 'y', e.target.value)}
              />
            </div>
            <div className="transform-input-group">
              <span className="input-label">Z</span>
              <input
                type="number"
                step="1"
                value={objectInfo.rotation.z}
                onChange={(e) => propertiesManager?.setTransformProperty('rotation', 'z', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Scale */}
        <div className="transform-row">
          <div className="transform-label">Scale</div>
          <div className="transform-inputs">
            <div className="transform-input-group">
              <span className="input-label">X</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={objectInfo.scale.x}
                onChange={(e) => propertiesManager?.setTransformProperty('scale', 'x', e.target.value)}
              />
            </div>
            <div className="transform-input-group">
              <span className="input-label">Y</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={objectInfo.scale.y}
                onChange={(e) => propertiesManager?.setTransformProperty('scale', 'y', e.target.value)}
              />
            </div>
            <div className="transform-input-group">
              <span className="input-label">Z</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={objectInfo.scale.z}
                onChange={(e) => propertiesManager?.setTransformProperty('scale', 'z', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Material 탭 렌더링
  const renderMaterialTab = () => {
    if (objectType !== 'mesh') return <div className="not-available">메시 객체가 아닙니다</div>

    return (
      <div className="material-properties">
        <div className="property-group">
          <label>Color</label>
          <input
            type="color"
            value={propertiesManager?.getMaterialProperty('color') || '#ffffff'}
            onChange={(e) => propertiesManager?.setMaterialProperty('color', e.target.value)}
          />
        </div>

        <div className="property-group">
          <label>Metalness</label>
          <div className="range-input">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={propertiesManager?.getMaterialProperty('metalness') || 0}
              onChange={(e) => propertiesManager?.setMaterialProperty('metalness', e.target.value)}
            />
            <span>{(propertiesManager?.getMaterialProperty('metalness') || 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="property-group">
          <label>Roughness</label>
          <div className="range-input">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={propertiesManager?.getMaterialProperty('roughness') || 0.8}
              onChange={(e) => propertiesManager?.setMaterialProperty('roughness', e.target.value)}
            />
            <span>{(propertiesManager?.getMaterialProperty('roughness') || 0.8).toFixed(2)}</span>
          </div>
        </div>

        <div className="property-group">
          <label>Emissive</label>
          <input
            type="color"
            value={propertiesManager?.getMaterialProperty('emissive') || '#000000'}
            onChange={(e) => propertiesManager?.setMaterialProperty('emissive', e.target.value)}
          />
        </div>

        <div className="property-group">
          <label>Emissive Intensity</label>
          <div className="range-input">
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={propertiesManager?.getMaterialProperty('emissiveIntensity') || 0}
              onChange={(e) => propertiesManager?.setMaterialProperty('emissiveIntensity', e.target.value)}
            />
            <span>{(propertiesManager?.getMaterialProperty('emissiveIntensity') || 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="property-group">
          <label>Opacity</label>
          <div className="range-input">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={propertiesManager?.getMaterialProperty('opacity') || 1}
              onChange={(e) => propertiesManager?.setMaterialProperty('opacity', e.target.value)}
            />
            <span>{(propertiesManager?.getMaterialProperty('opacity') || 1).toFixed(2)}</span>
          </div>
        </div>
      </div>
    )
  }

  // Part Inspect 탭 렌더링
  const renderPartTab = () => {
    if (objectType !== 'mesh') return <div className="not-available">메시 객체가 아닙니다</div>

  const partEnabled = !!editorControls?.partInspector?.enabled
    const solo = !!editorControls?.partInspector?.solo
    const clipping = !!editorControls?.partInspector?.clipping
  const partGizmo = !!editorControls?.partInspector?.gizmo
    const info = selectedPartInfo

    return (
      <div className="part-properties">
        <div className="property-group" style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
          <label>파트 인스펙션</label>
          <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
            <input type="checkbox" checked={partEnabled}
              onChange={(e)=>editorControls?.enablePartInspect?.(e.target.checked)} /> 사용
          </label>
          <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
            <input type="checkbox" checked={solo}
              onChange={(e)=>editorControls?.setPartSolo?.(e.target.checked)} disabled={!partEnabled} /> 솔로 뷰
          </label>
          <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
            <input type="checkbox" checked={clipping}
              onChange={(e)=>editorControls?.setPartClipping?.(e.target.checked)} disabled={!partEnabled} /> 클리핑
          </label>
          <button onClick={()=>editorControls?.clearPartSelection?.()} disabled={!partEnabled}>파트 선택 해제</button>
        </div>

        {/* 파트 기즈모 제어 */}
        {partEnabled && (
          <div className="property-group" style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <label>파트 기즈모</label>
            <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
              <input type="checkbox" checked={partGizmo}
                onChange={(e)=>editorControls?.setPartGizmoEnabled?.(e.target.checked)} disabled={!editorControls?.getSelectedPart?.()} /> 활성화
            </label>
            <div style={{display:'inline-flex', gap:6}}>
              <button onClick={()=>editorControls?.setPartGizmoMode?.('translate')} disabled={!partGizmo}>이동</button>
              <button onClick={()=>editorControls?.setPartGizmoMode?.('rotate')} disabled={!partGizmo}>회전</button>
              <button onClick={()=>editorControls?.setPartGizmoMode?.('scale')} disabled={!partGizmo}>스케일</button>
            </div>
          </div>
        )}

        {/* OutlinePass 간단 튜닝 */
        }
        {/* 기본 포스트프로세싱 토글 */}
        <div className="property-group" style={{display:'grid', gridTemplateColumns:'120px 1fr', gap:'8px 12px'}}>
          <div style={{gridColumn:'1 / span 2', fontWeight:600}}>포스트프로세싱</div>
          <label>Bloom</label>
          <input type="checkbox"
            checked={!!postProcessingManager?.effectSettings?.bloom?.enabled}
            onChange={(e)=>{ try { postProcessingManager?.setEffectEnabled?.('bloom', e.target.checked); } catch {} }} />
          <label>AA (SMAA)</label>
          <input type="checkbox"
            checked={!!postProcessingManager?.effectSettings?.fxaa?.enabled}
            onChange={(e)=>{ try { postProcessingManager?.setEffectEnabled?.('fxaa', e.target.checked); } catch {} }} />
          <label>SSAO</label>
          <input type="checkbox"
            checked={!!postProcessingManager?.effectSettings?.ssao?.enabled}
            onChange={(e)=>{ try { postProcessingManager?.setEffectEnabled?.('ssao', e.target.checked); } catch {} }} />
          <label>Tone Mapping</label>
          <input type="checkbox"
            checked={postProcessingManager?.effectSettings?.toneMapping?.enabled !== false}
            onChange={(e)=>{ try { postProcessingManager?.setEffectEnabled?.('toneMapping', e.target.checked); } catch {} }} />
        </div>
        {/* Tone Mapping 상세 */}
        <div className="property-group" style={{display:'grid', gridTemplateColumns:'120px 1fr', gap:'8px 12px'}}>
          <div style={{gridColumn:'1 / span 2', fontWeight:600}}>톤 매핑</div>
          <label>모드</label>
          <select
            value={postProcessingManager?.effectSettings?.toneMapping?.mapping || 'ACESFilmic'}
            onChange={(e)=>{ try { postProcessingManager?.updateEffectSettings?.('toneMapping', { mapping: e.target.value }); } catch {} }}
          >
            <option value="None">None</option>
            <option value="Linear">Linear</option>
            <option value="Reinhard">Reinhard</option>
            <option value="Cineon">Cineon</option>
            <option value="ACESFilmic">ACESFilmic</option>
          </select>
          <label>노출</label>
          <input type="range" min="0.1" max="4" step="0.05"
            value={postProcessingManager?.effectSettings?.toneMapping?.exposure ?? 1}
            onChange={(e)=>{ const v = parseFloat(e.target.value); try { postProcessingManager?.updateEffectSettings?.('toneMapping', { exposure: v }); } catch {} }}
          />
        </div>

        {partEnabled && (
          <div className="property-group">
            <div style={{fontSize:12, color:'#aaa', marginBottom:6}}>서브메시를 클릭해 선택하세요.</div>
            {info ? (
              <div className="mesh-info" style={{display:'grid', gridTemplateColumns:'120px 1fr', gap:'6px 12px'}}>
                <div>이름</div><div>{info.name}</div>
                <div>UUID</div><div style={{wordBreak:'break-all'}}>{info.uuid}</div>
                <div>지오메트리</div><div>{info.geometry.type} {info.geometry.hasIndex ? '(Indexed)' : ''}</div>
                <div>버텍스/트라이</div><div>{info.geometry.vertices} / {info.geometry.triangles}</div>
                <div>속성</div><div>{info.geometry.attributes.join(', ')}</div>
                <div>월드 크기</div><div>{info.geometry.world.size.map(n=>n.toFixed(3)).join(', ')}</div>
                <div>월드 중심</div><div>{info.geometry.world.center.map(n=>n.toFixed(3)).join(', ')}</div>
                <div>UV</div><div>{info.geometry.uv ? `${info.geometry.uv.count}x${info.geometry.uv.itemSize}` : '없음'}</div>
                <div>UV2</div><div>{info.geometry.uv2 ? `${info.geometry.uv2.count}x${info.geometry.uv2.itemSize}` : '없음'}</div>
                {info.material && (
                  <>
                    <div>머티리얼</div><div>{info.material.type} {info.material.name ? `(${info.material.name})` : ''}</div>
                    <div>색상/불투명</div><div>{info.material.color || '-'} / {info.material.opacity}</div>
                    <div>Metal/Rough</div><div>{info.material.metalness ?? '-'} / {info.material.roughness ?? '-'}</div>
                    <div>맵들</div><div>{Object.entries(info.material.maps).filter(([,v])=>v).map(([k])=>k).join(', ') || '없음'}</div>
                  </>
                )}
              </div>
            ) : (
              <div style={{color:'#aaa'}}>선택된 파트가 없습니다.</div>
            )}
            {/* 멀티 파트 선택/도구 */}
            <div style={{marginTop:10, display:'flex', gap:8, flexWrap:'wrap'}}>
              <button onClick={()=>editorControls?.selectAllChildParts?.()} disabled={!editorControls?.getSelectedPart?.()}>자식 파트 전체 선택</button>
              <button onClick={()=>editorControls?.clearAllPartSelections?.()} disabled={!editorControls?.getSelectedPart?.()}>모든 파트 선택 해제</button>
              <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                <input type="checkbox"
                  checked={!!editorControls?.isPartGroupGizmoEnabled?.()}
                  onChange={(e)=>editorControls?.setPartGroupGizmoEnabled?.(e.target.checked)}
                /> 그룹 기즈모(일괄 변형)
              </label>
              <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
                피벗
                <select
                  value={editorControls?.getPartGroupPivot?.() || 'center'}
                  onChange={(e)=>editorControls?.setPartGroupPivot?.(e.target.value)}
                >
                  <option value="center">선택 중심</option>
                  <option value="first">첫 파트</option>
                  <option value="last">마지막 파트</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Light 탭 렌더링
  const renderLightTab = () => {
    if (objectType !== 'light') return <div className="not-available">라이트 객체가 아닙니다</div>

    const lightType = propertiesManager?.getLightProperty('type')

    return (
      <div className="light-properties">
        <div className="property-group">
          <label>Type</label>
          <span className="readonly-value">{lightType}</span>
        </div>

        <div className="property-group">
          <label>Color</label>
          <input
            type="color"
            value={propertiesManager?.getLightProperty('color') || '#ffffff'}
            onChange={(e) => propertiesManager?.setLightProperty('color', e.target.value)}
          />
        </div>

        <div className="property-group">
          <label>Intensity</label>
          <div className="range-input">
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={propertiesManager?.getLightProperty('intensity') || 1}
              onChange={(e) => propertiesManager?.setLightProperty('intensity', e.target.value)}
            />
            <span>{(propertiesManager?.getLightProperty('intensity') || 1).toFixed(1)}</span>
          </div>
        </div>

        {/* SpotLight specific properties */}
        {lightType === 'SpotLight' && (
          <>
            <div className="property-group">
              <label>Distance</label>
              <input
                type="number"
                min="0"
                step="1"
                value={propertiesManager?.getLightProperty('distance') || 0}
                onChange={(e) => propertiesManager?.setLightProperty('distance', e.target.value)}
              />
            </div>

            <div className="property-group">
              <label>Angle</label>
              <div className="range-input">
                <input
                  type="range"
                  min="0"
                  max="1.57"
                  step="0.01"
                  value={propertiesManager?.getLightProperty('angle') || 0}
                  onChange={(e) => propertiesManager?.setLightProperty('angle', e.target.value)}
                />
                <span>{(propertiesManager?.getLightProperty('angle') || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="property-group">
              <label>Penumbra</label>
              <div className="range-input">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={propertiesManager?.getLightProperty('penumbra') || 0}
                  onChange={(e) => propertiesManager?.setLightProperty('penumbra', e.target.value)}
                />
                <span>{(propertiesManager?.getLightProperty('penumbra') || 0).toFixed(2)}</span>
              </div>
            </div>
          </>
        )}

        {/* PointLight and SpotLight distance/decay */}
        {(lightType === 'PointLight' || lightType === 'SpotLight') && (
          <>
            {lightType === 'PointLight' && (
              <div className="property-group">
                <label>Distance</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={propertiesManager?.getLightProperty('distance') || 0}
                  onChange={(e) => propertiesManager?.setLightProperty('distance', e.target.value)}
                />
              </div>
            )}

            <div className="property-group">
              <label>Decay</label>
              <div className="range-input">
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={propertiesManager?.getLightProperty('decay') || 1}
                  onChange={(e) => propertiesManager?.setLightProperty('decay', e.target.value)}
                />
                <span>{(propertiesManager?.getLightProperty('decay') || 1).toFixed(1)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // Camera 탭 렌더링
  const renderCameraTab = () => {
    if (objectType !== 'camera') return <div className="not-available">카메라 객체가 아닙니다</div>

    return (
      <div className="camera-properties">
        <div className="property-group">
          <label>Type</label>
          <span className="readonly-value">{propertiesManager?.getCameraProperty('type')}</span>
        </div>

        <div className="property-group">
          <label>FOV</label>
          <div className="range-input">
            <input
              type="range"
              min="10"
              max="120"
              step="1"
              value={propertiesManager?.getCameraProperty('fov') || 75}
              onChange={(e) => propertiesManager?.setCameraProperty('fov', e.target.value)}
            />
            <span>{propertiesManager?.getCameraProperty('fov') || 75}°</span>
          </div>
        </div>

        <div className="property-group">
          <label>Near</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={propertiesManager?.getCameraProperty('near') || 0.1}
            onChange={(e) => propertiesManager?.setCameraProperty('near', e.target.value)}
          />
        </div>

        <div className="property-group">
          <label>Far</label>
          <input
            type="number"
            min="1"
            step="1"
            value={propertiesManager?.getCameraProperty('far') || 1000}
            onChange={(e) => propertiesManager?.setCameraProperty('far', e.target.value)}
          />
        </div>
      </div>
    )
  }

  const renderTabContent = () => {
    if (!selectedObject) {
      return (
        <div className="no-selection">
          <div className="no-selection-icon">📦</div>
          <div className="no-selection-text">오브젝트를 선택하세요</div>
          <div className="no-selection-hint">씬 계층구조에서 오브젝트를 클릭하거나<br/>3D 뷰에서 직접 선택할 수 있습니다</div>
        </div>
      )
    }

  // 사용되지 않음 (탭 제거됨)
  return null
  }

  return (
    <div className="inspector-panel">
      <div className="inspector-header">
        <h3>인스펙터</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="inspector-content">
        {/* 계층 트리 (좌측 패널을 대체) */}
        <div className="hierarchy-section">
          <div className="section-header">
            <h4>씬 계층구조</h4>
          </div>
          <div className="hierarchy-container">
            <HierarchyTreePanel
              objects={objects}
              selectedIds={selectedIds || []}
              dragUseSelectionForDnD={(() => { try { return useEditorStore.getState().dragUseSelectionForDnD } catch { return false } })()}
              onBatchStart={() => { try { useEditorStore.getState().beginBatch?.() } catch {} }}
              onBatchEnd={() => { try { useEditorStore.getState().endBatch?.() } catch {} }}
              onSelect={(id) => {
                setSelectedIds?.([id]);
                const obj = editorControls?.findObjectById?.(id);
                if (obj) editorControls?.selectObject?.(obj);
              }}
              onReparent={(childId, newParentId) => {
                // 단일 호출 기준. HierarchyTreePanel은 여러 번 호출 가능(멀티 드롭)
                // 1) 상태 트리 업데이트
                setParent?.(childId, newParentId);
                // 2) Three.js 그래프 동기화 (월드 변환 유지)
                try {
                  const child3 = editorControls?.findObjectById?.(childId);
                  if (child3) {
                    if (newParentId == null) {
                      clearParent3D(child3, editorControls?.scene, true);
                    } else {
                      const parent3 = editorControls?.findObjectById?.(newParentId);
                      if (parent3 && child3 !== parent3) setParent3D(child3, parent3, true);
                    }
                  }
                } catch {}
                // 아웃라인 갱신은 일괄 처리되도록 살짝 지연하여 중복 호출 coalesce
                try { clearTimeout(window.__reparentOutlineT); } catch {}
                try {
                  window.__reparentOutlineT = setTimeout(() => {
                    editorControls?.objectSelector?.updateAllSelectionOutlines?.();
                    window.__reparentOutlineT = null;
                  }, 0);
                } catch {}
              }}
              onReorder={(parentId, orderedIds) => {
                reorderSiblings?.(parentId, orderedIds);
              }}
              onToggleVisibility={(node) => onObjectVisibilityToggle?.(node)}
              onToggleFreeze={(node) => onObjectFreezeToggle?.(node)}
            />
          </div>
        </div>

        {/* 속성 섹션 */}
        <div className="properties-section-wrapper">
          <div className="section-header">
            <h4>속성</h4>
            {objectInfo && (
              <div className="object-info">
                <span className="object-name">{objectInfo.name}</span>
                <span className="object-type">({objectType})</span>
                {(editorControls?.objectSelector?.transformControls?.dragging || editorControls?._gizmoPointerDown) && (
                  <span className="editing-badge" title="기즈모 편집 중 - 값만 실시간 갱신됩니다">편집 중</span>
                )}
              </div>
            )}
          </div>
          
          <div className={`properties-container ${(editorControls?.objectSelector?.transformControls?.dragging || editorControls?._gizmoPointerDown) ? 'editing' : ''}`}>
            {!selectedObject && (
              <div className="no-selection">
                <div className="no-selection-icon">ℹ️</div>
                <div className="no-selection-text">뷰 정보</div>
                <div className="no-selection-hint">선택된 객체가 없을 때 현재 시스템 상태를 보여줍니다.</div>
                <ViewStats />
              </div>
            )}
            {objectInfo && (
              <div className="accordion">
                {/* Transform */}
                <div className="accordion-section">
                  <button className="accordion-header" onClick={() => toggleSection('transform')}>
                    <span className={`chevron ${collapsed.transform ? '' : 'open'}`}>▾</span>
                    <span className="title">Transform</span>
                  </button>
                  {!collapsed.transform && (
                    <div className="accordion-body transform-properties">
                      {renderTransformTab()}
                    </div>
                  )}
                </div>

                {/* Object */}
                <div className="accordion-section">
                  <button className="accordion-header" onClick={() => toggleSection('object')}>
                    <span className={`chevron ${collapsed.object ? '' : 'open'}`}>▾</span>
                    <span className="title">Object</span>
                  </button>
                  {!collapsed.object && (
                    <div className="accordion-body object-properties">
                      {renderObjectTab()}
                    </div>
                  )}
                </div>

                {/* Material (mesh일 때) */}
                {objectType === 'mesh' && (
                  <div className="accordion-section">
                    <button className="accordion-header" onClick={() => toggleSection('material')}>
                      <span className={`chevron ${collapsed.material ? '' : 'open'}`}>▾</span>
                      <span className="title">Material</span>
                    </button>
                    {!collapsed.material && (
                      <div className="accordion-body material-properties">
                        {renderMaterialTab()}
                      </div>
                    )}
                  </div>
                )}

                {/* Light */}
                {objectType === 'light' && (
                  <div className="accordion-section">
                    <button className="accordion-header" onClick={() => toggleSection('light')}>
                      <span className={`chevron ${collapsed.light ? '' : 'open'}`}>▾</span>
                      <span className="title">Light</span>
                    </button>
                    {!collapsed.light && (
                      <div className="accordion-body light-properties">
                        {renderLightTab()}
                      </div>
                    )}
                  </div>
                )}

                {/* Camera */}
                {objectType === 'camera' && (
                  <div className="accordion-section">
                    <button className="accordion-header" onClick={() => toggleSection('camera')}>
                      <span className={`chevron ${collapsed.camera ? '' : 'open'}`}>▾</span>
                      <span className="title">Camera</span>
                    </button>
                    {!collapsed.camera && (
                      <div className="accordion-body camera-properties">
                        {renderCameraTab()}
                      </div>
                    )}
                  </div>
                )}

                {/* Part Inspect (mesh일 때) */}
        {objectType === 'mesh' && (
                  <div className="accordion-section">
                    <button className="accordion-header" onClick={() => toggleSection('part')}>
                      <span className={`chevron ${collapsed.part ? '' : 'open'}`}>▾</span>
                      <span className="title">Part</span>
                    </button>
                    {!collapsed.part && (
                      <div className="accordion-body part-properties">
                        {renderPartTab()}
                      </div>
                    )}
                  </div>
                )}
              </div>
      )}
          </div>
        </div>
      </div>
    </div>
  )
})

export default InspectorPanel
