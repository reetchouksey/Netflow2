// frontend/src/prototype/MockSplitPreview.jsx
import React from 'react';
import MockManagerApprovals from './MockManagerApprovals';
import MockEmployeeDashboard from './MockEmployeeDashboard';

export default function MockSplitPreview() {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#4F46E5] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            ⚡
          </div>
          <div>
            <div className="text-xs font-bold text-blue-950 dark:text-blue-200">
              Interactive Dual-Screen Review Mode (Live Synced)
            </div>
            <div className="text-[11.5px] text-blue-800/80 dark:text-blue-400 mt-0.5">
              Approve or Reject on the Manager side (Left), and watch the Employee Dashboard (Right) update in real-time.
            </div>
          </div>
        </div>
        <span className="px-3 py-1 bg-white dark:bg-slate-800 rounded-full text-xs font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-slate-700 shadow-2xs shrink-0">
          Side-by-Side Live State
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Left: Manager Side */}
        <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              1. Manager Approvals Interface
            </h3>
            <span className="text-[11px] text-slate-400">Perform Action Here</span>
          </div>
          <MockManagerApprovals />
        </div>

        {/* Right: Employee Side */}
        <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              2. Employee "My Requests" View
            </h3>
            <span className="text-[11px] text-slate-400">Live Outcome Display</span>
          </div>
          <MockEmployeeDashboard />
        </div>
      </div>
    </div>
  );
}
