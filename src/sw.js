import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import {
  NetworkFirst,
  CacheFirst,
} from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// ---------------------------------------------------------------------------
// Precaching — Workbox injects the manifest here at build time
// ---------------------------------------------------------------------------
precacheAndRoute(self.__WB_MANIFEST)

// Wait for the client to confirm the update via SKIP_WAITING (sent by
// useRegisterSW when the user accepts the "Nueva versión disponible" prompt).
// Auto-skipWaiting on install would activate the new SW before the user can
// confirm, defeating registerType: 'prompt' in vite.config.js.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// ---------------------------------------------------------------------------
// Runtime caching
// ---------------------------------------------------------------------------

// Supabase API — NetworkFirst with 5 s timeout (GET only — never cache mutations).
// Do not cache profiles; profile rows can include PII and must not persist
// across users on shared browsers.
registerRoute(
  ({ url, request }) =>
    url.hostname.endsWith('.supabase.co') &&
    request.method === 'GET' &&
    !url.pathname.includes('/auth/') &&
    !url.pathname.includes('/rest/v1/profiles'),
  new NetworkFirst({
    cacheName: 'supabase-data-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 }),
    ],
  })
)

// Images — CacheFirst (30 days)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
)

// Google Fonts — CacheFirst (1 year)
registerRoute(
  /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
)

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'PadelZero', body: event.data ? event.data.text() : '' }
  }

  const title = data.title ?? 'PadelZero'
  const options = {
    body: data.body ?? '',
    icon: data.icon ?? '/icons/icon-192x192.png',
    badge: data.badge ?? '/icons/icon-192x192.png',
    data: data.data ?? {},
    vibrate: [100, 50, 100],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ---------------------------------------------------------------------------
// Notification click — focus existing tab or open a new one
// ---------------------------------------------------------------------------

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url ?? '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an already-open window on the same origin if possible
        for (const client of clientList) {
          if ('focus' in client) {
            if (client.url.startsWith(self.location.origin)) {
              client.navigate(targetUrl)
              return client.focus()
            }
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      })
  )
})
