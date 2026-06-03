import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './authStore'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  subscription: null,

  initialize: async () => {
    const { user } = useAuthStore.getState()
    if (!user?.id) return

    set({ loading: true })
    // Join sender profile so the UI can render "from whom" without a second round-trip.
    const { data } = await supabase
      .from('notifications')
      .select('id, recipient_id, sender_id, type, title, message, data, is_read, created_at, sender:profiles!sender_id(id, display_name, avatar_url, username)')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    set({
      notifications: data || [],
      unreadCount: data?.filter(n => !n.is_read).length || 0,
      loading: false,
    })

    // Setup real-time subscription
    get().setupSubscription()
  },

  setupSubscription: () => {
    const { user } = useAuthStore.getState()
    if (!user?.id) return

    // Clean up existing subscription
    const currentSub = get().subscription
    if (currentSub) currentSub.unsubscribe()

    const newSub = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          // Realtime payload only has raw columns — resolve sender profile
          // so the notification card shows "from whom" immediately.
          let sender = null
          if (payload.new.sender_id) {
            const { data } = await supabase
              .from('profiles')
              .select('id, display_name, avatar_url, username')
              .eq('id', payload.new.sender_id)
              .maybeSingle()
            sender = data
          }
          set((state) => ({
            notifications: [{ ...payload.new, sender }, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          }))
        }
      )
      .subscribe()

    set({ subscription: newSub })
  },

  cleanup: () => {
    const sub = get().subscription
    if (sub) sub.unsubscribe()
    set({ notifications: [], unreadCount: 0, subscription: null })
  },

  markAsRead: async (notificationId) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }))

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
  },

  acceptFriendRequest: async (notification) => {
    const friendshipId = notification.data?.friendship_id
    if (!friendshipId) return

    // Update friendship
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)

    // Mark as read
    await get().markAsRead(notification.id)
  },

  rejectFriendRequest: async (notification) => {
    const friendshipId = notification.data?.friendship_id
    if (!friendshipId) return

    // Delete friendship request
    await supabase.from('friendships').delete().eq('id', friendshipId)

    // Mark as read
    await get().markAsRead(notification.id)
  },

  acceptLigaInvite: async (notification) => {
    const ligaId = notification.data?.liga_id
    const memberId = notification.data?.member_id
    if (!ligaId || !memberId) return

    // Ownership check: only the intended recipient may accept
    const { user } = useAuthStore.getState()
    if (!user?.id) return

    // Update member status — restrict to the current user's player_id
    await supabase
      .from('liga_members')
      .update({ status: 'active' })
      .eq('id', memberId)
      .eq('player_id', user.id)

    // Mark as read
    await get().markAsRead(notification.id)
  },

  rejectLigaInvite: async (notification) => {
    const memberId = notification.data?.member_id
    if (!memberId) return

    // Ownership check: only the intended recipient may reject
    const { user } = useAuthStore.getState()
    if (!user?.id) return

    // Delete — restrict to the current user's player_id
    await supabase.from('liga_members').delete().eq('id', memberId).eq('player_id', user.id)

    // Mark as read
    await get().markAsRead(notification.id)
  },
}))
