import { useMemo, useRef } from 'react';
import './SceneHierarchyPanel.css';

export default function HierarchyTreePanel({
  objects,
  selectedIds = [],
  onSelect,
  onReparent,
  onReorder
}) {
  const dragState = useRef({ draggingId: null, overId: null, overPos: 'inside' });
  const byId = useMemo(() => new Map(objects.map(o => [o.id, o])), [objects]);
  const byParent = useMemo(() => {
    const map = new Map();
    objects.forEach(o => {
      const pid = o.parentId ?? null;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid).push(o);
    });
    for (const arr of map.values()) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return map;
  }, [objects]);

  const roots = byParent.get(null) || [];

  const handleDragStart = (e, id) => {
    dragState.current.draggingId = id;
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, overId) => {
    e.preventDefault();
    dragState.current.overId = overId;
    dragState.current.overPos = 'inside';
  };
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const srcId = dragState.current.draggingId;
    if (!srcId || srcId === targetId) return;
    onReparent?.(srcId, targetId);
    dragState.current = { draggingId: null, overId: null, overPos: 'inside' };
  };

  const renderNode = (node) => {
    const isSelected = selectedIds.includes(node.id);
    const children = byParent.get(node.id) || [];
    return (
      <div key={node.id} className={`tree-node ${isSelected ? 'selected' : ''}`}
           draggable
           onDragStart={(e) => handleDragStart(e, node.id)}
           onDragOver={(e) => handleDragOver(e, node.id)}
           onDrop={(e) => handleDrop(e, node.id)}
           onClick={() => onSelect?.(node.id)}>
        <div className="tree-row">
          <span className="tree-name">{node.name}</span>
        </div>
        {children.length > 0 && (
          <div className="tree-children">
            {children.map(renderNode)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="scene-hierarchy-panel">
      <div className="panel-header"><h3>계층</h3></div>
      <div className="panel-content">
        {(roots || []).map(renderNode)}
      </div>
    </div>
  );
}
