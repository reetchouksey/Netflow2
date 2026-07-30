// Multi-tenancy step 9 - utils/workspace.js
// Detects which organization workspace the browser is pointed at, so the login
// page can show the org and scope the login to it.
//
// Resolution order:
//   1. ?org=acme query param — for local dev, where wildcard subdomains
//      (acme.localhost) usually don't resolve. Remembered in localStorage so
//      it survives client-side navigation within the login flow.
//   2. Host subdomain — production (acme.netflow.app) or a working local
//      wildcard (acme.localhost).
//   3. Remembered dev workspace from a previous ?org= visit.
//
// Returns the subdomain string (lowercased) or null for the bare/default domain.

const RESERVED = new Set(['www', 'api', 'app', 'admin', 'platform'])
const STORAGE_KEY = 'netflow_workspace'

// Hosting/platform domains that are the app's own infrastructure. The label in
// front (e.g. "net-flow-sw" in net-flow-sw.vercel.app) is a project name, not a
// tenant workspace — so these hosts resolve to the bare/default domain.
const PLATFORM_HOST_SUFFIXES = ['.vercel.app', '.onrender.com', '.netlify.app', '.pages.dev']

const remember = (sub) => {
  try { localStorage.setItem(STORAGE_KEY, sub) } catch { /* ignore */ }
}

export const detectWorkspace = () => {
  // 1. Explicit ?org= (local dev).
  try {
    const q = new URLSearchParams(window.location.search).get('org')
    if (q && q.trim()) {
      const sub = q.trim().toLowerCase()
      remember(sub)
      return sub
    }
  } catch { /* ignore */ }

  // 2. Host subdomain.
  const host = String(window.location.hostname || '').toLowerCase()
  const isIp = /^\d+(\.\d+){3}$/.test(host)
  const isPlatformHost = PLATFORM_HOST_SUFFIXES.some((s) => host.endsWith(s))
  if (host && !isIp && !isPlatformHost) {
    // When VITE_ROOT_DOMAIN is configured, only its direct children are
    // workspaces (acme.netflow.app → "acme"); the apex is the default.
    const root = String(import.meta.env.VITE_ROOT_DOMAIN || '').toLowerCase().replace(/^\.+/, '')
    if (root) {
      if (host !== root && host.endsWith(`.${root}`)) {
        const label = host.slice(0, -(root.length + 1)).split('.').pop()
        if (label && !RESERVED.has(label)) return label
      }
    } else {
      const parts = host.split('.')
      const isLocal = host.endsWith('localhost')
      // acme.localhost → 2 parts; acme.netflow.app → 3 parts. Bare localhost and
      // apex domains (netflow.app) carry no workspace.
      const hasSub = isLocal ? parts.length >= 2 : parts.length >= 3
      if (hasSub) {
        const sub = parts[0]
        if (sub && sub !== 'localhost' && !RESERVED.has(sub)) return sub
      }
    }
  }

  // 3. Remembered dev workspace.
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return saved
  } catch { /* ignore */ }

  return null
}

export const clearWorkspace = () => {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}
