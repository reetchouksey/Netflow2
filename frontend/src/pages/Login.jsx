// M1 - Phase 2 - Login.jsx - Wired to POST /api/auth/login

import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authStore } from '../utils/auth'
import { api, API_BASE } from '../utils/api'
import { detectWorkspace } from '../utils/workspace'

// Friendly copy for the ?sso_error=... codes the SSO callback can bounce back.
const SSO_ERROR_MESSAGES = {
  nouser: "This Microsoft account isn't registered. Ask your administrator to add you first.",
  inactive: 'Your account is deactivated. Contact your administrator.',
  state: 'Your sign-in session expired. Please try again.',
  nocode: 'Microsoft sign-in was cancelled or failed. Please try again.',
  noemail: "We couldn't read an email from your Microsoft account.",
  session: 'Could not start your session. Please try again.',
  disabled: 'Microsoft sign-in is not available right now.',
  failed: 'Microsoft sign-in failed. Please try again.',
}

// ---------- Left panel decoration ----------
function MockupCard() {
  return (
    <div className="relative w-full max-w-xs mx-auto mt-10">
      {/* Main card */}
      <div className="bg-surface/90 backdrop-blur rounded-2xl shadow-xl p-5">
        <p className="text-xs font-semibold text-fg-muted mb-3 uppercase tracking-wide">Workflow Progress</p>
        <div className="flex items-center gap-5">
          {/* Donut */}
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--color-line)" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#6366f1" strokeWidth="3.5"
                strokeDasharray="75 25" strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-bold text-fg">75%</span>
              <span className="text-[9px] text-fg-subtle">Completed</span>
            </span>
          </div>
          {/* Stats */}
          <div className="space-y-1.5 text-xs text-fg-muted">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
              In Progress <span className="ml-auto font-semibold text-fg">12</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Pending <span className="ml-auto font-semibold text-fg">5</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Completed <span className="ml-auto font-semibold text-fg">28</span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-4 -left-4 bg-surface rounded-xl shadow-lg px-3 py-2 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-fg">Approvals</p>
          <p className="text-[9px] text-fg-subtle">Clear owners, faster outcomes</p>
        </div>
      </div>
    </div>
  )
}

