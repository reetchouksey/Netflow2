// Multi-tenancy polish - pages/ChangePassword.jsx
// Handles two cases:
//   • Forced change  — user.mustChangePassword is true (e.g. a Super-Admin-
//     provisioned org admin on first login). Current password not required.
//   • Voluntary change — reached from Profile; current password required.

import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authStore, useUser } from '../utils/auth'
import { toast } from '../lib/toastStore'

export default function ChangePassword() {
  const navigate = useNavigate()
  const user = useUser()
  const forced = Boolean(user?.mustChangePassword)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!forced && !currentPassword) return setError('Enter your current password')
    if (newPassword.length < 6) return setError('New password must be at least 6 characters')
    if (newPassword !== confirm) return setError('New passwords do not match')

    setBusy(true)
    try {
      await authStore.changePassword(forced ? undefined : currentPassword, newPassword)
      toast.success('Password updated')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Could not change the password')
    } finally {
      setBusy(false)
    }
  }

  const field = 'mt-1 w-full px-3 py-2.5 text-sm border border-line rounded-lg bg-surface-2 text-fg focus:outline-none focus:ring-2 focus:ring-indigo-300'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f0ff] px-6 py-12">
      <div className="w-full max-w-sm bg-surface border border-line rounded-2xl shadow-xl p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow">
            <img src="/netflow-icon.png" alt="NetFlow" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-fg text-lg">NetFlow</span>
        </div>

        <h1 className="text-xl font-bold text-fg">
          {forced ? 'Set a new password' : 'Change password'}
        </h1>
        <p className="text-sm text-fg-muted mt-1 mb-5">
          {forced
            ? 'For security, please replace your temporary password before continuing.'
            : 'Enter your current password and choose a new one.'}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {!forced && (
            <label className="block">
              <span className="text-xs font-medium text-fg-muted">Current password</span>
              <input
                type={show ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setError('') }}
                autoComplete="current-password"
                className={field}
              />
            </label>
          )}

          <label className="block">
            <span className="text-xs font-medium text-fg-muted">New password</span>
            <input
              type={show ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setError('') }}
              autoComplete="new-password"
              className={field}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-fg-muted">Confirm new password</span>
            <input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError('') }}
              autoComplete="new-password"
              className={field}
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-fg-muted">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="rounded" />
            Show passwords
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold shadow transition"
          >
            {busy ? 'Saving…' : forced ? 'Set password & continue' : 'Update password'}
          </button>
        </form>

        {!forced ? (
          <Link to="/profile" className="mt-5 inline-block text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            ← Back to profile
          </Link>
        ) : (
          <button
            onClick={() => authStore.logout().then(() => navigate('/login', { replace: true }))}
            className="mt-5 text-sm text-fg-muted hover:text-fg font-medium"
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  )
}
