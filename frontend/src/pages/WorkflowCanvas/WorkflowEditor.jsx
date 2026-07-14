import { useEffect, useRef, useState } from "react";
import { NODE_STYLES } from "./nodeStyles";

export const NODE_W = 160;
export const NODE_H = 60;

// The nodes live in a large logical "world". The viewport (the visible box) is
// much smaller — users zoom + pan to navigate big graphs (20+ nodes) instead of
// being clamped to a tiny fixed canvas.
const WORLD_W = 2400;
const WORLD_H = 4000;
const MIN_SCALE = 0.2;
const MAX_SCALE = 2;
const clampScale = (s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

const zoomBtnCls =
  "w-7 h-7 inline-flex items-center justify-center rounded-md border border-line bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg text-sm font-semibold transition";

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

  // view = pan offset (x, y in screen px) + zoom (scale). Kept as one object so
  // wheel/zoom updates stay internally consistent under rapid events.
  const [view, setView] = useState({ scale: 1, x: 24, y: 24 });
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef(null); // { lastX, lastY } while panning
  const didPanRef = useRef(false); // suppress the deselect-click after a pan

  // Convert pointer (client) coordinates into world coordinates.
  const toWorld = (clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  };

  // Wheel-to-zoom, focused on the cursor. Registered natively (passive:false)
  // so we can preventDefault and stop the page from scrolling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const fx = e.clientX - rect.left;
      const fy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setView((v) => {
        const next = clampScale(v.scale * factor);
        const k = next / v.scale;
        return { scale: next, x: fx - (fx - v.x) * k, y: fy - (fy - v.y) * k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomAtCenter = (factor) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const fx = rect ? rect.width / 2 : 0;
    const fy = rect ? rect.height / 2 : 0;
    setView((v) => {
      const next = clampScale(v.scale * factor);
      const k = next / v.scale;
      return { scale: next, x: fx - (fx - v.x) * k, y: fy - (fy - v.y) * k };
    });
  };

  const resetView = () => setView({ scale: 1, x: 24, y: 24 });

  // Zoom + center so every node fits within the viewport.
  const fitView = () => {
    const el = containerRef.current;
    if (!el || nodes.length === 0) {
      resetView();
      return;
    }
    const rect = el.getBoundingClientRect();
    const pad = 48;
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_W));
    const maxY = Math.max(...nodes.map((n) => n.y + NODE_H));
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const scale = clampScale(
      Math.min((rect.width - pad * 2) / w, (rect.height - pad * 2) / h)
    );
    setView({
      scale,
      x: (rect.width - w * scale) / 2 - minX * scale,
      y: (rect.height - h * scale) / 2 - minY * scale,
    });
  };

  const handleNodeMouseDown = (e, node) => {
    if (readOnly) return;
    e.stopPropagation();
    onSelectNode?.(node.id);
    const w = toWorld(e.clientX, e.clientY);
    setDragState({ id: node.id, offsetX: w.x - node.x, offsetY: w.y - node.y });
  };

  const handleStartConnect = (e, nodeId) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const w = toWorld(e.clientX, e.clientY);
    setPendingConn({
      fromId: nodeId,
      startX: node.x + NODE_W / 2,
      startY: node.y + NODE_H,
      x: w.x,
      y: w.y,
    });
  };

  // Mousedown on empty canvas -> begin panning. Nodes and connection dots call
  // stopPropagation, so this only fires for the background.
  const handleBackgroundMouseDown = (e) => {
    if (dragState || pendingConn) return;
    panRef.current = { lastX: e.clientX, lastY: e.clientY };
    didPanRef.current = false;
    setIsPanning(true);
  };

  const handleMouseMove = (e) => {
    if (dragState) {
      const w = toWorld(e.clientX, e.clientY);
      const x = Math.max(0, Math.min(WORLD_W - NODE_W, w.x - dragState.offsetX));
      const y = Math.max(0, Math.min(WORLD_H - NODE_H, w.y - dragState.offsetY));
      onMoveNode?.(dragState.id, x, y);
      return;
    }
    if (pendingConn) {
      const w = toWorld(e.clientX, e.clientY);
      setPendingConn((prev) => ({ ...prev, x: w.x, y: w.y }));
      const target = nodeAt(w.x, w.y, nodes, pendingConn.fromId);
      setHoverTargetId(target?.id || null);
      return;
    }
    if (panRef.current) {
      const dx = e.clientX - panRef.current.lastX;
      const dy = e.clientY - panRef.current.lastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didPanRef.current = true;
      panRef.current = { lastX: e.clientX, lastY: e.clientY };
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };

  const endInteractions = (e) => {
    if (dragState) setDragState(null);
    if (pendingConn) {
      const w = toWorld(e.clientX, e.clientY);
      const target = nodeAt(w.x, w.y, nodes, pendingConn.fromId);
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
    if (panRef.current) {
      panRef.current = null;
      setIsPanning(false);
    }
  };

  const handleBackgroundClick = () => {
    // A drag-pan also fires a click on mouseup — don't let it deselect.
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    onSelectNode?.(null);
  };

  return (
    <section className="flex-1 min-w-0 bg-surface-2/60 flex flex-col">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-line bg-surface">
        {!readOnly ? (
          <p className="text-[11px] text-fg-muted leading-tight">
            Tip: drag a node’s bottom dot onto another to connect. Scroll to
            zoom, drag empty space to pan.
          </p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => zoomAtCenter(1 / 1.2)}
            className={zoomBtnCls}
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={resetView}
            className="h-7 min-w-[3.25rem] px-2 inline-flex items-center justify-center rounded-md border border-line bg-surface text-[11px] font-medium text-fg-muted hover:bg-surface-2 transition"
            title="Reset zoom to 100%"
          >
            {Math.round(view.scale * 100)}%
          </button>
          <button
            type="button"
            onClick={() => zoomAtCenter(1.2)}
            className={zoomBtnCls}
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={fitView}
            className="ml-1 h-7 px-2.5 inline-flex items-center justify-center rounded-md border border-line bg-surface text-[11px] font-medium text-fg hover:bg-surface-2 transition"
            title="Fit all nodes in view"
          >
            Fit
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`relative flex-1 min-h-0 overflow-hidden ${
          isPanning ? "cursor-grabbing" : "cursor-grab"
        } ${isDragOver ? "ring-2 ring-inset ring-blue-300" : ""}`}
        onMouseDown={handleBackgroundMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endInteractions}
        onMouseLeave={endInteractions}
        onClick={handleBackgroundClick}
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
          const w = toWorld(e.clientX, e.clientY);
          const x = Math.max(0, Math.min(WORLD_W - NODE_W, w.x - NODE_W / 2));
          const y = Math.max(0, Math.min(WORLD_H - NODE_H, w.y - NODE_H / 2));
          onDropNewNode?.(type, x, y);
        }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: WORLD_W,
            height: WORLD_H,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        >
          <DottedBackground />

          <svg
            className="absolute inset-0"
            width={WORLD_W}
            height={WORLD_H}
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
                    strokeDasharray={
                      c.dashed || c.branch === "reject" ? "5 4" : undefined
                    }
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
          className={`absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 rounded-full bg-surface border-2 transition ${
            isPendingTarget
              ? "border-blue-500 scale-125"
              : "border-line group-hover:border-gray-500"
          }`}
        />
      )}

      {!readOnly && (
        <div
          onMouseDown={onStartConnect}
          title="Drag to connect"
          className={`absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 rounded-full bg-surface border-2 transition cursor-crosshair hover:scale-125 hover:bg-blue-50 ${
            isPendingSource
              ? "border-blue-500 scale-125 bg-blue-50"
              : "border-line hover:border-blue-500"
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
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-surface border border-line text-fg-muted hover:text-rose-600 hover:border-rose-300 shadow-sm text-[11px] leading-none flex items-center justify-center"
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
      className="absolute inset-0"
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
