// M1 - Phase 2 - Login.jsx - Wired to POST /api/auth/login

import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authStore } from '../utils/auth'

function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    setErrors((p) => ({ ...p, [name]: '' }))
    setServerError('')
  }

  const validate = () => {
    const next = {}
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!form.email.trim()) next.email = 'Email is required'
    else if (!emailPattern.test(form.email)) next.email = 'Enter a valid email address'
    if (!form.password) next.password = 'Password is required'
    else if (form.password.length < 6) next.password = 'Password must be at least 6 characters'
    return next
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const v = validate()
    setErrors(v)
    if (Object.keys(v).length > 0) return

    setSubmitting(true)
    setServerError('')
    try {
      await authStore.login(form.email.trim(), form.password)
      navigate('/dashboard')
    } catch (err) {
      setServerError(err.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Welcome Back</h1>
          <p className="text-gray-500 mt-1">Sign in to continue to NetFlow</p>
        </div>

        {serverError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-center">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className={`w-full px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 transition ${
                errors.email
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-gray-300 focus:ring-indigo-400 focus:border-indigo-400'
              }`}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className={`w-full px-4 py-2.5 pr-12 rounded-lg border focus:outline-none focus:ring-2 transition ${
                  errors.password
                    ? 'border-red-400 focus:ring-red-300'
                    : 'border-gray-300 focus:ring-indigo-400 focus:border-indigo-400'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 px-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold shadow-md hover:shadow-lg transition"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          {/* Don&apos;t have an account?{' '} */}
          {/* <Link to="/register" className="text-indigo-600 hover:text-indigo-800 font-semibold">
            Create one
          </Link> */}
        </p>
        <p className="text-center text-[11px] text-gray-400 mt-2">
          The first account you create becomes the workspace Admin.
        </p>
      </div>
    </div>
  )
}

export default Login
