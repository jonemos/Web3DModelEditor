import { useMemo, useRef, useState, useCallback } from 'react';
import './SceneHierarchyPanel.css';

export default function HierarchyTreePanel({
  objects,
  selectedIds = [],
  onSelect,
  onReparent,
  onReorder
}) {
  const dragRef = useRef({ draggingId: null });
  const [overId, setOverId] = useState(null);
  const [overPos, setOverPos] = useState(null); // 'above' | 'inside' | 'below'
  const [isOverRoot, setIsOverRoot] = useState(false);
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
    try {
      const json = JSON.stringify({ id });
      e.dataTransfer.setData('application/json', json);
      e.dataTransfer.setData('text/plain', json);
      e.dataTransfer.effectAllowed = 'move';
    } catch {}
  };

  const handleDragOver = (e, targetId) => {
    e.preventDefault();
    setIsOverRoot(false);
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

  const handleDropOnItem = (e, targetId) => {
    e.preventDefault();
    const movingId = dragRef.current.draggingId;
    setOverId(null);
    setOverPos(null);
    setIsOverRoot(false);
    if (!movingId || movingId === targetId) return;
    const target = byId.get(targetId);
    if (!target) return;

    // 사이클 방지
    if (isAncestor(movingId, targetId)) return;

    const zone = overPos || 'inside';
    if (zone === 'inside') {
      onReparent?.(movingId, targetId);
    } else {
      const newParentId = target.parentId ?? null;
      // 먼저 동일 부모로 이동
      onReparent?.(movingId, newParentId);
      // 그 다음 순서 조정
      commitReorderAroundTarget(newParentId, movingId, targetId, zone);
    }
  };

  const handleDropOnRoot = (e) => {
    e.preventDefault();
    const movingId = dragRef.current.draggingId;
    setIsOverRoot(false);
    setOverId(null);
    setOverPos(null);
    if (!movingId) return;
    onReparent?.(movingId, null);
  };

  const renderNode = (node, depth = 0) => {
    const isSelected = selectedIds.includes(node.id);
    const kids = byParent.get(node.id) || [];
    const collapsedHere = collapsed.has(node.id);
    const isOver = overId === node.id;
    const zone = isOver ? (overPos || 'inside') : null;
    const indent = Math.max(0, depth) * 12;

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
          <span className="tree-name" style={{ color: isSelected ? '#fff' : '#ccc', fontWeight: isSelected ? 'bold' : 'normal', userSelect: 'none' }}>{node.name}</span>
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
        {/* 루트 드롭 영역 */}
        <div onDragOver={(e) => { e.preventDefault(); setIsOverRoot(true); setOverId(null); setOverPos(null); }}
             onDragLeave={() => setIsOverRoot(false)}
             onDrop={handleDropOnRoot}
             style={{
               border: isOverRoot ? '2px dashed #00b894' : '1px dashed #444',
               background: isOverRoot ? 'rgba(0,184,148,0.12)' : 'transparent',
               color: '#aaa', fontSize: 11, padding: '6px 8px', borderRadius: 4, marginBottom: 6
             }}
             title="여기에 드롭하면 루트로 이동">
          루트로 드롭하여 상위 해제
        </div>
        {(roots || []).map(node => renderNode(node, 0))}
      </div>
    </div>
  );
}
