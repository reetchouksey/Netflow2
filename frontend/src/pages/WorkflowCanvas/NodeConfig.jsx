import { useEffect, useId, useState } from "react";
import { NODE_STYLES } from "./nodeStyles";
import NodeTypeIcon from "../../components/NodeTypeIcon";
import { FORM_FIELD_TYPES, newFieldId, PATTERN_PRESETS } from "../../components/FormFields";
import { api } from "../../utils/api";
import { fetchAllUsers } from "../../utils/users";

const SLA_UNITS = ["Minutes", "Hours", "Days"];
const BREACH_ACTIONS = [
  "Escalate to admin",
  "Auto-approve",
  "Auto-reject",
  "Notify team",
];

// Semantic role tokens the backend workflowEngine recognises. The value is
// what gets stored in node.approverRole and resolved at runtime against the
// submitter's context (see server/utils/workflowEngine.js resolveSemanticApprover).
const ROLE_APPROVERS = [
  { value: "direct_manager",  label: "Reporting manager (auto)",  hint: "Auto-detected from the org chart — routes to the submitter's own reporting manager" },
  { value: "hr_partner",      label: "HR partner (auto)",         hint: "Auto-detected — routes to the submitter's own assigned HR partner" },
  { value: "hr_admin",        label: "Admin",                    hint: "Any user with the Admin role" },
  { value: "ceo",             label: "CEO",                      hint: "Any user with the CEO role (falls back to Admin)" },
  { value: "hr_manager",      label: "HR Manager",               hint: "Manager in HR department" },
  { value: "finance_manager", label: "Finance Manager",          hint: "Manager in Finance department" },
  { value: "it_manager",      label: "IT Manager",               hint: "Manager in IT department" },
  { value: "operations_manager", label: "Operations Manager",    hint: "Manager in Operations department" },
  { value: "sales_manager",   label: "Sales Manager",            hint: "Manager in Sales department" },
  { value: "legal_manager",   label: "Legal Manager",            hint: "Manager in Legal department" },
  // Custom roles — resolved by exact Role name via the engine's role-name pass.
  { value: "Warehouse Manager", label: "Warehouse Manager",      hint: "Any active user with the Warehouse Manager role" },
  { value: "Accounts Officer",  label: "Accounts Officer",       hint: "Any active user with the Accounts Officer role" },
  { value: "Brand Rep",         label: "Brand Rep",              hint: "Any active user with the Brand Rep role" },
  { value: "Finance Approver",  label: "Finance Approver",       hint: "Any active user with the Finance Approver role" },
  { value: "Receiving Staff",   label: "Receiving Staff",        hint: "Any active user with the Receiving Staff role" },
];

const roleApproverByValue = (v) => ROLE_APPROVERS.find((r) => r.value === v);

