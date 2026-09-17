// frontend/src/prototype/MockManagerApprovals.jsx
import React, { useState } from 'react';
import { usePrototype } from './PrototypeContext';
import StatusBadge from '../components/StatusBadge';

export default function MockManagerApprovals() {
  const { requests, currentManager, approveRequest, rejectRequest } = usePrototype();

  const [activeReqId, setActiveReqId] = useState(() => requests[0]?.id || 'req-101');
  const [commentInput, setCommentInput] = useState('');
  const [validationError, setValidationError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const activeRequest = requests.find((r) => r.id === activeReqId) || requests[0];

  const handleApprove = () => {
    setValidationError('');
    approveRequest(activeRequest.id, commentInput);
    setCommentInput('');
    setActionSuccess(`Request "${activeRequest.title}" approved successfully!`);
    setTimeout(() => setActionSuccess(''), 4000);
  };

  const handleReject = () => {
    if (!commentInput.trim()) {
      setValidationError('A rejection reason is required before confirming rejection.');
      return;
    }
    setValidationError('');
    const res = rejectRequest(activeRequest.id, commentInput);
    if (res?.success) {
      setCommentInput('');
      setActionSuccess(`Request "${activeRequest.title}" was rejected with your comment.`);
      setTimeout(() => setActionSuccess(''), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner explaining prototype flow */}
      <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            {currentManager.avatar}
          </div>
          <div>
            <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
              Manager Approval Studio • Acting as {currentManager.name} ({currentManager.department} Manager)
            </div>
            <div className="text-[11.5px] text-indigo-700/80 dark:text-indigo-400 mt-0.5">
              Select any request below to approve or reject. Rejections require a comment, which will sync to the Employee Dashboard.
            </div>
          </div>
        </div>
        <span className="px-3 py-1 bg-white dark:bg-slate-800 rounded-full text-xs font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-slate-700 shadow-2xs shrink-0">
          Client-Side Mock Only
        </span>
      </div>

      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {actionSuccess}
        </div>
      )}

      {/* Main Grid: Left Request List, Right Approval Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Requests Queue */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pending & Decided Requests ({requests.length})
            </h3>
            <span className="text-[11px] text-slate-400">Select to review</span>
          </div>

          <div className="space-y-2">
            {requests.map((req) => {
              const isSelected = req.id === activeReqId;
              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => {
                    setActiveReqId(req.id);
                    setValidationError('');
                    setCommentInput('');
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white dark:bg-slate-800 border-[#4F46E5] shadow-sm ring-1 ring-[#4F46E5]/40'
                      : 'bg-white/80 dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {req.title}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        By {req.employee} • {req.department}
                      </div>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-2">
                    {req.summary}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Request Detail & Approval Actions (Matches UI Screenshot) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6">
          {/* Header Title */}
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  {activeRequest.formType}
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {activeRequest.title} — Approval Required — {activeRequest.employee}
                </h2>
              </div>
              <StatusBadge status={activeRequest.status} className="text-xs" />
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span>Submitted {activeRequest.submittedAgo}</span>
              <span>•</span>
              <span>Department: <strong className="text-slate-700 dark:text-slate-300">{activeRequest.department}</strong></span>
            </div>
          </div>

          {/* Form Fields Data Table (Matching screenshot layout) */}
          <div className="border border-slate-200/70 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {activeRequest.fields.map((field, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-5 py-3.5 text-xs bg-white dark:bg-slate-900"
              >
                <div className="font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {field.label}
                </div>
                <div className="sm:col-span-2 text-slate-800 dark:text-slate-200 font-medium break-all">
                  {field.isFile ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-lg font-semibold text-[11px] border border-indigo-200 dark:border-indigo-800">
                      📎 {field.value}
                    </span>
                  ) : (
                    field.value
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Previous Decision Display if already decided */}
          {activeRequest.status !== 'Pending' && (
            <div
              className={`p-4 rounded-2xl border ${
                activeRequest.status === 'Approved'
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-100'
                  : 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80 text-rose-900 dark:text-rose-100'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                <span>
                  {activeRequest.status === 'Approved' ? '✓ Approved' : '✕ Rejected'} by {activeRequest.decidedBy}
                </span>
                <span className="font-normal text-[11px] opacity-80">
                  on {new Date(activeRequest.decidedAt).toLocaleString()}
                </span>
              </div>
              {activeRequest.managerComment && (
                <div className="mt-2 text-xs leading-relaxed bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-current/10">
                  <span className="font-bold">Manager feedback / reason: </span>
                  {activeRequest.managerComment}
                </div>
              )}
            </div>
          )}

          {/* Approval Actions Box (Matching screenshot) */}
          <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Approval actions
              </h4>
              {activeRequest.status === 'Pending' ? (
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  ● Awaiting your decision
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  Decision completed • You can re-decide below if needed
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="mgr-comment"
                className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Add a comment — <span className="text-rose-600 font-bold">required when rejecting</span>
              </label>
              <textarea
                id="mgr-comment"
                rows={3}
                value={commentInput}
                onChange={(e) => {
                  setCommentInput(e.target.value);
                  if (validationError) setValidationError('');
                }}
                placeholder="Type your approval feedback or reason for rejection here..."
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 focus:outline-none focus:ring-2 focus:ring-[#4F46E5] text-slate-800 dark:text-slate-100"
              />
              {validationError && (
                <p className="text-[11.5px] font-semibold text-rose-600 dark:text-rose-400 mt-1.5 flex items-center gap-1.5 animate-fade-in">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                  </svg>
                  {validationError}
                </p>
              )}
            </div>

            {/* Action Buttons Matching Screenshot */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleApprove}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs transition shadow-2xs flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Approve</span>
              </button>

              <button
                type="button"
                onClick={handleReject}
                className="px-5 py-2.5 rounded-xl border-2 border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-bold text-xs transition shadow-2xs flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Reject</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCommentInput('Please update the proposal document and re-upload.');
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs transition cursor-pointer"
              >
                ↩ Request changes
              </button>
            </div>

            <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-1">
              {activeRequest.status === 'Approved'
                ? 'This task is approved — outcome synced with employee dashboard.'
                : activeRequest.status === 'Rejected'
                ? 'This task is rejected — rejection comment synced with employee dashboard.'
                : 'Clicking Approve or Reject instantly updates the client-side state for preview.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
