// Reset password - reads token + email from the query string, validates the
// link, then submits a new password via POST /api/auth/reset-password.

import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../utils/api'

const Shell = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center bg-auth-bg px-6 py-12">
    <div className="w-full max-w-sm bg-surface rounded-2xl shadow-xl p-8">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="font-bold text-fg">NetFlow</span>
      </div>
      {children}
    </div>
  </div>
)

function ResetPassword() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const email = params.get('email') || ''

  const [checking, setChecking] = useState(true)
  const [linkValid, setLinkValid] = useState(false)
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true
    if (!token || !email) {
      setChecking(false)
      setLinkValid(false)
      return
    }
    api
      .get(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`, { skipAuthRedirect: true })
      .then((data) => { if (active) setLinkValid(Boolean(data.valid)) })
      .catch(() => { if (active) setLinkValid(false) })
      .finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [token, email])

  const validate = () => {
    const next = {}
    if (!form.password) next.password = 'Password is required'
    else if (form.password.length < 6) next.password = 'Password must be at least 6 characters'
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match'
    return next
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    setErrors((p) => ({ ...p, [name]: '' }))
    setServerError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const v = validate()
    setErrors(v)
    if (Object.keys(v).length > 0) return
    setSubmitting(true)
    setServerError('')
    try {
      await api.post('/api/auth/reset-password', { token, email, password: form.password }, { skipAuthRedirect: true })
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setServerError(err.message || 'Could not reset password. Please request a new link.')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return <Shell><p className="text-sm text-fg-muted">Checking your reset link…</p></Shell>
  }

  if (!linkValid) {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-fg">Link expired or invalid</h1>
        <p className="text-sm text-fg-muted mt-2">
          This reset link is no longer valid. Reset links expire after 30 minutes and can only be used once.
        </p>
        <Link
          to="/forgot-password"
          className="mt-6 inline-block w-full text-center py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow transition"
        >
          Request a new link
        </Link>
      </Shell>
    )
  }

  if (done) {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-fg">Password updated</h1>
        <p className="text-sm text-fg-muted mt-2">
          Your password has been reset. Redirecting you to sign in…
        </p>
        <Link
          to="/login"
          className="mt-6 inline-block w-full text-center py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow transition"
        >
          Go to sign in
        </Link>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold text-fg">Set a new password</h1>
      <p className="text-sm text-fg-muted mt-1 mb-6">
        For <span className="font-medium text-fg">{email}</span>
      </p>

      {serverError && (
        <div className="mb-4 p-3 rounded-lg bg-danger-subtle border border-danger-line text-danger-fg text-sm">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-fg mb-1.5">
            New password
          </label>
          <div className="relative">
            <input
              id="password" name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.password} onChange={handleChange}
              placeholder="At least 6 characters"
              className={`w-full pl-4 pr-14 py-2.5 rounded-lg border border-line bg-surface text-fg placeholder:text-fg-subtle text-sm focus:outline-none focus:ring-2 transition ${errors.password ? 'border-red-400 focus:ring-red-200' : 'focus:ring-indigo-200 focus:border-indigo-400'}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute inset-y-0 right-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-danger-fg">{errors.password}</p>}
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-fg mb-1.5">
            Confirm password
          </label>
          <input
            id="confirm" name="confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={form.confirm} onChange={handleChange}
            placeholder="Re-enter your password"
            className={`w-full px-4 py-2.5 rounded-lg border border-line bg-surface text-fg placeholder:text-fg-subtle text-sm focus:outline-none focus:ring-2 transition ${errors.confirm ? 'border-red-400 focus:ring-red-200' : 'focus:ring-indigo-200 focus:border-indigo-400'}`}
          />
          {errors.confirm && <p className="mt-1 text-xs text-danger-fg">{errors.confirm}</p>}
        </div>

        <button
          type="submit" disabled={submitting}
          className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow transition mt-1"
        >
          {submitting ? 'Resetting…' : 'Reset password'}
        </button>
      </form>

      <p className="text-center text-sm text-fg-muted mt-6">
        <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-medium">
          Back to sign in
        </Link>
      </p>
    </Shell>
  )
}

export default ResetPassword
