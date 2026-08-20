import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { authStore, useUser, initials, ROLE_LABELS } from '../utils/auth'
import { isOrgAdmin, isPlatformShell } from '../utils/permissions'
import { Skeleton } from '../components/Skeleton'
import { AlertBanner } from '../components/Alert'
import { CHIP_CLASS, formatDate, licenceChip } from '../lib/licensing'

// Shortcuts for Workflow Admin — matches what the org-admin shell is for.
const ADMIN_SHORTCUTS = [
  { to: '/admin', label: 'Users', hint: 'People & seats' },
  { to: '/departments', label: 'Departments', hint: 'Teams & routing' },
  { to: '/roles', label: 'Roles', hint: 'Permissions' },
  { to: '/settings', label: 'Organization', hint: 'Name & billing' },
  { to: '/forms', label: 'Forms', hint: 'Form library' },
  { to: '/workflows', label: 'Workflows', hint: 'Builder' },
  { to: '/analytics', label: 'Reports', hint: 'Analytics' },
  { to: '/audit-log', label: 'Audit log', hint: 'Change history' },
]

const toDateInput = (d) => {
  if (!d) return ''
  try { return new Date(d).toISOString().slice(0, 10) } catch { return '' }
}

// Tunable notification events (kept in sync with server/utils/notificationPrefs).
const NOTIFICATION_EVENTS = [
  { key: 'assignment', title: 'Task assigned to me' },
  { key: 'approval', title: 'My request was approved' },
  { key: 'rejection', title: 'My request was rejected' },
  { key: 'escalation', title: 'Task escalated to me' }
]

const defaultNotifPrefs = () =>
  NOTIFICATION_EVENTS.reduce((acc, e) => { acc[e.key] = { inApp: true, email: true }; return acc }, {})

// Merge stored prefs over defaults so legacy users (no field yet) show "both on".
const mergeNotifPrefs = (stored) => {
  const src = stored || {}
  return NOTIFICATION_EVENTS.reduce((acc, e) => {
    const p = src[e.key] || {}
    acc[e.key] = { inApp: p.inApp !== false, email: p.email !== false }
    return acc
  }, {})
}

const fieldCls =
  'mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg focus:border-indigo-400 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 transition'

function Card({ title, action, children, className = '', bodyClass = 'px-5 py-4' }) {
  const hasBody = children != null && children !== false
  return (
    <section className={`bg-surface border border-line rounded-xl shadow-sm overflow-hidden ${className}`}>
      {(title || action) && (
        <div className={`px-5 py-3.5 flex items-center justify-between gap-3 ${hasBody ? 'border-b border-line bg-surface-2/40' : 'bg-surface'}`}>
          {title ? <h3 className="text-sm font-semibold text-fg min-w-0">{title}</h3> : <span />}
          {action}
        </div>
      )}
      {hasBody && <div className={bodyClass}>{children}</div>}
    </section>
  )
}

function PersonTile({ person, empty, loading, tone = 'muted' }) {
  if (loading) return <Skeleton className="h-12 w-full rounded-lg" />
  if (!person) return <p className="text-sm text-fg-muted">{empty}</p>
  const avatar =
    tone === 'success'
      ? 'bg-success-subtle text-success-fg'
      : 'bg-surface-3 text-fg-muted'
  return (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${avatar}`}>
        {initials(person.name)}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-fg truncate">{person.name}</p>
        <p className="text-xs text-fg-muted truncate">
          {person.email}
          {person.department ? ` · ${person.department}` : ''}
        </p>
      </div>
    </div>
  )
}

// Compact on/off switch used for each notification channel cell.
function ChannelToggle({ on, onClick, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      title={on ? 'On' : 'Off'}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-60 ${on ? 'bg-indigo-600' : 'bg-surface-3'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow transition ${on ? 'translate-x-4' : 'translate-x-1'}`} />
    </button>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-line last:border-0">
      <dt className="text-xs text-fg-muted shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-fg text-right min-w-0 max-w-[70%]">
        {value || '—'}
      </dd>
    </div>
  )
}

