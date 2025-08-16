import { useMemo, useRef, useState, useCallback } from 'react';
import './SceneHierarchyPanel.css';

export default function HierarchyTreePanel({
  objects,
  selectedIds = [],
  selectedObjectId,
  dragUseSelectionForDnD = false,
  onSelect,
  onReparent,
  onReorder,
  onBatchStart,
  onBatchEnd,
  onToggleVisibility,
  onToggleFreeze
}) {
  const dragRef = useRef({ draggingId: null });
  const [overId, setOverId] = useState(null);
  const [overPos, setOverPos] = useState(null); // 'above' | 'inside' | 'below'
  const [collapsed, setCollapsed] = useState(() => new Set());

  const byId = useMemo(() => new Map((objects || []).map(o => [o.id, o])), [objects]);
  const byParent = useMemo(() => {
    const map = new Map();
    (objects || []).forEach(o => {
      const pid = o.parentId ?? null;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid).push(o);
    });
    for (const arr of map.values()) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return map;
  }, [objects]);

  const roots = byParent.get(null) || [];

  // 선택 비교 정규화: id 타입(숫자/문자열) 불일치 보정 + 단일 선택 아이디 폴백
  const selectedIdSet = useMemo(() => {
    try {
      const arr = Array.isArray(selectedIds) ? selectedIds.slice() : [];
      if (selectedObjectId != null) arr.push(selectedObjectId);
      return new Set(arr.map((v) => String(v)));
    } catch { return new Set(); }
  }, [selectedIds, selectedObjectId]);

  const isAncestor = useCallback((maybeAncestorId, nodeId) => {
    if (maybeAncestorId == null || nodeId == null) return false;
    let cur = byId.get(nodeId);
    const guard = new Set();
    while (cur) {
      if (guard.has(cur.id)) break;
      guard.add(cur.id);
      if (cur.id === maybeAncestorId) return true;
      const pid = cur.parentId ?? null;
      cur = pid != null ? byId.get(pid) : null;
    }
    return false;
  }, [byId]);

  const toggleCollapse = (id) => setCollapsed(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleDragStart = (e, id) => {
    dragRef.current.draggingId = id;
    // 옵션: 선택 집합을 항상 사용하거나, 드래그 항목이 선택에 포함된 경우에만 사용
    const selectedSetStr = selectedIdSet;
    const idStr = String(id);
    const useSelection = dragUseSelectionForDnD ? (selectedSetStr.size > 0) : (selectedSetStr.has(idStr) && selectedSetStr.size > 0);
    let ids = useSelection ? Array.from(selectedSetStr) : [idStr];
    // 중첩 선택 정규화: 상위가 포함된 항목의 모든 자손은 제거(최상위 항목만 유지)
    const idSet = new Set(ids);
    const hasSelectedAncestor = (nid) => {
      let cur = byId.get(nid);
      const guard = new Set();
      while (cur) {
        if (guard.has(cur.id)) break;
        guard.add(cur.id);
        const pid = cur.parentId ?? null;
        if (pid == null) return false;
        if (idSet.has(pid)) return true;
        cur = byId.get(pid);
      }
      return false;
    };
    ids = ids.filter(nid => !hasSelectedAncestor(nid));
    try {
      const json = JSON.stringify({ ids });
      e.dataTransfer.setData('application/json', json);
      e.dataTransfer.setData('text/plain', json);
      e.dataTransfer.effectAllowed = 'move';
    } catch {}
  };

  const handleDragOver = (e, targetId) => {
    e.preventDefault();
    setOverId(targetId ?? null);
    try {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const h = rect.height || 1;
      const pos = y < h * 0.25 ? 'above' : (y > h * 0.75 ? 'below' : 'inside');
      setOverPos(pos);
    } catch {
      setOverPos('inside');
    }
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (e, targetId) => {
    setOverId(prev => (prev === targetId ? null : prev));
    setOverPos(prev => (overId === targetId ? null : prev));
  };

  const commitReorderAroundTarget = (parentId, movingId, targetId, pos) => {
    const siblings = (objects || []).filter(o => (o.parentId ?? null) === (parentId ?? null));
    const base = siblings.map(s => s.id).filter(id => id !== movingId);
    const idx = base.indexOf(targetId);
    const insertIdx = pos === 'above' ? Math.max(0, idx) : Math.min(base.length, idx + 1);
    const ordered = [...base.slice(0, insertIdx), movingId, ...base.slice(insertIdx)];
    onReorder?.(parentId ?? null, ordered);
  };

  const commitReorderMultipleAroundTarget = (parentId, movingIds, targetId, pos) => {
    const siblings = (objects || []).filter(o => (o.parentId ?? null) === (parentId ?? null));
    const moveSet = new Set(movingIds);
    const base = siblings.map(s => s.id).filter(id => !moveSet.has(id));
    const idx = base.indexOf(targetId);
    const insertIdx = pos === 'above' ? Math.max(0, idx) : Math.min(base.length, idx + 1);
    const ordered = [...base.slice(0, insertIdx), ...movingIds, ...base.slice(insertIdx)];
    onReorder?.(parentId ?? null, ordered);
  };

  const handleDropOnItem = (e, targetId) => {
    e.preventDefault();
    // payload에서 멀티 아이디 수집 (폴백: draggingId)
    let payload = null;
    try {
      const txt = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain') || '';
      if (txt) payload = JSON.parse(txt);
    } catch {}
    const ids = Array.isArray(payload?.ids) && payload.ids.length ? payload.ids : (dragRef.current.draggingId ? [dragRef.current.draggingId] : []);
    setOverId(null);
    setOverPos(null);
    if (!ids.length) return;
    const target = byId.get(targetId);
    if (!target) return;

    const zone = overPos || 'inside';
    if (zone === 'inside') {
      if (ids.length > 1) onBatchStart?.();
      // 각 항목을 타겟의 자식으로
      ids.forEach(movingId => {
        if (movingId === targetId) return;
        // 사이클 방지: movingId가 target의 조상인 경우 스킵
        if (isAncestor(movingId, targetId)) return;
        onReparent?.(movingId, targetId);
      });
      if (ids.length > 1) onBatchEnd?.();
    } else {
      const newParentId = target.parentId ?? null;
      if (ids.length > 1) onBatchStart?.();
      // 새로운 부모로 이동 후, 멀티 순서 삽입
      const validMoves = ids.filter(movingId => {
        if (movingId === targetId) return false;
        // 사이클 방지: movingId의 조상으로 이동하는 경우 방지
        const tpid = newParentId;
        if (tpid != null) {
          // target의 부모가 movingId의 자손인지 검사 (간접적으로 불필요한 케이스 방지)
          return !isAncestor(movingId, tpid);
        }
        return true;
      });
      validMoves.forEach(movingId => onReparent?.(movingId, newParentId));
      if (validMoves.length) commitReorderMultipleAroundTarget(newParentId, validMoves, targetId, zone);
      if (ids.length > 1) onBatchEnd?.();
    }
    // 드롭 후 첫 번째 이동 대상을 다시 선택해 컨트롤/선택 상태를 단일화
    const pick = ids[0];
    if (pick != null) onSelect?.(pick);
  };

  const renderNode = (node, depth = 0) => {
  const isSelected = selectedIdSet.has(String(node.id));
    const kids = byParent.get(node.id) || [];
    const collapsedHere = collapsed.has(node.id);
    const isOver = overId === node.id;
    const zone = isOver ? (overPos || 'inside') : null;
    const indent = Math.max(0, depth) * 12;
    const visible = node.visible !== false;
    const frozen = node.frozen === true;
    const typeIcon = node.type === 'camera' ? '📷' : (node.type === 'light' ? '💡' : '🔶');

    return (
      <div key={node.id} className={`tree-node ${isSelected ? 'selected' : ''}`}
           draggable
           onDragStart={(e) => handleDragStart(e, node.id)}
           onDragOver={(e) => handleDragOver(e, node.id)}
           onDragLeave={(e) => handleDragLeave(e, node.id)}
           onDrop={(e) => handleDropOnItem(e, node.id)}
           onClick={() => onSelect?.(node.id)}
           style={{
             margin: '2px 0',
             borderRadius: 3,
             background: isSelected ? '#ff8c00' : (isOver && zone === 'inside' ? '#2d2d2d' : 'transparent'),
             // 선택 강조: outline/borderLeft만 사용해 borderTop/bottom과 충돌 방지
             outline: isSelected ? '2px solid #ff6600' : 'none',
             borderLeft: isSelected ? '3px solid #ff6600' : '3px solid transparent',
             // 드롭 가이드: 위/아래 테두리만 사용
             borderTop: isOver && zone === 'above' ? '2px solid #00b894' : undefined,
             borderBottom: isOver && zone === 'below' ? '2px solid #00b894' : undefined,
             boxShadow: isSelected ? '0 0 8px rgba(255,140,0,0.6)' : 'none',
             paddingLeft: 8 + indent,
             transition: 'all .15s ease'
           }}>
        <div className="tree-row" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px' }}>
          <button title={collapsedHere ? '펼치기' : '접기'}
                  onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id); }}
                  style={{ width: 16, height: 20, background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>
            {kids.length > 0 ? (collapsedHere ? '▸' : '▾') : '·'}
          </button>
          <span className="tree-type" style={{ opacity: 0.8 }}>{typeIcon}</span>
          <span className="tree-name" style={{ color: isSelected ? '#fff' : '#ccc', fontWeight: isSelected ? 'bold' : 'normal', userSelect: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
          <div className="tree-actions" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {node.parentId != null && (
              <button
                className="icon-btn unparent"
                title="부모 해제 (루트로 이동)"
                onClick={(e) => { e.stopPropagation(); onReparent?.(node.id, null); }}
                style={{ width: 22, height: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#ddd' }}
              >⏏</button>
            )}
            <button
              className={`icon-btn eye ${visible ? 'on' : 'off'}`}
              title={visible ? '숨기기' : '보이기'}
              onClick={(e) => { e.stopPropagation(); onToggleVisibility?.(node); }}
              style={{ width: 22, height: 20, background: 'none', border: 'none', cursor: 'pointer', color: visible ? '#ddd' : '#666' }}
            >{visible ? '👁' : '🙈'}</button>
            <button
              className={`icon-btn lock ${frozen ? 'on' : 'off'}`}
              title={frozen ? '잠금 해제' : '잠금'}
              onClick={(e) => { e.stopPropagation(); onToggleFreeze?.(node); }}
              style={{ width: 22, height: 20, background: 'none', border: 'none', cursor: 'pointer', color: frozen ? '#ddd' : '#666' }}
            >{frozen ? '🔒' : '🔓'}</button>
          </div>
        </div>
        {kids.length > 0 && !collapsedHere && (
          <div className="tree-children">
            {kids.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="scene-hierarchy-panel">
      <div className="panel-header"><h3>계층</h3></div>
      <div className="panel-content">
        {(roots || []).map(node => renderNode(node, 0))}
      </div>
    </div>
  );
}
