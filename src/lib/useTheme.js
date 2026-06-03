import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'padelzero_theme'

/**
 * Theme hook: 'dark' | 'light' | 'system'
 * Defaults to 'dark' (original app behavior).
 * Applies/removes 'dark' class on <html> and updates color-scheme.
 */
export function useTheme() {
  const [mode, setModeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'dark'
    } catch {
      return 'dark'
    }
  })

  // Resolve 'system' to actual dark/light
  const resolvedTheme = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode

  const applyTheme = useCallback((resolved) => {
    const root = document.documentElement
    if (resolved === 'dark') {
      root.classList.add('dark')
      root.style.colorScheme = 'dark'
    } else {
      root.classList.remove('dark')
      root.style.colorScheme = 'light'
    }
  }, [])

  // Apply on mount and when mode changes
  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme, applyTheme])

  // Listen for system preference changes when mode is 'system'
  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => applyTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode, applyTheme])

  const setMode = useCallback((newMode) => {
    setModeState(newMode)
    try {
      localStorage.setItem(STORAGE_KEY, newMode)
    } catch {}
  }, [])

  return { mode, resolvedTheme, setMode, isDark: resolvedTheme === 'dark' }
}

/**
 * Initialize theme from localStorage on app startup (call once, outside React).
 * Prevents flash of wrong theme.
 */
export function initTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || 'dark'
    let resolved = stored
    if (stored === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    const root = document.documentElement
    if (resolved === 'dark') {
      root.classList.add('dark')
      root.style.colorScheme = 'dark'
    } else {
      root.classList.remove('dark')
      root.style.colorScheme = 'light'
    }
  } catch {}
}
