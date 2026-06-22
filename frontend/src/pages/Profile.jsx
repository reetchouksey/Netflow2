// Shared - Profile.jsx
// Lets any logged-in user see their own account details: name, email, role,
// department, who their reporting manager is, and who their HR partner is.
// Reads GET /api/users/me/profile (role + manager + HR populated) and falls back
// to the cached auth user while loading.

import React, { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { useUser, initials, ROLE_LABELS } from '../utils/auth'

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

  useEffect(() => {
    let cancelled = false
    api.get('/api/users/me/profile')
      .then((data) => {
        if (cancelled) return
        setProfile(data.user)
        setReports(data.reports || [])
      })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load profile') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const user = profile || cached
  const roleName = user?.role?.name
  const roleLabel = roleName ? (ROLE_LABELS[roleName] || roleName) : '—'
  const manager = user?.managerId && typeof user.managerId === 'object' ? user.managerId : null
  const hr = user?.hrId && typeof user.hrId === 'object' ? user.hrId : null

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
