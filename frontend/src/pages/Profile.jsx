// Shared - Profile.jsx
// Lets any logged-in user see their own account details: name, email, role,
// department, who their reporting manager is, and who their HR partner is.
// Reads GET /api/users/me/profile (role + manager + HR populated) and falls back
// to the cached auth user while loading.

import React, { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { useUser, initials, ROLE_LABELS } from '../utils/auth'

const toDateInput = (d) => {
  if (!d) return ''
  try { return new Date(d).toISOString().slice(0, 10) } catch { return '' }
}

// Tunable notification events (kept in sync with server/utils/notificationPrefs).
const NOTIFICATION_EVENTS = [
  { key: 'assignment', title: 'Task assigned to me', description: 'A new approval, review, or submission task is routed to you.' },
  { key: 'approval', title: 'My request was approved', description: 'A request you submitted moves forward after approval.' },
  { key: 'rejection', title: 'My request was rejected', description: 'A request you submitted is rejected or sent back.' },
  { key: 'escalation', title: 'Task escalated to me', description: 'An overdue task is escalated to you as a manager/admin.' }
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

function Row({ label, value, hint }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 py-3">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="sm:col-span-2 text-sm text-fg font-medium break-words">
        {value || <span className="text-fg-subtle font-normal">{hint || 'Not set'}</span>}
      </dd>
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
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-60 ${on ? 'bg-indigo-600' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow transition ${on ? 'translate-x-4' : 'translate-x-1'}`} />
    </button>
  )
}

function Profile() {
  const cached = useUser()
  const [profile, setProfile] = useState(cached)
  const [reports, setReports] = useState([])
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

    api.get('/api/users?isActive=true&limit=1000')
      .then((data) => { if (!cancelled) setActiveUsers(data.users || []) })
      .catch((e) => console.error('Failed to load active users:', e))

    api.get('/api/auth/mfa/status')
      .then((data) => { if (!cancelled) setMfa({ enabled: !!data.enabled, required: !!data.required }) })
      .catch(() => { /* non-fatal */ })

    return () => { cancelled = true }
  }, [])

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

  return (
    <AppShell title="My profile" subtitle="Your account details and reporting line">
      {error && (
        <div className="mb-4 p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="max-w-2xl space-y-4">
        <section className="bg-surface border border-line rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xl font-semibold">
              {initials(user?.name)}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-fg truncate">{user?.name || 'Guest'}</h2>
              <p className="text-sm text-fg-muted truncate">{user?.email || ''}</p>
              <span className="inline-flex mt-1.5 items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700">
                {roleLabel}
              </span>
            </div>
          </div>
        </section>

        <section className="bg-surface border border-line rounded-xl px-6 py-2">
          <dl className="divide-y divide-line">
            <Row label="Full name" value={user?.name} />
            <Row label="Email" value={user?.email} />
            <Row label="Role" value={roleLabel} />
            <Row label="Department" value={user?.department} />
            <Row label="Account status" value={user?.isActive === false ? 'Inactive' : 'Active'} />
            <Row label="Member since" value={joined} hint={loading ? 'Loading…' : 'Unknown'} />
            <Row label="Last login" value={lastLogin} hint={loading ? 'Loading…' : 'Never'} />
          </dl>
        </section>

        <section className="bg-surface border border-line rounded-xl px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-fg">
                Two-factor authentication
                {mfa.enabled && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700">On</span>
                )}
              </h3>
              <p className="text-xs text-fg-muted mt-0.5">
                Add a second step at sign-in using an authenticator app (Google Authenticator, Authy).
                {mfa.required && <span className="text-amber-700"> Required for admin accounts.</span>}
              </p>
            </div>
            {mfaStep === 'idle' && !mfa.enabled && (
              <button
                type="button"
                onClick={startMfaSetup}
                disabled={mfaBusy}
                className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {mfaBusy ? 'Starting…' : 'Enable'}
              </button>
            )}
          </div>

          {mfaMsg && <p className="mt-2 text-xs text-fg-muted">{mfaMsg}</p>}

          {mfaStep === 'setup' && (
            <div className="mt-4 flex flex-col items-start gap-3">
              {mfaSetup?.qr && (
                <div className="flex flex-col items-center">
                  <img src={mfaSetup.qr} alt="MFA QR code" className="w-40 h-40 rounded-lg border border-line" />
                  <p className="mt-1 text-[11px] text-fg-subtle">Or enter this key manually:</p>
                  <code className="text-xs font-mono text-fg-muted break-all">{mfaSetup.manualKey}</code>
                </div>
              )}
              <div className="w-full max-w-xs">
                <input
                  inputMode="numeric"
                  value={mfaCode}
                  onChange={(e) => { setMfaCode(e.target.value); setMfaMsg('') }}
                  placeholder="Enter 6-digit code"
                  className="w-full rounded-md border border-line px-2 py-1.5 text-sm text-center tracking-widest focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button type="button" onClick={confirmMfaEnable} disabled={mfaBusy}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                    {mfaBusy ? 'Verifying…' : 'Verify & enable'}
                  </button>
                  <button type="button" onClick={cancelMfa}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-fg-muted hover:text-fg">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {mfaStep === 'backup' && (
            <div className="mt-4">
              <p className="text-xs text-fg-muted mb-2">
                Save these one-time backup codes somewhere safe — each works once if you lose your app.
              </p>
              <div className="grid grid-cols-2 gap-2 p-4 rounded-lg bg-surface-2 border border-line max-w-xs">
                {mfaBackup.map((c) => (
                  <code key={c} className="text-sm font-mono text-fg text-center">{c}</code>
                ))}
              </div>
              <button type="button" onClick={cancelMfa}
                className="mt-3 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                Done
              </button>
            </div>
          )}

          {mfaStep === 'idle' && mfa.enabled && !mfa.required && (
            <div className="mt-4 max-w-xs">
              <p className="text-xs text-fg-muted mb-2">Enter a current code to turn off two-factor auth.</p>
              <input
                inputMode="numeric"
                value={mfaCode}
                onChange={(e) => { setMfaCode(e.target.value); setMfaMsg('') }}
                placeholder="6-digit or backup code"
                className="w-full rounded-md border border-line px-2 py-1.5 text-sm text-center tracking-widest focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button type="button" onClick={disableMfa} disabled={mfaBusy}
                className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60">
                {mfaBusy ? 'Disabling…' : 'Disable two-factor'}
              </button>
            </div>
          )}

          {mfaStep === 'idle' && mfa.enabled && mfa.required && (
            <p className="mt-3 text-xs text-fg-muted">
              Two-factor authentication is required for your admin account and can't be turned off.
            </p>
          )}
        </section>

        <section className="bg-surface border border-line rounded-xl px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-fg">Out of office</h3>
              <p className="text-xs text-fg-muted mt-0.5">
                While you&rsquo;re away, new approvals assigned to you will be routed to your chosen delegate.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={ooo.enabled}
              onClick={toggleOoo}
              disabled={oooSaving}
              title={ooo.enabled ? 'Turn off' : 'Turn on'}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${ooo.enabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition ${ooo.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>

          {ooo.enabled && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-fg-muted">
                  From (optional)
                  <input
                    type="date"
                    value={ooo.from}
                    onChange={(e) => setOoo((p) => ({ ...p, from: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-fg focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </label>
                <label className="block text-xs font-medium text-fg-muted">
                  Until (optional)
                  <input
                    type="date"
                    value={ooo.until}
                    onChange={(e) => setOoo((p) => ({ ...p, until: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-fg focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-fg-muted">
                Note (optional)
                <input
                  type="text"
                  value={ooo.note}
                  onChange={(e) => setOoo((p) => ({ ...p, note: e.target.value }))}
                  placeholder="e.g. On annual leave"
                  className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-fg focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>

              <label className="block text-xs font-medium text-fg-muted">
                Delegate
                <select
                  value={ooo.delegateId}
                  onChange={(e) => setOoo((p) => ({ ...p, delegateId: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-fg focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-surface"
                >
                  <option value="">Select a delegate...</option>
                  {activeUsers.filter(u => u._id !== user?._id).map(u => (
                    <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </label>

              <div className="rounded-md border border-line bg-surface-2 px-3 py-2 text-xs">
                {ooo.delegateId ? (
                  <span className="text-fg-muted">
                    Approvals will be routed to your selected delegate.
                  </span>
                ) : (
                  <span className="text-amber-700">
                    You have no delegate set. Approvals will not be redirected. Please select a delegate.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => saveOoo()}
                  disabled={oooSaving}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {oooSaving ? 'Saving…' : 'Save dates'}
                </button>
                {oooMsg && <span className="text-xs text-fg-muted">{oooMsg}</span>}
              </div>
            </div>
          )}

          {!ooo.enabled && oooMsg && <p className="mt-2 text-xs text-fg-muted">{oooMsg}</p>}
        </section>

        <section className="bg-surface border border-line rounded-xl px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-fg">Notification preferences</h3>
              <p className="text-xs text-fg-muted mt-0.5">
                Choose how you&rsquo;re notified for each event. Security emails (like password resets) are always sent.
              </p>
            </div>
            {prefsMsg && <span className="shrink-0 mt-0.5 text-xs text-fg-muted">{prefsMsg}</span>}
          </div>

          <div className="mt-4">
            <div className="flex items-center px-1 pb-2 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
              <div className="flex-1">Event</div>
              <div className="w-14 text-center">In-app</div>
              <div className="w-14 text-center">Email</div>
            </div>
            <div className="divide-y divide-line">
              {NOTIFICATION_EVENTS.map((ev) => (
                <div key={ev.key} className="flex items-center px-1 py-3">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-sm font-medium text-fg">{ev.title}</p>
                    <p className="text-xs text-fg-muted">{ev.description}</p>
                  </div>
                  <div className="w-14 flex justify-center">
                    <ChannelToggle
                      on={notifPrefs[ev.key].inApp}
                      disabled={prefsSaving}
                      onClick={() => toggleNotif(ev.key, 'inApp')}
                      label={`In-app notifications for: ${ev.title}`}
                    />
                  </div>
                  <div className="w-14 flex justify-center">
                    <ChannelToggle
                      on={notifPrefs[ev.key].email}
                      disabled={prefsSaving}
                      onClick={() => toggleNotif(ev.key, 'email')}
                      label={`Email notifications for: ${ev.title}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-surface border border-line rounded-xl px-6 py-5">
          <h3 className="text-sm font-semibold text-fg mb-3">Reporting manager</h3>
          {manager ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-sm font-semibold">
                {initials(manager.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg truncate">{manager.name}</p>
                <p className="text-xs text-fg-muted truncate">
                  {manager.email}
                  {manager.department ? ` · ${manager.department}` : ''}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-fg-muted">
              {loading
                ? 'Loading…'
                : 'No manager assigned yet. Ask an admin to set your reporting manager in the Admin Panel.'}
            </p>
          )}
        </section>

        <section className="bg-surface border border-line rounded-xl px-6 py-5">
          <h3 className="text-sm font-semibold text-fg mb-3">Your HR partner</h3>
          {hr ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-sm font-semibold">
                {initials(hr.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg truncate">{hr.name}</p>
                <p className="text-xs text-fg-muted truncate">
                  {hr.email}
                  {hr.department ? ` · ${hr.department}` : ''}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-fg-muted">
              {loading
                ? 'Loading…'
                : 'No HR partner assigned yet. Ask an admin to set your HR partner in the Admin Panel.'}
            </p>
          )}
        </section>

        <section className="bg-surface border border-line rounded-xl px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-fg">People reporting to you</h3>
            {reports.length > 0 && (
              <span className="text-xs font-medium text-fg-muted">
                {reports.length} {reports.length === 1 ? 'report' : 'reports'}
              </span>
            )}
          </div>
          {reports.length === 0 ? (
            <p className="text-sm text-fg-muted">
              {loading ? 'Loading…' : 'No one reports to you yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {reports.map((r) => (
                <li key={r._id} className="flex items-center gap-3 py-2.5">
                  <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-semibold shrink-0">
                    {initials(r.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg truncate">
                      {r.name}
                      {r.isActive === false && (
                        <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-fg-subtle">Inactive</span>
                      )}
                    </p>
                    <p className="text-xs text-fg-muted truncate">{r.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {r.role?.name && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-3 text-fg-muted">
                        {ROLE_LABELS[r.role.name] || r.role.name}
                      </span>
                    )}
                    {r.department && (
                      <p className="text-[11px] text-fg-subtle mt-0.5">{r.department}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  )
}

export default Profile