// Active users for the "specific person" approver picker. Cached at module level
// so switching between nodes doesn't refetch the list every time.
let _activeUsersCache = null;
function useActiveUsers() {
  const [users, setUsers] = useState(_activeUsersCache || []);
  useEffect(() => {
    if (_activeUsersCache) return;
    let cancelled = false;
    fetchAllUsers({ isActive: true })
      .then((d) => {
        _activeUsersCache = d.users || [];
        if (!cancelled) setUsers(_activeUsersCache);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return users;
}

export default function NodeConfig({
  node,
  onChange,
  nodes = [],
  connections = [],
  onConnectionsChange,
  onClose,
}) {
  if (!node) {
    return (
      <aside className="w-60 xl:w-[20%] min-w-[224px] max-w-[260px] shrink-0 border-l border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-0 select-none">
        <div className="px-5 pt-4 pb-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
          <div className="text-[11px] font-extrabold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
            NODE CONFIG
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
              <path d="M12 12v9" />
              <path d="m8 17 4-4 4 4" />
            </svg>
          </div>
          <h4 className="text-[13px] font-bold text-slate-600 dark:text-slate-300">No node selected</h4>
          <p className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-2 max-w-[200px] leading-relaxed">
            Click on any node in the canvas to configure its settings, title, and properties.
          </p>
        </div>
      </aside>
    );
  }

  const s = NODE_STYLES[node.type] || NODE_STYLES.start;
  const update = (patch) => onChange({ ...node, ...patch });

  return (
    <aside className="w-60 xl:w-[20%] min-w-[224px] max-w-[260px] shrink-0 border-l border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-0">
      <div className="px-5 pt-4 pb-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
        <div className="text-[11px] font-extrabold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
          NODE CONFIG
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title="Close panel"
            aria-label="Close panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 thin-scrollbar">
      <div className={`rounded-xl border px-4 py-3.5 mb-6 flex items-start gap-3.5 ${s.card}`}>
        <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${s.tile}`}>
          <NodeTypeIcon name={s.icon} className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex flex-col justify-center py-0.5">
          <div className={`text-[14px] font-bold truncate leading-tight ${s.title}`}>{node.title}</div>
          <div className={`text-[11.5px] mt-0.5 font-medium tracking-wide uppercase ${s.subtitle}`}>{s.label}</div>
        </div>
      </div>

      <Field label="Title">
        <input
          type="text"
          value={node.title}
          onChange={(e) => update({ title: e.target.value })}
          className={inputCls}
        />
      </Field>

      <Field label="Subtitle">
        <input
          type="text"
          value={node.subtitle || ""}
          onChange={(e) => update({ subtitle: e.target.value })}
          placeholder="Optional description"
          className={inputCls}
        />
      </Field>

      {node.type === "approval" && (
        <ApprovalConfig node={node} update={update} />
      )}

      {node.type === "multiApproval" && (
        <MultiApprovalConfig node={node} update={update} />
      )}

      {node.type === "submit" && (
        <SubmitConfig node={node} update={update} />
      )}

      {node.type === "review" && (
        <ReviewConfig
          node={node}
          update={update}
          nodes={nodes}
          connections={connections}
          onConnectionsChange={onConnectionsChange}
        />
      )}

      {node.type === "condition" && (
        <DecisionConfig
          node={node}
          nodes={nodes}
          connections={connections}
          onConnectionsChange={onConnectionsChange}
        />
      )}

      {node.type === "notify" && (
        <Field label="Channels">
          <div className="space-y-1.5">
            {["Email", "In-app", "SMS", "Slack"].map((c) => (
              <Checkbox
                key={c}
                label={c}
                checked={(node.channels || ["Email", "In-app"]).includes(c)}
                onChange={(v) => {
                  const prev = node.channels || ["Email", "In-app"];
                  update({
                    channels: v ? [...prev, c] : prev.filter((x) => x !== c),
                  });
                }}
              />
            ))}
          </div>
        </Field>
      )}

      {node.type === "api" && <ApiConfig node={node} update={update} />}

      {node.type === "timer" && (
        <Field label="Wait duration">
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={node.waitValue ?? 1}
              onChange={(e) => update({ waitValue: Number(e.target.value) })}
              className={`${inputCls} w-20`}
            />
            <select
              value={node.waitUnit || "Hours"}
              onChange={(e) => update({ waitUnit: e.target.value })}
              className={`${inputCls} flex-1`}
            >
              {SLA_UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
        </Field>
      )}

      {node.type === "end" && (
        <div className="mt-1">
          <Checkbox
            checked={!!node.generatePdf}
            onChange={(v) => update({ generatePdf: v })}
            label="Generate signed PDF on completion"
          />
          <p className="mt-1 ml-6 text-[11px] text-fg-subtle">
            When on, finishing here auto-produces a signed PDF (form data + the
            full approval trail with e-signatures) and attaches it to the request
            for the submitter and approvers to download.
          </p>
        </div>
      )}
      </div>
    </aside>
  );
}

function DecisionConfig({ node, nodes, connections, onConnectionsChange }) {
  // Each Decision node should have at most two outgoing edges:
  //   { from: node.id, to: <approveTarget>, branch: 'approve' }
  //   { from: node.id, to: <rejectTarget>,  branch: 'reject'  }
  // We treat these as the source of truth and rewrite them whenever either
  // picker changes. Targets list every other node so the user can wire to
  // anything (end, notify, another approval, etc.).
  const targets = nodes.filter((n) => n.id !== node.id)
  const approveEdge = connections.find(
    (c) => c.from === node.id && c.branch === "approve"
  )
  const rejectEdge = connections.find(
    (c) => c.from === node.id && c.branch === "reject"
  )

  const setBranchTarget = (branch, toId) => {
    if (!onConnectionsChange) return
    const others = connections.filter(
      (c) => !(c.from === node.id && c.branch === branch)
    )
    if (toId) {
      const dashed = branch === "reject"
      others.push({ from: node.id, to: toId, branch, dashed })
    }
    onConnectionsChange(others)
  }

  const branchSelect = (branch, edge) => {
    const value = edge?.to || ""
    return (
      <select
        value={value}
        onChange={(e) => setBranchTarget(branch, e.target.value)}
        className={inputCls}
      >
        <option value="">— Select target —</option>
        {targets.map((n) => (
          <option key={n.id} value={n.id}>
            {n.title || n.id} ({n.type})
          </option>
        ))}
      </select>
    )
  }

  return (
    <>
      <div className="mb-3 text-[11px] text-fg-muted">
        This Decision routes based on whether the previous approval was
        approved or rejected.
      </div>

      <Field label="If approved →">
        {branchSelect("approve", approveEdge)}
        {approveEdge && (
          <p className="mt-1 text-[11px] text-success-fg">
            Approve path wired.
          </p>
        )}
      </Field>

      <Field label="If rejected →">
        {branchSelect("reject", rejectEdge)}
        {rejectEdge && (
          <p className="mt-1 text-[11px] text-danger-fg">
            Reject path wired.
          </p>
        )}
      </Field>

      {targets.length === 0 && (
        <p className="text-[11px] text-warning-fg">
          Add more nodes to the canvas first, then pick where each branch goes.
        </p>
      )}
    </>
  )
}

function ApprovalConfig({ node, update }) {
  // Approvers can be auto-resolved from the submitter's org chart (a role token
  // like "direct_manager") OR pinned to a specific person. When a person is
  // chosen we store node.approverId — the engine's resolveAssignee uses it
  // directly and skips role resolution (see server/utils/workflowEngine.js).
  const users = useActiveUsers();
  const [mode, setMode] = useState(node.approverId ? "person" : "role");

  // Re-sync the mode when a different node is selected.
  useEffect(() => {
    setMode(node.approverId ? "person" : "role");
  }, [node.id]);

  // Backward compat: older nodes might have a free-form `approver` string
  // (e.g. "Direct manager"). Normalise to a known role token if possible.
  const legacyToken = node.approver
    ? String(node.approver).toLowerCase().replace(/\s+/g, "_")
    : null;
  const currentRoleValue =
    node.approverRole ||
    (legacyToken && roleApproverByValue(legacyToken)?.value) ||
    "direct_manager";

  const roleHint = roleApproverByValue(currentRoleValue)?.hint;

  const onApproverChange = (value) => {
    if (value === "__person__") {
      setMode("person");
    } else {
      setMode("role");
      update({ approverRole: value, approverId: null });
    }
  };

  const onPersonChange = (userId) =>
    update({ approverId: userId || null, approverRole: userId ? null : currentRoleValue });

  const selectedPerson = users.find((u) => String(u._id) === String(node.approverId));

  return (
    <>
      <Field label="Approver">
        <select
          value={mode === "person" ? "__person__" : currentRoleValue}
          onChange={(e) => onApproverChange(e.target.value)}
          className={inputCls}
        >
          <optgroup label="Auto (from org chart)">
            {ROLE_APPROVERS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </optgroup>
          <optgroup label="Specific person">
            <option value="__person__">Pick a specific person…</option>
          </optgroup>
        </select>

        {mode === "person" ? (
          <div className="mt-2">
            <select
              value={node.approverId || ""}
              onChange={(e) => onPersonChange(e.target.value)}
              className={inputCls}
            >
              <option value="">— Select a person —</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}{u.department ? ` · ${u.department}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-fg-muted">
              {selectedPerson
                ? `Always assigned to ${selectedPerson.name}, regardless of the submitter's org chart.`
                : "This exact person will be assigned every time, regardless of who submits."}
            </p>
          </div>
        ) : (
          <>
            {roleHint && <p className="mt-1 text-[11px] text-fg-muted">{roleHint}</p>}
            <p className="mt-1.5 text-[11px] text-fg-subtle">
              Auto-detected at submit time from the org chart.
            </p>
          </>
        )}
      </Field>

      <Field label="SLA deadline">
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={node.slaValue ?? 24}
            onChange={(e) => update({ slaValue: Number(e.target.value) })}
            className={`${inputCls} w-20`}
          />
          <select
            value={node.slaUnit || "Hours"}
            onChange={(e) => update({ slaUnit: e.target.value })}
            className={`${inputCls} flex-1`}
          >
            {SLA_UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
      </Field>

      <Field label="On SLA breach">
        <select
          value={node.onBreach || BREACH_ACTIONS[0]}
          onChange={(e) => update({ onBreach: e.target.value })}
          className={inputCls}
        >
          {BREACH_ACTIONS.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </Field>

      <Checkbox
        checked={!!node.sequential}
        onChange={(v) => update({ sequential: v })}
        label="Sequential approval"
      />

      <div className="mt-3">
        <Checkbox
          checked={!!node.requireSignature}
          onChange={(v) => update({ requireSignature: v })}
          label="Require e-signature on decision"
        />
        <p className="mt-1 ml-6 text-[11px] text-fg-subtle">
          When on, the approver must add an e-signature (typed or uploaded) before they can approve, reject, or request changes.
        </p>
      </div>
    </>
  );
}

function MultiApprovalConfig({ node, update }) {
  // Committee / quorum approval: pick several specific people, then set how many
  // of them (N of M) must approve for the stage to pass. The stage passes as soon
  // as N approve, and fails once enough reject that N is no longer reachable.
  const users = useActiveUsers();
  const selected = Array.isArray(node.approverIds) ? node.approverIds : [];
  const required = Math.max(1, Number(node.requiredApprovals) || 1);
  const M = selected.length;

  const toggle = (userId) => {
    const has = selected.some((id) => String(id) === String(userId));
    const next = has
      ? selected.filter((id) => String(id) !== String(userId))
      : [...selected, userId];
    // Keep the required count within 1..M as the roster changes.
    const clamped = Math.min(Math.max(1, required), Math.max(1, next.length));
    update({ approverIds: next, requiredApprovals: clamped });
  };

  return (
    <>
      <Field label="Approvers (pick the committee)">
        <div className="max-h-56 overflow-y-auto rounded-md border border-line divide-y divide-line">
          {users.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-fg-subtle">Loading users…</p>
          )}
          {users.map((u) => {
            const checked = selected.some((id) => String(id) === String(u._id));
            return (
              <label
                key={u._id}
                className="flex items-center gap-2 px-3 py-2 text-sm text-fg cursor-pointer hover:bg-info-subtle/60"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(u._id)}
                  className="w-4 h-4 rounded border-line accent-indigo-600"
                />
                <span className="truncate">
                  {u.name}
                  {u.department ? <span className="text-fg-subtle"> · {u.department}</span> : ""}
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-fg-muted">
          {M > 0 ? `${M} approver${M === 1 ? "" : "s"} selected.` : "Select the people who should receive this approval."}
        </p>
      </Field>

      <Field label="Approvals required (N of M)">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={Math.max(1, M)}
            value={required}
            onChange={(e) => {
              const n = Math.min(Math.max(1, Number(e.target.value) || 1), Math.max(1, M));
              update({ requiredApprovals: n });
            }}
            className={`${inputCls} w-24`}
          />
          <span className="text-sm text-fg-muted">of {Math.max(1, M)}</span>
        </div>
        <p className="mt-1.5 text-[11px] text-fg-muted">
          {M > 0
            ? `The stage passes as soon as ${required} of ${M} approve. It fails once ${M - required + 1} reject.`
            : "Add approvers first, then choose how many must approve."}
        </p>
      </Field>

      <Field label="SLA deadline">
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={node.slaValue ?? 24}
            onChange={(e) => update({ slaValue: Number(e.target.value) })}
            className={`${inputCls} w-20`}
          />
          <select
            value={node.slaUnit || "Hours"}
            onChange={(e) => update({ slaUnit: e.target.value })}
            className={`${inputCls} flex-1`}
          >
            {SLA_UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
      </Field>

      <div className="mt-3">
        <Checkbox
          checked={!!node.requireSignature}
          onChange={(v) => update({ requireSignature: v })}
          label="Require e-signature on decision"
        />
        <p className="mt-1 ml-6 text-[11px] text-fg-subtle">
          When on, each approver must add an e-signature before they can approve or reject.
        </p>
      </div>
    </>
  );
}

function SubmitConfig({ node, update }) {
  // The Submit node assigns a task to a person/role who must upload a file +
  // optional comment and click Submit to advance the flow (e.g. Accounts
  // generating a Costing). The assignee resolves like an approver at runtime.
  const users = useActiveUsers();
  const [mode, setMode] = useState(node.approverId ? "person" : "role");

  // Re-sync the mode when a different node is selected.
  useEffect(() => {
    setMode(node.approverId ? "person" : "role");
  }, [node.id]);

  const legacyToken = node.approver
    ? String(node.approver).toLowerCase().replace(/\s+/g, "_")
    : null;
  const currentRoleValue =
    node.approverRole ||
    (legacyToken && roleApproverByValue(legacyToken)?.value) ||
    "direct_manager";

  const roleHint = roleApproverByValue(currentRoleValue)?.hint;

  const onApproverChange = (value) => {
    if (value === "__person__") {
      setMode("person");
    } else {
      setMode("role");
      update({ approverRole: value, approverId: null });
    }
  };

  const onPersonChange = (userId) =>
    update({ approverId: userId || null, approverRole: userId ? null : currentRoleValue });

  const selectedPerson = users.find((u) => String(u._id) === String(node.approverId));

  return (
    <>
      <Field label="Assign to">
        <select
          value={mode === "person" ? "__person__" : currentRoleValue}
          onChange={(e) => onApproverChange(e.target.value)}
          className={inputCls}
        >
          <optgroup label="Auto (from org chart)">
            {ROLE_APPROVERS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </optgroup>
          <optgroup label="Specific person">
            <option value="__person__">Pick a specific person…</option>
          </optgroup>
        </select>

        {mode === "person" ? (
          <div className="mt-2">
            <select
              value={node.approverId || ""}
              onChange={(e) => onPersonChange(e.target.value)}
              className={inputCls}
            >
              <option value="">— Select a person —</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}{u.department ? ` · ${u.department}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-fg-muted">
              {selectedPerson
                ? `Always assigned to ${selectedPerson.name}. They will fill the form below.`
                : "This exact person will be assigned every time, regardless of who submits."}
            </p>
          </div>
        ) : (
          <>
            {roleHint && <p className="mt-1 text-[11px] text-fg-muted">{roleHint}</p>}
            <p className="mt-1.5 text-[11px] text-fg-subtle">
              This person fills the form below and clicks Submit to advance the workflow.
            </p>
          </>
        )}
      </Field>

      <Field label="Instructions">
        <textarea
          rows={3}
          value={node.instructions || ""}
          onChange={(e) => update({ instructions: e.target.value })}
          placeholder="e.g. Generate the Costing sheet and attach it as a PDF."
          className={`${inputCls} resize-none`}
        />
      </Field>

      <SubmitFormBuilder
        fields={node.formFields}
        onChange={(formFields) => update({ formFields })}
      />

      <Field label="SLA deadline">
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={node.slaValue ?? 24}
            onChange={(e) => update({ slaValue: Number(e.target.value) })}
            className={`${inputCls} w-20`}
          />
          <select
            value={node.slaUnit || "Hours"}
            onChange={(e) => update({ slaUnit: e.target.value })}
            className={`${inputCls} flex-1`}
          >
            {SLA_UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
      </Field>
    </>
  );
}

const CONDITION_OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "nonempty", label: "is filled in" },
];

// Per-field "show only when …" editor for Submit-node inline forms. `dependsOn`
// can only reference an EARLIER field (no circular rules). Stores the object
// shape { enabled, dependsOn, operator, showWhen } that the model + renderers use.
function FieldConditionEditor({ field, earlier, onChange }) {
  const cl = field.conditionalLogic && typeof field.conditionalLogic === "object" ? field.conditionalLogic : {};
  const enabled = !!cl.enabled;
  const operator = cl.operator || "eq";
  const source = (earlier || []).find((f) => f.id === cl.dependsOn) || null;
  const needsValue = operator !== "nonempty";
  const sourceOptions = source && source.type === "dropdown" ? source.options || [] : null;

  const setCL = (patch) => onChange({ enabled: true, operator: "eq", ...cl, ...patch });

  return (
    <div className="mt-2 pt-2 border-t border-line">
      <label className="flex items-center gap-1.5 text-xs text-fg-muted">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange({ ...cl, operator, enabled: e.target.checked })}
          className="w-4 h-4 rounded border-line accent-teal-600"
        />
        Conditional logic
      </label>

      {enabled && (
        (earlier || []).length === 0 ? (
          <p className="mt-1.5 text-[11px] text-warning-fg">Add a field above this one to use as the trigger.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            <select
              value={cl.dependsOn || ""}
              onChange={(e) => setCL({ dependsOn: e.target.value })}
              className={inputCls}
            >
              <option value="">— Show when field —</option>
              {(earlier || []).map((f) => (
                <option key={f.id} value={f.id}>{f.label || f.id}</option>
              ))}
            </select>
            <select value={operator} onChange={(e) => setCL({ operator: e.target.value })} className={inputCls}>
              {CONDITION_OPERATORS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {needsValue && (
              sourceOptions ? (
                <select value={cl.showWhen || ""} onChange={(e) => setCL({ showWhen: e.target.value })} className={inputCls}>
                  <option value="">— Select a value —</option>
                  {sourceOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={cl.showWhen || ""}
                  onChange={(e) => setCL({ showWhen: e.target.value })}
                  placeholder="value to match"
                  className={inputCls}
                />
              )
            )}
          </div>
        )
      )}
    </div>
  );
}

// Length / range / format-pattern editor for one Submit-node field. Writes into
// the canonical nested `validation` object the model + renderers understand.
function FieldValidationEditor({ field, onChange }) {
  const isText = field.type === "text" || field.type === "textarea";
  const isNum = field.type === "number";
  if (!isText && !isNum) return null;

  const v = field.validation && typeof field.validation === "object" ? field.validation : {};
  const setV = (patch) => {
    const next = { ...v, ...patch };
    Object.keys(next).forEach((k) => {
      if (next[k] === null || next[k] === "" || next[k] === undefined) delete next[k];
    });
    onChange(next);
  };
  const numOrNull = (s) => (s === "" ? null : Number(s));

  const currentPreset = (() => {
    if (!v.pattern) return "none";
    for (const [key, p] of Object.entries(PATTERN_PRESETS)) if (p.pattern === v.pattern) return key;
    return "custom";
  })();

  const onPresetChange = (key) => {
    if (key === "none") return setV({ pattern: null, patternLabel: null });
    if (key === "custom") return setV({ pattern: currentPreset === "custom" ? v.pattern : " ", patternLabel: null });
    const p = PATTERN_PRESETS[key];
    setV({ pattern: p.pattern, patternLabel: p.label });
  };

  return (
    <div className="mt-2 pt-2 border-t border-line space-y-1.5">
      {isText && (
        <>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              value={v.minLength ?? ""}
              onChange={(e) => setV({ minLength: numOrNull(e.target.value) })}
              placeholder="Min len"
              className={inputCls}
            />
            <input
              type="number"
              min="1"
              value={v.maxLength ?? ""}
              onChange={(e) => setV({ maxLength: numOrNull(e.target.value) })}
              placeholder="Max len"
              className={inputCls}
            />
          </div>
          <select value={currentPreset} onChange={(e) => onPresetChange(e.target.value)} className={inputCls}>
            <option value="none">No pattern</option>
            <option value="email">Email</option>
            <option value="phone">Phone number</option>
            <option value="digits">Digits only</option>
            <option value="alnum">Letters &amp; numbers</option>
            <option value="custom">Custom regex…</option>
          </select>
          {currentPreset === "custom" && (
            <>
              <input
                type="text"
                value={v.pattern ?? ""}
                onChange={(e) => setV({ pattern: e.target.value })}
                placeholder="Regex e.g. ^[A-Z]{2}[0-9]{4}$"
                className={`${inputCls} font-mono text-xs`}
              />
              <input
                type="text"
                value={v.patternLabel ?? ""}
                onChange={(e) => setV({ patternLabel: e.target.value })}
                placeholder="Error message (optional)"
                className={inputCls}
              />
            </>
          )}
        </>
      )}
      {isNum && (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={v.min ?? ""}
            onChange={(e) => setV({ min: numOrNull(e.target.value) })}
            placeholder="Min"
            className={inputCls}
          />
          <input
            type="number"
            value={v.max ?? ""}
            onChange={(e) => setV({ max: numOrNull(e.target.value) })}
            placeholder="Max"
            className={inputCls}
          />
        </div>
      )}
    </div>
  );
}

// Field-list editor for the Submit node's inline form. The designer adds the
// fields (label, type, required, dropdown options) the assignee must fill.
function SubmitFormBuilder({ fields, onChange }) {
  const list = Array.isArray(fields) ? fields : [];

  const addField = () =>
    onChange([
      ...list,
      { id: newFieldId(), type: "text", label: "Untitled field", required: false },
    ]);

  const updateField = (i, patch) =>
    onChange(list.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const removeField = (i) => onChange(list.filter((_, idx) => idx !== i));

  const moveField = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <Field label="Form fields">
      <p className="-mt-1 mb-2 text-[11px] text-fg-subtle">
        The assignee fills these before submitting. File fields become attachments
        visible to later steps.
      </p>

      {list.length === 0 && (
        <p className="mb-2 text-[11px] text-fg-subtle italic">No fields yet.</p>
      )}

      <div className="space-y-2">
        {list.map((f, i) => (
          <div key={f.id} className="border border-line rounded-md p-2.5 bg-surface-2/60">
            <div className="flex items-center gap-1.5 mb-2">
              <input
                value={f.label || ""}
                onChange={(e) => updateField(i, { label: e.target.value })}
                placeholder="Field label"
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={() => moveField(i, -1)}
                disabled={i === 0}
                className="px-1.5 py-1 text-fg-subtle hover:text-fg-muted disabled:opacity-30"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveField(i, 1)}
                disabled={i === list.length - 1}
                className="px-1.5 py-1 text-fg-subtle hover:text-fg-muted disabled:opacity-30"
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeField(i)}
                className="px-1.5 py-1 text-danger-fg hover:text-danger-fg"
                title="Remove field"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={f.type}
                onChange={(e) => updateField(i, { type: e.target.value })}
                className={`${inputCls} flex-1`}
              >
                {FORM_FIELD_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>{t.label}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-fg-muted whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={!!f.required}
                  onChange={(e) => updateField(i, { required: e.target.checked })}
                  className="w-4 h-4 rounded border-line accent-blue-600"
                />
                Required
              </label>
            </div>
            {f.type === "dropdown" && (
              <input
                value={(f.options || []).join(", ")}
                onChange={(e) =>
                  updateField(i, {
                    options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="Option 1, Option 2, Option 3"
                className={`${inputCls} mt-2`}
              />
            )}
            <FieldValidationEditor
              field={f}
              onChange={(validation) => updateField(i, { validation })}
            />
            <FieldConditionEditor
              field={f}
              earlier={list.slice(0, i)}
              onChange={(cl) => updateField(i, { conditionalLogic: cl })}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addField}
        className="mt-2 w-full px-3 py-2 text-sm rounded-md border border-dashed border-line text-fg-muted hover:border-teal-300 hover:text-teal-700 dark:hover:border-teal-500/40 dark:hover:text-teal-300 transition"
      >
        + Add field
      </button>
    </Field>
  );
}

function ReviewConfig({ node, update, nodes, connections, onConnectionsChange }) {
  // The Review (viewer) node assigns a task to a reviewer (e.g. Brand Rep) who
  // sees the submission + every document carried over from earlier steps, then
  // chooses to forward (no changes) or send it back for changes. Routing mirrors
  // the Decision node: two outgoing edges tagged 'approve' (forward) / 'reject'
  // (changes) which the engine reads as config.forwardPath / config.changesPath.
  const users = useActiveUsers();
  const [mode, setMode] = useState(node.approverId ? "person" : "role");

  // Re-sync the mode when a different node is selected.
  useEffect(() => {
    setMode(node.approverId ? "person" : "role");
  }, [node.id]);

  const currentRoleValue = node.approverRole || "direct_manager";
  const roleHint = roleApproverByValue(currentRoleValue)?.hint;

  const onApproverChange = (value) => {
    if (value === "__person__") {
      setMode("person");
    } else {
      setMode("role");
      update({ approverRole: value, approverId: null });
    }
  };

  const onPersonChange = (userId) =>
    update({ approverId: userId || null, approverRole: userId ? null : currentRoleValue });

  const selectedPerson = users.find((u) => String(u._id) === String(node.approverId));

  const targets = nodes.filter((n) => n.id !== node.id);
  const forwardEdge = connections.find(
    (c) => c.from === node.id && c.branch === "approve"
  );
  const changesEdge = connections.find(
    (c) => c.from === node.id && c.branch === "reject"
  );

  const setBranchTarget = (branch, toId) => {
    if (!onConnectionsChange) return;
    const others = connections.filter(
      (c) => !(c.from === node.id && c.branch === branch)
    );
    if (toId) {
      others.push({ from: node.id, to: toId, branch, dashed: branch === "reject" });
    }
    onConnectionsChange(others);
  };

  const branchSelect = (branch, edge) => (
    <select
      value={edge?.to || ""}
      onChange={(e) => setBranchTarget(branch, e.target.value)}
      className={inputCls}
    >
      <option value="">— Select target —</option>
      {targets.map((n) => (
        <option key={n.id} value={n.id}>
          {n.title || n.id} ({n.type})
        </option>
      ))}
    </select>
  );

  return (
    <>
      <Field label="Assign to (reviewer)">
        <select
          value={mode === "person" ? "__person__" : currentRoleValue}
          onChange={(e) => onApproverChange(e.target.value)}
          className={inputCls}
        >
          <optgroup label="Auto (from org chart)">
            {ROLE_APPROVERS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </optgroup>
          <optgroup label="Specific person">
            <option value="__person__">Pick a specific person…</option>
          </optgroup>
        </select>

        {mode === "person" ? (
          <div className="mt-2">
            <select
              value={node.approverId || ""}
              onChange={(e) => onPersonChange(e.target.value)}
              className={inputCls}
            >
              <option value="">— Select a person —</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}{u.department ? ` · ${u.department}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-fg-muted">
              {selectedPerson
                ? `Always assigned to ${selectedPerson.name} for review.`
                : "This exact person will review every time, regardless of who submits."}
            </p>
          </div>
        ) : (
          <>
            {roleHint && <p className="mt-1 text-[11px] text-fg-muted">{roleHint}</p>}
            <p className="mt-1.5 text-[11px] text-fg-subtle">
              The reviewer sees the submission + all earlier documents, then forwards
              it or sends it back — no approve/reject.
            </p>
          </>
        )}
      </Field>

      <Field label="Instructions">
        <textarea
          rows={2}
          value={node.instructions || ""}
          onChange={(e) => update({ instructions: e.target.value })}
          placeholder="e.g. Check the costing against the GRN before forwarding."
          className={`${inputCls} resize-none`}
        />
      </Field>

      <Field label="If no changes → (forward)">
        {branchSelect("approve", forwardEdge)}
        {forwardEdge && (
          <p className="mt-1 text-[11px] text-success-fg">Forward path wired.</p>
        )}
      </Field>

      <Field label="If changes required →">
        {branchSelect("reject", changesEdge)}
        {changesEdge && (
          <p className="mt-1 text-[11px] text-danger-fg">
            Changes path wired (usually loops back to the submit step).
          </p>
        )}
      </Field>

      {targets.length === 0 && (
        <p className="text-[11px] text-warning-fg">
          Add more nodes to the canvas first, then pick where each outcome goes.
        </p>
      )}
    </>
  );
}

const API_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

// Config for the Integration / webhook node: an outbound HTTP call fired mid-flow.
function ApiConfig({ node, update }) {
  const headers = Array.isArray(node.apiHeaders) ? node.apiHeaders : [];
  const auth = node.apiAuth || { mode: "none" };

  const setHeader = (i, patch) => {
    const next = headers.map((h, idx) => (idx === i ? { ...h, ...patch } : h));
    update({ apiHeaders: next });
  };
  const addHeader = () => update({ apiHeaders: [...headers, { key: "", value: "" }] });
  const removeHeader = (i) => update({ apiHeaders: headers.filter((_, idx) => idx !== i) });
  const setAuth = (patch) => update({ apiAuth: { ...auth, ...patch } });

  return (
    <>
      <Field label="Request URL">
        <input
          type="url"
          value={node.apiUrl || ""}
          onChange={(e) => update({ apiUrl: e.target.value })}
          placeholder="https://api.example.com/hook"
          className={inputCls}
        />
        <p className="mt-1 text-[11px] text-fg-subtle">
          Must be an https:// address. Called automatically when the flow reaches this step.
        </p>
      </Field>

      <Field label="Method">
        <select
          value={node.apiMethod || "POST"}
          onChange={(e) => update({ apiMethod: e.target.value })}
          className={inputCls}
        >
          {API_METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </Field>

      <Field label="Headers">
        <div className="space-y-2">
          {headers.length === 0 && (
            <p className="text-[11px] text-fg-subtle">No headers. Add one if the API needs it (e.g. Content-Type).</p>
          )}
          {headers.map((h, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={h.key || ""}
                onChange={(e) => setHeader(i, { key: e.target.value })}
                placeholder="Header"
                className={`${inputCls} flex-1`}
              />
              <input
                value={h.value || ""}
                onChange={(e) => setHeader(i, { value: e.target.value })}
                placeholder="Value"
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={() => removeHeader(i)}
                className="px-2 text-fg-subtle hover:text-danger-fg"
                aria-label="Remove header"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addHeader}
            className="text-xs font-medium text-info-fg hover:brightness-110"
          >
            + Add header
          </button>
        </div>
      </Field>

      <Field label="Data to Send">
        <label className="flex items-center gap-2 cursor-pointer pt-1 pb-1">
          <input
            type="checkbox"
            checked={node.sendAllData === true || (node.sendAllData === undefined && !node.apiBody?.trim())}
            onChange={(e) => update({ sendAllData: e.target.checked })}
            className="w-3.5 h-3.5 text-indigo-600 rounded border-line focus:ring-indigo-500 bg-surface-2"
          />
          <span className="text-xs font-medium text-fg">Send entire form data automatically</span>
        </label>
      </Field>

      {!(node.sendAllData === true || (node.sendAllData === undefined && !node.apiBody?.trim())) && (
        <Field label="Custom Request body">
          <textarea
            rows={4}
            value={node.apiBody || ""}
            onChange={(e) => update({ apiBody: e.target.value })}
            placeholder={'{\n  "id": "{{formData.requestId}}",\n  "by": "{{submitter.email}}"\n}'}
            className={`${inputCls} font-mono text-xs`}
          />
          <p className="mt-1 text-[11px] text-fg-subtle">
            Use {"{{formData.field}}"}, {"{{submitter.email}}"}, {"{{lastApprovalOutcome}}"} to insert live values.
          </p>
        </Field>
      )}

      <Field label="Authentication">
        <select
          value={auth.mode || "none"}
          onChange={(e) => setAuth({ mode: e.target.value })}
          className={inputCls}
        >
          <option value="none">None</option>
          <option value="bearer">Bearer token</option>
          <option value="basic">Basic auth</option>
        </select>
        {auth.mode === "bearer" && (
          <>
            <input
              value={auth.token || ""}
              onChange={(e) => setAuth({ token: e.target.value })}
              placeholder="Token or env:MY_SECRET"
              className={`${inputCls} mt-2`}
            />
            <p className="mt-1 text-[11px] text-fg-subtle">
              Use <code className="text-[10px]">env:VAR_NAME</code> to read from server environment (vault-style).
            </p>
          </>
        )}
        {auth.mode === "basic" && (
          <div className="mt-2 flex gap-2">
            <input
              value={auth.username || ""}
              onChange={(e) => setAuth({ username: e.target.value })}
              placeholder="Username"
              className={`${inputCls} flex-1`}
            />
            <input
              type="password"
              value={auth.password || ""}
              onChange={(e) => setAuth({ password: e.target.value })}
              placeholder="Password"
              className={`${inputCls} flex-1`}
            />
          </div>
        )}
      </Field>

      <Field label="Save response as">
        <input
          value={node.saveResponseAs || ""}
          onChange={(e) => update({ saveResponseAs: e.target.value })}
          placeholder="e.g. erpResult (optional)"
          className={inputCls}
        />
        <p className="mt-1 text-[11px] text-fg-subtle">
          Stores the response so later Decision nodes can read it.
        </p>
      </Field>

      <div className="mt-1">
        <Checkbox
          checked={node.continueOnError !== false}
          onChange={(v) => update({ continueOnError: v })}
          label="Continue workflow if the call fails"
        />
        <p className="mt-1 ml-6 text-[11px] text-fg-subtle">
          When off, a failed call stops the workflow instead of moving on.
        </p>
      </div>
    </>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm bg-surface text-fg placeholder:text-fg-subtle border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

// Some fields hold a single input, others a checkbox list or a repeater with its
// own buttons, so a wrapping <label> would be wrong (and nest labels). Naming a
// group covers both without every caller wiring up an id.
function Field({ label, children }) {
  const captionId = useId();
  return (
    <div className="mb-4" role="group" aria-labelledby={captionId}>
      <span id={captionId} className="block text-xs font-medium text-fg mb-1.5">
        {label}
      </span>
      {children}
    </div>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-line accent-blue-600"
      />
      <span className="text-sm text-fg">{label}</span>
    </label>
  );
}
