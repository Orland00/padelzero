import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTournamentDetailStore } from '@/stores/tournamentDetailStore'

const hoisted = vi.hoisted(() => {
  const mockAuth = {
    getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
  }
  
  const makeChain = () => {
    const chain = {}
    chain.select = vi.fn(() => chain)
    chain.insert = vi.fn(() => chain)
    chain.update = vi.fn(() => chain)
    chain.delete = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.in = vi.fn(() => chain)
    chain.order = vi.fn(() => chain)
    chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
    chain.single = vi.fn(async () => ({ data: null, error: null }))
    chain.neq = vi.fn(() => chain)
    chain.or = vi.fn(() => chain)
    return chain
  }

  const mockSupabase = {
    auth: mockAuth,
    from: vi.fn(() => makeChain()),
    functions: {
      invoke: vi.fn(async () => ({ data: null, error: null })),
    },
  }

  return { mockAuth, mockSupabase, makeChain }
})

vi.mock('@/lib/supabase', () => ({
  supabase: hoisted.mockSupabase,
}))

vi.mock('@/stores/uiStore', () => ({
  useUiStore: {
    getState: () => ({
      showToast: vi.fn(),
    }),
  },
}))

import { supabase } from '@/lib/supabase'

describe('useTournamentDetailStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTournamentDetailStore.setState({
      tournament: null,
      participants: [],
      matches: [],
      standings: [],
      loading: false,
      error: null,
    })
  })

  describe('fetchTournament', () => {
    it('fetches all tournament data in parallel', async () => {
      vi.mocked(supabase.from).mockImplementation((table) => {
        const chain = hoisted.makeChain()
        if (table === 'tournaments') {
          chain.single = vi.fn().mockResolvedValue({ data: { id: 't1', name: 'Tourney' }, error: null })
        } else if (table === 'tournament_participants') {
          chain.eq = vi.fn().mockResolvedValue({ data: [{ id: 'p1' }], error: null })
        } else if (table === 'tournament_matches') {
          // It calls .select().eq().order().order()
          chain.order = vi.fn().mockReturnValue(chain) // first order
          chain.order.mockReturnValueOnce(chain).mockResolvedValue({ data: [{ id: 'm1' }], error: null }) // second order returns result
        } else if (table === 'tournament_standings') {
          chain.eq = vi.fn().mockResolvedValue({ data: [], error: null })
        }
        return chain
      })

      await useTournamentDetailStore.getState().fetchTournament('t1')

      const state = useTournamentDetailStore.getState()
      expect(state.tournament).not.toBeNull()
      expect(state.tournament?.id).toBe('t1')
      expect(state.participants).toHaveLength(1)
      expect(state.matches).toHaveLength(1)
    })
  })

  describe('createTournament', () => {
    it('inserts a new tournament and updates state', async () => {
      const mockTourney = { id: 't1', name: 'New Tourney' }
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockTourney, error: null }),
      })

      const result = await useTournamentDetailStore.getState().createTournament({ name: 'New Tourney' })

      expect(result).toEqual(mockTourney)
      expect(useTournamentDetailStore.getState().tournament).toEqual(mockTourney)
    })
  })

  describe('registerTeam', () => {
    it('registers a team and handles waitlist if full', async () => {
      useTournamentDetailStore.setState({
        tournament: { id: 't1', max_players: 2, status: 'registration' }
      })

      vi.mocked(supabase.from).mockImplementation((table) => {
        const chain = hoisted.makeChain()
        if (table === 'tournament_participants') {
          // Mock duplicate check: .select().eq().neq().or()
          chain.or = vi.fn().mockResolvedValue({ data: [], error: null })
          
          // Mock count check: .select().eq().eq()
          // We need to differentiate between the select calls.
          // One has { count: 'exact', head: true }
          chain.select = vi.fn().mockImplementation((proj, opts) => {
            if (opts?.count === 'exact') {
              return {
                eq: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({ count: 2, error: null })
              }
            }
            return chain
          })
          
          // Mock insert: .insert().select().single()
          chain.insert = vi.fn().mockReturnThis()
          chain.select = vi.fn().mockReturnThis()
          chain.single = vi.fn().mockResolvedValue({ data: { id: 'p3', status: 'waitlisted' }, error: null })
        }
        return chain
      })

      const result = await useTournamentDetailStore.getState().registerTeam('t1', 'u1', 'u2', 'Team 3')

      expect(result.status).toBe('waitlisted')
      expect(useTournamentDetailStore.getState().participants).toContainEqual(expect.objectContaining({ id: 'p3' }))
    })
  })

  describe('generateBracket', () => {
    it('creates matches for the tournament bracket', async () => {
      const mockParticipants = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }]
      
      vi.mocked(supabase.from).mockImplementation((table) => {
        const chain = hoisted.makeChain()
        if (table === 'tournament_participants') {
          chain.eq = vi.fn().mockResolvedValue({ data: mockParticipants, error: null })
        } else if (table === 'tournament_matches') {
          chain.insert = vi.fn().mockReturnThis()
          chain.select = vi.fn().mockResolvedValue({ data: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }], error: null })
          chain.update = vi.fn().mockResolvedValue({ error: null })
        } else if (table === 'tournaments') {
          chain.update = vi.fn().mockResolvedValue({ error: null })
        }
        return chain
      })

      await useTournamentDetailStore.getState().generateBracket('t1')

      expect(supabase.from).toHaveBeenCalledWith('tournament_participants')
      // verify matches were inserted
      expect(supabase.from).toHaveBeenCalledWith('tournament_matches')
    })
  })

  describe('recordMatchResult', () => {
    it('updates match result and advances winner', async () => {
      useTournamentDetailStore.setState({
        tournament: { id: 't1', elo_impact: true },
        matches: [
          { id: 'm1', tournament_id: 't1', team1_id: 'p1', team2_id: 'p2', next_match_id: 'm3', bracket_slot: 1 },
          { id: 'm2', tournament_id: 't1', team1_id: 'p3', team2_id: 'p4', next_match_id: 'm3', bracket_slot: 2 },
          { id: 'm3', tournament_id: 't1', team1_id: null, team2_id: null }
        ]
      })

      vi.mocked(supabase.from).mockReturnValue(hoisted.makeChain())
      const fetchSpy = vi.spyOn(useTournamentDetailStore.getState(), 'fetchTournament').mockResolvedValue()

      await useTournamentDetailStore.getState().recordMatchResult('m1', 2, 1)

      expect(supabase.from).toHaveBeenCalledWith('tournament_matches')
      // verify update winner call
      expect(supabase.functions.invoke).toHaveBeenCalledWith('finish-tournament-match', expect.any(Object))
      expect(fetchSpy).toHaveBeenCalledWith('t1')
    })
  })
})
