// Forgot password - requests a reset link via POST /api/auth/forgot-password.
// Always shows a generic success (the API never reveals if the email exists).

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../utils/api'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const value = email.trim()
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!value) return setError('Email is required')
    if (!emailPattern.test(value)) return setError('Enter a valid email address')

    setSubmitting(true)
    setError('')
    try {
      await api.post('/api/auth/forgot-password', { email: value }, { skipAuthRedirect: true })
      setSent(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f0ff] px-6 py-12">
      <div className="w-full max-w-sm bg-surface rounded-2xl shadow-xl p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-fg">NetFlow</span>
        </div>

        {sent ? (
          <>
            <h1 className="text-xl font-bold text-fg">Check your inbox</h1>
            <p className="text-sm text-fg-muted mt-2">
              If an account exists for <span className="font-medium text-fg">{email.trim()}</span>,
              we've sent a link to reset your password. The link expires in 30 minutes.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block w-full text-center py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow transition"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-fg">Forgot password?</h1>
            <p className="text-sm text-fg-muted mt-1 mb-6">
              Enter your account email and we'll send you a reset link.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-fg mb-1.5">
                  Email address
                </label>
                <input
                  id="email" name="email" type="email" autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError('') }}
                  placeholder="Enter your email"
                  className="w-full px-4 py-2.5 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition"
                />
              </div>

              <button
                type="submit" disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow transition"
              >
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <p className="text-center text-sm text-fg-muted mt-6">
              <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-medium">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default ForgotPassword
