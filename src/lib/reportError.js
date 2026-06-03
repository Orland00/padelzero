/**
 * Self-hosted error reporting — replaces Sentry.
 *
 * Errors flow: browser → Supabase `client_errors` table (rate-limited at 30/hr
 * per user/UA by the rate_limit_client_errors trigger). Operators query the
 * table in Supabase SQL Editor:
 *
 *   SELECT created_at, url, message, stack, user_id, user_agent
 *   FROM public.client_errors
 *   WHERE created_at > now() - INTERVAL '24 hours'
 *   ORDER BY created_at DESC;
 *
 * No third-party service. All data stays inside our Supabase project.
 */
import { supabase } from '@/lib/supabase'

let lastReportedKey = null
let lastReportedAt = 0

/**
 * Report an error. Non-blocking; never throws.
 * Extra context (componentStack, user action, etc.) is stored in `context`.
 */
export async function reportError(err, extra = {}) {
  try {
    if (import.meta.env.DEV) {
      // In dev, just log. We don't want every HMR error landing in error table.
      console.error('[reportError]', err, extra)
      return
    }

    const message = (err?.message || String(err || 'unknown')).slice(0, 500)
    const stack = (err?.stack || '').slice(0, 4000)

    // Deduplicate: skip the same message if we reported it in the last 30s.
    const key = `${message}::${(extra?.source || '')}`
    const now = Date.now()
    if (key === lastReportedKey && now - lastReportedAt < 30_000) return
    lastReportedKey = key
    lastReportedAt = now

    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))

    await supabase.from('client_errors').insert({
      user_id: user?.id ?? null,
      url: typeof window !== 'undefined' ? window.location.pathname : null,
      message,
      stack,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
      release_sha: import.meta.env.VITE_RELEASE_SHA ?? null,
      context: extra && Object.keys(extra).length ? extra : null,
    })
  } catch {
    // Swallow — reporting must never break the app.
  }
}

/**
 * Wire up global browser handlers. Call once at app startup.
 */
export function installGlobalErrorHandlers() {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    // Filter noisy ResizeObserver-loop errors (browser chrome noise).
    const msg = event.error?.message || event.message || ''
    if (msg.includes('ResizeObserver loop')) return
    reportError(event.error || new Error(msg), { source: 'window.error', filename: event.filename, lineno: event.lineno })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const err = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
    reportError(err, { source: 'unhandledrejection' })
  })
}
