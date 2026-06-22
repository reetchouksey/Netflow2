export const NODE_STYLES = {
  start: {
    label: "Start",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
    card: "bg-emerald-50/70 border-emerald-300",
    title: "text-emerald-700",
    subtitle: "text-emerald-700/70",
    ring: "ring-emerald-400/60",
  },
  approval: {
    label: "Approval",
    chip: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
    card: "bg-blue-50/70 border-blue-300",
    title: "text-blue-700",
    subtitle: "text-blue-700/70",
    ring: "ring-blue-500/60",
  },
  condition: {
    label: "Condition",
    chip: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
    card: "bg-amber-50/70 border-amber-300",
    title: "text-amber-700",
    subtitle: "text-amber-700/70",
    ring: "ring-amber-500/60",
  },
  notify: {
    label: "Notify",
    chip: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
    card: "bg-purple-50/70 border-purple-300",
    title: "text-purple-700",
    subtitle: "text-purple-700/70",
    ring: "ring-purple-500/60",
  },
  timer: {
    label: "Timer",
    chip: "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200",
    card: "bg-gray-50 border-gray-300",
    title: "text-gray-800",
    subtitle: "text-gray-500",
    ring: "ring-gray-400/60",
  },
  end: {
    label: "End",
    chip: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
    card: "bg-rose-50/70 border-rose-300",
    title: "text-rose-700",
    subtitle: "text-rose-700/70",
    ring: "ring-rose-500/60",
  },
};

export const NODE_TYPE_ORDER = [
  "start",
  "approval",
  "condition",
  "notify",
  "timer",
  "end",
];

export const NODE_DEFAULTS = {
  start: { title: "Start", subtitle: "Trigger" },
  approval: {
    title: "Approval",
    subtitle: "Approval node",
    approverRole: "direct_manager",
    approverId: null,
    slaValue: 24,
    slaUnit: "Hours",
    onBreach: "Escalate to admin",
    sequential: false,
  },
  condition: {
    title: "Decision",
    subtitle: "Branch logic",
    branches: ["Yes", "No"],
  },
  notify: {
    title: "Notify",
    subtitle: "Send notification",
    channels: ["Email"],
  },
  timer: {
    title: "Wait",
    subtitle: "Delay",
    waitValue: 1,
    waitUnit: "Hours",
  },
  end: { title: "End", subtitle: "Finish" },
};

let _nextId = 1;
export const createNodeId = () =>
  `n${Date.now().toString(36)}${(_nextId++).toString(36)}`;
