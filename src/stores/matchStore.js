import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { queueMatch } from '@/lib/offlineQueue'
import { getSpanishError } from '@/utils/errorMessages'
import { useUiStore } from '@/stores/uiStore'

const MATCH_COLUMNS = 'id, p1_id, p1b_id, p2_id, p2b_id, formato, tipo, club_id, court_number, best_of, live_state, sets, winner, finished, played_at, confirmation_status, created_by, created_at, updated_at'

export const useMatchStore = create((set, get) => ({
  currentMatch: null,
  matches: [],
  matchSubscription: null,
  loading: false,
  creating: false,
  error: null,

  createMatch: async (p1Id, p1bId, p2Id, p2bId, setsToWin, tipo, clubId, courtNumber, useAdvantage = true) => {
    if (get().creating) return { data: null, error: 'Already creating' }
    set({ creating: true })
    // If offline, queue for later and return gracefully
    if (!navigator.onLine) {
      const { data: { user } } = await supabase.auth.getUser()
      await queueMatch({ p1Id, p1bId, p2Id, p2bId, setsToWin, tipo, clubId, courtNumber }, user?.id || null)
      return { data: null, error: null, queued: true }
    }

    try {
      const { data, error } = await supabase
        .from('matches')
        .insert({
          p1_id: p1Id,
          p1b_id: p1bId || null,
          p2_id: p2Id,
          p2b_id: p2bId || null,
          formato: p1bId && p2bId ? '2v2' : '1v1',
          tipo,
          club_id: clubId,
          court_number: courtNumber,
          best_of: setsToWin,
          live_state: { 
            p1_points: 0, 
            p2_points: 0,
            is_points_mode: setsToWin >= 7,
            points_limit: setsToWin >= 7 ? setsToWin : 0,
            use_advantage: useAdvantage
          },
          sets: [],
          finished: false,
        })
        .select(MATCH_COLUMNS)
        .single()

      if (error) {
        set({ loading: false, creating: false })
        return { data: null, error: error }
      }

      set({ currentMatch: data, loading: false, creating: false })
      return { data, error: null }
    } catch (err) {
      const errorMsg = getSpanishError(err)
      set({ error: errorMsg, loading: false, creating: false })
      useUiStore.getState().showToast({ type: 'error', message: errorMsg })
      return { data: null, error: { message: errorMsg } }
    }
  },


  fetchMatch: async (matchId) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(
          `
          ${MATCH_COLUMNS},
          p1:profiles!p1_id(id, display_name, elo_rating),
          p1b:profiles!p1b_id(id, display_name, elo_rating),
          p2:profiles!p2_id(id, display_name, elo_rating),
          p2b:profiles!p2b_id(id, display_name, elo_rating),
          club:clubs(id, name)
        `
        )
        .eq('id', matchId)
        .single()

      if (error) throw error
      set({ currentMatch: data, loading: false })
      return { data, error: null }
    } catch (err) {
      set({ error: err.message, loading: false })
      return { data: null, error: err }
    }
  },

  fetchMatches: async (filters = {}) => {
    set({ loading: true, error: null })
    try {
      let query = supabase
        .from('matches')
        .select(
          `
          ${MATCH_COLUMNS},
          p1:profiles!p1_id(id, display_name, elo_rating),
          p1b:profiles!p1b_id(id, display_name, elo_rating),
          p2:profiles!p2_id(id, display_name, elo_rating),
          p2b:profiles!p2b_id(id, display_name, elo_rating),
          club:clubs(id, name)
        `,
          { count: 'exact' }
        )

      // Apply filters
      if (filters.playerId) {
        query = query.or(`p1_id.eq.${filters.playerId},p2_id.eq.${filters.playerId}`)
      }

      if (filters.finished !== undefined) {
        query = query.eq('finished', filters.finished)
      }

      if (filters.clubId) {
        query = query.eq('club_id', filters.clubId)
      }

      // Pagination
      const offset = (filters.page || 0) * (filters.limit || 10)
      query = query.order('created_at', { ascending: false }).range(offset, offset + (filters.limit || 10) - 1)

      const { data, error, count } = await query

      if (error) throw error
      set({ matches: data || [], loading: false })
      return { data: { matches: data || [], count }, error: null }
    } catch (err) {
      set({ error: err.message, loading: false })
      return { data: null, error: err }
    }
  },

  updateScore: async (matchId, setIndex, p1Points, p2Points) => {
    set({ loading: true, error: null })
    try {
      const { currentMatch } = get()

      // Update live_state
      const updatedLiveState = {
        ...currentMatch.live_state,
        p1_points: p1Points,
        p2_points: p2Points,
      }

      const { data, error } = await supabase
        .from('matches')
        .update({ live_state: updatedLiveState, updated_at: new Date().toISOString() })
        .eq('id', matchId)
        .select(MATCH_COLUMNS)
        .single()

      if (error) throw error
      set({ currentMatch: data, loading: false })
      return { data, error: null }
    } catch (err) {
      set({ error: err.message, loading: false })
      return { data: null, error: err }
    }
  },

  finishMatch: async (matchId, winnerId, p1Points = null, p2Points = null, sets = null) => {
    set({ loading: true, error: null })
    try {
      // Call Supabase Edge Function to update ELO and finish match securely
      const { data, error } = await supabase.functions.invoke('finish_match', {
        body: {
          match_id: matchId,
          winner_id: winnerId,
          p1_pts: p1Points,
          p2_pts: p2Points,
          scores: sets,
        }
      })

      if (error) throw error

      // Fetch updated match
      const { data: updatedMatch, error: fetchError } = await supabase
        .from('matches')
        .select(MATCH_COLUMNS)
        .eq('id', matchId)
        .single()

      if (fetchError) throw fetchError

      set({ currentMatch: updatedMatch, loading: false })
      return { data: updatedMatch, error: null }
    } catch (err) {
      set({ error: err.message, loading: false })
      return { data: null, error: err }
    }
  },

  subscribeToMatch: (matchId, callback) => {
    // Clean up old subscription
    const { matchSubscription } = get()
    if (matchSubscription) {
      supabase.removeChannel(matchSubscription)
    }

    // Subscribe to match updates (Supabase v2 syntax)
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        (payload) => {
          set({ currentMatch: payload.new })
          if (callback) callback(payload.new)
        }
      )
      .subscribe()

    set({ matchSubscription: channel })

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel)
      set({ matchSubscription: null })
    }
  },

  unsubscribe: () => {
    const { matchSubscription } = get()
    if (matchSubscription) {
      supabase.removeChannel(matchSubscription)
      set({ matchSubscription: null })
    }
  },

  clearMatch: () => {
    set({ currentMatch: null, error: null })
  },
}))
