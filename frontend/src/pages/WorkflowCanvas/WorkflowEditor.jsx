import { useEffect, useRef, useState, useMemo } from "react";
import { NODE_STYLES } from "./nodeStyles";
import NodeTypeIcon from "../../components/NodeTypeIcon";

export const NODE_W = 280;
export const NODE_H = 100;

const zoomBtnCls =
  "w-8 h-8 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg text-sm font-semibold shadow-sm transition";

// The nodes live in a dynamic logical "world" whose size is computed from
// the actual node bounding box. The viewport (the visible box) pans/zooms
// to navigate, but never beyond the content bounds + a small padding.
const MIN_SCALE = 0.5;
const MAX_SCALE = 2;
const CANVAS_PADDING = 24;
const CANVAS_TOP_PADDING = 12;
// Extra padding around the content bounding box that defines the world.
// This gives users a small breathing room (~1 scroll gesture worth) around
// the outermost nodes but prevents multiple screens of blank space.
const CONTENT_MARGIN = 120;
const clampScale = (s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

// Compute the world bounding box from the actual node positions.
// Returns { minX, minY, maxX, maxY, worldW, worldH } with CONTENT_MARGIN padding.
function computeWorldBounds(nodeList) {
  if (!nodeList || !nodeList.length) {
    // Fallback for empty canvas — small default area
    return { minX: 0, minY: 0, maxX: 600, maxY: 400, worldW: 600, worldH: 400 };
  }
  const minX = Math.min(...nodeList.map((n) => n.x)) - CONTENT_MARGIN;
  const minY = Math.min(...nodeList.map((n) => n.y)) - CONTENT_MARGIN;
  const maxX = Math.max(...nodeList.map((n) => n.x + (n.w || NODE_W))) + CONTENT_MARGIN;
  const maxY = Math.max(...nodeList.map((n) => n.y + (n.h || NODE_H))) + CONTENT_MARGIN;
  return {
    minX,
    minY,
    maxX,
    maxY,
    worldW: Math.max(600, maxX - minX),
    worldH: Math.max(400, maxY - minY),
  };
}

export default function WorkflowEditor({
  nodes,
  connections,
  selectedNodeId,
  onSelectNode,
  onMoveNode,
  onResizeNode,
  onDropNewNode,
  onDeleteNode,
  onAddConnection,
  onDeleteConnection,
  readOnly = false,
  // Bump when the graph is replaced (edit load / template) so we auto-fit again.
  fitKey = 0,
  isMaximized = false,
  onToggleMaximize = null,
  // Live structural problems from graphIssues — highlight + banner on the canvas.
  problemNodeIds = null,
  flowProblems = [],
  onSelectProblem,
}) {
  const containerRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [resizeState, setResizeState] = useState(null);
  const [pendingConn, setPendingConn] = useState(null);
  const [hoveredConnIdx, setHoveredConnIdx] = useState(null);
  const [hoverTargetId, setHoverTargetId] = useState(null);
  const [problemsOpen, setProblemsOpen] = useState(true);
  const problemSet = problemNodeIds instanceof Set
    ? problemNodeIds
    : new Set(problemNodeIds || []);

  // view = pan offset (x, y in screen px) + zoom (scale). Kept as one object so
  // wheel/zoom updates stay internally consistent under rapid events.
  const [view, setView] = useState({ scale: 1, x: CANVAS_PADDING, y: CANVAS_TOP_PADDING });

  // Dynamic world bounds based on actual node positions
  const worldBounds = useMemo(() => computeWorldBounds(nodes), [
    // Recompute when nodes change structurally (count, positions, sizes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nodes.map(n => `${n.id}:${n.x}:${n.y}:${n.w || NODE_W}:${n.h || NODE_H}`).join(',')
  ]);
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef(null); // { lastX, lastY } while panning
  const didPanRef = useRef(false); // suppress the deselect-click after a pan
  // First paint of this editor session — auto-fit once the canvas has a real size.
  const didInitialFitRef = useRef(false);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Keep the viewport within the real workflow bounds. Short workflows stay
  // fixed in the available viewport; larger workflows can pan only as far as
  // their outermost nodes plus CONTENT_MARGIN — enough breathing room for
  // ~1 scroll gesture, but not multiple screens of blank space.
  const constrainView = (nextView) => {
    const el = containerRef.current;
    const list = nodesRef.current;
    if (!el) return nextView;
    if (!list.length) return { ...nextView, x: CANVAS_PADDING, y: CANVAS_TOP_PADDING };

    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return nextView;

    const scale = nextView.scale;
    const minX = Math.min(...list.map((n) => n.x));
    const minY = Math.min(...list.map((n) => n.y));
    const maxX = Math.max(...list.map((n) => n.x + (n.w || NODE_W)));
    const maxY = Math.max(...list.map((n) => n.y + (n.h || NODE_H)));
    const contentWidth = (maxX - minX) * scale;
    const contentHeight = (maxY - minY) * scale;

    // Horizontal: center when content fits; otherwise clamp pan so at most
    // CONTENT_MARGIN of blank space is visible on either side.
    const x = contentWidth <= rect.width - CONTENT_MARGIN * 2
      ? (rect.width - contentWidth) / 2 - minX * scale
      : Math.max(
          rect.width - CONTENT_MARGIN - maxX * scale,
          Math.min(CONTENT_MARGIN - minX * scale, nextView.x)
        );

    // Vertical: top-align when content fits; otherwise clamp so at most
    // CONTENT_MARGIN of blank space is visible above/below.
    const topPad = Math.min(CONTENT_MARGIN, CANVAS_TOP_PADDING + CONTENT_MARGIN);
    const y = contentHeight <= rect.height - topPad - CONTENT_MARGIN
      ? CANVAS_TOP_PADDING - minY * scale
      : Math.max(
          rect.height - CONTENT_MARGIN - maxY * scale,
          Math.min(topPad - minY * scale, nextView.y)
        );

    return { ...nextView, x, y };
  };

  // Convert pointer (client) coordinates into world coordinates.
  const toWorld = (clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  };

  // Zoom + center so every node fits within the viewport. Cap at 1× so a
  // two-node scratch graph isn't blown up to fill the whole screen.
  const computeFit = (el, list, { maxScale = 1 } = {}) => {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return null;
    if (!list.length) return { scale: 1, x: CANVAS_PADDING, y: CANVAS_TOP_PADDING };

    const padX = Math.max(48, Math.min(96, rect.width * 0.08));
    const padY = CANVAS_PADDING;
    const minX = Math.min(...list.map((n) => n.x));
    const minY = Math.min(...list.map((n) => n.y));
    const maxX = Math.max(...list.map((n) => n.x + (n.w || NODE_W)));
    const maxY = Math.max(...list.map((n) => n.y + (n.h || NODE_H)));
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const scale = clampScale(
      Math.min(
        maxScale,
        (rect.width - padX * 2) / w,
        (rect.height - padY * 2) / h
      )
    );
    return {
      scale,
      x: (rect.width - w * scale) / 2 - minX * scale,
      y: CANVAS_TOP_PADDING - minY * scale,
    };
  };

  const fitView = () => {
    const next = computeFit(containerRef.current, nodes, { maxScale: 1 });
    if (next) setView(constrainView(next));
  };

  // Manual zoom only requested by user; wheel-to-zoom is disabled.

  // On first visit (and after the fullscreen layout settles), fit every node
  // into view. ResizeObserver covers the case where the canvas mounts at 0×0
  // before the flex layout assigns height. `fitKey` resets this when the graph
  // is replaced (edit load / template).
  useEffect(() => {
    didInitialFitRef.current = false;
    const el = containerRef.current;
    if (!el) return undefined;

    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!nodesRef.current.length) return;
        const next = computeFit(el, nodesRef.current, { maxScale: 1 });
        if (next) {
          setView(constrainView(next));
          didInitialFitRef.current = true;
        }
      }, 50);
    };

    handleResize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(handleResize) : null;
    ro?.observe(el);

    return () => {
      ro?.disconnect();
      clearTimeout(resizeTimeout);
    };
  }, [fitKey]);

  // Edit mode often mounts with a bootstrap graph, then swaps in the real
  // nodes — if the first fit already ran on empty/bootstrap, retry once.
  useEffect(() => {
    if (didInitialFitRef.current || !nodes.length) return;
    fitView();
  }, [nodes.length]);

  // Auto-fit when a node is added/removed, or when maximized state changes.
  useEffect(() => {
    if (didInitialFitRef.current && nodes.length > 0) {
      // Small timeout to allow DOM layout to settle if maximized state changed
      setTimeout(fitView, 50);
    }
  }, [nodes.length, isMaximized]);

  // Zoom at pointer position (for mouse wheel / pinch-to-zoom)
  const zoomAtPointer = (factor, clientX, clientY) => {
    setView((v) => {
      const nextScale = clampScale(v.scale * factor);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...v, scale: nextScale };

      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;

      // World coordinates before zoom
      const worldX = (mouseX - v.x) / v.scale;
      const worldY = (mouseY - v.y) / v.scale;

      return constrainView({
        scale: nextScale,
        x: mouseX - worldX * nextScale,
        y: mouseY - worldY * nextScale,
      });
    });
  };

  const zoomAtCenter = (factor) => {
    setView((v) => {
      const nextScale = clampScale(v.scale * factor);
      const el = containerRef.current;
      if (!el || !nodes.length) {
        return { ...v, scale: nextScale };
      }
      // Keep the entire graph horizontally centered but top-aligned when zooming
      const rect = el.getBoundingClientRect();
      const minX = Math.min(...nodes.map((n) => n.x));
      const minY = Math.min(...nodes.map((n) => n.y));
      const maxX = Math.max(...nodes.map((n) => n.x + (n.w || NODE_W)));
      const w = Math.max(1, maxX - minX);
      
      return constrainView({
        scale: nextScale,
        x: (rect.width - w * nextScale) / 2 - minX * nextScale,
        y: CANVAS_TOP_PADDING - minY * nextScale,
      });
    });
  };

  const resetView = () => setView((v) => constrainView({ ...v, scale: 1 }));

  // Laptop Keyboard Shortcuts (+, -, 0, 1, Ctrl + +, Ctrl + -)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in form input / textarea / select
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (document.activeElement?.isContentEditable) return;

      if (
        e.key === "=" ||
        e.key === "+" ||
        (e.ctrlKey && (e.key === "=" || e.key === "+")) ||
        (e.metaKey && (e.key === "=" || e.key === "+"))
      ) {
        e.preventDefault();
        zoomAtCenter(1.2);
      } else if (
        e.key === "-" ||
        e.key === "_" ||
        (e.ctrlKey && (e.key === "-" || e.key === "_")) ||
        (e.metaKey && (e.key === "-" || e.key === "_"))
      ) {
        e.preventDefault();
        zoomAtCenter(1 / 1.2);
      } else if (
        e.key === "0" ||
        (e.ctrlKey && e.key === "0") ||
        (e.metaKey && e.key === "0")
      ) {
        e.preventDefault();
        fitView();
      } else if (
        e.key === "1" ||
        (e.ctrlKey && e.key === "1") ||
        (e.metaKey && e.key === "1")
      ) {
        e.preventDefault();
        resetView();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nodes]);

  // Keep wheel/trackpad navigation inside the canvas. Two-axis trackpads pan
  // naturally; Shift + mouse-wheel provides horizontal navigation. Ctrl/Cmd +
  // wheel retains the existing pointer-centred zoom behaviour.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
        zoomAtPointer(factor, e.clientX, e.clientY);
        return;
      }

      const deltaX = e.shiftKey && Math.abs(e.deltaX) < Math.abs(e.deltaY)
        ? e.deltaY
        : e.deltaX;
      const deltaY = e.shiftKey ? 0 : e.deltaY;
      setView((v) => constrainView({ ...v, x: v.x - deltaX, y: v.y - deltaY }));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleNodeMouseDown = (e, node) => {
    if (readOnly) return;
    e.stopPropagation();
    onSelectNode?.(node.id);
    const w = toWorld(e.clientX, e.clientY);
    setDragState({ id: node.id, offsetX: w.x - node.x, offsetY: w.y - node.y });
  };

  const handleStartResize = (e, node) => {
    if (readOnly) return;
    e.stopPropagation();
    onSelectNode?.(node.id);
    const w = toWorld(e.clientX, e.clientY);
    setResizeState({ id: node.id, startW: node.w || NODE_W, startH: node.h || NODE_H, startX: w.x, startY: w.y });
  };

  // Nodes were mouse-only: a keyboard user couldn't reach one, let alone move
  // or delete it. Arrows nudge by the same 10px grid the drag snaps to (×4 with
  // Shift), Enter/Space selects so the config panel opens, Delete removes.
  const NUDGE = 10;
  const handleNodeKeyDown = (e, node) => {
    if (readOnly) return;
    const step = e.shiftKey ? NUDGE * 4 : NUDGE;
    const nudge = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[e.key];
    if (nudge) {
      e.preventDefault();
      onSelectNode?.(node.id);
      onMoveNode?.(node.id, Math.max(0, node.x + nudge[0]), Math.max(0, node.y + nudge[1]));
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectNode?.(node.id);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onDeleteNode?.(node.id);
    }
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
      startX: node.x + (node.w || NODE_W) / 2,
      startY: node.y + (node.h || NODE_H),
      x: w.x,
      y: w.y,
    });
  };

  // Track if the mousedown actually started on the background
  const isBackgroundClickRef = useRef(false);

  // Mousedown on empty canvas -> begin panning. Nodes and connection dots call
  // stopPropagation, so this only fires for the background.
  const handleBackgroundMouseDown = (e) => {
    if (dragState || resizeState || pendingConn) return;
    panRef.current = { lastX: e.clientX, lastY: e.clientY };
    didPanRef.current = false;
    isBackgroundClickRef.current = true;
    setIsPanning(true);
  };

  const handleMouseMove = (e) => {
    if (dragState) {
      const w = toWorld(e.clientX, e.clientY);
     const x = w.x - dragState.offsetX;
const y = w.y - dragState.offsetY;

      onMoveNode?.(dragState.id, x, y);
      return;
    }
    if (resizeState) {
      const w = toWorld(e.clientX, e.clientY);
      const newW = Math.max(120, resizeState.startW + (w.x - resizeState.startX));
      const newH = Math.max(48, resizeState.startH + (w.y - resizeState.startY));
      // Snap to grid
      const snapW = Math.round(newW / 10) * 10;
      const snapH = Math.round(newH / 10) * 10;
      onResizeNode?.(resizeState.id, snapW, snapH);
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
      setView((v) => constrainView({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };

  const endInteractions = (e) => {
    setDragState(null);
    setResizeState(null);
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
    
    // Reset background click tracking after the click event has a chance to fire
    setTimeout(() => {
      isBackgroundClickRef.current = false;
    }, 0);
  };

  const handleBackgroundClick = () => {
    // If the mousedown didn't start on the background, this is a synthetic click
    // caused by a layout shift (e.g. sidebar opening). Ignore it.
    if (!isBackgroundClickRef.current) return;
    
    // A drag-pan also fires a click on mouseup — don't let it deselect.
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    onSelectNode?.(null);
  };

  const problemCount = Array.isArray(flowProblems) ? flowProblems.length : 0;

  return (
    <section className="flex-1 min-w-0 min-h-0 bg-surface-2 flex flex-col relative overflow-hidden">
      {/* Floating Canvas Controls are rendered inside containerRef below */}

      <div
        ref={containerRef}
        className={`relative flex-1 min-h-0 overflow-hidden overscroll-contain ${
          isPanning ? "cursor-grabbing" : "cursor-grab"
        } ${isDragOver ? "ring-2 ring-inset ring-indigo-400/60" : ""}`}
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
          const x = Math.max(0, w.x - NODE_W / 2);
          const y = Math.max(0, w.y - NODE_H / 2);
          onDropNewNode?.(type, x, y);
        }}
      >
        <DottedBackground view={view} />

        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: worldBounds.worldW,
            height: worldBounds.worldH,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        >

          <svg
            className="absolute inset-0"
            width={worldBounds.worldW}
            height={worldBounds.worldH}
            style={{ pointerEvents: "none" , overflow:"visible" }}
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
                <path d="M0 0 L10 5 L0 10 z" fill="var(--color-fg-subtle)" />
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
                <path d="M0 0 L10 5 L0 10 z" fill="var(--color-line)" />
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
                    strokeWidth={isHovered ? 3.5 : 2.5}
                    strokeDasharray={
                      c.dashed || c.branch === "reject" ? "6 5" : undefined
                    }
                    markerEnd={marker}
                    style={{ pointerEvents: "none" }}
                  />
                  {/* Midpoint waypoint dot */}
                  {(() => {
                    const midX = (from.x + (from.w || NODE_W) / 2 + to.x + (to.w || NODE_W) / 2) / 2;
                    const midY = (from.y + (from.h || NODE_H) + to.y) / 2;
                    return (
                      <circle
                        cx={midX}
                        cy={midY}
                        r={3.5}
                        fill="#4F46E5"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        className="shadow-xs pointer-events-none"
                      />
                    );
                  })()}
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
              hasProblem={false}
              isPendingTarget={hoverTargetId === node.id}
              isPendingSource={pendingConn?.fromId === node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              onStartResize={(e) => handleStartResize(e, node)}
              onKeyDown={(e) => handleNodeKeyDown(e, node)}
              onStartConnect={(e) => handleStartConnect(e, node.id)}
              onDelete={() => onDeleteNode?.(node.id)}
              readOnly={readOnly}
            />
          ))}
        </div>

        {/* Floating Bottom Right Fit View Pill */}
        {(() => {
          const zoomBtnCls = "w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition";
          return (
            <div className="absolute bottom-6 right-6 z-20 flex items-center bg-white/95 dark:bg-slate-800/95 backdrop-blur shadow-md border border-slate-200/80 dark:border-slate-700/80 p-1 rounded-xl">
              {/* LEFT: Zoom controls */}
              <div className="flex items-center gap-1">
                <button onClick={() => zoomAtCenter(0.8)} className={zoomBtnCls} title="Zoom out">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                </button>
                <div className="text-[11px] font-bold w-10 text-center text-slate-700 dark:text-slate-300">
                  {Math.round(view.scale * 100)}%
                </div>
                <button onClick={() => zoomAtCenter(1.25)} className={zoomBtnCls} title="Zoom in">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              {/* Divider */}
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1.5" />
              {/* RIGHT: Fit View */}
              <button onClick={fitView} className="px-2 h-6 inline-flex items-center gap-1 rounded-md border border-transparent hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold transition">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
                </svg>
                Fit view
              </button>
            </div>
          );
        })()}
      </div>
    </section>
  );
}

