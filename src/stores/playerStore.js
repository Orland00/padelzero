/**
 * Player Store — Level, Rating History, and Match Confirmations
 *
 * Fetches the current user's Playtomic-style level (0.0–7.0),
 * paginated ELO change history, and any matches pending confirmation.
 * Uses the confirm_match_and_update_ratings RPC for atomic ELO updates.
 *
 * Updated: 2026-05-07
 */
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { eloToLevel } from '@/utils/eloEngine'

// ─── Store ───────────────────────────────────────────────────────────────────

export const usePlayerStore = create((set, get) => ({
  // Profile with level
  profile: null,
  level: null,

  // Paginated rating history (20 per page)
  history: [],
  historyPage: 0,
  historyHasMore: true,
  historyLoading: false,

  // Matches this user needs to confirm or dispute
  pendingConfirmations: [],
  confirmationsLoading: false,

  error: null,

  /**
   * Load profile and derive level from elo_rating.
   * Updated: 2026-05-07
   */
  loadProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, elo_rating, level, matches_played, matches_won, achievements')
      .eq('id', userId)
      .single()

    if (error || !data) {
      set({ error: error?.message || 'Profile not found' })
      return
    }

    // Use DB level if available; fallback to client formula
    const level = data.level ?? eloToLevel(data.elo_rating)
    set({ profile: data, level })
  },

  // ─── Rating History ────────────────────────────────────────────────────────

  /**
   * Load paginated ELO history for a player (20 per page).
   * Updated: 2026-05-07
   */
  loadHistory: async (userId, reset = false) => {
    if (get().historyLoading) return
    const page = reset ? 0 : get().historyPage
    const PAGE_SIZE = 20

    set({ historyLoading: true })

    const { data, error } = await supabase
      .from('player_rating_history')
      .select('id, match_id, elo_before, elo_after, level_before, level_after, delta_elo, created_at')
      .eq('player_id', userId)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (error) {
      set({ historyLoading: false, error: error.message })
      return
    }

    set(state => ({
      history: reset ? (data || []) : [...state.history, ...(data || [])],
      historyPage: page + 1,
      historyHasMore: (data?.length || 0) === PAGE_SIZE,
      historyLoading: false,
    }))
  },

  // ─── Match Confirmations ───────────────────────────────────────────────────

  /**
   * Load matches where the current user is a participant and
   * confirmation_status is 'pending' and they haven't decided yet.
   * Updated: 2026-05-07
   */
  loadPendingConfirmations: async (userId) => {
    set({ confirmationsLoading: true })

    const { data, error } = await supabase
      .from('matches')
      .select('id, p1_id, p1b_id, p2_id, p2b_id, winner, sets, played_at, confirmation_status, tipo')
      .or(`p1_id.eq.${userId},p1b_id.eq.${userId},p2_id.eq.${userId},p2b_id.eq.${userId}`)
      .eq('confirmation_status', 'pending')
      .order('played_at', { ascending: false })
      .limit(10)

    if (error) {
      set({ confirmationsLoading: false })
      return
    }

    const matchIds = (data || []).map(m => m.id)
    if (matchIds.length === 0) {
      set({ pendingConfirmations: [], confirmationsLoading: false })
      return
    }

    const { data: decided } = await supabase
      .from('match_confirmations')
      .select('match_id')
      .eq('player_id', userId)
      .in('match_id', matchIds)

    const decidedIds = new Set((decided || []).map(d => d.match_id))
    const pending = (data || []).filter(m => !decidedIds.has(m.id))

    set({ pendingConfirmations: pending, confirmationsLoading: false })
  },

  /**
   * Confirm or dispute a match.
   * Updated: 2026-05-07
   */
  decideMatch: async (matchId, decision, userId) => {
    const { error: decErr } = await supabase
      .from('match_confirmations')
      .insert({ match_id: matchId, player_id: userId, decision })

    if (decErr) return { error: decErr.message }

    if (decision === 'confirm') {
      const { error: rpcErr } = await supabase
        .rpc('confirm_match_and_update_ratings', { p_match_id: matchId })

      if (rpcErr && !rpcErr.message.includes('needs confirmation')) {
        return { error: rpcErr.message }
      }
    }

    set(state => ({
      pendingConfirmations: state.pendingConfirmations.filter(m => m.id !== matchId)
    }))

    return { error: null }
  },
}))
