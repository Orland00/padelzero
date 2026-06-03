import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getSpanishError } from '@/utils/errorMessages'
import { useUiStore } from '@/stores/uiStore'
import { tStandalone } from '@/lib/i18n'
import { LIGA_FOREVER_ID, LIGA_PROLEAGUE_ID } from '@/lib/constants'
import { validateLigaScore } from '@/lib/ligaRules'

export const useLigaStore = create((set, get) => ({
  ligas: [],
  currentLiga: null,
  members: [],
  jornadas: [],
  standings: [],
  crownHistory: [],
  ligaMatches: [],
  pairStats: [],
  teamStats: [],
  loading: false,
  recording: false,
  error: null,

  // Fetch all ligas user is in
  fetchMyLigas: async () => {
    set({ loading: true, error: null })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('liga_members')
        .select('liga_id, ligas(id, name, format, description, schedule, is_active, join_code, max_members, max_score, created_by, created_at, updated_at)')
        .eq('player_id', user.id)

      if (error) throw error
      const ligas = data?.map(m => m.ligas).filter(Boolean) || []
      set({ ligas })
    } catch (err) {
      set({ error: err.message })
    } finally {
      set({ loading: false })
    }
  },

  // Fetch single liga + members + standings (Task 16)
  fetchLiga: async (ligaId) => {
    set({ loading: true, error: null })
    try {
      const { data: liga, error: ligaErr } = await supabase
        .from('ligas')
        .select('id, name, description, schedule, created_by, format, is_active, join_code, max_members, max_score, created_at, updated_at')
        .eq('id', ligaId)
        .single()

      if (ligaErr) throw ligaErr

      const { data: members, error: memberErr } = await supabase
        .from('liga_members')
        .select('id, player_id, role, status, joined_at, profiles(id, display_name, avatar_url)')
        .eq('liga_id', ligaId)

      if (memberErr) throw memberErr

      const { data: standings, error: standErr } = await supabase
        .from('liga_standings')
        .select('*, profile:player_id(id, display_name, avatar_url)')
        .eq('liga_id', ligaId)
        .order('total_points', { ascending: false })

      if (standErr) throw standErr

      set({
        currentLiga: liga,
        members: members || [],
        standings: standings || [],
      })
    } catch (err) {
      set({ error: err.message })
    } finally {
      set({ loading: false })
    }
  },

  // Fetch jornadas for current liga
  fetchJornadas: async (ligaId) => {
    try {
      const { data, error } = await supabase
        .from('jornadas')
        .select('id, liga_id, jornada_number, date, status, completed_at, created_by')
        .eq('liga_id', ligaId)
        .order('date', { ascending: false })

      if (error) throw error
      set({ jornadas: data || [] })
    } catch (err) {
      set({ error: err.message })
    }
  },

  // Fetch crown history for current liga
  fetchCrownHistory: async (ligaId) => {
    try {
      const { data, error } = await supabase
        .from('crown_history')
        .select('id, liga_id, crowned_at, from_player_id, to_player_id, reason')
        .eq('liga_id', ligaId)
        .order('crowned_at', { ascending: false })

      if (error) throw error
      set({ crownHistory: data || [] })
    } catch (err) {
      set({ error: err.message })
    }
  },

  // Create a new liga (Task 17)
  createLiga: async (name, description, schedule) => {
    set({ loading: true, error: null })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: liga, error: ligaErr } = await supabase
        .from('ligas')
        .insert({
          name,
          description,
          schedule,
          created_by: user.id,
          format: 'americano',
        })
        .select('id, name, description, schedule, created_by, format, is_active, join_code, max_members, max_score, created_at, updated_at')
        .single()

      if (ligaErr) throw ligaErr

      // Add creator as admin with active status
      const { error: memberErr } = await supabase
        .from('liga_members')
        .insert({
          liga_id: liga.id,
          player_id: user.id,
          role: 'admin',
          status: 'active',
          is_active: true,
        })

      if (memberErr) throw memberErr

      set(state => ({ ligas: [...state.ligas, liga] }))
      return liga
    } catch (err) {
      set({ error: err.message })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  // Join a liga (Task 18)
  joinLiga: async (ligaId) => {
    set({ loading: true, error: null })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Forever League: instant join (active). ProLeague + others: request access (pending).
      const isOpenLiga = ligaId === LIGA_FOREVER_ID
      const { error } = await supabase
        .from('liga_members')
        .insert({
          liga_id: ligaId,
          player_id: user.id,
          role: 'player',
          status: isOpenLiga ? 'active' : 'pending',
          is_active: isOpenLiga,
        })

      if (error) {
        if (error.message && error.message.includes('Liga is full')) {
          throw new Error('Esta liga está llena (máximo de jugadores alcanzado)')
        }
        throw error
      }
      await get().fetchLiga(ligaId)
    } catch (err) {
      set({ error: err.message })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  // Remove member from liga (Task 20)
  removeMember: async (memberId, ligaId) => {
    set({ loading: true, error: null })
    try {
      // Verify caller is admin
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: callerMember } = await supabase.from('liga_members').select('role').eq('liga_id', ligaId).eq('player_id', user.id).maybeSingle()
      if (!callerMember || (callerMember.role !== 'admin' && callerMember.role !== 'creator')) throw new Error('Solo admins pueden eliminar miembros')

      const { error } = await supabase
        .from('liga_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error
      await get().fetchLiga(ligaId)
    } catch (err) {
      set({ error: err.message })
      useUiStore.getState().showToast({ type: 'error', message: err.message || 'Error al eliminar miembro', duration: 3000 })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  // Update liga (Task 20)
  updateLiga: async (ligaId, updates) => {
    set({ loading: true, error: null })
    try {
      // Verify caller is admin
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: callerMember } = await supabase.from('liga_members').select('role').eq('liga_id', ligaId).eq('player_id', user.id).maybeSingle()
      if (!callerMember || (callerMember.role !== 'admin' && callerMember.role !== 'creator')) throw new Error('Solo admins pueden actualizar la liga')

      const { error } = await supabase
        .from('ligas')
        .update(updates)
        .eq('id', ligaId)

      if (error) throw error
      await get().fetchLiga(ligaId)
    } catch (err) {
      set({ error: err.message })
    } finally {
      set({ loading: false })
    }
  },

  // Fetch activity feed for current liga (Task 17)
  fetchActivityFeed: async (ligaId, daysBack = 30) => {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysBack)
      const cutoffIso = cutoffDate.toISOString()

      const events = []

      // Fetch crown transfers
      const { data: crowns, error: crownErr } = await supabase
        .from('crown_history')
        .select('*, profiles:player_id(id, display_name, avatar_url), dethroned:dethroned_id(id, display_name, avatar_url)')
        .eq('liga_id', ligaId)
        .gte('crowned_at', cutoffIso)
        .order('crowned_at', { ascending: false })

      if (crownErr) throw crownErr

      crowns?.forEach(c => {
        events.push({
          id: c.id,
          type: 'crown_transfer',
          timestamp: c.crowned_at,
          player: c.profiles,
          previousHolder: c.dethroned,
          eventData: c,
        })
      })

      // Fetch jornada creations and completions
      const { data: jornadas, error: jornadaErr } = await supabase
        .from('jornadas')
        .select('*, created_by_profile:created_by(id, display_name, avatar_url)')
        .eq('liga_id', ligaId)
        .gte('created_at', cutoffIso)
        .order('created_at', { ascending: false })

      if (jornadaErr) throw jornadaErr

      jornadas?.forEach(j => {
        // Jornada created
        events.push({
          id: `jornada-created-${j.id}`,
          type: 'jornada_created',
          timestamp: j.created_at,
          player: j.created_by_profile,
          eventData: j,
        })

        // Jornada completed (if applicable)
        if (j.status === 'completed' && j.completed_at && new Date(j.completed_at) >= cutoffDate) {
          events.push({
            id: `jornada-completed-${j.id}`,
            type: 'jornada_completed',
            timestamp: j.completed_at,
            eventData: j,
          })
        }
      })

      // Fetch new members
      const { data: members, error: memberErr } = await supabase
        .from('liga_members')
        .select('*, profiles:player_id(id, display_name, avatar_url)')
        .eq('liga_id', ligaId)
        .gte('joined_at', cutoffIso)
        .order('joined_at', { ascending: false })

      if (memberErr) throw memberErr

      members?.forEach(m => {
        events.push({
          id: m.id,
          type: 'member_joined',
          timestamp: m.joined_at,
          player: m.profiles,
          eventData: m,
        })
      })

      // Sort all events by timestamp (newest first)
      events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

      return events
    } catch (err) {
      set({ error: err.message })
      throw err
    }
  },

  // Subscribe to liga activity updates
  subscribeActivity: (ligaId, onUpdate) => {
    const channel = supabase.channel(`activity:${ligaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crown_history', filter: `liga_id=eq.${ligaId}` },
        onUpdate
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jornadas', filter: `liga_id=eq.${ligaId}` },
        onUpdate
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'liga_members', filter: `liga_id=eq.${ligaId}` },
        onUpdate
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  },

  // Subscribe to liga updates
  subscribeLiga: (ligaId) => {
    const channel = supabase.channel(`liga:${ligaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'liga_standings', filter: `liga_id=eq.${ligaId}` },
        () => get().fetchLiga(ligaId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jornadas', filter: `liga_id=eq.${ligaId}` },
        () => get().fetchJornadas(ligaId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'liga_members', filter: `liga_id=eq.${ligaId}` },
        () => get().fetchLiga(ligaId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'liga_matches', filter: `liga_id=eq.${ligaId}` },
        () => {
          get().fetchLigaMatches(ligaId)
          get().fetchPairStats(ligaId)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  },

  // Fetch liga matches (direct matches, not americano)
  fetchLigaMatches: async (ligaId) => {
    try {
      const { data, error } = await supabase
        .from('liga_matches')
        .select(`
          *,
          p1:team_a_player1(id, display_name, avatar_url),
          p2:team_a_player2(id, display_name, avatar_url),
          p3:team_b_player1(id, display_name, avatar_url),
          p4:team_b_player2(id, display_name, avatar_url),
          recorder:recorded_by(id, display_name)
        `)
        .eq('liga_id', ligaId)
        .order('played_at', { ascending: false })

      if (error) throw error
      set({ ligaMatches: data || [] })
    } catch (err) {
      set({ error: err.message })
    }
  },

  // Record a new liga match via atomic server-side RPC
  recordLigaMatch: async (ligaId, { teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2, scoreTeamA, scoreTeamB }) => {
    if (get().recording) return { error: 'Already recording' }
    set({ loading: true, recording: true, error: null })
    try {
      const currentLiga = get().currentLiga?.id === ligaId ? get().currentLiga : {}
      const scoreValidation = validateLigaScore(scoreTeamA, scoreTeamB, currentLiga)
      if (!scoreValidation.valid) {
        throw new Error(scoreValidation.message)
      }

      // Single atomic RPC: ELO calculation, match insert, profile updates,
      // standings, pair stats, team stats, elo_history — all in one transaction
      const { data, error } = await supabase.rpc('record_liga_match', {
        p_liga_id: ligaId,
        p_team_a_player1: teamAPlayer1,
        p_team_a_player2: teamAPlayer2,
        p_team_b_player1: teamBPlayer1,
        p_team_b_player2: teamBPlayer2,
        p_score_team_a: scoreTeamA,
        p_score_team_b: scoreTeamB,
      })
      if (error) throw error

      // Refresh data in parallel
      await Promise.all([get().fetchLiga(ligaId), get().fetchLigaMatches(ligaId)])

      // Parse result for callers that use eloChanges
      const eloChanges = data?.elo_changes?.map(c => ({
        playerId: c.playerId, oldElo: c.oldElo, newElo: c.newElo, delta: c.delta,
      })) || []

      return { match: { id: data?.match_id }, eloChanges }
    } catch (err) {
      const spanishMsg = getSpanishError(err)
      set({ error: spanishMsg })
      useUiStore.getState().showToast({ type: 'error', message: spanishMsg })
      throw err
    } finally {
      set({ loading: false, recording: false })
    }
  },

  // Fetch pair stats
  fetchPairStats: async (ligaId) => {
    try {
      const { data, error } = await supabase
        .from('liga_pair_stats')
        .select(`
          *,
          player1:player1_id(id, display_name, avatar_url),
          player2:player2_id(id, display_name, avatar_url)
        `)
        .eq('liga_id', ligaId)
        .order('matches_won', { ascending: false })

      if (error) throw error
      set({ pairStats: data || [] })
    } catch (err) {
      set({ error: err.message })
    }
  },

  // ═══ PARITY FEATURES (matching proleagueStore patterns) ═══

  // Delete match with atomic ELO reversal via RPC
  deleteMatch: async (matchId, ligaId) => {
    set({ loading: true })
    try {
      const { error } = await supabase.rpc('delete_liga_match', {
        p_match_id: matchId,
        p_liga_id: ligaId,
      })
      if (error) throw error
      await get().fetchLiga(ligaId)
      await get().fetchLigaMatches(ligaId)
      await get().fetchPairStats(ligaId)
      useUiStore.getState().showToast({ type: 'success', message: tStandalone('toast.match_deleted') })
    } catch (err) {
      const msg = getSpanishError(err)
      set({ error: msg })
      useUiStore.getState().showToast({ type: 'error', message: msg })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  // Leave a liga (self-remove)
  leaveLiga: async (ligaId) => {
    set({ loading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('liga_members').delete().eq('liga_id', ligaId).eq('player_id', user.id)
      if (error) throw error
      set(state => ({ ligas: state.ligas.filter(l => l.id !== ligaId) }))
      return { error: null }
    } catch (err) {
      set({ error: err.message })
      return { error: err }
    } finally {
      set({ loading: false })
    }
  },

  // Delete entire liga (creator only)
  deleteLiga: async (ligaId) => {
    set({ loading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      // Verify creator
      const { data: liga } = await supabase.from('ligas').select('created_by').eq('id', ligaId).single()
      if (liga?.created_by !== user.id) throw new Error('Solo el creador puede eliminar la liga')
      const { error } = await supabase.from('ligas').delete().eq('id', ligaId)
      if (error) throw error
      set(state => ({ ligas: state.ligas.filter(l => l.id !== ligaId) }))
      return { error: null }
    } catch (err) {
      set({ error: err.message })
      return { error: err }
    } finally {
      set({ loading: false })
    }
  },

  // Admin: add player directly to liga
  addMember: async (ligaId, playerId) => {
    try {
      // Verify caller is admin
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: callerMember } = await supabase.from('liga_members').select('role').eq('liga_id', ligaId).eq('player_id', user.id).maybeSingle()
      if (!callerMember || (callerMember.role !== 'admin' && callerMember.role !== 'creator')) throw new Error('Solo admins pueden agregar miembros')

      const { error } = await supabase
        .from('liga_members')
        .upsert({
          liga_id: ligaId,
          player_id: playerId,
          role: 'player',
          status: 'active',
          is_active: true,
        }, { onConflict: 'liga_id,player_id' })
      if (error) throw error

      // Auto-create standing
      await supabase
        .from('liga_standings')
        .upsert({
          liga_id: ligaId,
          player_id: playerId,
          total_points: 0,
          matches_played: 0,
          matches_won: 0,
          matches_lost: 0,
          elo_rating: 1200,
        }, { onConflict: 'liga_id,player_id' })

      await get().fetchLiga(ligaId)
    } catch (err) {
      useUiStore.getState().showToast({ type: 'error', message: getSpanishError(err) })
      throw err
    }
  },

  // Admin: update member role (creator/admin/player)
  updateMemberRole: async (ligaId, playerId, role) => {
    try {
      // Verify caller is admin
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: callerMember } = await supabase.from('liga_members').select('role').eq('liga_id', ligaId).eq('player_id', user.id).maybeSingle()
      if (!callerMember || (callerMember.role !== 'admin' && callerMember.role !== 'creator')) throw new Error('Solo admins pueden cambiar roles')

      // Only creator can assign or revoke the creator role
      if (role === 'creator' && callerMember.role !== 'creator') throw new Error('Solo el creador puede asignar el rol de creador')
      // Prevent demoting the creator unless you ARE the creator
      const { data: targetMember } = await supabase.from('liga_members').select('role').eq('liga_id', ligaId).eq('player_id', playerId).maybeSingle()
      if (targetMember?.role === 'creator' && callerMember.role !== 'creator') throw new Error('No puedes cambiar el rol del creador')

      const { error } = await supabase
        .from('liga_members')
        .update({ role })
        .eq('liga_id', ligaId)
        .eq('player_id', playerId)
      if (error) throw error
      await get().fetchLiga(ligaId)
    } catch (err) {
      useUiStore.getState().showToast({ type: 'error', message: getSpanishError(err) })
      throw err
    }
  },

  // Admin: reset period deltas (new cycle)
  resetPeriod: async (ligaId) => {
    try {
      // Verify caller is admin
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: callerMember } = await supabase.from('liga_members').select('role').eq('liga_id', ligaId).eq('player_id', user.id).maybeSingle()
      if (!callerMember || (callerMember.role !== 'admin' && callerMember.role !== 'creator')) throw new Error('Solo admins pueden reiniciar período')

      await supabase
        .from('liga_standings')
        .update({ period_elo_delta: 0, period_points_delta: 0 })
        .eq('liga_id', ligaId)
      await supabase
        .from('liga_team_stats')
        .update({ period_elo_delta: 0 })
        .eq('liga_id', ligaId)
      await get().fetchLiga(ligaId)
      useUiStore.getState().showToast({ type: 'success', message: tStandalone('toast.period_reset') })
    } catch (err) {
      useUiStore.getState().showToast({ type: 'error', message: getSpanishError(err) })
    }
  },

  // Fetch team (pair) ELO stats
  fetchTeamStats: async (ligaId) => {
    try {
      const { data, error } = await supabase
        .from('liga_team_stats')
        .select(`
          *,
          player1:player1_id(id, display_name, avatar_url),
          player2:player2_id(id, display_name, avatar_url)
        `)
        .eq('liga_id', ligaId)
        .order('team_elo', { ascending: false })
      if (error) throw error
      set({ teamStats: data || [] })
    } catch (err) {
      set({ error: err.message })
    }
  },

  // Update own team name
  updateTeamName: async (ligaId, teamName) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('liga_members')
        .update({ team_name: teamName })
        .eq('liga_id', ligaId)
        .eq('player_id', user.id)
      if (error) throw error
      await get().fetchLiga(ligaId)
    } catch (err) {
      useUiStore.getState().showToast({ type: 'error', message: getSpanishError(err) })
    }
  },

  // Search players (for admin add)
  searchPlayers: async (query) => {
    if (!query || query.length < 2) return []
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, email, city')
      .or(`display_name.ilike.%${query.replace(/[%_\\,.()"']/g, '')}%,email.ilike.%${query.replace(/[%_\\,.()"']/g, '')}%`)
      .limit(10)
    if (error) throw error
    return data || []
  },

  // Admin: update liga settings (max_score, name, description, etc.)
  updateLigaSettings: async (ligaId, settings) => {
    try {
      // Verify caller is admin
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: callerMember } = await supabase.from('liga_members').select('role').eq('liga_id', ligaId).eq('player_id', user.id).maybeSingle()
      if (!callerMember || (callerMember.role !== 'admin' && callerMember.role !== 'creator')) throw new Error('Solo admins pueden cambiar configuración')

      // Whitelist allowed settings fields to prevent mass-assignment
      const ALLOWED_SETTINGS = ['name', 'description', 'max_score', 'schedule']
      const safe = Object.fromEntries(
        Object.entries(settings).filter(([k]) => ALLOWED_SETTINGS.includes(k))
      )

      const { error } = await supabase
        .from('ligas')
        .update(safe)
        .eq('id', ligaId)
      if (error) throw error
      await get().fetchLiga(ligaId)
      useUiStore.getState().showToast({ type: 'success', message: tStandalone('toast.settings_updated') })
    } catch (err) {
      useUiStore.getState().showToast({ type: 'error', message: getSpanishError(err) })
    }
  },

  // Create next jornada (admin)
  createNextJornada: async (ligaId) => {
    try {
      const { jornadas } = get()
      const currentJornada = jornadas.find(j => j.status === 'in_progress') || jornadas[0]
      const nextNumber = (currentJornada?.jornada_number || 0) + 1

      // Complete current jornada + apply penalties
      if (currentJornada && currentJornada.status === 'in_progress') {
        await supabase
          .from('jornadas')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', currentJornada.id)
        await supabase.rpc('apply_jornada_penalties', { p_jornada_id: currentJornada.id })
      }

      // Create new jornada
      const { data: { user } } = await supabase.auth.getUser()
      const { data: newJornada, error } = await supabase
        .from('jornadas')
        .insert({
          liga_id: ligaId,
          jornada_number: nextNumber,
          date: new Date().toISOString().split('T')[0],
          status: 'in_progress',
          created_by: user?.id,
        })
        .select('id, liga_id, jornada_number, date, status, completed_at, created_by')
        .single()
      if (error) throw error

      // Auto-add all active members as participants
      const { members } = get()
      const activeMembers = members.filter(m => m.status === 'active' || m.is_active)
      for (const m of activeMembers) {
        await supabase
          .from('jornada_participants')
          .upsert({
            jornada_id: newJornada.id,
            player_id: m.player_id,
            played: false,
          }, { onConflict: 'jornada_id,player_id' })
      }

      await get().fetchJornadas(ligaId)
      await get().fetchLiga(ligaId)
      useUiStore.getState().showToast({ type: 'success', message: tStandalone('toast.jornada_created', { n: nextNumber }) })
      return newJornada
    } catch (err) {
      useUiStore.getState().showToast({ type: 'error', message: getSpanishError(err) })
      throw err
    }
  },

  reset: () => set({
    ligas: [],
    currentLiga: null,
    members: [],
    jornadas: [],
    standings: [],
    crownHistory: [],
    ligaMatches: [],
    pairStats: [],
    teamStats: [],
    loading: false,
    error: null,
  }),
}))
