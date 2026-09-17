// frontend/src/prototype/PrototypePage.jsx
// ISOLATED PROTOTYPE PREVIEW SHELL
// Strictly client-side mock data — zero production endpoints or database bindings.

import React from 'react';
import { Link } from 'react-router-dom';
import { PrototypeProvider, usePrototype } from './PrototypeContext';
import MockManagerApprovals from './MockManagerApprovals';
import MockEmployeeDashboard from './MockEmployeeDashboard';
import MockDepartmentTeamView from './MockDepartmentTeamView';
import MockSplitPreview from './MockSplitPreview';

function PrototypeContent() {
  const { activeTab, setActiveTab, currentManager, setCurrentManager, availableManagers, resetData } =
    usePrototype();

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-800 dark:text-slate-100 flex flex-col">
      {/* Top Prototype Notice Banner */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 flex items-center gap-1.5 transition"
              title="Return to main application"
            >
              ← Back to App
            </Link>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-extrabold text-[10.5px] uppercase tracking-wider border border-amber-300/80 dark:border-amber-800">
                PROTOTYPE PREVIEW
              </span>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Workflow UX & Department Team Preview
              </h1>
            </div>
          </div>

          {/* Manager Switcher & Reset Button */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Quick Profile Switcher */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl shadow-2xs">
              <span className="text-xs font-bold text-slate-500">👔 Acting Manager:</span>
              <select
                value={currentManager.id}
                onChange={(e) => {
                  const m = availableManagers.find((item) => item.id === e.target.value);
                  if (m) setCurrentManager(m);
                }}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-transparent focus:outline-none cursor-pointer"
              >
                {availableManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.department})
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Seed Data */}
            <button
              type="button"
              onClick={resetData}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Reset mock data to initial demo state"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Reset Data</span>
            </button>
          </div>
        </div>

        {/* Prototype Tab Navigation Bar */}
        <div className="max-w-7xl mx-auto mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 overflow-x-auto thin-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('manager')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'manager'
                ? 'bg-[#4F46E5] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>👔</span>
            <span>Feature 1: Manager Approvals View</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('employee')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'employee'
                ? 'bg-[#4F46E5] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>👤</span>
            <span>Feature 1: Employee "My Requests"</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'team'
                ? 'bg-[#4F46E5] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>📊</span>
            <span>Feature 2: Department "My Team" Analytics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('split')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'split'
                ? 'bg-[#4F46E5] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>⚡</span>
            <span>Live Side-by-Side Dual View</span>
          </button>
        </div>
      </header>

      {/* Main Prototype Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {activeTab === 'manager' && <MockManagerApprovals />}
        {activeTab === 'employee' && <MockEmployeeDashboard />}
        {activeTab === 'team' && <MockDepartmentTeamView />}
        {activeTab === 'split' && <MockSplitPreview />}
      </main>

      {/* Prototype Footer Badge */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-4 px-6 text-center text-xs text-slate-400">
        NetFlow UX Prototype Preview • Scoped purely to client-side in-memory mock data • Production data unaffected.
      </footer>
    </div>
  );
}

export default function PrototypePage() {
  return (
    <PrototypeProvider>
      <PrototypeContent />
    </PrototypeProvider>
  );
}
