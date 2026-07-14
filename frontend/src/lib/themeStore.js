// Shared - themeStore.js
// Light/dark theme, persisted to localStorage and applied as a `.dark` class on
// <html>. A tiny inline script in index.html applies the saved theme before
// first paint (no flash); this store keeps React in sync and handles toggling.

import { useSyncExternalStore } from 'react'

const KEY = 'fs.theme'
const listeners = new Set()

function readInitial() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* storage unavailable */ }
  try {
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch { /* matchMedia unavailable */ }
  return 'light'
}

let theme = readInitial()

function apply(next) {
  try {
    const root = document.documentElement
    root.classList.toggle('dark', next === 'dark')
    root.style.colorScheme = next
  } catch { /* SSR / no document */ }
}

// Reconcile the DOM with the resolved theme (the inline script normally already
// did this, but this covers the OS-preference fallback and StrictMode remounts).
apply(theme)

function emit() {
  listeners.forEach((fn) => fn())
}

export const themeStore = {
  get: () => theme,
  set(next) {
    theme = next === 'dark' ? 'dark' : 'light'
    try { localStorage.setItem(KEY, theme) } catch { /* storage unavailable */ }
    apply(theme)
    emit()
  },
  toggle() {
    this.set(theme === 'dark' ? 'light' : 'dark')
  },
  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}

export function useTheme() {
  return useSyncExternalStore(themeStore.subscribe, themeStore.get, () => 'light')
}
