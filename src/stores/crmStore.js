/**
 * CRM Store — Coach Notes + Club Analytics
 *
 * Manages private coach notes per student (crm_notes table) with the
 * Privacy Guard: coaches own their notes; students can only read notes
 * where is_shared=true. All privacy enforcement is at DB/RLS level.
 *
 * Also manages club-level player stats (crm_player_stats) for the
 * occupancy dashboard and heavy user segmentation.
 *
 * Updated: 2026-05-07
 */
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

// ─── Predefined skill tags for padel coaching ────────────────────────────────

/**
 * 10 standardized diagnostic tags for coach note classification.
 * GIN-indexed in the DB for efficient "find all students with tag X" queries.
 *
 * Updated: 2026-05-07
 */
export const PREDEFINED_TAGS = [
  'bandeja',
  'vibora',
  'chiquita',
  'saque_fuerte',
  'mala_volea',
  'fondo_fisico_bajo',
  'reves',
  'drive',
  'globo',
  'smash',
]

// ─── Store ───────────────────────────────────────────────────────────────────

export const useCrmStore = create((set, get) => ({
  // Notes for the currently viewed student
  notes: [],
  notesLoading: false,

  // Club stats
  clubStats: [],
  clubStatsLoading: false,

  // Occupancy data: array of { date, hour, count }
  occupancy: [],
  occupancyLoading: false,

  error: null,

  /**
   * Load notes that the current coach wrote about a specific student.
   * RLS ensures only the author can see unshared notes.
   *
   * Updated: 2026-05-07
   */
  loadNotes: async (targetId) => {
    set({ notesLoading: true, notes: [] })

    const { data, error } = await supabase
      .from('crm_notes')
      .select('id, content, tags, is_shared, created_at, updated_at')
      .eq('target_id', targetId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      // Security Mandate: Log the access
      await supabase.rpc('log_crm_access', {
        p_target_id: targetId,
        p_action: 'view_notes'
      })
    }

    set({ notes: data || [], notesLoading: false, error: error?.message || null })
  },

  /**
   * Save a new note for a student.
   * author_id is set server-side via RLS (auth.uid() = author_id CHECK).
   *
   * Updated: 2026-05-07
   */
  saveNote: async ({ authorId, targetId, content, tags, isShared }) => {
    const { data, error } = await supabase
      .from('crm_notes')
      .insert({
        author_id: authorId,
        target_id: targetId,
        content,
        tags: tags || [],
        is_shared: isShared || false,
      })
      .select('id, author_id, target_id, content, tags, is_shared, created_at, updated_at')

    if (error) return { error: error.message }

    set(state => ({ notes: [data[0], ...state.notes] }))
    return { error: null, note: data[0] }
  },

  /**
   * Toggle the is_shared flag on an existing note.
   *
   * Updated: 2026-05-07
   */
  toggleShare: async (noteId, currentShared) => {
    const newShared = !currentShared

    const { error } = await supabase
      .from('crm_notes')
      .update({ is_shared: newShared, updated_at: new Date().toISOString() })
      .eq('id', noteId)

    if (error) return { error: error.message }

    set(state => ({
      notes: state.notes.map(n =>
        n.id === noteId ? { ...n, is_shared: newShared } : n
      )
    }))

    return { error: null }
  },

  /**
   * Load club-level player stats sorted by heavy_user_score DESC.
   * Used by HeavyUsersList component.
   *
   * Updated: 2026-05-07
   */
  loadClubStats: async (limit = 10) => {
    set({ clubStatsLoading: true })

    const { data, error } = await supabase
      .from('crm_player_stats')
      .select(`
        player_id, freq_classes_taken, freq_classes_cancelled,
        total_spend, pending_debt, heavy_user_score,
        profile:profiles!player_id(id, display_name, avatar_url, level)
      `)
      .order('heavy_user_score', { ascending: false })
      .limit(limit)

    set({ clubStats: data || [], clubStatsLoading: false })
  },

  /**
   * Update club stats for a player (upsert).
   *
   * Updated: 2026-05-07
   */
  upsertPlayerStats: async (playerId, updates) => {
    const { error } = await supabase
      .from('crm_player_stats')
      .upsert({ player_id: playerId, ...updates, updated_at: new Date().toISOString() })

    return { error: error?.message || null }
  },

  /**
   * Load 7-day occupancy data from club_bookings.
   * Aggregates by (date, hour) client-side for the heatmap.
   *
   * Updated: 2026-05-07
   */
  loadOccupancy: async (clubId) => {
    set({ occupancyLoading: true })

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data, error } = await supabase
      .from('club_bookings')
      .select('booking_date, start_time, status')
      .eq('club_id', clubId)
      .gte('booking_date', sevenDaysAgo.toISOString().split('T')[0])
      .neq('status', 'cancelled')

    if (error) {
      set({ occupancyLoading: false })
      return
    }

    const map = {}
    ;(data || []).forEach(b => {
      const hour = b.start_time?.slice(0, 2) || '00'
      const key = `${b.booking_date}|${hour}`
      map[key] = (map[key] || 0) + 1
    })

    const occupancy = Object.entries(map).map(([key, count]) => {
      const [date, hour] = key.split('|')
      return { date, hour: parseInt(hour, 10), count }
    })

    set({ occupancy, occupancyLoading: false })
  },
}))
