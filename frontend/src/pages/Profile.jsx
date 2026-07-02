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

function Row({ label, value, hint }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-3">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="col-span-2 text-sm text-gray-800 font-medium break-words">
        {value || <span className="text-gray-400 font-normal">{hint || 'Not set'}</span>}
      </dd>
    </div>
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
      })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load profile') })
      .finally(() => { if (!cancelled) setLoading(false) })

    api.get('/api/users?isActive=true&limit=1000')
      .then((data) => { if (!cancelled) setActiveUsers(data.users || []) })
      .catch((e) => console.error('Failed to load active users:', e))

    return () => { cancelled = true }
  }, [])

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
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xl font-semibold">
              {initials(user?.name)}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{user?.name || 'Guest'}</h2>
              <p className="text-sm text-gray-500 truncate">{user?.email || ''}</p>
              <span className="inline-flex mt-1.5 items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700">
                {roleLabel}
              </span>
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl px-6 py-2">
          <dl className="divide-y divide-gray-100">
            <Row label="Full name" value={user?.name} />
            <Row label="Email" value={user?.email} />
            <Row label="Role" value={roleLabel} />
            <Row label="Department" value={user?.department} />
            <Row label="Account status" value={user?.isActive === false ? 'Inactive' : 'Active'} />
            <Row label="Member since" value={joined} hint={loading ? 'Loading…' : 'Unknown'} />
            <Row label="Last login" value={lastLogin} hint={loading ? 'Loading…' : 'Never'} />
          </dl>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-800">Out of office</h3>
              <p className="text-xs text-gray-500 mt-0.5">
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
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${ooo.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>

          {ooo.enabled && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-gray-600">
                  From (optional)
                  <input
                    type="date"
                    value={ooo.from}
                    onChange={(e) => setOoo((p) => ({ ...p, from: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Until (optional)
                  <input
                    type="date"
                    value={ooo.until}
                    onChange={(e) => setOoo((p) => ({ ...p, until: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-gray-600">
                Note (optional)
                <input
                  type="text"
                  value={ooo.note}
                  onChange={(e) => setOoo((p) => ({ ...p, note: e.target.value }))}
                  placeholder="e.g. On annual leave"
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>

              <label className="block text-xs font-medium text-gray-600">
                Delegate
                <select
                  value={ooo.delegateId}
                  onChange={(e) => setOoo((p) => ({ ...p, delegateId: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
                >
                  <option value="">Select a delegate...</option>
                  {activeUsers.filter(u => u._id !== user?._id).map(u => (
                    <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </label>

              <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
                {ooo.delegateId ? (
                  <span className="text-gray-600">
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
                {oooMsg && <span className="text-xs text-gray-500">{oooMsg}</span>}
              </div>
            </div>
          )}

          {!ooo.enabled && oooMsg && <p className="mt-2 text-xs text-gray-500">{oooMsg}</p>}
        </section>

        <section className="bg-white border border-gray-200 rounded-xl px-6 py-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Reporting manager</h3>
          {manager ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-sm font-semibold">
                {initials(manager.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{manager.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {manager.email}
                  {manager.department ? ` · ${manager.department}` : ''}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {loading
                ? 'Loading…'
                : 'No manager assigned yet. Ask an admin to set your reporting manager in the Admin Panel.'}
            </p>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-xl px-6 py-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Your HR partner</h3>
          {hr ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-sm font-semibold">
                {initials(hr.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{hr.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {hr.email}
                  {hr.department ? ` · ${hr.department}` : ''}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {loading
                ? 'Loading…'
                : 'No HR partner assigned yet. Ask an admin to set your HR partner in the Admin Panel.'}
            </p>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-xl px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">People reporting to you</h3>
            {reports.length > 0 && (
              <span className="text-xs font-medium text-gray-500">
                {reports.length} {reports.length === 1 ? 'report' : 'reports'}
              </span>
            )}
          </div>
          {reports.length === 0 ? (
            <p className="text-sm text-gray-500">
              {loading ? 'Loading…' : 'No one reports to you yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {reports.map((r) => (
                <li key={r._id} className="flex items-center gap-3 py-2.5">
                  <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-semibold shrink-0">
                    {initials(r.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {r.name}
                      {r.isActive === false && (
                        <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-gray-400">Inactive</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{r.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {r.role?.name && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                        {ROLE_LABELS[r.role.name] || r.role.name}
                      </span>
                    )}
                    {r.department && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{r.department}</p>
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
