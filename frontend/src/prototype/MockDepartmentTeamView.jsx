// frontend/src/prototype/MockDepartmentTeamView.jsx
import React, { useState } from 'react';
import { usePrototype } from './PrototypeContext';
import StatusBadge from '../components/StatusBadge';

export default function MockDepartmentTeamView() {
  const { currentManager, setCurrentManager, availableManagers, teamEmployees } = usePrototype();
  const [selectedRange, setSelectedRange] = useState('Last 30 days');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Top Banner explaining Feature 2 */}
      <div className="bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            📊
          </div>
          <div>
            <div className="text-xs font-bold text-purple-950 dark:text-purple-200">
              Department-Scoped "My Team" Analytics Preview
            </div>
            <div className="text-[11.5px] text-purple-800/80 dark:text-purple-400 mt-0.5">
              Client-side filter ensures managers only see employees in their own department (e.g. IT sees IT only, Sales sees Sales only).
            </div>
          </div>
        </div>

        {/* Manager Profile Switcher Pill */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-purple-200 dark:border-slate-700 px-3 py-1.5 rounded-2xl shadow-xs shrink-0">
          <span className="text-[11px] font-bold text-slate-500">Switch Manager:</span>
          <select
            value={currentManager.id}
            onChange={(e) => {
              const selected = availableManagers.find((m) => m.id === e.target.value);
              if (selected) setCurrentManager(selected);
            }}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-transparent focus:outline-none cursor-pointer"
          >
            {availableManagers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.department} Manager)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Bar (Matching screenshot layout) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-3 relative">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Scope:</span>
          
          {/* Scope Dropdown Button (Matching screenshot) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5 shadow-2xs hover:bg-slate-100 transition cursor-pointer"
            >
              <span>My team ({currentManager.department})</span>
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-56 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-30 py-2 animate-scale-in">
                <div className="px-3 py-1.5 text-[10.5px] font-extrabold uppercase text-slate-400">
                  Switch Department Manager
                </div>
                {availableManagers.map((mgr) => (
                  <button
                    key={mgr.id}
                    type="button"
                    onClick={() => {
                      setCurrentManager(mgr);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition cursor-pointer ${
                      mgr.id === currentManager.id
                        ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{mgr.department} ({mgr.name})</span>
                    {mgr.id === currentManager.id && <span className="text-indigo-600 font-bold">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50/70 dark:bg-indigo-950/50 rounded-full text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
            <span>Filter logic:</span>
            <code className="text-[10.5px] font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-indigo-900 dark:text-indigo-200">
              employee.department === "{currentManager.department}"
            </code>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Timeframe:</span>
          <select
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>This Quarter (Q3)</option>
            <option>Year to date</option>
          </select>
        </div>
      </div>

      {/* Analytics KPI Row & Donut Chart (Matching screenshot design) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Department Metrics */}
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {currentManager.department} Team Size
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
              {teamEmployees.length}
            </div>
            <div className="text-[11.5px] text-emerald-600 font-semibold flex items-center gap-1">
              <span>● 100% active in {currentManager.department}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Active Workflow Tasks
            </div>
            <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
              {teamEmployees.reduce((acc, curr) => acc + curr.openTasks, 0)}
            </div>
            <div className="text-[11.5px] text-slate-400">Across {teamEmployees.length} team members</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-1">
            <div className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">
              SLA Breaches
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
              0
            </div>
            <div className="text-[11.5px] text-emerald-600 font-semibold">In selected range</div>
          </div>
        </div>

        {/* Right: 72% Approved Donut Chart (Matching screenshot) */}
        <div className="md:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex items-center justify-between">
          <div className="relative flex items-center justify-center">
            {/* SVG Donut */}
            <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="#E2E8F0" strokeWidth="12" fill="transparent" />
              {/* Green Approved: 72% */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#10B981"
                strokeWidth="12"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 * (1 - 0.72)}
                fill="transparent"
                strokeLinecap="round"
              />
              {/* Orange Escalated: 18% */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#F59E0B"
                strokeWidth="12"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 * (1 - 0.18)}
                strokeDasharray="45 251.2"
                fill="transparent"
                className="opacity-90"
              />
              {/* Red Rejected: 10% */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#EF4444"
                strokeWidth="12"
                strokeDasharray="25 251.2"
                strokeDashoffset="-225"
                fill="transparent"
              />
            </svg>
            <div className="absolute text-center">
              <div className="text-xl font-black text-slate-900 dark:text-slate-100">72%</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">APPROVED</div>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">Approved (72%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">In Progress (18%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">Rejected (10%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filtered Employee Roster Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{currentManager.department} Department Team Roster</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 font-bold border border-indigo-200 dark:border-indigo-800">
                {teamEmployees.length} Members
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Showing employees strictly belonging to the {currentManager.department} department.
            </p>
          </div>

          <div className="text-xs font-semibold text-slate-500 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            Manager: <strong className="text-indigo-600 dark:text-indigo-400">{currentManager.name}</strong>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 px-3">Employee</th>
                <th className="pb-3 px-3">Department</th>
                <th className="pb-3 px-3">Role</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3">Open Tasks</th>
                <th className="pb-3 px-3">SLA Health</th>
                <th className="pb-3 px-3 text-right">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {teamEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${emp.avatarColor} text-white flex items-center justify-center font-bold text-xs shadow-2xs`}>
                        {emp.avatar}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100">{emp.name}</div>
                        <div className="text-[11px] text-slate-400">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] border border-indigo-200 dark:border-indigo-800">
                      {emp.department}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                    {emp.role}
                  </td>
                  <td className="py-3.5 px-3">
                    <StatusBadge status={emp.status} />
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      {emp.openTasks}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {emp.slaCompliance}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-400 font-medium">
                    {emp.lastActive}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
