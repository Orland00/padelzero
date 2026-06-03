import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { generateAmericanoRounds, calculateJornadaPoints } from '@/utils/americanoEngine'
import { getSpanishError } from '@/utils/errorMessages'
import { useUiStore } from '@/stores/uiStore'

const JORNADA_COLUMNS = 'id, liga_id, jornada_number, date, status, completed_at, created_by'
const AMERICANO_ROUND_COLUMNS = 'id, jornada_id, round_number, status, created_at'
const AMERICANO_MATCH_COLUMNS = 'id, round_id, court_number, team_a_player1, team_a_player2, team_b_player1, team_b_player2, bye_player, score_team_a, score_team_b, status, completed_at'

export const useJornadaStore = create((set, get) => ({
  jornada: null,
  checkIns: [],
  rounds: [],
  matches: [],
  currentRound: 0,
  loading: false,
  error: null,

  // Task 21: Create jornada (admin)
  createJornada: async (ligaId, date) => {
    set({ loading: true, error: null })
    try {
      // Get next jornada number
      const { data: lastJornada } = await supabase
        .from('jornadas')
        .select('jornada_number')
        .eq('liga_id', ligaId)
        .order('jornada_number', { ascending: false })
        .limit(1)
        .single()

      const nextNumber = (lastJornada?.jornada_number || 0) + 1

      const { data, error } = await supabase
        .from('jornadas')
        .insert({
          liga_id: ligaId,
          jornada_number: nextNumber,
          date,
          status: 'upcoming',
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select(JORNADA_COLUMNS)
        .single()

      if (error) throw error
      set({ jornada: data })
      return data
    } catch (err) {
      set({ error: err.message })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  // Task 23: Open check-in (admin)
  openCheckIn: async (jornadaId) => {
    set({ loading: true, error: null })
    try {
      const { error } = await supabase
        .from('jornadas')
        .update({ status: 'checkin_open' })
        .eq('id', jornadaId)

      if (error) throw error
      set(state => ({
        jornada: state.jornada ? { ...state.jornada, status: 'checkin_open' } : null,
      }))
    } catch (err) {
      set({ error: err.message })
    } finally {
      set({ loading: false })
    }
  },

  // Task 22: Player checks in
  checkIn: async (jornadaId, playerId) => {
    set({ loading: true, error: null })
    try {
      const { error } = await supabase
        .from('jornada_checkins')
        .insert({ jornada_id: jornadaId, player_id: playerId })

      if (error) throw error
      await get().fetchCheckIns(jornadaId)
    } catch (err) {
      set({ error: err.message })
    } finally {
      set({ loading: false })
    }
  },

  // Task 22: Manual check-in (admin)
  manualCheckIn: async (jornadaId, playerId) => {
    return get().checkIn(jornadaId, playerId)
  },

  // Fetch all check-ins for a jornada
  fetchCheckIns: async (jornadaId) => {
    try {
      const { data, error } = await supabase
        .from('jornada_checkins')
        .select('id, jornada_id, player_id, checked_in_at, profiles(id, display_name)')
        .eq('jornada_id', jornadaId)

      if (error) throw error
      set({ checkIns: data || [] })
    } catch (err) {
      set({ error: err.message })
    }
  },

  // Task 24: Generate rounds from check-ins
  generateRounds: async (jornadaId, ligaId, numRounds = 3) => {
    set({ loading: true, error: null })
    try {
      // Fetch checked-in players
      const { data: checkIns, error: checkInErr } = await supabase
        .from('jornada_checkins')
        .select('player_id')
        .eq('jornada_id', jornadaId)

      if (checkInErr) throw checkInErr

      const playerIds = checkIns.map(ci => ci.player_id)
      if (playerIds.length < 4) {
        throw new Error('Se necesitan mínimo 4 jugadores')
      }

      // Generate rounds using JS engine
      const generatedRounds = generateAmericanoRounds(playerIds, numRounds)

      // Insert americano_rounds
      const roundsToInsert = generatedRounds.map(r => ({
        jornada_id: jornadaId,
        round_number: r.round,
        status: 'pending',
      }))

      const { data: insertedRounds, error: roundErr } = await supabase
        .from('americano_rounds')
        .insert(roundsToInsert)
        .select(AMERICANO_ROUND_COLUMNS)

      if (roundErr) throw roundErr

      // Insert americano_matches for each round
      const matchesToInsert = []
      generatedRounds.forEach((genRound, idx) => {
        const roundId = insertedRounds[idx].id
        genRound.matches.forEach(match => {
          matchesToInsert.push({
            round_id: roundId,
            court_number: match.court,
            team_a_player1: match.teamA[0],
            team_a_player2: match.teamA[1],
            team_b_player1: match.teamB[0],
            team_b_player2: match.teamB[1],
            bye_player: genRound.bye,
            status: 'pending',
          })
        })
      })

      const { error: matchErr } = await supabase
        .from('americano_matches')
        .insert(matchesToInsert)

      if (matchErr) throw matchErr

      // Update jornada status
      await supabase
        .from('jornadas')
        .update({ status: 'in_progress' })
        .eq('id', jornadaId)

      set({ rounds: insertedRounds, currentRound: 0 })
      await get().fetchRounds(jornadaId)
      await get().fetchMatches(jornadaId)
    } catch (err) {
      set({ error: err.message })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  // Fetch all rounds for a jornada
  fetchRounds: async (jornadaId) => {
    try {
      const { data, error } = await supabase
        .from('americano_rounds')
        .select(AMERICANO_ROUND_COLUMNS)
        .eq('jornada_id', jornadaId)
        .order('round_number', { ascending: true })

      if (error) throw error
      set({ rounds: data || [] })
    } catch (err) {
      set({ error: err.message })
    }
  },

  // Fetch all matches with player details
  fetchMatches: async (jornadaId) => {
    try {
      // First get round IDs for this jornada
      const { data: rounds, error: roundsErr } = await supabase
        .from('americano_rounds')
        .select('id')
        .eq('jornada_id', jornadaId)

      if (roundsErr) throw roundsErr
      const roundIds = (rounds || []).map(r => r.id)
      if (roundIds.length === 0) { set({ matches: [] }); return }

      const { data, error } = await supabase
        .from('americano_matches')
        .select(`
          ${AMERICANO_MATCH_COLUMNS},
          round:americano_rounds(round_number),
          p1:team_a_player1(display_name),
          p2:team_a_player2(display_name),
          p3:team_b_player1(display_name),
          p4:team_b_player2(display_name),
          bye:bye_player(display_name)
        `)
        .in('round_id', roundIds)

      if (error) throw error
      set({ matches: data || [] })
    } catch (err) {
      set({ error: err.message })
    }
  },

  // Task 26: Record match score
  recordMatchScore: async (matchId, scoreTeamA, scoreTeamB) => {
    set({ loading: true, error: null })
    try {
      const { error: updateErr } = await supabase
        .from('americano_matches')
        .update({
          score_team_a: scoreTeamA,
          score_team_b: scoreTeamB,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', matchId)

      if (updateErr) throw updateErr

      // Fetch updated matches
      const { data: match } = await supabase
        .from('americano_matches')
        .select('round_id')
        .eq('id', matchId)
        .single()

      // Check if all matches in round are completed
      if (match) {
        const { data: roundMatches } = await supabase
          .from('americano_matches')
          .select('status')
          .eq('round_id', match.round_id)

        const allCompleted = roundMatches?.every(m => m.status === 'completed')
        if (allCompleted) {
          // Get current round info
          const { data: currentRound } = await supabase
            .from('americano_rounds')
            .select('jornada_id, round_number')
            .eq('id', match.round_id)
            .single()

          // Task 27: Auto-advance round
          await supabase
            .from('americano_rounds')
            .update({ status: 'completed' })
            .eq('id', match.round_id)

          // Mark next round as in_progress
          if (currentRound) {
            const { data: nextRound } = await supabase
              .from('americano_rounds')
              .select('id')
              .eq('jornada_id', currentRound.jornada_id)
              .gt('round_number', currentRound.round_number)
              .order('round_number', { ascending: true })
              .limit(1)
              .single()

            if (nextRound) {
              await supabase
                .from('americano_rounds')
                .update({ status: 'in_progress' })
                .eq('id', nextRound.id)
            }
          }
        }
      }
    } catch (err) {
      set({ error: err.message })
    } finally {
      set({ loading: false })
    }
  },

  // Task 27: Advance to next round
  advanceRound: () => {
    set(state => ({
      currentRound: state.currentRound + 1,
    }))
  },

  // Task 28: Finalize jornada (call Edge Function)
  finalizeJornada: async (jornadaId, ligaId) => {
    set({ loading: true, error: null })
    try {
      const response = await supabase.functions.invoke('finalize_jornada', {
        body: { jornadaId, ligaId },
      })

      if (response.error) throw response.error

      set(state => ({
        jornada: state.jornada ? { ...state.jornada, status: 'completed' } : null,
      }))

      // Task 15: Get crown transfer data for celebration
      const data = response.data
      if (data?.newCrownHolder) {
        // Fetch the new crown holder's profile to get display_name
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', data.newCrownHolder)
          .single()

        if (!profileErr && profile) {
          data.crownWinnerName = profile.display_name
        }
      }

      return data
    } catch (err) {
      set({ error: err.message })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  // Subscribe to jornada updates
  subscribeJornada: (jornadaId) => {
    const channel = supabase.channel(`jornada:${jornadaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jornada_checkins', filter: `jornada_id=eq.${jornadaId}` },
        () => get().fetchCheckIns(jornadaId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'americano_rounds', filter: `jornada_id=eq.${jornadaId}` },
        () => get().fetchRounds(jornadaId)
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  },

  reset: () => set({
    jornada: null,
    checkIns: [],
    rounds: [],
    matches: [],
    currentRound: 0,
    loading: false,
    error: null,
  }),
}))
