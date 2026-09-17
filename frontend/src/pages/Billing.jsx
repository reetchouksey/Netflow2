import React, { useState } from 'react'
import AppShell from '../components/AppShell'
import UsageCharts from '../components/UsageCharts'
import { useUsage, usageStore } from '../lib/usageStore'
import { METER_ORDER, meterText, licenceChip, formatDate } from '../lib/licensing'
import { Skeleton } from '../components/Skeleton'
import { AlertBanner } from '../components/Alert'

// SVG Icons matching the mockup theme
function IconCrown(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.974 0-5.699-.533-8.15-1.45" /> </svg>}
function IconUsers(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>}
function IconBuilders(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" /></svg>}
function IconForms(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>}
function IconWorkflows(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>}
function IconSubmissions(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>}
function IconStorage(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" /></svg>}
function IconFiles(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>}

function getMeterConfig(key) {
  const configs = {
    users: { icon: IconUsers, iconBg: 'bg-indigo-50 text-indigo-600', color: 'bg-indigo-600' },
    builders: { icon: IconBuilders, iconBg: 'bg-orange-50 text-orange-600', color: 'bg-orange-500' },
    forms: { icon: IconForms, iconBg: 'bg-blue-50 text-blue-600', color: 'bg-blue-500' },
    workflows: { icon: IconWorkflows, iconBg: 'bg-emerald-50 text-emerald-600', color: 'bg-emerald-500' },
    submissions: { icon: IconSubmissions, iconBg: 'bg-cyan-50 text-cyan-600', color: 'bg-cyan-500' },
    storage: { icon: IconStorage, iconBg: 'bg-purple-50 text-purple-600', color: 'bg-purple-500' },
    files: { icon: IconFiles, iconBg: 'bg-amber-50 text-amber-600', color: 'bg-amber-500' }
  }
  return configs[key] || configs.users
}

export default function Billing() {
  const { usage, loading, error, canManage } = useUsage()
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString())

  const handleRefresh = async () => {
    try {
      await usageStore.refresh()
    } finally {
      setLastUpdated(new Date().toLocaleTimeString())
    }
  }

  if (loading && !usage) {
    return (
      <AppShell title="Plan & Usage">
        <div className="max-w-[1400px] p-8 space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="flex gap-4"><Skeleton className="h-24 w-48 rounded-xl" /><Skeleton className="h-24 w-48 rounded-xl" /></div>
        </div>
      </AppShell>
    )
  }

  if (!usage || !canManage) {
    return (
      <AppShell title="Plan & Usage">
        <div className="max-w-[1400px] p-8">
          <AlertBanner tone="danger">You do not have permission to view billing and usage data.</AlertBanner>
        </div>
      </AppShell>
    )
  }

  const { licence, period, resources } = usage
  const planLabel = licence?.planLabel || 'Unknown'
  const planActive = licence?.status === 'active' || (licence?.daysLeft != null && licence.daysLeft > 0) || !licence?.readOnly
  const renewsOn = licence?.expiresAt ? formatDate(licence.expiresAt) : '—'
  const usageReset = period?.end ? formatDate(period.end) : '—'

  const exceeded = METER_ORDER.filter(({ key }) => resources?.[key] && !resources[key].unlimited && resources[key].state === 'exceeded')

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#6366F1] text-white flex items-center justify-center text-xl font-black shrink-0 shadow-md shadow-indigo-500/20">
              <IconCrown className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Plan &amp; Usage</h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Track your plan limits and resource consumption.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Last updated: {lastUpdated}</span>
            <button
              onClick={handleRefresh}
              className="text-xs font-bold px-4.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs transition cursor-pointer"
            >
              Refresh
            </button>
            <button className="text-xs font-bold px-5 py-2.5 bg-[#6366F1] hover:bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-500/20 transition cursor-pointer">
              Upgrade Plan
            </button>
          </div>
        </div>

        {/* Top Banner (Plan Summary) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Current Plan */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl flex flex-col justify-between shadow-2xs border border-slate-200/80 dark:border-slate-800 min-h-[190px]">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#EEF2FF] dark:bg-indigo-500/15 text-[#6366F1] dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Current Plan</p>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-900 dark:text-white leading-none tracking-tight">{planLabel}</h2>
                      {planActive && <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e3f7ed] text-[#12a15f] dark:bg-emerald-500/15 dark:text-emerald-300 uppercase tracking-wider">Active</span>}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Ideal for small teams getting started.
              </p>
            </div>
            <div className="pt-4">
              <button className="text-xs font-bold text-[#6366F1] dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl px-4 py-2 transition cursor-pointer">
                View Plan Details
              </button>
            </div>
          </div>
          
          {/* Card 2: Renews On */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl flex flex-col justify-between shadow-2xs border border-slate-200/80 dark:border-slate-800 min-h-[190px]">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Renews On</p>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white leading-none tracking-tight">{renewsOn}</h2>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300 uppercase tracking-wider">
                  Auto-renew
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Subscription auto-renews at next term.
              </p>
            </div>
            <div className="pt-4">
              <button className="text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl px-4 py-2 transition cursor-pointer">
                Manage Renewal
              </button>
            </div>
          </div>

          {/* Card 3: Billing Cycle */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl flex flex-col justify-between shadow-2xs border border-slate-200/80 dark:border-slate-800 min-h-[190px]">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Billing Cycle</p>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white leading-none tracking-tight">Yearly</h2>
                  </div>
                </div>
                <div className="w-9 h-9 bg-[#EEF2FF] dark:bg-indigo-500/15 rounded-xl flex items-center justify-center shrink-0 shadow-2xs text-[#6366F1]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Billed annually with 2 months free.
              </p>
            </div>
            <div className="pt-4">
              <button className="text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl px-4 py-2 transition cursor-pointer">
                Change Cycle
              </button>
            </div>
          </div>
        </div>

        {/* Usage Meters Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {METER_ORDER.map(({ key, label }) => {
            const meter = resources?.[key]
            if (!meter) return null
            const config = getMeterConfig(key)
            const Icon = config.icon
            
            const usedRaw = meter.used || 0
            const maxRaw = meter.max || 0
            
            const percent = meter.unlimited ? 0 : Math.min(100, Math.max(0, (usedRaw / maxRaw) * 100))
            const percentStr = percent > 0 && percent < 1 ? '<1' : Math.round(percent)
            
            const isExceeded = !meter.unlimited && meter.state === 'exceeded'
            const barColor = isExceeded ? 'bg-red-500' : config.color

            return (
              <div key={key} className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xs border border-slate-200/80 dark:border-slate-800 flex flex-col items-center flex-1 min-w-[130px]">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${config.iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{label}</h4>
                </div>
                
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">{usedRaw}</span>
                  <span className="text-xs font-bold text-slate-400">/ &infin;</span>
                </div>
                
                <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-2">
                  <div className={`h-full ${barColor} rounded-full opacity-60`} style={{ width: '100%' }} />
                </div>
                
                <p className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-widest">
                  Unlimited
                </p>
              </div>
            )
          })}
        </div>

        {/* Alert Banner */}
        {exceeded.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h4 className="text-sm font-bold text-amber-900">{exceeded[0].label} limit reached</h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Your plan has exceeded its {exceeded[0].label.toLowerCase()} limit. {exceeded.length > 1 ? `${exceeded.length - 1} other limit(s) also reached.` : 'Upgrade to resume full functionality.'}
                </p>
              </div>
            </div>
            <button className="shrink-0 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg px-4 py-2 transition">
              Review Usage
            </button>
          </div>
        )}

        {/* Charts */}
        <UsageCharts />

      </div>
    </AppShell>
  )
}
