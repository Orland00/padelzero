/**
 * Social Store — Follows, Activity Feed, Achievements
 *
 * Manages the social graph (player_follows), the activity feed
 * (recent matches from followed players), and achievements
 * earned by the current user (from player_achievements table).
 *
 * Updated: 2026-05-08
 */
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

// ─── Achievement metadata ────────────────────────────────────────────────────

/**
 * Metadata for all 10 achievement types.
 * icon: emoji, label: display name (Spanish).
 *
 * Updated: 2026-05-08
 */
export const ACHIEVEMENT_META = {
  primera_victoria:  { icon: '🥇', label: 'Primera victoria' },
  racha_5:           { icon: '🔥', label: 'Racha de 5' },
  nivel_3:           { icon: '📈', label: 'Nivel 3.0' },
  doble_10:          { icon: '🎾', label: '10 partidos' },
  veterano_20:       { icon: '🏅', label: 'Veterano (20)' },
  invicto_semana:    { icon: '⚡', label: 'Invicto semana' },
  nivel_5:           { icon: '💜', label: 'Nivel 5.0' },
  social_5:          { icon: '👥', label: '5 seguidores' },
  organizador:       { icon: '🏆', label: 'Organizador' },
  leyenda:           { icon: '⭐', label: 'Leyenda' },
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useSocialStore = create((set, get) => ({
  following: [],
  followersCount: 0,
  followingLoading: false,

  feed: [],
  feedLoading: false,

  achievements: [],

  /**
   * Load who the current user follows.
   *
   * Updated: 2026-05-08
   */
  loadFollowing: async (userId) => {
    set({ followingLoading: true })
    const { data } = await supabase
      .from('player_follows')
      .select('followee_id')
      .eq('follower_id', userId)

    set({
      following: (data || []).map(r => r.followee_id),
      followingLoading: false,
    })
  },

  /**
   * Load follower count for a target player.
   *
   * Updated: 2026-05-08
   */
  loadFollowersCount: async (targetId) => {
    const { count } = await supabase
      .from('player_follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('followee_id', targetId)

    set({ followersCount: count || 0 })
  },

  /**
   * Follow a player (optimistic update).
   *
   * Updated: 2026-05-08
   */
  follow: async (followerId, followeeId) => {
    set(state => ({ following: [...state.following, followeeId] }))

    const { error } = await supabase
      .from('player_follows')
      .insert({ follower_id: followerId, followee_id: followeeId })

    if (error) {
      set(state => ({ following: state.following.filter(id => id !== followeeId) }))
      return { error: error.message }
    }
    return { error: null }
  },

  /**
   * Unfollow a player (optimistic update).
   *
   * Updated: 2026-05-08
   */
  unfollow: async (followerId, followeeId) => {
    set(state => ({ following: state.following.filter(id => id !== followeeId) }))

    const { error } = await supabase
      .from('player_follows')
      .delete()
      .match({ follower_id: followerId, followee_id: followeeId })

    if (error) {
      set(state => ({ following: [...state.following, followeeId] }))
      return { error: error.message }
    }
    return { error: null }
  },

  // ─── Feed ──────────────────────────────────────────────────────────────────

  /**
   * Load activity feed: recent confirmed matches from followed players.
   *
   * Updated: 2026-05-08
   */
  loadFeed: async (userId) => {
    set({ feedLoading: true })

    const following = get().following
    if (following.length === 0) {
      set({ feed: [], feedLoading: false })
      return
    }

    const { data, error } = await supabase
      .from('matches')
      .select(`
        id, played_at, tipo, winner, sets,
        p1:profiles!p1_id(id, display_name, level),
        p2:profiles!p2_id(id, display_name, level)
      `)
      .in('p1_id', following)
      .eq('confirmation_status', 'confirmed')
      .order('played_at', { ascending: false })
      .limit(50)

    set({ feed: error ? [] : (data || []), feedLoading: false })
  },

  // ─── Achievements ──────────────────────────────────────────────────────────

  /**
   * Load achievements for a player.
   *
   * Updated: 2026-05-08
   */
  loadAchievements: async (userId) => {
    const { data } = await supabase
      .from('player_achievements')
      .select('achievement_key, unlocked_at')
      .eq('player_id', userId)
      .order('unlocked_at', { ascending: false })

    set({ achievements: data || [] })
  },
}))
