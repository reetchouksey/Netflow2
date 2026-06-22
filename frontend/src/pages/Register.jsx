// M1 - Phase 2 - Register.jsx - Wired to POST /api/auth/register

import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authStore, DEPARTMENTS } from '../utils/auth'

function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    department: DEPARTMENTS[0],
    password: '',
    agree: false
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }))
    setErrors((p) => ({ ...p, [name]: '' }))
    setServerError('')
  }

  const validate = () => {
    const next = {}
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!form.firstName.trim()) next.firstName = 'First name is required'
    if (!form.lastName.trim()) next.lastName = 'Last name is required'
    if (!form.email.trim()) next.email = 'Work email is required'
    else if (!emailPattern.test(form.email)) next.email = 'Enter a valid email address'
    if (!form.password) next.password = 'Password is required'
    else if (form.password.length < 6) next.password = 'Password must be at least 6 characters'
    if (!form.agree) next.agree = 'You must agree to the terms'
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
      await authStore.register({
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email: form.email.trim(),
        password: form.password,
        department: form.department
      })
      navigate('/dashboard')
    } catch (err) {
      setServerError(err.message || 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  const inputBase = 'w-full px-3 py-2 text-sm rounded-md border bg-white focus:outline-none focus:ring-2 transition'
  const inputOk = 'border-gray-300 focus:ring-indigo-200 focus:border-indigo-400'
  const inputErr = 'border-red-300 focus:ring-red-200 focus:border-red-400'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h7" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900">NetFlow</span>
        </div>

        <h1 className="text-xl font-bold text-gray-900">Create your account</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">Start building approval workflows today</p>

        {serverError && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First name</label>
              <input id="firstName" name="firstName" type="text" autoComplete="given-name" value={form.firstName} onChange={handleChange} placeholder="Arjun" className={`${inputBase} ${errors.firstName ? inputErr : inputOk}`} />
              {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
              <input id="lastName" name="lastName" type="text" autoComplete="family-name" value={form.lastName} onChange={handleChange} placeholder="Kumar" className={`${inputBase} ${errors.lastName ? inputErr : inputOk}`} />
              {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Work email</label>
            <input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange} placeholder="you@company.com" className={`${inputBase} ${errors.email ? inputErr : inputOk}`} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select id="department" name="department" value={form.department} onChange={handleChange} className={`${inputBase} ${inputOk}`}>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={handleChange} placeholder="Min 6 characters" className={`${inputBase} ${errors.password ? inputErr : inputOk}`} />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>

          <div>
            <label className="flex items-start gap-2 text-sm text-gray-600 select-none">
              <input type="checkbox" name="agree" checked={form.agree} onChange={handleChange} className="w-4 h-4 mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400" />
              <span>
                I agree to the <a href="#" className="text-indigo-600 hover:text-indigo-800 font-medium">Terms of Service</a> and <a href="#" className="text-indigo-600 hover:text-indigo-800 font-medium">Privacy Policy</a>
              </span>
            </label>
            {errors.agree && <p className="mt-1 text-xs text-red-600">{errors.agree}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-md bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm transition"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default Register
