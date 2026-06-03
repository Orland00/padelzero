import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getSpanishError } from '@/utils/errorMessages'
import { useUiStore } from '@/stores/uiStore'

const SESSION_COLUMNS = 'id, name, type, sets_to_win, status, created_by, created_at, updated_at'
const SESSION_TEAM_COLUMNS = 'id, session_id, name, p1_id, p2_id, sort_order, created_at'
const SESSION_MATCH_COLUMNS = 'id, session_id, team1_id, team2_id, round, status, team1_sets, team2_sets, winner_team_id, created_at, updated_at'

// ── Round-robin schedule (circle method) ────────────────────────────────────
function generateLeagueMatches(teams) {
  const list = teams.length % 2 === 0 ? [...teams] : [...teams, null]
  const n = list.length
  const matches = []
  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const t1 = list[i]
      const t2 = list[n - 1 - i]
      if (t1 && t2) matches.push({ team1_id: t1.id, team2_id: t2.id, round: round + 1 })
    }
    // Rotate: keep first fixed, rotate rest
    const last = list.splice(n - 1, 1)[0]
    list.splice(1, 0, last)
  }
  return matches
}

// ── Tournament bracket (first round only; subsequent generated as rounds complete) ─
function generateTournamentRound1(teams) {
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(teams.length, 2))))
  const seeded = [...teams, ...Array(size - teams.length).fill(null)]
  const matches = []
  for (let i = 0; i < size; i += 2) {
    const t1 = seeded[i]
    const t2 = seeded[i + 1]
    if (t1 && t2) matches.push({ team1_id: t1.id, team2_id: t2.id, round: 1 })
    else if (t1) matches.push({ team1_id: t1.id, team2_id: null, round: 1, status: 'done', winner_team_id: t1.id })
  }
  return matches
}

export const useSessionStore = create((set, get) => ({
  sessions: [],
  currentSession: null,
  loading: false,
  error: null,

  fetchSessions: async (filters = {}) => {
    set({ loading: true, error: null })
    try {
      let query = supabase.from('sessions').select(SESSION_COLUMNS, { count: 'exact' })
      if (filters.status) query = query.eq('status', filters.status)
      query = query.order('created_at', { ascending: false }).range(0, 19)
      const { data, error, count } = await query
      if (error) throw error
      set({ sessions: data || [], loading: false })
      return { data: { sessions: data || [], count }, error: null }
    } catch (err) {
      set({ error: err.message, loading: false })
      return { data: null, error: err }
    }
  },

  fetchSession: async (sessionId) => {
    set({ loading: true, error: null })
    try {
      const [sessionRes, teamsRes, matchesRes] = await Promise.all([
        supabase.from('sessions').select(SESSION_COLUMNS).eq('id', sessionId).single(),
        supabase.from('session_teams')
          .select(`${SESSION_TEAM_COLUMNS}, p1:profiles!p1_id(id, display_name, username, elo_rating), p2:profiles!p2_id(id, display_name, username, elo_rating)`)
          .eq('session_id', sessionId).order('sort_order'),
        supabase.from('session_matches')
          .select(`${SESSION_MATCH_COLUMNS}, team1:session_teams!team1_id(id, name, p1:profiles!p1_id(display_name), p2:profiles!p2_id(display_name)), team2:session_teams!team2_id(id, name, p1:profiles!p1_id(display_name), p2:profiles!p2_id(display_name))`)
          .eq('session_id', sessionId).order('round').order('created_at'),
      ])
      if (sessionRes.error) throw sessionRes.error
      const session = { ...sessionRes.data, teams: teamsRes.data || [], matches: matchesRes.data || [] }
      set({ currentSession: session, loading: false })
      return { data: session, error: null }
    } catch (err) {
      set({ error: err.message, loading: false })
      return { data: null, error: err }
    }
  },

  createSession: async (name, type, setsToWin, createdBy) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('sessions').insert({ name, type, sets_to_win: setsToWin, created_by: createdBy, status: 'setup' })
        .select(SESSION_COLUMNS).single()
      if (error) throw error
      set({ loading: false })
      return { data, error: null }
    } catch (err) {
      set({ error: err.message, loading: false })
      return { data: null, error: err }
    }
  },

  startSession: async (sessionId, teams) => {
    set({ loading: true, error: null })
    try {
      // Fetch session type
      const { data: session } = await supabase.from('sessions').select('type').eq('id', sessionId).single()
      const isLeague = session?.type === 'league'

      // Generate schedule
      const schedule = isLeague ? generateLeagueMatches(teams) : generateTournamentRound1(teams)
      const toInsert = schedule.map(m => ({ ...m, session_id: sessionId, team2_id: m.team2_id || undefined }))
        .filter(m => m.team1_id && m.team2_id)

      // Insert matches
      if (toInsert.length > 0) {
        const { error: mErr } = await supabase.from('session_matches').insert(toInsert)
        if (mErr) throw mErr
      }

      // Handle byes in tournament (auto-advance)
      const byes = schedule.filter(m => !m.team2_id)
      for (const bye of byes) {
        await supabase.from('session_matches').insert({
          session_id: sessionId, team1_id: bye.team1_id, team2_id: bye.team1_id,
          team1_sets: 1, team2_sets: 0, winner_team_id: bye.team1_id, round: 1, status: 'done'
        })
      }

      // Activate session
      const { error: sErr } = await supabase.from('sessions').update({ status: 'active' }).eq('id', sessionId)
      if (sErr) throw sErr

      set({ loading: false })
      return { error: null }
    } catch (err) {
      set({ error: err.message, loading: false })
      return { error: err }
    }
  },

  recordResult: async (matchId, team1Sets, team2Sets) => {
    const winnerId = team1Sets > team2Sets ? 'team1' : 'team2'
    try {
      // Fetch match to get team IDs
      const { data: match } = await supabase.from('session_matches').select('team1_id, team2_id').eq('id', matchId).single()
      const winnerTeamId = winnerId === 'team1' ? match.team1_id : match.team2_id
      const { error } = await supabase.from('session_matches').update({
        team1_sets: team1Sets, team2_sets: team2Sets,
        winner_team_id: winnerTeamId, status: 'done'
      }).eq('id', matchId)

      if (error) throw error

      // Refresh current session
      const { currentSession } = get()
      if (currentSession?.id) {
        await get().fetchSession(currentSession.id)
      }

      return { error: null }
    } catch (err) {
      return { error: err }
    }
  },

  joinSession: async (sessionId) => {
    try {
      const { data, error } = await supabase.from('sessions').select(SESSION_COLUMNS).eq('id', sessionId).single()
      if (error) throw error
      set({ currentSession: data })
      return { data, error: null }
    } catch (err) {
      return { data: null, error: err }
    }
  },

  clearSession: () => set({ currentSession: null, error: null }),
}))
