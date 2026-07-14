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

// ── Left panel decoration ──────────────────────────────────────────────────
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
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
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
      {/* AI Routing badge */}
      <div className="absolute -bottom-4 -left-4 bg-surface rounded-xl shadow-lg px-3 py-2 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-fg">AI Routing</p>
          <p className="text-[9px] text-fg-subtle">Smart decisions, faster outcomes</p>
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

  // MFA flow: 'login' | 'mfa' (enter code) | 'setup' (admin enrol) | 'backup' (show codes)
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
    <div className="min-h-screen flex bg-[#f0f0ff]">
      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 px-14 py-12 bg-[#f0f0ff]">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow">
            <img src="/netflow-icon.png" alt="NetFlow Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="font-bold text-fg text-lg leading-none">NetFlow</span>
            <p className="text-[10px] text-fg-subtle leading-none mt-0.5">Automate. Orchestrate. Scale.</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="mb-16">
          <h2 className="text-4xl font-extrabold text-fg leading-tight mb-3">
            Streamline workflows.<br />
            <span className="text-indigo-600">Increase efficiency.</span><br />
            Drive growth.
          </h2>
          <p className="text-fg-muted text-sm max-w-xs leading-relaxed">
            NetFlow helps organizations automate processes, orchestrate workflows and achieve operational excellence at scale.
          </p>
          <MockupCard />
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 bg-surface lg:rounded-l-3xl shadow-2xl">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-fg">NetFlow</span>
          </div>

          {step === 'login' && (
          <>
          {/* Workspace context (step 9 — subdomain routing) */}
          {orgContext && !orgUnknown && (
            <div className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-700">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-6h.01M7 11h.01M7 7h.01M11 15h.01M11 11h.01M11 7h.01" />
              </svg>
              {orgContext.name}
            </div>
          )}
          <h1 className="text-2xl font-bold text-fg">Welcome back</h1>
          <p className="text-sm text-fg-muted mt-1 mb-8">
            {orgContext && !orgUnknown
              ? <>Sign in to <span className="font-semibold text-fg">{orgContext.name}</span> on NetFlow.</>
              : 'Sign in to your NetFlow admin account.'}
          </p>

          {orgSuspended && (
            <div className="mb-5 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3l9 16H3L12 3z" />
              </svg>
              <span>This workspace is suspended. Contact your platform administrator.</span>
            </div>
          )}
          {orgUnknown && (
            <div className="mb-5 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3l9 16H3L12 3z" />
              </svg>
              <span>Unknown workspace “{workspace}”. Check the address and try again.</span>
            </div>
          )}

          {serverError && (
            <div
              className={`mb-5 p-3 rounded-lg border text-sm flex items-start gap-2 ${
                locked
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : attemptsLeft !== null
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                {locked ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3l9 16H3L12 3z" />
                )}
              </svg>
              <span>
                {serverError}
                {attemptsLeft !== null && !locked && attemptsLeft <= 2 && (
                  <span className="block mt-0.5 font-semibold">
                    {attemptsLeft === 0
                      ? 'This is your last try.'
                      : `Warning: ${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} remaining.`}
                  </span>
                )}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-fg mb-1.5">
                Email address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-fg-subtle">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  id="email" name="email" type="email" autoComplete="email"
                  value={form.email} onChange={handleChange}
                  placeholder="Enter your email"
                  className={`w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition ${errors.email ? 'border-red-400 focus:ring-red-200' : 'border-line focus:ring-indigo-200 focus:border-indigo-400'
                    }`}
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-fg mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-fg-subtle">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  id="password" name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password} onChange={handleChange}
                  placeholder="Enter your password"
                  className={`w-full pl-9 pr-14 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition ${errors.password ? 'border-red-400 focus:ring-red-200' : 'border-line focus:ring-indigo-200 focus:border-indigo-400'
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
            </div>

            {/* Forgot password */}
            <div className="flex items-center justify-end text-sm">
              <Link to="/forgot-password" className="text-indigo-600 hover:text-indigo-800 font-medium">
                Forgot password?
              </Link>
            </div>

            {/* Sign in */}
            <button
              type="submit" disabled={submitting || orgSuspended}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow transition mt-1"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {ssoEnabled && (
            <>
              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <hr className="flex-1 border-line" />
                <span className="text-xs text-fg-subtle">or</span>
                <hr className="flex-1 border-line" />
              </div>

              <button
                type="button"
                onClick={() => { window.location.href = `${API_BASE}/api/auth/oauth/microsoft` }}
                className="w-full py-2.5 rounded-lg border border-line hover:bg-surface-2 active:bg-surface-3 text-sm font-semibold text-fg shadow-sm transition flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                Sign in with Microsoft
              </button>
            </>
          )}

          <p className="text-center text-xs text-fg-subtle mt-6">
            Contact your administrator to get an account.
          </p>
          </>
          )}

          {step === 'mfa' && (
            <>
              <h1 className="text-2xl font-bold text-fg">Two-factor authentication</h1>
              <p className="text-sm text-fg-muted mt-1 mb-8">
                Enter the 6-digit code from your authenticator app.
              </p>
              {mfaError && (
                <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {mfaError}
                </div>
              )}
              <form onSubmit={submitMfaVerify} className="space-y-4">
                <input
                  autoFocus inputMode="numeric" autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setMfaError('') }}
                  placeholder="Enter the 6-digit code"
                  className="w-full px-4 py-2.5 rounded-lg border border-line text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition"
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
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
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
                  className="w-full px-4 py-2.5 rounded-lg border border-line text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition"
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
