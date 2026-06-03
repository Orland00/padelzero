import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { validateLigaScore } from '@/lib/ligaRules'
import { LIGA_PROLEAGUE_ID } from '@/lib/constants'

export const useProLeagueStore = create((set, get) => ({
  liga: null,
  members: [],
  standings: [],
  matches: [],
  currentJornada: null,
  jornadas: [],
  teamStats: [],
  jornadaParticipants: [],
  loading: false,
  error: null,

  // Fetch all ProLeague data
  fetchAll: async () => {
    set({ loading: true, error: null })
    try {
      await Promise.all([
        get().fetchLiga(),
        get().fetchMembers(),
        get().fetchStandings(),
        get().fetchCurrentJornada(),
        get().fetchMatches(),
        get().fetchTeamStats(),
      ])
    } catch (err) {
      set({ error: err.message })
    } finally {
      set({ loading: false })
    }
  },

  fetchLiga: async () => {
    const { data, error } = await supabase
      .from('ligas')
      .select('id, name, description, schedule, created_by, format, is_active, join_code, max_members, max_score, created_at, updated_at')
      .eq('id', LIGA_PROLEAGUE_ID)
      .single()
    if (error) throw error
    set({ liga: data })
  },

  fetchMembers: async () => {
    const { data, error } = await supabase
      .from('liga_members')
      .select('id, player_id, role, status, is_active, team_name, joined_at, profiles(id, display_name, avatar_url, elo_rating, matches_played)')
      .eq('liga_id', LIGA_PROLEAGUE_ID)
    if (error) throw error
    set({ members: data || [] })
  },

  fetchStandings: async () => {
    const { data, error } = await supabase
      .from('liga_standings')
      .select('*, profile:player_id(id, display_name, avatar_url)')
      .eq('liga_id', LIGA_PROLEAGUE_ID)
      .order('elo_rating', { ascending: false })
    if (error) throw error
    set({ standings: data || [] })
  },

  fetchCurrentJornada: async () => {
    // Get the latest in_progress jornada, or the most recent one
    const { data, error } = await supabase
      .from('jornadas')
      .select('id, liga_id, jornada_number, date, status, completed_at, created_by')
      .eq('liga_id', LIGA_PROLEAGUE_ID)
      .order('jornada_number', { ascending: false })
      .limit(5)
    if (error) throw error

    const jornadas = data || []
    const current = jornadas.find(j => j.status === 'in_progress') || jornadas[0] || null
    set({ currentJornada: current, jornadas })

    // Fetch participants for current jornada
    if (current) {
      const { data: participants } = await supabase
        .from('jornada_participants')
        .select('*, profile:player_id(id, display_name)')
        .eq('jornada_id', current.id)
      set({ jornadaParticipants: participants || [] })
    }
  },

  fetchMatches: async () => {
    const { data, error } = await supabase
      .from('liga_matches')
      .select('id, liga_id, jornada_id, team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id, score_team_a, score_team_b, status, played_at, created_at, recorded_by, court_number')
      .eq('liga_id', LIGA_PROLEAGUE_ID)
      .not('team_a_player1_id', 'is', null)
      .order('played_at', { ascending: false })
      .limit(50)
    if (error) throw error

    // Fetch player names for display
    const allPlayerIds = new Set()
    data?.forEach(m => {
      if (m.team_a_player1_id) allPlayerIds.add(m.team_a_player1_id)
      if (m.team_a_player2_id) allPlayerIds.add(m.team_a_player2_id)
      if (m.team_b_player1_id) allPlayerIds.add(m.team_b_player1_id)
      if (m.team_b_player2_id) allPlayerIds.add(m.team_b_player2_id)
      if (m.recorded_by) allPlayerIds.add(m.recorded_by)
    })

    const playerIds = Array.from(allPlayerIds)
    let playerMap = {}
    if (playerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', playerIds)
      profiles?.forEach(p => {
        playerMap[p.id] = p
      })
    }

    // Enrich matches with player data
    const enrichedMatches = data?.map(m => ({
      ...m,
      player_a1: playerMap[m.team_a_player1_id],
      player_a2: playerMap[m.team_a_player2_id],
      player_b1: playerMap[m.team_b_player1_id],
      player_b2: playerMap[m.team_b_player2_id],
      recorder: playerMap[m.recorded_by]
    })) || []

    set({ matches: enrichedMatches })
  },

  fetchTeamStats: async () => {
    const { data, error } = await supabase
      .from('liga_team_stats')
      .select(`
        *,
        player1:player1_id(id, display_name, avatar_url),
        player2:player2_id(id, display_name, avatar_url)
      `)
      .eq('liga_id', LIGA_PROLEAGUE_ID)
      .order('team_elo', { ascending: false })
    if (error) throw error
    set({ teamStats: data || [] })
  },

  // Record a 2v2 doubles match via atomic server-side RPC
  recordMatch: async ({ teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2, scoreTeamA, scoreTeamB }) => {
    set({ loading: true, error: null })
    try {
      // Validate all player IDs are present
      if (!teamAPlayer1 || !teamAPlayer2 || !teamBPlayer1 || !teamBPlayer2) {
        throw new Error('Todos los 4 jugadores son requeridos: ' +
          `A1:${teamAPlayer1 ? '✓' : '✗'} A2:${teamAPlayer2 ? '✓' : '✗'} B1:${teamBPlayer1 ? '✓' : '✗'} B2:${teamBPlayer2 ? '✓' : '✗'}`)
      }

      // Validate scores
      if (typeof scoreTeamA !== 'number' || typeof scoreTeamB !== 'number') {
        throw new Error('Marcador no válido')
      }

      const scoreValidation = validateLigaScore(scoreTeamA, scoreTeamB, get().liga || {})
      if (!scoreValidation.valid) {
        throw new Error(scoreValidation.message)
      }

      const { currentJornada } = get()

      // Single atomic RPC: ELO calculation, match insert, profile updates,
      // standings, pair stats, team stats, jornada participants, elo_history
      const { data, error } = await supabase.rpc('record_liga_match', {
        p_liga_id: LIGA_PROLEAGUE_ID,
        p_team_a_player1: teamAPlayer1,
        p_team_a_player2: teamAPlayer2,
        p_team_b_player1: teamBPlayer1,
        p_team_b_player2: teamBPlayer2,
        p_score_team_a: scoreTeamA,
        p_score_team_b: scoreTeamB,
        p_jornada_id: currentJornada?.id || null,
      })
      if (error) throw error

      // Refresh data
      await get().fetchAll()

      // Parse result for callers that use eloChanges/teamEloChanges
      const eloChanges = data?.elo_changes?.map(c => ({
        playerId: c.playerId, oldElo: c.oldElo, newElo: c.newElo, delta: c.delta,
      })) || []
      const teamEloChanges = data?.team_elo_changes?.map(c => ({
        player1: c.player1, player2: c.player2, oldElo: c.oldElo, newElo: c.newElo, delta: c.delta,
      })) || []

      return { match: { id: data?.match_id }, eloChanges, teamEloChanges }
    } catch (err) {
      set({ error: err.message })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  // Update team name (only own)
  updateTeamName: async (teamName) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('liga_members')
      .update({ team_name: teamName })
      .eq('liga_id', LIGA_PROLEAGUE_ID)
      .eq('player_id', user.id)
    if (error) throw error
    await get().fetchMembers()
  },

  // Admin: reset period deltas (new jornada / new cycle)
  resetPeriod: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { data: callerMember } = await supabase.from('liga_members').select('role').eq('liga_id', LIGA_PROLEAGUE_ID).eq('player_id', user.id).maybeSingle()
    if (!callerMember || (callerMember.role !== 'admin' && callerMember.role !== 'creator')) throw new Error('Solo admins pueden reiniciar período')

    await supabase
      .from('liga_standings')
      .update({ period_elo_delta: 0, period_points_delta: 0 })
      .eq('liga_id', LIGA_PROLEAGUE_ID)
    await supabase
      .from('liga_team_stats')
      .update({ period_elo_delta: 0 })
      .eq('liga_id', LIGA_PROLEAGUE_ID)
    await get().fetchAll()
  },

  // Admin: add player directly
  addMember: async (playerId) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { data: callerMember } = await supabase.from('liga_members').select('role').eq('liga_id', LIGA_PROLEAGUE_ID).eq('player_id', user.id).maybeSingle()
    if (!callerMember || (callerMember.role !== 'admin' && callerMember.role !== 'creator')) throw new Error('Solo admins pueden agregar miembros')

    const { error } = await supabase
      .from('liga_members')
      .upsert({
        liga_id: LIGA_PROLEAGUE_ID,
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
        liga_id: LIGA_PROLEAGUE_ID,
        player_id: playerId,
        total_points: 0,
        matches_played: 0,
        matches_won: 0,
        matches_lost: 0,
        elo_rating: 1200,
      }, { onConflict: 'liga_id,player_id' })

    // Add to current jornada
    const { currentJornada } = get()
    if (currentJornada) {
      await supabase
        .from('jornada_participants')
        .upsert({
          jornada_id: currentJornada.id,
          player_id: playerId,
          played: false,
        }, { onConflict: 'jornada_id,player_id' })
    }

    await get().fetchMembers()
    await get().fetchStandings()
  },

  // Admin: update member role
  updateMemberRole: async (playerId, role) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { data: callerMember } = await supabase.from('liga_members').select('role').eq('liga_id', LIGA_PROLEAGUE_ID).eq('player_id', user.id).maybeSingle()
    if (!callerMember || (callerMember.role !== 'admin' && callerMember.role !== 'creator')) throw new Error('Solo admins pueden cambiar roles')

    const { error } = await supabase
      .from('liga_members')
      .update({ role })
      .eq('liga_id', LIGA_PROLEAGUE_ID)
      .eq('player_id', playerId)
    if (error) throw error
    await get().fetchMembers()
  },

  // Admin: remove player
  removeMember: async (playerId) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { data: callerMember } = await supabase.from('liga_members').select('role').eq('liga_id', LIGA_PROLEAGUE_ID).eq('player_id', user.id).maybeSingle()
    if (!callerMember || (callerMember.role !== 'admin' && callerMember.role !== 'creator')) throw new Error('Solo admins pueden eliminar miembros')

    const { error } = await supabase
      .from('liga_members')
      .delete()
      .eq('liga_id', LIGA_PROLEAGUE_ID)
      .eq('player_id', playerId)
    if (error) throw error
    await get().fetchMembers()
  },

  // Admin: delete match and reverse standings, ELO, team stats, pair stats
  deleteMatch: async (matchId) => {
    set({ loading: true })
    try {
      // Verify caller is admin
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: callerMember } = await supabase.from('liga_members').select('role').eq('liga_id', LIGA_PROLEAGUE_ID).eq('player_id', user.id).maybeSingle()
      if (!callerMember || (callerMember.role !== 'admin' && callerMember.role !== 'creator')) throw new Error('Solo admins pueden eliminar partidos')

      // Single atomic RPC: reverses ELO, standings, team/pair stats, deletes match
      const { error } = await supabase.rpc('delete_liga_match', {
        p_match_id: matchId,
        p_liga_id: LIGA_PROLEAGUE_ID,
      })
      if (error) throw error

      await get().fetchAll()
    } catch (err) {
      set({ error: err.message })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  // Admin: search players
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

  // Admin: update liga settings (max_score, etc.)
  updateLigaSettings: async (settings) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { data: callerMember } = await supabase.from('liga_members').select('role').eq('liga_id', LIGA_PROLEAGUE_ID).eq('player_id', user.id).maybeSingle()
    if (!callerMember || (callerMember.role !== 'admin' && callerMember.role !== 'creator')) throw new Error('Solo admins pueden cambiar configuración')

    const { error } = await supabase
      .from('ligas')
      .update(settings)
      .eq('id', LIGA_PROLEAGUE_ID)
    if (error) throw error
    await get().fetchLiga()
  },

  // Create next jornada (admin)
  createNextJornada: async () => {
    const { jornadas, currentJornada } = get()
    const nextNumber = (currentJornada?.jornada_number || 0) + 1

    // Complete current jornada + apply penalties
    if (currentJornada && currentJornada.status === 'in_progress') {
      await supabase
        .from('jornadas')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', currentJornada.id)

      // Apply penalties via SQL function
      await supabase.rpc('apply_jornada_penalties', { p_jornada_id: currentJornada.id })
    }

    // Create new jornada
    const { data: { user } } = await supabase.auth.getUser()
    const { data: newJornada, error } = await supabase
      .from('jornadas')
      .insert({
        liga_id: LIGA_PROLEAGUE_ID,
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

    await get().fetchCurrentJornada()
    await get().fetchStandings()
  },
}))
