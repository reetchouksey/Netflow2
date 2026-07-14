import { NODE_STYLES, NODE_TYPE_ORDER } from "./nodeStyles";

export default function NodeTypesSidebar({ onAddNode }) {
  return (
    <aside className="w-56 shrink-0 border-r border-line bg-surface px-4 py-5">
      <div className="text-[11px] font-semibold tracking-wider text-fg-muted mb-3">
        NODE TYPES
      </div>
      <ul className="space-y-2">
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
                className={`w-full px-3 py-2 text-sm font-medium rounded-md border transition cursor-grab active:scale-[0.99] ${s.chip}`}
              >
                {s.label}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
