import { useEffect } from "react";
import { NODE_STYLES } from "./nodeStyles";
import { FORM_FIELD_TYPES, newFieldId } from "../../components/FormFields";

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

export default function NodeConfig({
  node,
  onChange,
  nodes = [],
  connections = [],
  onConnectionsChange,
}) {
  if (!node) {
    return (
      <aside className="w-80 shrink-0 border-l border-gray-200 bg-white px-5 py-6">
        <div className="text-[11px] font-semibold tracking-wider text-gray-500 mb-3">
          NODE CONFIG
        </div>
        <div className="text-sm text-gray-400 mt-10 text-center">
          Select a node on the canvas to configure it.
        </div>
      </aside>
    );
  }

  const s = NODE_STYLES[node.type] || NODE_STYLES.start;
  const update = (patch) => onChange({ ...node, ...patch });

  return (
    <aside className="w-80 shrink-0 border-l border-gray-200 bg-white px-5 py-6 overflow-y-auto">
      <div className="text-[11px] font-semibold tracking-wider text-gray-500 mb-3">
        NODE CONFIG
      </div>

      <div className={`rounded-lg border px-4 py-3 mb-5 ${s.card}`}>
        <div className={`text-sm font-semibold ${s.title}`}>{node.title}</div>
        <div className={`text-xs mt-0.5 ${s.subtitle}`}>{s.label} node</div>
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
          className={inputCls}
        />
      </Field>

      {node.type === "approval" && (
        <ApprovalConfig node={node} update={update} />
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
      <div className="mb-3 text-[11px] text-gray-500">
        This Decision routes based on whether the previous approval was
        approved or rejected.
      </div>

      <Field label="If approved →">
        {branchSelect("approve", approveEdge)}
        {approveEdge && (
          <p className="mt-1 text-[11px] text-emerald-700">
            Approve path wired.
          </p>
        )}
      </Field>

      <Field label="If rejected →">
        {branchSelect("reject", rejectEdge)}
        {rejectEdge && (
          <p className="mt-1 text-[11px] text-rose-700">
            Reject path wired.
          </p>
        )}
      </Field>

      {targets.length === 0 && (
        <p className="text-[11px] text-amber-700">
          Add more nodes to the canvas first, then pick where each branch goes.
        </p>
      )}
    </>
  )
}

function ApprovalConfig({ node, update }) {
  // Approvers are always auto-resolved at runtime by the workflow engine from
  // the submitter's org-chart context (see server/utils/workflowEngine.js
  // resolveSemanticApprover). There is no manual "specific person" option —
  // approvals route to the reporting manager (or the chosen role) automatically.
  const setRoleMode = (value) =>
    update({ approverRole: value, approverId: null });

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

  // Migrate legacy nodes that pinned a specific person: drop approverId and
  // fall back to auto role resolution so approvals are never hard-wired.
  useEffect(() => {
    if (node.approverId || (!node.approverRole && legacyToken)) {
      update({ approverRole: currentRoleValue, approverId: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  return (
    <>
      <Field label="Approver">
        <select
          value={currentRoleValue}
          onChange={(e) => setRoleMode(e.target.value)}
          className={inputCls}
        >
          {ROLE_APPROVERS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        {roleHint && (
          <p className="mt-1 text-[11px] text-gray-500">{roleHint}</p>
        )}
        <p className="mt-1.5 text-[11px] text-gray-400">
          Auto-detected at submit time from the org chart — approvers can't be set to a specific person.
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
        <p className="mt-1 ml-6 text-[11px] text-gray-400">
          When on, the approver must add an e-signature (typed or uploaded) before they can approve, reject, or request changes.
        </p>
      </div>
    </>
  );
}

function SubmitConfig({ node, update }) {
  // The Submit node assigns a task to a person/role who must upload a file +
  // optional comment and click Submit to advance the flow (e.g. Accounts
  // generating a Costing). The assignee resolves like an approver at runtime.
  const setRoleMode = (value) =>
    update({ approverRole: value, approverId: null });

  const legacyToken = node.approver
    ? String(node.approver).toLowerCase().replace(/\s+/g, "_")
    : null;
  const currentRoleValue =
    node.approverRole ||
    (legacyToken && roleApproverByValue(legacyToken)?.value) ||
    "direct_manager";

  const roleHint = roleApproverByValue(currentRoleValue)?.hint;

  useEffect(() => {
    if (node.approverId || (!node.approverRole && legacyToken)) {
      update({ approverRole: currentRoleValue, approverId: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  return (
    <>
      <Field label="Assign to">
        <select
          value={currentRoleValue}
          onChange={(e) => setRoleMode(e.target.value)}
          className={inputCls}
        >
          {ROLE_APPROVERS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        {roleHint && (
          <p className="mt-1 text-[11px] text-gray-500">{roleHint}</p>
        )}
        <p className="mt-1.5 text-[11px] text-gray-400">
          This person fills the form below and clicks Submit to advance the workflow.
        </p>
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
      <p className="-mt-1 mb-2 text-[11px] text-gray-400">
        The assignee fills these before submitting. File fields become attachments
        visible to later steps.
      </p>

      {list.length === 0 && (
        <p className="mb-2 text-[11px] text-gray-400 italic">No fields yet.</p>
      )}

      <div className="space-y-2">
        {list.map((f, i) => (
          <div key={f.id} className="border border-gray-200 rounded-md p-2.5 bg-gray-50/60">
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
                className="px-1.5 py-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveField(i, 1)}
                disabled={i === list.length - 1}
                className="px-1.5 py-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeField(i)}
                className="px-1.5 py-1 text-red-500 hover:text-red-700"
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
              <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={!!f.required}
                  onChange={(e) => updateField(i, { required: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 accent-blue-600"
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
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addField}
        className="mt-2 w-full px-3 py-2 text-sm rounded-md border border-dashed border-gray-300 text-gray-600 hover:border-teal-300 hover:text-teal-700 transition"
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
  const setRoleMode = (value) => update({ approverRole: value, approverId: null });
  const currentRoleValue = node.approverRole || "direct_manager";
  const roleHint = roleApproverByValue(currentRoleValue)?.hint;

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
          value={currentRoleValue}
          onChange={(e) => setRoleMode(e.target.value)}
          className={inputCls}
        >
          {ROLE_APPROVERS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        {roleHint && (
          <p className="mt-1 text-[11px] text-gray-500">{roleHint}</p>
        )}
        <p className="mt-1.5 text-[11px] text-gray-400">
          The reviewer sees the submission + all earlier documents, then forwards
          it or sends it back — no approve/reject.
        </p>
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
          <p className="mt-1 text-[11px] text-emerald-700">Forward path wired.</p>
        )}
      </Field>

      <Field label="If changes required →">
        {branchSelect("reject", changesEdge)}
        {changesEdge && (
          <p className="mt-1 text-[11px] text-rose-700">
            Changes path wired (usually loops back to the submit step).
          </p>
        )}
      </Field>

      {targets.length === 0 && (
        <p className="text-[11px] text-amber-700">
          Add more nodes to the canvas first, then pick where each outcome goes.
        </p>
      )}
    </>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-gray-700 mb-1.5">
        {label}
      </label>
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
        className="w-4 h-4 rounded border-gray-300 accent-blue-600"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
