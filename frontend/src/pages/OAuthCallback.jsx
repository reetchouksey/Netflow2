// Landing page for the Microsoft SSO redirect. The server sends the freshly
// issued app JWT back in the URL fragment (#token=...); we store it, hydrate the
// user via /api/auth/me, and move on. Any #sso_error bounces back to /login.

import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { setToken } from '../utils/api'
import { authStore } from '../utils/auth'

const parseHash = () => {
  const hash = (window.location.hash || '').replace(/^#/, '')
  return new URLSearchParams(hash)
}

export default function OAuthCallback() {
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const params = parseHash()
    const token = params.get('token')
    const ssoError = params.get('sso_error')

    // Clear the token/hash from the address bar as soon as we've read it.
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', window.location.pathname)
    }

    if (ssoError || !token) {
      navigate(`/login${ssoError ? `?sso_error=${encodeURIComponent(ssoError)}` : ''}`, { replace: true })
      return
    }

    ;(async () => {
      setToken(token)
      const user = await authStore.refresh()
      navigate(user ? '/dashboard' : '/login?sso_error=session', { replace: true })
    })()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-2">
      <p className="text-sm text-fg-muted">Signing you in…</p>
    </div>
  )
}