function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', remember: false })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [attemptsLeft, setAttemptsLeft] = useState(null)
  const [locked, setLocked] = useState(false)

  // MFA flow: 'login' | 'mfa' (enter code) | 'setup' (opt-in enrol) | 'backup' (show codes)
  const [step, setStep] = useState('login')
  const [challenge, setChallenge] = useState('')
  const [code, setCode] = useState('')
  const [setupData, setSetupData] = useState(null)   // { qr, manualKey }
  const [backupCodes, setBackupCodes] = useState([])
  const [mfaError, setMfaError] = useState('')
  const [busy, setBusy] = useState(false)

  const [ssoEnabled, setSsoEnabled] = useState(false)

  // Step 9 — subdomain routing. Which workspace (org) is being signed in to.
  const [workspace] = useState(() => detectWorkspace())
  // orgContext: null (still loading / bare domain), { name, status } when known,
  // or { unknown: true } when the subdomain matches no organization.
  const [orgContext, setOrgContext] = useState(null)

  // Show the SSO button only when the server has Microsoft credentials, and
  // surface any error the SSO callback redirected back with.
  useEffect(() => {
    api.get('/api/auth/sso/config')
      .then((d) => setSsoEnabled(!!d.microsoft))
      .catch(() => setSsoEnabled(false))

    const params = new URLSearchParams(window.location.search)
    const err = params.get('sso_error')
    if (err) {
      setServerError(SSO_ERROR_MESSAGES[err] || 'Microsoft sign-in failed. Please try again.')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  // Resolve the workspace org so we can show its name and warn on suspended /
  // unknown workspaces before the user even types a password.
  useEffect(() => {
    if (!workspace) return
    api.get(`/api/auth/org-context?subdomain=${encodeURIComponent(workspace)}`)
      .then((d) => {
        if (d.org) setOrgContext(d.org)
        else setOrgContext({ unknown: true })
      })
      .catch(() => setOrgContext(null))
  }, [workspace])

  const orgSuspended = !!(orgContext && orgContext.status === 'suspended')
  const orgUnknown = !!(orgContext && orgContext.unknown)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }))
    setErrors((p) => ({ ...p, [name]: '' }))
    setServerError('')
    setAttemptsLeft(null)
    setLocked(false)
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
    setAttemptsLeft(null)
    setLocked(false)
    try {
      const res = await authStore.login(form.email.trim(), form.password, workspace)
      if (res.status === 'ok') {
        navigate('/dashboard')
      } else if (res.status === 'mfa') {
        setChallenge(res.challenge)
        setCode('')
        setMfaError('')
        setStep('mfa')
      } else if (res.status === 'setup') {
        setChallenge(res.challenge)
        setCode('')
        setMfaError('')
        setStep('setup')
        try {
          const d = await authStore.mfaSetupWithChallenge(res.challenge)
          setSetupData(d)
        } catch (err) {
          setMfaError(err.message || 'Could not start MFA setup')
        }
      }
    } catch (err) {
      setServerError(err.message || 'Login failed')
      if (err.code === 'ACCOUNT_LOCKED') {
        setLocked(true)
      } else if (err.data && typeof err.data.attemptsRemaining === 'number') {
        setAttemptsLeft(err.data.attemptsRemaining)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const submitMfaVerify = async (e) => {
    e.preventDefault()
    if (!code.trim()) return setMfaError('Enter the 6-digit code')
    setBusy(true)
    setMfaError('')
    try {
      await authStore.completeMfa(challenge, code.trim())
      navigate('/dashboard')
    } catch (err) {
      setMfaError(err.message || 'Invalid code')
    } finally {
      setBusy(false)
    }
  }

  const submitMfaEnable = async (e) => {
    e.preventDefault()
    if (!code.trim()) return setMfaError('Enter the 6-digit code from your app')
    setBusy(true)
    setMfaError('')
    try {
      const d = await authStore.mfaEnableWithChallenge(challenge, code.trim())
      setBackupCodes(d.backupCodes || [])
      setStep('backup')
    } catch (err) {
      setMfaError(err.message || 'Invalid code')
    } finally {
      setBusy(false)
    }
  }

  const backToLogin = () => {
    setStep('login')
    setChallenge('')
    setCode('')
    setSetupData(null)
    setMfaError('')
  }

  return (
    <div className="h-screen max-h-screen overflow-hidden flex bg-white dark:bg-slate-900 font-sans">
      {/* ---------- Left Royal Blue Hero Panel ---------- */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-10 lg:p-14 bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#1E40AF] text-white relative overflow-hidden shrink-0 h-full">
        
        {/* Decorative Background Waves & Orbs */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
          <svg className="w-full h-full" viewBox="0 0 500 500" fill="none">
            <circle cx="450" cy="50" r="180" stroke="white" strokeWidth="2" strokeDasharray="6 6" />
            <circle cx="50" cy="450" r="220" stroke="white" strokeWidth="2" />
            <path d="M-50,200 Q150,100 350,300 T550,200" stroke="white" strokeWidth="3" />
          </svg>
        </div>

        {/* Top Brand Logo */}
        <Link to="/" className="relative z-10 flex items-center hover:opacity-90 transition group cursor-pointer" title="Back to landing page">
          <span className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md text-white font-black text-xl flex items-center justify-center shadow-lg shadow-black/10 group-hover:scale-105 transition-transform">
            N
          </span>
          <span className="text-2xl font-black tracking-tight text-white ml-3">
            NetFlow
          </span>
        </Link>

        {/* Hero Copy */}
        <div className="relative z-10 my-auto py-6 max-w-xl">
          <h1 className="text-4xl lg:text-5xl font-black text-white leading-[1.15] tracking-tight mb-5">
            Streamline workflows.<br />
            Increase efficiency.<br />
            Drive growth.
          </h1>
          
          <p className="text-sm text-blue-100/90 leading-relaxed font-medium max-w-md mb-8">
            NetFlow automates your processes, provides real-time insights, and empowers your team to achieve more—every single day.
          </p>

          {/* 3 Feature Pills */}
          <div className="space-y-4 max-w-sm">
            <div className="flex items-center gap-4 text-white">
              <div className="w-11 h-11 rounded-[16px] bg-white/20 backdrop-blur-md border border-white/15 flex items-center justify-center shrink-0 shadow-sm">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <span className="text-sm font-extrabold tracking-wide text-white">Automate approvals</span>
            </div>

            <div className="flex items-center gap-4 text-white">
              <div className="w-11 h-11 rounded-[16px] bg-white/20 backdrop-blur-md border border-white/15 flex items-center justify-center shrink-0 shadow-sm">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-sm font-extrabold tracking-wide text-white">Real-time SLA visibility</span>
            </div>

            <div className="flex items-center gap-4 text-white">
              <div className="w-11 h-11 rounded-[16px] bg-white/20 backdrop-blur-md border border-white/15 flex items-center justify-center shrink-0 shadow-sm">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-sm font-extrabold tracking-wide text-white">Faster decisions</span>
            </div>
          </div>
        </div>

        {/* Footer Subtext */}
        <div className="relative z-10 text-xs font-semibold text-blue-200/80">
          © {new Date().getFullYear()} NetFlow Inc. All rights reserved.
        </div>
      </div>

      {/* ---------- Right Form Panel ---------- */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 sm:px-12 py-8 bg-white dark:bg-slate-900 h-full overflow-hidden">
        <div className="w-full max-w-md space-y-6">

          {/* Mobile Logo Header */}
          <Link to="/" className="flex items-center gap-3 lg:hidden mb-4 hover:opacity-90 transition cursor-pointer" title="Back to landing page">
            <span className="w-9 h-9 rounded-2xl bg-[#2563EB] text-white font-black text-lg flex items-center justify-center shadow-md">
              N
            </span>
            <span className="text-xl font-black text-slate-900 dark:text-white">NetFlow</span>
          </Link>

          {step === 'login' && (
            <div className="w-full max-w-[360px] mx-auto">
              {/* Back to website link */}
              <div className="mb-4">
                <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  <span>Back to home</span>
                </Link>
              </div>

              {/* Heading */}
              <div className="mb-8">
                <h2 className="text-[32px] font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Welcome back
                </h2>
                <p className="text-[14px] text-slate-500 mt-1.5">
                  Sign in to continue to NetFlow
                </p>
              </div>

              {/* Server / Auth Error Banner */}
              {serverError && (
                <div className="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-100 text-[13px] font-medium text-rose-600">
                  {serverError}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Email address */}
                <div>
                  <label htmlFor="email" className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="superadmin@netflow.com"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 text-[14px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-sm"
                  />
                  {errors.email && <p className="mt-1.5 text-[12px] font-medium text-rose-500">{errors.email}</p>}
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    <Link to="/forgot-password" className="text-[13px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="••••••••••••"
                      className="w-full px-3 pr-16 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 text-[14px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute inset-y-0 right-3 text-[13px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 flex items-center"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1.5 text-[12px] font-medium text-rose-500">{errors.password}</p>}
                </div>

                {/* Sign in button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white text-[14px] font-semibold shadow-sm transition mt-2 cursor-pointer"
                >
                  {submitting ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-6">
                <hr className="flex-1 border-slate-200 dark:border-slate-800" />
                <span className="text-[12px] text-slate-400 uppercase tracking-widest font-medium">or</span>
                <hr className="flex-1 border-slate-200 dark:border-slate-800" />
              </div>

              {/* Continue with Microsoft */}
              <button
                type="button"
                onClick={() => { window.location.href = `${API_BASE}/api/auth/oauth/microsoft` }}
                className="w-full py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-[14px] font-semibold shadow-sm transition flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                Continue with Microsoft
              </button>
            </div>
          )}

          {step === 'mfa' && (
            <>
              <h1 className="text-2xl font-bold text-fg">Two-factor authentication</h1>
              <p className="text-sm text-fg-muted mt-1 mb-8">
                Enter the 6-digit code from your authenticator app.
              </p>
              {mfaError && (
                <div className="mb-5 p-3 rounded-lg bg-danger-subtle border border-danger-line text-danger-fg text-sm">
                  {mfaError}
                </div>
              )}
              <form onSubmit={submitMfaVerify} className="space-y-4">
                <input
                  autoFocus inputMode="numeric" autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setMfaError('') }}
                  placeholder="Enter the 6-digit code"
                  className="w-full px-4 py-2.5 rounded-lg border border-line bg-surface text-fg placeholder:text-fg-subtle text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition"
                />
                <button
                  type="submit" disabled={busy}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold shadow transition"
                >
                  {busy ? 'Verifying…' : 'Verify & sign in'}
                </button>
              </form>
              <button onClick={backToLogin} className="mt-5 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                ← Back to sign in
              </button>
            </>
          )}

          {step === 'setup' && (
            <>
              <h1 className="text-2xl font-bold text-fg">Set up two-factor auth</h1>
              <p className="text-sm text-fg-muted mt-1 mb-5">
                Admin accounts require an authenticator app. Scan this QR code with
                Google Authenticator (or Authy), then enter the 6-digit code.
              </p>
              {mfaError && (
                <div className="mb-4 p-3 rounded-lg bg-danger-subtle border border-danger-line text-danger-fg text-sm">
                  {mfaError}
                </div>
              )}
              {setupData?.qr ? (
                <div className="flex flex-col items-center">
                  <img src={setupData.qr} alt="MFA QR code" className="w-44 h-44 rounded-lg border border-line" />
                  <p className="mt-2 text-[11px] text-fg-subtle">
                    Can't scan? Enter this key manually:
                  </p>
                  <code className="text-xs font-mono text-fg-muted break-all text-center">{setupData.manualKey}</code>
                </div>
              ) : (
                <p className="text-sm text-fg-subtle">Loading QR code…</p>
              )}
              <form onSubmit={submitMfaEnable} className="space-y-4 mt-5">
                <input
                  inputMode="numeric" autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setMfaError('') }}
                  placeholder="Enter 6-digit code"
                  className="w-full px-4 py-2.5 rounded-lg border border-line bg-surface text-fg placeholder:text-fg-subtle text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition"
                />
                <button
                  type="submit" disabled={busy || !setupData}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold shadow transition"
                >
                  {busy ? 'Verifying…' : 'Enable & continue'}
                </button>
              </form>
              <button onClick={backToLogin} className="mt-5 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                ← Back to sign in
              </button>
            </>
          )}

          {step === 'backup' && (
            <>
              <h1 className="text-2xl font-bold text-fg">Save your backup codes</h1>
              <p className="text-sm text-fg-muted mt-1 mb-5">
                Store these one-time codes somewhere safe. Each can be used once if you
                lose access to your authenticator app.
              </p>
              <div className="grid grid-cols-2 gap-2 p-4 rounded-lg bg-surface-2 border border-line">
                {backupCodes.map((c) => (
                  <code key={c} className="text-sm font-mono text-fg text-center">{c}</code>
                ))}
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full mt-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow transition"
              >
                I've saved them — continue
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
