/**
 * Open Match Store
 *
 * Manages the "Buscar partido" feed: open matches where the current player
 * can request to fill an empty slot. Filters by level ±0.5 of the viewer.
 *
 * Match rows must have is_open=true and slots_needed>0 (set by v15_04 migration).
 *
 * Updated: 2026-05-08
 */
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export const useOpenMatchStore = create((set, get) => ({
  feed: [],
  loading: false,
  error: null,

  /**
   * Load open matches filtered by level range (viewer's level ±0.5).
   * Passes 0/7 as bounds when level is unknown to return all open matches.
   *
   * Updated: 2026-05-08
   */
  loadFeed: async (viewerLevel = null) => {
    set({ loading: true, error: null })

    const levelMin = viewerLevel != null ? Math.max(0, viewerLevel - 0.5) : 0
    const levelMax = viewerLevel != null ? Math.min(7, viewerLevel + 0.5) : 7

    const { data, error } = await supabase
      .from('matches')
      .select(`
        id, played_at, tipo, slots_needed, level_min, level_max,
        p1_id, p1b_id, p2_id, p2b_id,
        creator:profiles!p1_id(id, display_name, avatar_url, level)
      `)
      .eq('is_open', true)
      .gt('slots_needed', 0)
      .gte('level_max', levelMin)
      .lte('level_min', levelMax)
      .order('played_at', { ascending: true })
      .limit(30)

    if (error) {
      set({ loading: false, error: error.message })
      return
    }

    set({ feed: data || [], loading: false })
  },

  // ─── Join Action ──────────────────────────────────────────────────────────

  /**
   * Join an open match by filling the next empty slot and decrementing slots_needed.
   * Returns { error } on failure.
   *
   * Updated: 2026-05-08
   */
  joinMatch: async (matchId, userId) => {
    const { data: match, error: fetchErr } = await supabase
      .from('matches')
      .select('slots_needed, p1_id, p1b_id, p2_id, p2b_id')
      .eq('id', matchId)
      .single()

    if (fetchErr || !match) return { error: fetchErr?.message || 'Match not found' }
    if (match.slots_needed <= 0) return { error: 'No slots available' }

    // Fill the first null player slot (p1 is creator, so skip it)
    const slotField = [
      { field: 'p1b_id', current: match.p1b_id },
      { field: 'p2_id', current: match.p2_id },
      { field: 'p2b_id', current: match.p2b_id },
    ].find(s => s.current == null)

    if (!slotField) return { error: 'No empty slot found' }

    const newSlotsNeeded = match.slots_needed - 1
    const { error } = await supabase
      .from('matches')
      .update({
        [slotField.field]: userId,
        slots_needed: newSlotsNeeded,
        is_open: newSlotsNeeded > 0,
      })
      .eq('id', matchId)

    if (error) return { error: error.message }

    if (newSlotsNeeded === 0) {
      set(state => ({ feed: state.feed.filter(m => m.id !== matchId) }))
    }

    return { error: null }
  },
}))
