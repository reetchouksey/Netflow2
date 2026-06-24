import { useRef, useState } from "react";
import { NODE_STYLES } from "./nodeStyles";

export const NODE_W = 160;
export const NODE_H = 60;

const CANVAS_W = 760;
const CANVAS_H = 540;

export default function WorkflowEditor({
  nodes,
  connections,
  selectedNodeId,
  onSelectNode,
  onMoveNode,
  onDropNewNode,
  onDeleteNode,
  onAddConnection,
  onDeleteConnection,
  readOnly = false,
}) {
  const containerRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [pendingConn, setPendingConn] = useState(null);
  const [hoveredConnIdx, setHoveredConnIdx] = useState(null);
  const [hoverTargetId, setHoverTargetId] = useState(null);

  const handleNodeMouseDown = (e, node) => {
    if (readOnly) return;
    e.stopPropagation();
    onSelectNode?.(node.id);
    const rect = containerRef.current.getBoundingClientRect();
    setDragState({
      id: node.id,
      offsetX: e.clientX - rect.left - node.x,
      offsetY: e.clientY - rect.top - node.y,
    });
  };

  const handleStartConnect = (e, nodeId) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPendingConn({
      fromId: nodeId,
      startX: node.x + NODE_W / 2,
      startY: node.y + NODE_H,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (dragState) {
      const x = Math.max(
        0,
        Math.min(CANVAS_W - NODE_W, mx - dragState.offsetX)
      );
      const y = Math.max(
        0,
        Math.min(CANVAS_H - NODE_H, my - dragState.offsetY)
      );
      onMoveNode?.(dragState.id, x, y);
    }

    if (pendingConn) {
      setPendingConn((prev) => ({ ...prev, x: mx, y: my }));
      const target = nodeAt(mx, my, nodes, pendingConn.fromId);
      setHoverTargetId(target?.id || null);
    }
  };

  const handleMouseUp = (e) => {
    if (dragState) setDragState(null);
    if (pendingConn) {
      const rect = containerRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const target = nodeAt(mx, my, nodes, pendingConn.fromId);
      if (target) {
        const exists = connections.some(
          (c) => c.from === pendingConn.fromId && c.to === target.id
        );
        if (!exists) {
          onAddConnection?.({ from: pendingConn.fromId, to: target.id });
        }
      }
      setPendingConn(null);
      setHoverTargetId(null);
    }
  };

  return (
    <section className="flex-1 min-w-0 bg-gray-50/60 overflow-auto">
      <div className="mx-auto my-6" style={{ width: CANVAS_W }}>
        {!readOnly && (
          <div className="text-xs text-gray-500 mb-2 px-1">
            Tip: drag from a node’s bottom dot onto another node to connect them.
            Hover a connection and click to delete it.
          </div>
        )}
        <div
          ref={containerRef}
          className={`relative bg-white border rounded-md transition ${
            isDragOver
              ? "border-blue-400 ring-2 ring-blue-300"
              : "border-gray-200"
          }`}
          style={{ width: CANVAS_W, height: CANVAS_H }}
          onClick={() => onSelectNode?.(null)}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDragOver={(e) => {
            if (readOnly) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            if (readOnly) return;
            e.preventDefault();
            setIsDragOver(false);
            const type = e.dataTransfer.getData("application/x-node-type");
            if (!type) return;
            const rect = containerRef.current.getBoundingClientRect();
            const x = Math.max(
              0,
              Math.min(CANVAS_W - NODE_W, e.clientX - rect.left - NODE_W / 2)
            );
            const y = Math.max(
              0,
              Math.min(CANVAS_H - NODE_H, e.clientY - rect.top - NODE_H / 2)
            );
            onDropNewNode?.(type, x, y);
          }}
        >
          <DottedBackground />

          <svg
            className="absolute inset-0"
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ pointerEvents: "none" }}
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 z" fill="#94a3b8" />
              </marker>
              <marker
                id="arrow-dashed"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 z" fill="#cbd5e1" />
              </marker>
              <marker
                id="arrow-hover"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 z" fill="#f43f5e" />
              </marker>
              <marker
                id="arrow-approve"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 z" fill="#10b981" />
              </marker>
              <marker
                id="arrow-reject"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 z" fill="#ef4444" />
              </marker>
            </defs>

            {connections.map((c, idx) => {
              const from = nodes.find((n) => n.id === c.from);
              const to = nodes.find((n) => n.id === c.to);
              if (!from || !to) return null;
              const d = pathFor(from, to);
              const isHovered = hoveredConnIdx === idx;

              let strokeColor, marker;
              if (isHovered) {
                strokeColor = "#f43f5e";
                marker = "url(#arrow-hover)";
              } else if (c.branch === "approve") {
                strokeColor = "#10b981";
                marker = "url(#arrow-approve)";
              } else if (c.branch === "reject") {
                strokeColor = "#ef4444";
                marker = "url(#arrow-reject)";
              } else if (c.dashed) {
                strokeColor = "#cbd5e1";
                marker = "url(#arrow-dashed)";
              } else {
                strokeColor = "#94a3b8";
                marker = "url(#arrow)";
              }
              return (
                <g key={idx}>
                  {!readOnly && (
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      style={{ pointerEvents: "stroke", cursor: "pointer" }}
                      onMouseEnter={() => setHoveredConnIdx(idx)}
                      onMouseLeave={() => setHoveredConnIdx(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConnection?.(idx);
                        setHoveredConnIdx(null);
                      }}
                    >
                      <title>Click to delete connection</title>
                    </path>
                  )}

                  <path
                    d={d}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHovered ? 2 : 1.6}
                    strokeDasharray={c.dashed || c.branch === "reject" ? "5 4" : undefined}
                    markerEnd={marker}
                    style={{ pointerEvents: "none" }}
                  />
                </g>
              );
            })}

            {pendingConn && (
              <path
                d={`M ${pendingConn.startX} ${pendingConn.startY} L ${pendingConn.x} ${pendingConn.y}`}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1.8}
                strokeDasharray="4 3"
                style={{ pointerEvents: "none" }}
              />
            )}
          </svg>

          {nodes.map((node) => (
            <WorkflowNode
              key={node.id}
              node={node}
              selected={selectedNodeId === node.id}
              isPendingTarget={hoverTargetId === node.id}
              isPendingSource={pendingConn?.fromId === node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              onStartConnect={(e) => handleStartConnect(e, node.id)}
              onDelete={() => onDeleteNode?.(node.id)}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowNode({
  node,
  selected,
  isPendingTarget,
  isPendingSource,
  onMouseDown,
  onStartConnect,
  onDelete,
  readOnly = false,
}) {
  const s = NODE_STYLES[node.type] || NODE_STYLES.start;
  const cursorCls = readOnly
    ? "cursor-default"
    : selected
    ? `ring-2 ${s.ring} shadow-md cursor-grabbing`
    : "cursor-grab";
  return (
    <div
      onMouseDown={readOnly ? undefined : onMouseDown}
      onClick={(e) => e.stopPropagation()}
      className={`group absolute select-none rounded-md border px-3 py-2 text-center shadow-sm transition ${s.card} ${cursorCls} ${
        !readOnly && isPendingTarget ? "ring-2 ring-blue-500/70 shadow-md" : ""
      }`}
      style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
    >
      <div className={`text-[13px] font-semibold ${s.title}`}>{node.title}</div>
      <div className={`text-[11px] mt-0.5 ${s.subtitle}`}>{node.subtitle}</div>

      {!readOnly && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 rounded-full bg-white border-2 transition ${
            isPendingTarget
              ? "border-blue-500 scale-125"
              : "border-gray-300 group-hover:border-gray-500"
          }`}
        />
      )}

      {!readOnly && (
        <div
          onMouseDown={onStartConnect}
          title="Drag to connect"
          className={`absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 rounded-full bg-white border-2 transition cursor-crosshair hover:scale-125 hover:bg-blue-50 ${
            isPendingSource
              ? "border-blue-500 scale-125 bg-blue-50"
              : "border-gray-300 hover:border-blue-500"
          }`}
        />
      )}

      {!readOnly && selected && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete node"
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-gray-300 text-gray-500 hover:text-rose-600 hover:border-rose-300 shadow-sm text-[11px] leading-none flex items-center justify-center"
        >
          ×
        </button>
      )}
    </div>
  );
}

function DottedBackground() {
  return (
    <svg
      className="absolute inset-0 opacity-60"
      width="100%"
      height="100%"
      style={{ pointerEvents: "none" }}
    >
      <defs>
        <pattern
          id="dots"
          x="0"
          y="0"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="1" fill="#e5e7eb" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dots)" />
    </svg>
  );
}

function pathFor(from, to) {
  const fromX = from.x + NODE_W / 2;
  const fromY = from.y + NODE_H;
  const toX = to.x + NODE_W / 2;
  const toY = to.y;

  if (Math.abs(fromX - toX) < 4) {
    return `M ${fromX} ${fromY} L ${toX} ${toY}`;
  }
  const midY = fromY + Math.max(20, (toY - fromY) / 2);
  return `M ${fromX} ${fromY} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${toY}`;
}

function nodeAt(x, y, nodes, excludeId) {
  return nodes.find(
    (n) =>
      n.id !== excludeId &&
      x >= n.x &&
      x <= n.x + NODE_W &&
      y >= n.y &&
      y <= n.y + NODE_H
  );
}
