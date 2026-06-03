import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export const usePushStore = create((set, get) => ({
  pushEnabled: false,
  showBanner: false,

  initialize: (userId) => {
    if (!userId) return
    if (!('PushManager' in window) || !('Notification' in window)) return
    if (!VAPID_PUBLIC_KEY) return

    if (Notification.permission === 'granted') {
      set({ pushEnabled: true })
    } else if (Notification.permission === 'default') {
      if (!localStorage.getItem('pz_push_asked')) {
        set({ showBanner: true })
      }
    }
  },

  subscribe: async (userId) => {
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        set({ showBanner: false })
        localStorage.setItem('pz_push_asked', '1')
        return false
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const json = subscription.toJSON()
      await supabase.from('push_subscriptions').upsert(
        {
          user_id: userId,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: 'user_id,endpoint' }
      )

      set({ pushEnabled: true, showBanner: false })
      localStorage.setItem('pz_push_asked', '1')
      return true
    } catch (err) {
      console.error('Push subscription failed:', err)
      return false
    }
  },

  unsubscribe: async (userId) => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', endpoint)
      }
      set({ pushEnabled: false })
    } catch (err) {
      console.error('Push unsubscribe failed:', err)
    }
  },

  dismissBanner: () => {
    set({ showBanner: false })
    localStorage.setItem('pz_push_asked', '1')
  },
}))
