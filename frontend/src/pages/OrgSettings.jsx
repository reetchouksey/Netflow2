import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { useUser } from '../utils/auth'
import { toast } from '../lib/toastStore'
import { formatDate, formatDateTime } from '../utils/datetime'
import { useReadOnly } from '../lib/usageStore'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const fieldCls = 'w-full px-3 py-2 text-sm border border-line rounded-lg bg-surface-2 text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 focus:bg-surface transition disabled:opacity-60'

// --- Icons ---
function IconBuilding(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg> }
function IconShield(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg> }
function IconPlan(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg> }
function IconAccess(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg> }
function IconDomain(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg> }
function IconSave(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" /></svg> }
function IconCheckCircle(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
function IconActivity(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg> }

// --- Subcomponents ---

function TopCard({ icon, title, value, subtitle, badge, tone = "neutral", action }) {
  const tones = {
    neutral: "text-fg-muted bg-surface-2",
    success: "text-emerald-600 bg-emerald-50 ring-emerald-200",
    indigo: "text-indigo-600 bg-indigo-50 ring-indigo-200",
    amber: "text-amber-600 bg-amber-50 ring-amber-200",
  }
  
  return (
    <div className="bg-surface border border-line rounded-xl p-5 flex items-start gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ring-1 ${tones[tone] || tones.neutral}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{title}</p>
        <p className="mt-1 text-lg font-bold text-fg truncate">{value}</p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {subtitle && <p className="text-xs text-fg-muted">{subtitle}</p>}
          {badge && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200">
              {badge}
            </span>
          )}
        </div>
        {action && (
          <div className="mt-2">
            {action}
          </div>
        )}
      </div>
    </div>
  )
}

function SectionCard({ title, icon, action, children }) {
  return (
    <section className="bg-surface border border-line rounded-xl shadow-sm flex flex-col h-full">
      <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="text-indigo-500 bg-indigo-50/50 p-1.5 rounded-lg">
            {icon}
          </div>
          <h2 className="text-sm font-bold text-fg">{title}</h2>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-6 flex-1 flex flex-col">{children}</div>
    </section>
  )
}

function DataRow({ label, value, valueNode, actionNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between py-3 gap-1 sm:gap-4 border-b border-line last:border-0 last:pb-0 first:pt-0">
      <p className="text-sm font-medium text-fg-muted w-[140px] shrink-0">{label}</p>
      <div className="text-sm font-medium text-fg flex-1 flex items-center justify-between gap-4 min-w-0">
        <div className="truncate min-w-0 flex-1">{valueNode || value}</div>
        {actionNode && <div className="shrink-0">{actionNode}</div>}
      </div>
    </div>
  )
}

export default function OrgSettings() {
  const user = useUser()
  const [org, setOrg] = useState(null)
  const [name, setName] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dmsStatus, setDmsStatus] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  
  const [editingProfile, setEditingProfile] = useState(false)
  
  const readOnly = useReadOnly()

  const apply = (o) => {
    setOrg(o)
    setName(o.name || '')
    setBillingEmail(o.billingEmail || '')
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [orgRes, dmsRes, auditRes] = await Promise.allSettled([
        api.get('/api/organization'),
        api.get('/api/organization/dms-status'),
        api.get('/api/audit-logs?limit=5')
      ])
      
      if (orgRes.status === 'fulfilled') apply(orgRes.value.organization)
      if (dmsRes.status === 'fulfilled') setDmsStatus(dmsRes.value)
      if (auditRes.status === 'fulfilled') setRecentActivity(auditRes.value.logs || [])
      
    } catch (err) {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const dirty = org && (name.trim() !== (org.name || '') || billingEmail.trim().toLowerCase() !== (org.billingEmail || ''))

  const handleSaveAll = async () => {
    if (!dirty || readOnly) return
    setSaving(true)
    try {
      const data = await api.put('/api/organization', {
        name: name.trim(),
        billingEmail: billingEmail.trim().toLowerCase()
      })
      apply(data.organization)
      toast.success('Settings saved successfully')
      setEditingProfile(false)
    } catch (err) {
      toast.error(err.message || 'Could not save the settings')
    } finally {
      setSaving(false)
    }
  }

  const licence = org?.licence
  const domainCount = org?.allowedDomains?.length || 0
  const deptCount = org?.departments?.length || 0

  // Chart data
  const usedKb = Math.round((dmsStatus?.storage?.usedBytes || 0) / 1024)
  const hasLimit = dmsStatus?.storage?.limitMb != null
  const limitKb = hasLimit ? dmsStatus.storage.limitMb * 1024 : 0
  const availableKb = hasLimit ? Math.max(0, limitKb - usedKb) : 0
  
  const chartData = hasLimit 
    ? [
        { name: 'Used', value: usedKb, color: '#e63232ff' }, // red-600
        { name: 'Available', value: availableKb, color: '#25f56eff' } // green-100
      ]
    : [
        { name: 'Used', value: usedKb || 1, color: '#4f46e5' }, // Solid circle
        { name: 'Unlimited', value: 0, color: 'transparent' }
      ]

  const formatSize = (kb) => {
    if (kb >= 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(1)} GB`
    if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`
    return `${kb} KB`
  }

  return (
    <AppShell
      title="Organization Settings"
      subtitle="Manage your organization preferences, integrations and security settings."
      actions={
        <button 
          onClick={handleSaveAll}
          disabled={!dirty || saving || readOnly}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
        >
          <IconSave className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      }
      mainClass="flex-1 p-6 overflow-y-auto bg-surface-2/30"
    >
      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-surface rounded-xl border border-line" />)}
          </div>
          <div className="grid grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-64 bg-surface rounded-xl border border-line" />)}
          </div>
        </div>
      ) : org && (
        <div className="space-y-6 max-w-[1400px]">
          {/* Top Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <TopCard 
              title="PLAN"
              value={licence?.planLabel || org.plan || 'Free'}
              subtitle="Set by platform team"
              tone="indigo"
              icon={<IconPlan className="w-6 h-6" />}
            />
            <TopCard 
              title="LICENSE"
              value={licence?.status === 'active' ? 'Active' : licence?.status || 'Unknown'}
              subtitle={licence?.expiresAt ? `Renews ${formatDate(licence.expiresAt)}` : 'Perpetual'}
              badge={licence?.daysLeft ? `${licence.daysLeft} days left` : null}
              tone="success"
              icon={<IconShield className="w-6 h-6" />}
            />
            <TopCard 
              title="SIGN-IN DOMAINS"
              value={domainCount ? `${domainCount} Allowed` : 'Open'}
              subtitle="Contact Platform Admin to Add more"
              tone="indigo"
              icon={<IconDomain className="w-6 h-6" />}
            />
            <TopCard 
              title="ADMIN SECURITY"
              value={user?.mfaEnabled ? "MFA Active" : "MFA Disabled"}
              // subtitle={user?.mfaEnabled ? "Secured via Authenticator" : "Setup recommended"}
              tone={user?.mfaEnabled ? "success" : "danger"}
              icon={<IconAccess className="w-6 h-6" />}
              action={
                <Link to="/profile" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline bg-indigo-50 px-2 py-1 rounded ">
                  {user?.mfaEnabled ? 'Manage' : 'Enable'}
                </Link>
              }
            />
          </div>

          {/* Middle Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SectionCard 
              title="Organization Profile" 
              icon={<IconBuilding className="w-4 h-4" />}
              action={
                <div className="flex items-center gap-2">
                  {dirty && (
                    <button 
                      onClick={handleSaveAll} 
                      disabled={saving || readOnly} 
                      className="flex items-center gap-1.5 bg-indigo-600 text-white px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      if (editingProfile) apply(org)
                      setEditingProfile(!editingProfile)
                    }} 
                    className="text-xs font-semibold px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg border border-line transition"
                  >
                    {editingProfile ? 'Cancel' : 'Edit'}
                  </button>
                </div>
              }
            >
              {editingProfile ? (
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-fg-muted">Workspace name</span>
                    <input value={name} onChange={e => setName(e.target.value)} disabled={readOnly} className={`${fieldCls} mt-1`} />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-fg-muted">Billing contact</span>
                    <input value={billingEmail} onChange={e => setBillingEmail(e.target.value)} disabled={readOnly} className={`${fieldCls} mt-1`} />
                  </label>
                  <div>
                    <span className="text-xs font-semibold text-fg-muted">Workspace address</span>
                    <div className="mt-1 flex items-center justify-between px-3 py-2 bg-surface-3 border border-line rounded-lg">
                      <span className="text-sm font-mono text-fg">{org.subdomain}</span>
                      <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ring-1 ring-emerald-200">Locked</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full justify-center space-y-4">
                  <DataRow label="Workspace name" value={name} />
                  <DataRow 
                    label="Workspace address" 
                    valueNode={<span className="font-mono">{org.subdomain}</span>} 
                    actionNode={<span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ring-1 ring-emerald-200">Locked</span>}
                  />
                  <DataRow 
                    label="Billing contact" 
                    valueNode={
                      <div>
                        <p>{billingEmail || 'None'}</p>
                        <p className="text-[10px] text-fg-subtle mt-0.5">Where renewal and usage warnings are sent.</p>
                      </div>
                    } 
                  />
                </div>
              )}
            </SectionCard>

            <SectionCard title="Plan & License" icon={<IconPlan className="w-4 h-4" />}>
              <div className="flex flex-col h-full justify-center space-y-2">
                <DataRow label="Plan" value={licence?.planLabel || org.plan} />
                <DataRow 
                  label="Status" 
                  valueNode={
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${licence?.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {licence?.status === 'active' ? 'Active' : licence?.status || 'Unknown'}
                    </span>
                  } 
                />
                <DataRow 
                  label="Renews" 
                  valueNode={
                    licence?.expiresAt ? (
                      <div className="flex items-center gap-2">
                        <span>{formatDate(licence.expiresAt)}</span>
                        {licence.daysLeft != null && (
                          <span className={` rounded text-xs font-semibold ${licence.daysLeft <= 14 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {licence.daysLeft} days left
                          </span>
                        )}
                      </div>
                    ) : 'No expiry'
                  } 
                />
                <DataRow 
                  label="Usage" 
                
                  actionNode={<Link to="/admin" className="text-xs font-semibold text-indigo-600 hover:underline">View usage &rarr;</Link>}
                />
              </div>
            </SectionCard>

            <SectionCard title="Access Policy" icon={<IconShield className="w-4 h-4" />}>
               <div className="flex flex-col h-full justify-center space-y-2">
                <DataRow 
                  label="Allowed sign-in domains" 
                  valueNode={domainCount ? org.allowedDomains.map(d => `@${d}`).join(', ') : 'Unrestricted'} 
                />
                <DataRow 
                  label="External users" 
                  valueNode={
                    <span className="inline-flex items-center gap-2">
                      <div className={`w-8 h-4 rounded-full flex items-center p-0.5 ${org.features?.externalUsers ? 'bg-indigo-600' : 'bg-surface-3'}`}>
                        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform ${org.features?.externalUsers ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                      <span className="text-xs text-fg-muted">{org.features?.externalUsers ? 'On' : 'Off'}</span>
                    </span>
                  }
                />
                <DataRow 
                  label="Departments" 
                  valueNode={
                     <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs font-semibold">{deptCount} teams</span>
                  }
                />
              </div>
            </SectionCard>
          </div>

          {/* Bottom Row */}
          <div className={`grid grid-cols-1 ${user?.dmsEnabled !== false ? 'lg:grid-cols-2' : ''} gap-6`}>
            {user?.dmsEnabled !== false && (
              <SectionCard 
                title="Document Storage (DMS)" 
              icon={<IconPlan className="w-4 h-4" />}
            >
              <div className="flex flex-col 2xl:flex-row 2xl:items-center gap-6 h-full">
                <div className="flex-1 space-y-4 w-full">
                  <DataRow 
                    label="Connection" 
                    valueNode={
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${dmsStatus?.connected ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dmsStatus?.connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {dmsStatus?.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    } 
                  />
                  <DataRow 
                    label="Org folder" 
                    valueNode={<span className="font-mono text-xs bg-surface-2 px-1.5 py-0.5 rounded border border-line">{dmsStatus?.orgSlug || 'N/A'}/</span>} 
                  />
                  <DataRow label="Storage used" value={formatSize(usedKb)} />
                  <DataRow label="Documents" value={dmsStatus?.storage?.documentCount?.toLocaleString() || 0} />
                </div>
                
                <div className="flex-1 border-t 2xl:border-t-0 2xl:border-l border-line pt-6 2xl:pt-2 2xl:pl-8 w-full">
                  <p className="text-xs font-semibold text-fg-muted mb-4">Storage Overview</p>
                  <div className="flex items-center gap-6">
                    <div className="w-32 h-32 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={55}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val) => formatSize(val)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-sm font-bold text-fg">{formatSize(usedKb)}</span>
                        <span className="text-[10px] text-fg-muted">Used</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-600" />
                        <span className="text-fg font-medium">Used</span>
                        <span className="ml-auto font-semibold">{formatSize(usedKb)}</span>
                      </div>
                      {hasLimit ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-600" />
                            <span className="text-fg-muted font-medium">Available</span>
                            <span className="ml-auto font-semibold">{formatSize(availableKb)}</span>
                          </div>
                          <div className="mt-1 pt-2 border-t border-line flex items-center justify-between font-semibold gap-1">
                            <span className="text-fg">Total Storage</span>
                            <span>{formatSize(limitKb)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="mt-1 pt-2 border-t border-line flex items-center justify-between gap-2 font-semibold text-emerald-600">
                          <span>Total Storage</span>
                          <span className='text-red-600'>Failed to Load</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
            )}

            <SectionCard 
              title="Recent Organization Activity" 
              icon={<IconActivity className="w-4 h-4" />}
              action={<Link to="/audit" className="text-xs font-semibold text-indigo-600 hover:underline">View all activity &rarr;</Link>}
            >
              {recentActivity.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-fg-muted">No recent activity</div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((log) => {
                    // Extract initials from performedBy.name
                    const initials = log.performedBy?.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'S'
                    
                    let statusLabel = null;
                    if (log.action.includes('error')) statusLabel = <span className="ml-2 bg-rose-50 text-rose-600 px-1.5 rounded text-[10px] ring-1 ring-rose-200">Failed</span>;
                    else if (log.action.includes('success')) statusLabel = <span className="ml-2 bg-emerald-50 text-emerald-600 px-1.5 rounded text-[10px] ring-1 ring-emerald-200">Success</span>;
                    
                    return (
                      <div key={log._id} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0 ring-1 ring-indigo-200">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-fg">
                            <span className="font-semibold">{log.performedBy?.name || 'System'}</span> {log.action.replace(/_/g, ' ')}
                            {statusLabel}
                          </p>
                          <p className="text-[11px] text-fg-muted mt-0.5">{formatDateTime(log.createdAt)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </AppShell>
  )
}
