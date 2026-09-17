// frontend/src/prototype/MockEmployeeDashboard.jsx
import React, { useState } from 'react';
import { usePrototype } from './PrototypeContext';
import StatusBadge from '../components/StatusBadge';

export default function MockEmployeeDashboard() {
  const { requests } = usePrototype();
  const [filterStatus, setFilterStatus] = useState('ALL');

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === 'ALL') return true;
    return r.status.toUpperCase() === filterStatus;
  });

  const pendingCount = requests.filter((r) => r.status === 'Pending').length;
  const approvedCount = requests.filter((r) => r.status === 'Approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'Rejected').length;

  return (
    <div className="space-y-6">
      {/* Top Banner explaining employee view sync */}
      <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            👤
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
              Employee Portal • "My Requests" Live Tracking
            </div>
            <div className="text-[11.5px] text-emerald-800/80 dark:text-emerald-400 mt-0.5">
              Live updates reflect manager decisions in real-time. Rejected requests clearly show the manager's comment and reason.
            </div>
          </div>
        </div>
        <span className="px-3 py-1 bg-white dark:bg-slate-800 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-slate-700 shadow-2xs shrink-0">
          Client-Side Mock Synced
        </span>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Requests</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{requests.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Tracked in this session</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">In Review</div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{pendingCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Awaiting manager decision</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Approved</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{approvedCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Signoff granted</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Rejected</div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{rejectedCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">With manager feedback</div>
        </div>
      </div>

      {/* Main "My Requests" Card Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              My Submitted Requests ({filteredRequests.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review current status, approvals, and manager feedback notes.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  filterStatus === st
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              className={`p-5 rounded-2xl border transition-all ${
                req.status === 'Rejected'
                  ? 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-200/80 dark:border-rose-900/40 hover:border-rose-300'
                  : req.status === 'Approved'
                  ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-200/80 dark:border-emerald-900/40 hover:border-emerald-300'
                  : 'bg-white dark:bg-slate-850 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2.5 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900">
                      {req.formType}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Submitted by <strong className="text-slate-700 dark:text-slate-200">{req.employee}</strong> ({req.department})
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-400">{req.submittedAgo}</span>
                  </div>

                  <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                    {req.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {req.summary}
                  </p>
                </div>

                {/* Status Badge */}
                <div className="shrink-0">
                  <StatusBadge status={req.status} className="text-xs" />
                </div>
              </div>

              {/* Status Specific Outcome Box */}
              {req.status === 'Rejected' && (
                <div className="mt-3.5 p-3.5 rounded-xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs">
                  <div className="flex items-center gap-2 font-bold text-rose-800 dark:text-rose-300">
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px]">✕</span>
                    <span>Request Rejected by {req.decidedBy || 'Manager'}</span>
                    {req.decidedAt && (
                      <span className="font-normal text-[11px] text-rose-600/80">
                        • {new Date(req.decidedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-rose-950 dark:text-rose-100 leading-relaxed pl-7">
                    <strong className="font-bold text-rose-800 dark:text-rose-300">Reason from manager: </strong>
                    <span className="italic">{req.managerComment || 'No specific comment provided.'}</span>
                  </div>
                </div>
              )}

              {req.status === 'Approved' && (
                <div className="mt-3.5 p-3.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                  <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>
                    <span>Approved by {req.decidedBy || 'Manager'}</span>
                    {req.decidedAt && (
                      <span className="font-normal text-[11px] text-emerald-600/80">
                        • {new Date(req.decidedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {req.managerComment && (
                    <div className="mt-1.5 text-emerald-900 dark:text-emerald-200 pl-7 text-[11.5px]">
                      <span className="font-semibold">Note: </span>
                      {req.managerComment}
                    </div>
                  )}
                </div>
              )}

              {req.status === 'Pending' && (
                <div className="mt-3 text-[11.5px] text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Waiting for manager review • Estimated turnaround within 24 hours.</span>
                </div>
              )}
            </div>
          ))}

          {filteredRequests.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
              No requests found in "{filterStatus}" status.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