function AdminWorkspaceCard({ org, loading }) {
  const licence = org?.licence
  const chip = licenceChip(licence)
  const licenceLabel = !licence
    ? '—'
    : licence.status === 'active'
      ? 'Active'
      : licence.status === 'grace'
        ? 'Grace period'
        : licence.status === 'suspended'
          ? 'Suspended'
          : 'Expired'
  const expiryHint = licence?.expiresAt
    ? `${licence.isTrial ? 'Trial ends' : 'Renews'} ${formatDate(licence.expiresAt)}`
    : licence
      ? 'Perpetual'
      : ''

  return (
    <Card
      title="Workspace"
      action={
        <Link to="/settings" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          Settings
        </Link>
      }
    >
      {loading && !org ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-36" />
        </div>
      ) : (
        <>
          <div className="mb-3">
            <p className="text-base font-semibold text-fg truncate">{org?.name || '—'}</p>
            {org?.subdomain && (
              <p className="text-xs text-fg-muted mt-0.5 truncate">{org.subdomain}</p>
            )}
          </div>
          <dl>
            <DetailRow
              label="Plan"
              value={licence?.planLabel || org?.plan || '—'}
            />
            <DetailRow
              label="Licence"
              value={
                <span className="inline-flex items-center gap-2">
                  {chip && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${CHIP_CLASS[chip.tone]}`}>
                      {chip.label}
                    </span>
                  )}
                  <span>{licenceLabel}{expiryHint ? ` · ${expiryHint}` : ''}</span>
                </span>
              }
            />
            <DetailRow label="Billing contact" value={org?.billingEmail} />
            <DetailRow
              label="Departments"
              value={org?.departments?.length != null ? String(org.departments.length) : '—'}
            />
          </dl>
        </>
      )}
    </Card>
  )
}

function AdminShortcutsCard() {
  return (
    <Card title="Manage">
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-1 -mx-1">
        {ADMIN_SHORTCUTS.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="flex flex-col px-3 py-2.5 rounded-lg hover:bg-surface-2 transition h-full"
            >
              <span className="text-sm font-medium text-fg">{item.label}</span>
              <span className="text-[11px] text-fg-muted">{item.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Profile() {
  const navigate = useNavigate()
  const cached = useUser()
  const platform = isPlatformShell(cached)
  const orgAdmin = isOrgAdmin(cached)
  // Org admins design/configure the tenant — not the day-to-day approval loop.
  const showReportingLine = !platform && !orgAdmin
  const showTaskPrefs = !platform && !orgAdmin
  const showAdminTools = orgAdmin
  const [profile, setProfile] = useState(cached)
  const [reports, setReports] = useState([])
  const [org, setOrg] = useState(null)
  const [orgLoading, setOrgLoading] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Out-of-office state (seeded from the loaded profile).
  const [ooo, setOoo] = useState({ enabled: false, from: '', until: '', note: '', delegateId: '' })
  const [oooSaving, setOooSaving] = useState(false)
  const [oooMsg, setOooMsg] = useState('')
  const [activeUsers, setActiveUsers] = useState([])

  const [notifPrefs, setNotifPrefs] = useState(defaultNotifPrefs)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsMsg, setPrefsMsg] = useState('')

  // Two-factor (MFA) state.
  const [mfa, setMfa] = useState({ enabled: false, required: false })
  const [mfaStep, setMfaStep] = useState('idle')     // idle | setup | backup
  const [mfaSetup, setMfaSetup] = useState(null)     // { qr, manualKey }
  const [mfaCode, setMfaCode] = useState('')
  const [mfaBackup, setMfaBackup] = useState([])
  const [mfaMsg, setMfaMsg] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.get('/api/users/me/profile')
      .then((data) => {
        if (cancelled) return
        setProfile(data.user)
        setReports(data.reports || [])
        const o = data.user?.outOfOffice || {}
        setOoo({
          enabled: !!o.enabled,
          from: toDateInput(o.from),
          until: toDateInput(o.until),
          note: o.note || '',
          delegateId: typeof o.delegateId === 'object' ? (o.delegateId?._id || '') : (o.delegateId || '')
        })
        setNotifPrefs(mergeNotifPrefs(data.user?.notificationPrefs))
      })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load profile') })
      .finally(() => { if (!cancelled) setLoading(false) })

    // Delegate picker for OOO — only roles that sit in the approval loop.
    if (showTaskPrefs) {
      api.get('/api/users?isActive=true&limit=1000')
        .then((data) => { if (!cancelled) setActiveUsers(data.users || []) })
        .catch((e) => console.error('Failed to load active users:', e))
    }

    if (showAdminTools) {
      setOrgLoading(true)
      api.get('/api/organization')
        .then((data) => { if (!cancelled) setOrg(data.organization || null) })
        .catch(() => { /* non-fatal — profile still works without org summary */ })
        .finally(() => { if (!cancelled) setOrgLoading(false) })
    }

    api.get('/api/auth/mfa/status')
      .then((data) => { if (!cancelled) setMfa({ enabled: !!data.enabled, required: !!data.required }) })
      .catch(() => { /* non-fatal */ })

    return () => { cancelled = true }
  }, [platform, showTaskPrefs, showAdminTools])

  const startMfaSetup = async () => {
    setMfaBusy(true); setMfaMsg('')
    try {
      const d = await api.post('/api/auth/mfa/setup', {})
      setMfaSetup(d)
      setMfaCode('')
      setMfaStep('setup')
    } catch (e) {
      setMfaMsg(e.message || 'Could not start setup')
    } finally {
      setMfaBusy(false)
    }
  }

  const confirmMfaEnable = async () => {
    if (!mfaCode.trim()) return setMfaMsg('Enter the 6-digit code from your app')
    setMfaBusy(true); setMfaMsg('')
    try {
      const d = await api.post('/api/auth/mfa/enable', { code: mfaCode.trim() })
      setMfaBackup(d.backupCodes || [])
      setMfa((p) => ({ ...p, enabled: true }))
      setMfaStep('backup')
    } catch (e) {
      setMfaMsg(e.message || 'Invalid code')
    } finally {
      setMfaBusy(false)
    }
  }

  const disableMfa = async () => {
    if (!mfaCode.trim()) return setMfaMsg('Enter a current code to confirm')
    setMfaBusy(true); setMfaMsg('')
    try {
      await api.post('/api/auth/mfa/disable', { code: mfaCode.trim() })
      setMfa((p) => ({ ...p, enabled: false }))
      setMfaStep('idle')
      setMfaCode('')
      setMfaMsg('Two-factor authentication disabled')
    } catch (e) {
      setMfaMsg(e.message || 'Invalid code')
    } finally {
      setMfaBusy(false)
    }
  }

  const cancelMfa = () => {
    setMfaStep('idle'); setMfaSetup(null); setMfaCode(''); setMfaMsg(''); setMfaBackup([])
  }

  const user = profile || cached
  const roleName = user?.role?.name
  const roleLabel = roleName ? (ROLE_LABELS[roleName] || roleName) : '—'
  const manager = user?.managerId && typeof user.managerId === 'object' ? user.managerId : null
  const hr = user?.hrId && typeof user.hrId === 'object' ? user.hrId : null

  const saveOoo = async (next = ooo) => {
    setOooSaving(true)
    setOooMsg('')
    try {
      const data = await api.put('/api/users/me/out-of-office', {
        enabled: next.enabled,
        from: next.from || null,
        until: next.until || null,
        note: next.note || null,
        delegateId: next.delegateId || null
      })
      setProfile(data.user)
      setOooMsg('Saved')
      setTimeout(() => setOooMsg(''), 2500)
    } catch (e) {
      setOooMsg(e.message || 'Could not save')
    } finally {
      setOooSaving(false)
    }
  }

  const toggleOoo = () => {
    const next = { ...ooo, enabled: !ooo.enabled }
    setOoo(next)
    saveOoo(next)
  }

  const toggleNotif = async (key, channel) => {
    const prev = notifPrefs
    const next = {
      ...notifPrefs,
      [key]: { ...notifPrefs[key], [channel]: !notifPrefs[key][channel] }
    }
    setNotifPrefs(next)
    setPrefsSaving(true)
    setPrefsMsg('')
    try {
      const data = await api.put('/api/users/me/notification-prefs', { notificationPrefs: next })
      if (data.user?.notificationPrefs) setNotifPrefs(mergeNotifPrefs(data.user.notificationPrefs))
      setPrefsMsg('Saved')
      setTimeout(() => setPrefsMsg(''), 2000)
    } catch (e) {
      setNotifPrefs(prev)
      setPrefsMsg(e.message || 'Could not save')
    } finally {
      setPrefsSaving(false)
    }
  }

  const joined = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null
  const lastLogin = user?.lastLogin
    ? new Date(user.lastLogin).toLocaleString()
    : null

  const accountActive = user?.isActive !== false
  const twoCol = showTaskPrefs || showReportingLine || showAdminTools

  return (
    <AppShell
      title="My profile"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => authStore.logout(true).then(() => navigate('/login'))}
            className="px-4 py-2 rounded-lg border border-danger-subtle bg-danger-subtle hover:bg-danger-subtle/80 text-sm font-medium text-danger-fg transition"
          >
            Sign out of all devices
          </button>
          <Link
            to="/change-password"
            className="px-4 py-2 rounded-lg border border-line hover:bg-surface-2 text-sm font-medium text-fg transition"
          >
            Change password
          </Link>
        </div>
      }
      mainClass="flex-1 min-h-0 flex flex-col p-4 md:p-6 pb-24 md:pb-6 overflow-hidden"
    >
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-2">
        {error && <AlertBanner>{error}</AlertBanner>}

        <div className={twoCol
          ? 'grid grid-cols-1 xl:grid-cols-5 gap-4'
          : 'max-w-2xl space-y-4'
        }>
          <div className={twoCol ? 'xl:col-span-3 space-y-4 min-w-0' : 'space-y-4 min-w-0'}>
            <Card bodyClass="p-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-semibold shadow-sm">
                  {initials(user?.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-fg truncate">{user?.name || 'Guest'}</h2>
                  <p className="text-sm text-fg-muted truncate">{user?.email || ''}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-info-subtle text-info-fg">
                      {roleLabel}
                    </span>
                    {!platform && user?.department && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-3 text-fg-muted">
                        {user.department}
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      accountActive ? 'bg-success-subtle text-success-fg' : 'bg-danger-subtle text-danger-fg'
                    }`}>
                      {accountActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-fg-muted">
                    <div>Member since <span className="text-fg font-medium">{joined || (loading ? '…' : '—')}</span></div>
                    <div>Last login <span className="text-fg font-medium">{lastLogin || (loading ? '…' : 'Never')}</span></div>
                  </dl>
                </div>
              </div>
            </Card>

            {(() => {
              const mfaBody = (
                <>
                  {mfaMsg && <p className="mb-3 text-xs text-fg-muted">{mfaMsg}</p>}

                  {mfaStep === 'setup' && (
                    <div className="flex flex-col sm:flex-row items-start gap-4">
                      {mfaSetup?.qr && (
                        <div className="flex flex-col items-center shrink-0">
                          <img src={mfaSetup.qr} alt="MFA QR code" className="w-40 h-40 rounded-xl border border-line bg-surface" />
                          <code className="mt-2 text-xs font-mono text-fg-muted break-all text-center max-w-[12rem]">{mfaSetup.manualKey}</code>
                        </div>
                      )}
                      <div className="w-full max-w-xs space-y-2">
                        <input
                          inputMode="numeric"
                          value={mfaCode}
                          onChange={(e) => { setMfaCode(e.target.value); setMfaMsg('') }}
                          placeholder="6-digit code"
                          className={`${fieldCls} text-center tracking-widest`}
                        />
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={confirmMfaEnable} disabled={mfaBusy}
                            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                            {mfaBusy ? 'Verifying…' : 'Verify & enable'}
                          </button>
                          <button type="button" onClick={cancelMfa}
                            className="rounded-lg px-3 py-2 text-sm font-medium text-fg-muted hover:text-fg hover:bg-surface-2">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {mfaStep === 'backup' && (
                    <div>
                      <p className="text-xs text-fg-muted mb-2">Save these backup codes somewhere safe.</p>
                      <div className="grid grid-cols-2 gap-2 p-4 rounded-xl bg-surface-2 border border-line max-w-xs">
                        {mfaBackup.map((c) => (
                          <code key={c} className="text-sm font-mono text-fg text-center">{c}</code>
                        ))}
                      </div>
                      <button type="button" onClick={cancelMfa}
                        className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                        Done
                      </button>
                    </div>
                  )}

                  {mfaStep === 'idle' && mfa.enabled && (
                    <div className="max-w-xs space-y-2">
                      <input
                        inputMode="numeric"
                        value={mfaCode}
                        onChange={(e) => { setMfaCode(e.target.value); setMfaMsg('') }}
                        placeholder="Code to disable"
                        className={`${fieldCls} text-center tracking-widest`}
                      />
                      <button type="button" onClick={disableMfa} disabled={mfaBusy}
                        className="rounded-lg border border-danger-line bg-danger-subtle px-3 py-2 text-sm font-semibold text-danger-fg hover:brightness-95 disabled:opacity-60">
                        {mfaBusy ? 'Disabling…' : 'Disable'}
                      </button>
                    </div>
                  )}
                </>
              )
              const mfaHasBody = Boolean(
                mfaMsg || mfaStep === 'setup' || mfaStep === 'backup' || (mfaStep === 'idle' && mfa.enabled)
              )

              return (
                <Card
                  title="Two-factor authentication"
                  action={
                    mfa.enabled ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-success-subtle text-success-fg">
                        On
                      </span>
                    ) : mfaStep === 'idle' ? (
                      <button
                        type="button"
                        onClick={startMfaSetup}
                        disabled={mfaBusy}
                        className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {mfaBusy ? 'Starting…' : 'Enable'}
                      </button>
                    ) : null
                  }
                >
                  {mfaHasBody ? mfaBody : null}
                </Card>
              )
            })()}

            {showAdminTools && <AdminShortcutsCard />}

            {showTaskPrefs && (
              <Card
                title="Out of office"
                action={
                  <button
                    type="button"
                    role="switch"
                    aria-checked={ooo.enabled}
                    onClick={toggleOoo}
                    disabled={oooSaving}
                    title={ooo.enabled ? 'Turn off' : 'Turn on'}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${ooo.enabled ? 'bg-indigo-600' : 'bg-surface-3'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition ${ooo.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                }
              >
                {ooo.enabled ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs font-semibold text-fg-muted">
                        From
                        <input type="date" value={ooo.from}
                          onChange={(e) => setOoo((p) => ({ ...p, from: e.target.value }))}
                          className={fieldCls} />
                      </label>
                      <label className="block text-xs font-semibold text-fg-muted">
                        Until
                        <input type="date" value={ooo.until}
                          onChange={(e) => setOoo((p) => ({ ...p, until: e.target.value }))}
                          className={fieldCls} />
                      </label>
                    </div>
                    <label className="block text-xs font-semibold text-fg-muted">
                      Note
                      <input type="text" value={ooo.note}
                        onChange={(e) => setOoo((p) => ({ ...p, note: e.target.value }))}
                        placeholder="Optional"
                        className={fieldCls} />
                    </label>
                    <label className="block text-xs font-semibold text-fg-muted">
                      Delegate
                      <select value={ooo.delegateId}
                        onChange={(e) => setOoo((p) => ({ ...p, delegateId: e.target.value }))}
                        className={fieldCls}>
                        <option value="">Select…</option>
                        {activeUsers.filter((u) => u._id !== user?._id).map((u) => (
                          <option key={u._id} value={u._id}>{u.name}</option>
                        ))}
                      </select>
                    </label>
                    {!ooo.delegateId && (
                      <p className="text-xs text-warning-fg">Select a delegate so approvals can be redirected.</p>
                    )}
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => saveOoo()} disabled={oooSaving}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                        {oooSaving ? 'Saving…' : 'Save'}
                      </button>
                      {oooMsg && <span className="text-xs text-fg-muted">{oooMsg}</span>}
                    </div>
                  </div>
                ) : oooMsg ? (
                  <p className="text-xs text-fg-muted">{oooMsg}</p>
                ) : null}
              </Card>
            )}
          </div>

          {(showTaskPrefs || showReportingLine || showAdminTools) && (
            <div className="xl:col-span-2 space-y-4 min-w-0">
              {showAdminTools && (
                <AdminWorkspaceCard org={org} loading={orgLoading} />
              )}

              {showTaskPrefs && (
                <Card
                  title="Notifications"
                  action={prefsMsg ? <span className="text-xs text-fg-muted">{prefsMsg}</span> : null}
                >
                  <div className="flex items-center pb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                    <div className="flex-1">Event</div>
                    <div className="w-14 text-center">In-app</div>
                    <div className="w-14 text-center">Email</div>
                  </div>
                  <div className="divide-y divide-line -mx-1">
                    {NOTIFICATION_EVENTS.map((ev) => (
                      <div key={ev.key} className="flex items-center px-1 py-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-sm font-medium text-fg">{ev.title}</p>
                        </div>
                        <div className="w-14 flex justify-center">
                          <ChannelToggle
                            on={notifPrefs[ev.key].inApp}
                            disabled={prefsSaving}
                            onClick={() => toggleNotif(ev.key, 'inApp')}
                            label={`In-app: ${ev.title}`}
                          />
                        </div>
                        <div className="w-14 flex justify-center">
                          <ChannelToggle
                            on={notifPrefs[ev.key].email}
                            disabled={prefsSaving}
                            onClick={() => toggleNotif(ev.key, 'email')}
                            label={`Email: ${ev.title}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {showReportingLine && (
                <>
                  <Card title="Manager">
                    <PersonTile person={manager} loading={loading} empty="Not assigned" />
                  </Card>

                  <Card title="HR partner">
                    <PersonTile person={hr} loading={loading} tone="success" empty="Not assigned" />
                  </Card>

                  <Card
                    title="Reports"
                    action={
                      reports.length > 0 ? (
                        <span className="text-xs font-semibold tabular-nums text-fg-muted">{reports.length}</span>
                      ) : null
                    }
                  >
                    {reports.length === 0 ? (
                      <p className="text-sm text-fg-muted">{loading ? 'Loading…' : 'None'}</p>
                    ) : (
                      <ul className="divide-y divide-line -my-1">
                        {reports.map((r) => (
                          <li key={r._id} className="flex items-center gap-3 py-2.5">
                            <div className="w-9 h-9 rounded-full bg-surface-3 text-fg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                              {initials(r.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-fg truncate">{r.name}</p>
                              <p className="text-xs text-fg-muted truncate">{r.email}</p>
                            </div>
                            {r.role?.name && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-3 text-fg-muted shrink-0">
                                {ROLE_LABELS[r.role.name] || r.role.name}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

export default Profile