function WorkflowNode({
  node,
  selected,
  hasProblem = false,
  isPendingTarget,
  isPendingSource,
  onMouseDown,
  onStartResize,
  onKeyDown,
  onStartConnect,
  onDelete,
  readOnly = false,
}) {
  const s = NODE_STYLES[node.type] || NODE_STYLES.start;
  const cursorCls = readOnly
    ? "cursor-default"
    : selected
    ? `ring-2 ring-offset-2 ring-indigo-500 shadow-lg cursor-grabbing`
    : "cursor-grab hover:shadow-md hover:border-slate-300 dark:hover:border-slate-500";
  const problemCls = hasProblem && !selected
    ? "ring-2 ring-rose-500/80 shadow-md"
    : hasProblem && selected
      ? "ring-2 ring-rose-500"
      : "";
  return (
    <div
      onMouseDown={readOnly ? undefined : onMouseDown}
      onKeyDown={readOnly ? undefined : onKeyDown}
      onClick={(e) => e.stopPropagation()}
      role={readOnly ? undefined : "button"}
      tabIndex={readOnly ? undefined : 0}
      aria-pressed={readOnly ? undefined : selected}
      aria-invalid={hasProblem || undefined}
      aria-label={readOnly ? undefined : `${node.title}${node.subtitle ? `, ${node.subtitle}` : ''}${hasProblem ? '. Connection problem' : ''}. Arrow keys to move, Delete to remove.`}
      className={`group absolute select-none rounded-2xl border-[1.5px] px-4 py-3 shadow-sm backdrop-blur-[2px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${s.card} ${cursorCls} ${problemCls} ${
        !readOnly && isPendingTarget ? "ring-2 ring-indigo-500/70 shadow-md" : ""
      } ${hasProblem ? "border-rose-400 dark:border-rose-500/70" : ""}`}
      style={{ left: node.x, top: node.y, width: node.w || NODE_W, height: node.h || NODE_H }}
    >
      {hasProblem && (
        <span
          className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm"
          title="Connection problem"
          aria-hidden="true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </span>
      )}
      <div className={`flex gap-3 h-full p-2.5 ${
        node.align === 'left' ? 'justify-start' : 
        node.align === 'right' ? 'justify-end' : 
        'justify-center'
      } ${
        node.verticalAlign === 'top' ? 'items-start' :
        node.verticalAlign === 'bottom' ? 'items-end' :
        'items-center'
      }`}>
        <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${s.tile}`}>
          <NodeTypeIcon name={s.icon} className="w-6 h-6" />
        </span>
        <div className={`min-w-0 flex flex-col justify-center ${
          node.align === 'left' ? 'text-left' : 
          node.align === 'right' ? 'text-right' : 
          'text-left'
        }`}>
          <div className={`text-[17px] font-bold truncate leading-snug ${s.title}`}>{node.title}</div>
          <div className={`text-[13.5px] mt-0.5 truncate leading-snug ${s.subtitle}`}>{node.subtitle}</div>
        </div>
      </div>

      {!readOnly && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 -top-1.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-700 border-2 shadow-2xs transition ${
            isPendingTarget
              ? "border-indigo-500 scale-125 bg-indigo-50"
              : "border-slate-400 dark:border-slate-500 group-hover:border-indigo-500"
          }`}
        />
      )}

      {!readOnly && (
        <div
          onMouseDown={onStartConnect}
          title="Drag to connect"
          className={`absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-700 border-2 shadow-2xs transition cursor-crosshair hover:scale-125 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 ${
            isPendingSource
              ? "border-indigo-600 scale-125 bg-indigo-50 dark:bg-indigo-500/20"
              : "border-slate-400 dark:border-slate-500 hover:border-indigo-500"
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
          aria-label={`Delete ${node.title}`}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-surface border border-danger-line text-danger-fg shadow-sm text-[11px] leading-none flex items-center justify-center hover:bg-danger-subtle transition"
        >
          ×
        </button>
      )}

      {!readOnly && selected && (
        <div
          onMouseDown={onStartResize}
          title="Drag to resize"
          className="absolute right-0 bottom-0 w-3.5 h-3.5 cursor-se-resize flex items-center justify-center text-slate-400 hover:text-indigo-600 transition group-hover:opacity-100 opacity-50"
        >
          <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-current">
            <polygon points="10,10 10,0 0,10" opacity="0.3" />
            <polygon points="10,10 10,5 5,10" />
          </svg>
        </div>
      )}
    </div>
  );
}

function DottedBackground({ view }) {
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
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${view.x}, ${view.y}) scale(${view.scale})`}
        >
          <circle cx="1.25" cy="1.25" r="1.1" fill="#94a3b8" opacity="0.55" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#edf2f7" className="dark:fill-[#0b1120]" />
      <rect width="100%" height="100%" fill="url(#dots)" />
    </svg>
  );
}

function pathFor(from, to) {
  const fromX = from.x + (from.w || NODE_W) / 2;
  const fromY = from.y + (from.h || NODE_H);
  const toX = to.x + (to.w || NODE_W) / 2;
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
      x <= n.x + (n.w || NODE_W) &&
      y >= n.y &&
      y <= n.y + (n.h || NODE_H)
  );
}
