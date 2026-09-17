import { useState } from "react";
import { NODE_STYLES, NODE_TYPE_ORDER } from "./nodeStyles";
import NodeTypeIcon from "../../components/NodeTypeIcon";

export default function NodeTypesSidebar({ onAddNode }) {
  const [showTip, setShowTip] = useState(() => {
    return localStorage.getItem('netflow_hide_workflow_tip') !== 'true';
  });

  const dismissTip = () => {
    localStorage.setItem('netflow_hide_workflow_tip', 'true');
    setShowTip(false);
  };

  return (
    <aside
      aria-label="Node types"
      className="w-60 xl:w-[20%] min-w-[224px] max-w-[260px] shrink-0 border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-0 select-none shadow-xs"
    >
      <div className="px-4 pt-4 pb-2.5 shrink-0 border-b border-slate-100 dark:border-slate-800">
        <div className="text-[11px] font-extrabold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
          NODE TYPES
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar flex flex-col">
        <ul className="px-3 py-3 space-y-1.5">
          {NODE_TYPE_ORDER.map((type) => {
            const s = NODE_STYLES[type];
            return (
              <li key={type}>
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-node-type", type);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onAddNode?.(type)}
                  title={s.label}
                  aria-label={`Add ${s.label} node`}
                  className="group w-full flex items-center gap-3 px-2.5 py-2.5 text-left rounded-xl bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-none hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
                >
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${s.tile}`}>
                    <NodeTypeIcon name={s.icon} className="w-4 h-4" />
                  </span>
                  <span className="min-w-0 flex-1 whitespace-nowrap text-[13px] font-bold leading-tight text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    {s.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* HOW TO BUILD Box */}
      {showTip && (
        <div className="p-3.5 mx-3 mb-4 mt-2 relative rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 text-xs text-slate-500 dark:text-slate-400 space-y-2 shrink-0 group animate-fade-in">
          <button
            onClick={dismissTip}
            className="absolute top-2.5 right-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-2 pr-6 font-extrabold text-[10px] uppercase tracking-wider text-indigo-600/80 dark:text-indigo-400/80">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            HOW TO BUILD
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] leading-snug flex items-start gap-2">
              <span className="text-indigo-400 mt-0.5 font-bold shrink-0">1.</span>
              <span>Click any type above to append it.</span>
            </p>
            <p className="text-[11px] leading-snug flex items-start gap-2">
              <span className="text-indigo-400 mt-0.5 font-bold shrink-0">2.</span>
              <span>Or drag one straight onto the canvas.</span>
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
