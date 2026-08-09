import React, { useState } from 'react'
import AppShell from '../components/AppShell'
import UsageCharts from '../components/UsageCharts'
import { useUsage } from '../lib/usageStore'
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

  const handleRefresh = () => {
    // In a real implementation this would trigger a refetch from useUsage / api
    setLastUpdated(new Date().toLocaleTimeString())
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
  const planActive = licence?.status === 'active' || true // Example
  const renewsOn = licence?.expiresAt ? formatDate(licence.expiresAt) : '—'
  const usageReset = period?.end ? formatDate(period.end) : '—'

  const exceeded = METER_ORDER.filter(({ key }) => resources?.[key] && !resources[key].unlimited && resources[key].state === 'exceeded')

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-fg tracking-tight">Plan &amp; Usage</h1>
            <p className="text-sm text-fg-muted mt-1">Monitor your organization's plan, limits, and resource consumption.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-fg-subtle">Last updated: {lastUpdated}</span>
            <button onClick={handleRefresh} className="text-xs font-semibold px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg border border-line transition text-fg">
              Refresh
            </button>
            <button className="text-xs font-semibold px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm rounded-lg transition">
              Upgrade Plan
            </button>
          </div>
        </div>

        {/* Top Banner (Plan Summary) */}
        <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row items-stretch">
          <div className="p-6 md:p-8 md:w-1/3 border-b md:border-b-0 md:border-r border-line flex flex-col justify-center relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-indigo-100">
                <IconCrown className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-0.5">Current Plan</p>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-fg leading-none">{planLabel}</h2>
                  {planActive && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-wider">Active</span>}
                </div>
              </div>
            </div>
            <p className="text-sm text-fg-muted mb-5">Ideal for small teams getting started.</p>
            <button className="text-xs font-bold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded-lg px-4 py-2 self-start transition">
              View Plan Details
            </button>
          </div>
          
          <div className="p-6 md:p-8 md:w-1/3 border-b md:border-b-0 md:border-r border-line flex flex-col justify-center gap-6">
            <div>
              <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                Renews On
              </p>
              <h3 className="text-lg font-bold text-fg">{renewsOn}</h3>
              {licence?.daysLeft != null && <p className="text-xs text-fg-muted mt-0.5">{licence.daysLeft} days left</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                Billing Cycle
              </p>
              <h3 className="text-lg font-bold text-fg">Yearly</h3>
              <p className="text-xs text-fg-muted mt-0.5">Billed annually</p>
            </div>
          </div>

          <div className="p-6 md:p-8 md:w-1/3 flex flex-col justify-center relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                Usage Reset
              </p>
              <h3 className="text-lg font-bold text-fg">{usageReset}</h3>
              {period?.daysLeft != null && <p className="text-xs text-fg-muted mt-0.5">{period.daysLeft} days left</p>}
            </div>
            {/* CSS Abstract Illustration */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
               <svg width="150" height="150" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                 <path fill="#4f46e5" d="M45.7,-76.4C58.9,-69.5,69.1,-55.4,78.2,-41.2C87.3,-27,95.3,-13.5,95.2,-0.1C95.1,13.4,86.9,26.7,78,39.7C69.1,52.7,59.5,65.3,47.1,73.5C34.7,81.7,19.5,85.5,4.7,77.6C-10.1,69.7,-24.5,50.1,-37,40.1C-49.5,30.1,-60.1,29.7,-68.5,23.3C-76.9,16.9,-83.1,4.5,-80.6,-6.4C-78.1,-17.3,-66.9,-26.8,-57,-35.1C-47.1,-43.4,-38.5,-50.5,-28.5,-59C-18.5,-67.5,-7.1,-77.4,5.1,-86.3C17.3,-95.2,32.5,-83.3,45.7,-76.4Z" transform="translate(100 100)" />
               </svg>
            </div>
          </div>
        </div>

        {/* Usage Meters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {METER_ORDER.map(({ key, label }) => {
            const meter = resources?.[key]
            if (!meter) return null
            const config = getMeterConfig(key)
            const Icon = config.icon
            
            const usedRaw = meter.used || 0
            const maxRaw = meter.max || 0
            
            const percent = meter.unlimited ? 0 : Math.min(100, Math.max(0, (usedRaw / maxRaw) * 100))
            const percentStr = percent > 0 && percent < 1 ? '<1' : Math.round(percent)
            
            // Re-apply Red if exceeded, otherwise use brand color
            const isExceeded = !meter.unlimited && meter.state === 'exceeded'
            const barColor = isExceeded ? 'bg-red-500' : config.color
            const textColor = isExceeded ? 'text-red-600' : 'text-fg'

            return (
              <div key={key} className="bg-white border border-line rounded-xl p-3 shadow-sm flex flex-col overflow-hidden">
                <div className="flex items-start gap-2.5 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-fg-subtle truncate">{label}</h4>
                    <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
                      <span className={`text-sm font-black ${textColor}`}>{meter.unlimited ? usedRaw : meterText(key, meter).split(' of ')[0]}</span>
                      {!meter.unlimited && <span className="text-[10px] text-fg-muted font-medium whitespace-nowrap">/ {meterText(key, meter).split(' of ')[1]}</span>}
                      {meter.unlimited && <span className="text-[10px] text-fg-muted font-medium">/ &infin;</span>}
                    </div>
                  </div>
                </div>
                
                <div className="mt-auto">
                  <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full`} style={{ width: `${meter.unlimited ? 100 : percent}%` }} />
                  </div>
                  <p className="text-[10px] text-fg-muted mt-2 font-medium">
                    {meter.unlimited ? 'Unlimited' : `${percentStr}% used`}
                  </p>
                </div>
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
