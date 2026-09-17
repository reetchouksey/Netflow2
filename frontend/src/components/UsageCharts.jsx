import React from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { useUsage } from '../lib/usageStore'
import { Link } from 'react-router-dom'

function formatSize(mb) {
  if (mb < 1) return Math.round(mb * 1024) + ' KB'
  if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB'
  return Math.round(mb) + ' MB'
}

export default function UsageCharts() {
  const { usage, trend, loading } = useUsage()

  if (loading || !usage) return null

  // 1. Storage Data (Donut Chart)
  const storageMax = usage.resources?.storage?.max || 5120
  const storageUsed = usage.resources?.storage?.used || 0
  const storageAvailable = Math.max(0, storageMax - storageUsed)
  
  const storageData = [
    { name: 'Used', value: Math.round(storageUsed * 10) / 10 },
    { name: 'Available', value: Math.round(storageAvailable * 10) / 10 }
  ]
  const usedPercent = storageMax > 0 ? Math.round((storageUsed / storageMax) * 100) : 0
  const availPercent = 100 - usedPercent

  // 2. Submissions Time Series
  const submissionData = trend && trend.length > 0 ? trend : [
    { name: 'Sun', submissions: 0 }, { name: 'Mon', submissions: 0 }, { name: 'Tue', submissions: 0 }, 
    { name: 'Wed', submissions: 0 }, { name: 'Thu', submissions: 1 }, { name: 'Fri', submissions: 0 }, { name: 'Sat', submissions: 0 }
  ]

  // 3. Workflows vs Forms (Horizontal Bar Chart)
  const assetsData = [
    { name: 'Forms', count: usage.resources?.forms?.used || 0, fill: '#6366f1' }, // Indigo
    { name: 'Workflows', count: usage.resources?.workflows?.used || 0, fill: '#10b981' }, // Emerald
    { name: 'Builders', count: usage.resources?.builders?.used || 0, fill: '#ea580c' } // Orange
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Storage Donut Chart */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl flex flex-col justify-between shadow-2xs border border-slate-200/80 dark:border-slate-800 min-h-[320px]">
        <div>
          <div className="flex items-center justify-between h-7 mb-5">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Storage Overview</h3>
          </div>
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 sm:gap-4">
            <div className="h-28 w-28 relative shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={storageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={54}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                  >
                    <Cell fill="#059669" />
                    <Cell fill="#34d399" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-sm font-black text-slate-900 dark:text-white">{formatSize(storageUsed)}</span>
                <span className="text-[10px] text-slate-400 font-bold mt-0.5">Used</span>
              </div>
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#059669] shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs">Used</span>
                </div>
                <div className="flex gap-2 text-xs text-right">
                  <span className="font-bold text-slate-900 dark:text-white">{formatSize(storageUsed)}</span>
                  <span className="text-slate-400 font-semibold">{usedPercent}%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#34d399] shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs">Available</span>
                </div>
                <div className="flex gap-2 text-xs text-right">
                  <span className="font-bold text-slate-900 dark:text-white">{formatSize(storageAvailable)}</span>
                  <span className="text-slate-400 font-semibold">{availPercent}%</span>
                </div>
              </div>
              
              <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 dark:text-white">Total Storage</span>
                <span className="font-black text-slate-900 dark:text-white">{formatSize(storageMax)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <Link to="/settings" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
            View storage details &rarr;
          </Link>
        </div>
      </div>

      {/* Submissions Line Chart */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl flex flex-col justify-between shadow-2xs border border-slate-200/80 dark:border-slate-800 min-h-[320px]">
        <div>
          <div className="flex items-center justify-between h-7 mb-5">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Submissions (This Week)</h3>
            <select className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 outline-none cursor-pointer">
              <option>This Week</option>
              <option>Last Week</option>
            </select>
          </div>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={submissionData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={5} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', padding: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                />
                <Line type="monotone" dataKey="submissions" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <Link to="/forms" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
            View all submissions &rarr;
          </Link>
        </div>
      </div>

      {/* Assets Bar Chart */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl flex flex-col justify-between shadow-2xs border border-slate-200/80 dark:border-slate-800 min-h-[320px]">
        <div>
          <div className="flex items-center justify-between h-7 mb-5">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Assets Created</h3>
            <select className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 outline-none cursor-pointer">
              <option>This Month</option>
              <option>All Time</option>
            </select>
          </div>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assetsData} layout="vertical" margin={{ top: 8, right: 20, left: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.04)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={5} />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 600, textAnchor: 'start' }}
                  dx={-75}
                  width={80}
                />
                <RechartsTooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }} 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', padding: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={14}>
                  {assetsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <Link to="/workflows" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
            View all assets &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
