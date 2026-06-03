import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useTournamentDetailStore } from '@/stores/tournamentDetailStore'
import EliminacionBracket from '@/components/tournaments/EliminacionBracket'
import LiguillaGroups from '@/components/tournaments/LiguillaGroups'
import AmericanoView from '@/components/tournaments/AmericanoView'
import ScoreModal from '@/components/tournaments/ScoreModal'
import PlayerLevelBadge from '@/components/PlayerLevelBadge'
import LiveScoreInput from '@/components/tournaments/LiveScoreInput'
import GlassButton from '@/components/ui/GlassButton'
import { useI18n } from '@/lib/i18n'
import { eloToLevel } from '@/utils/eloEngine'

const STATUS_BADGES = {
  registration: { label: 'Inscripciones', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  in_progress: { label: 'En Curso', color: 'bg-red-500/20 text-red-400 border-red-500/30', pulse: true },
  finished: { label: 'Finalizado', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
}

const FORMAT_LABELS = {
  eliminacion: 'Eliminacion Directa',
  americano: 'Americano',
  liguilla: 'Liguilla',
}

const TABS = [
  { key: 'bracket', label: 'Bracket' },
  { key: 'participantes', label: 'Participantes' },
  { key: 'resultados', label: 'Resultados' },
]

export default function TournamentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { t } = useI18n()
  const { registerTeam, cancelRegistration, getUserRegistration } = useTournamentDetailStore()

  const [tournament, setTournament] = useState(null)
  const [participants, setParticipants] = useState([])
  const [matches, setMatches] = useState([])
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [activeTab, setActiveTab] = useState('bracket')
  const [scoreMatch, setScoreMatch] = useState(null)
  const [scoreSubmitting, setScoreSubmitting] = useState(false)

  // Add team state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedP1, setSelectedP1] = useState(null)
  const [selectedP2, setSelectedP2] = useState(null)
  const [addingTeam, setAddingTeam] = useState(false)
  const [generatingBracket, setGeneratingBracket] = useState(false)

  // Self-registration state
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [regPartnerQuery, setRegPartnerQuery] = useState('')
  const [regPartnerResults, setRegPartnerResults] = useState([])
  const [regPartner, setRegPartner] = useState(null)
  const [regTeamName, setRegTeamName] = useState('')
  const [registering, setRegistering] = useState(false)

  const isAdmin = tournament?.created_by === user?.id
  const registeredParticipants = participants.filter(p => p.status !== 'cancelled')
  const activeRegistered = participants.filter(p => p.status === 'registered')
  const waitlistedParticipants = participants.filter(p => p.status === 'waitlisted').sort((a, b) => new Date(a.registered_at) - new Date(b.registered_at))
  const myRegistration = user ? participants.find(p => (p.p1_id === user.id || p.p2_id === user.id) && p.status !== 'cancelled') : null
  const isFull = tournament?.max_players && activeRegistered.length >= tournament.max_players
  const spotsText = t('tournament.spots', { current: activeRegistered.length, max: tournament?.max_players || '?' })

  const fetchData = useCallback(async () => {
    try {
      const [tournamentRes, participantsRes, matchesRes, standingsRes] = await Promise.all([
        supabase.from('tournaments').select('id, name, format, max_players, liga_id, description, elo_impact, entry_fee, deadline, created_by, status, join_code, created_at, updated_at').eq('id', id).single(),
        supabase
          .from('tournament_participants')
          .select(
            'id, tournament_id, p1_id, p2_id, team_name, status, seed, registered_at, checked_in_at, created_at, updated_at, p1_profile:profiles!tournament_participants_p1_id_fkey(id, display_name, avatar_url, level, elo_rating), p2_profile:profiles!tournament_participants_p2_id_fkey(id, display_name, avatar_url, level, elo_rating)'
          )
          .eq('tournament_id', id),
        supabase
          .from('tournament_matches')
          .select('id, tournament_id, team1_id, team2_id, next_match_id, round, bracket_slot, status, match_number, stage, winner_team_id, team1_sets, team2_sets, created_at, updated_at')
          .eq('tournament_id', id)
          .order('round', { ascending: false })
          .order('bracket_slot'),
        supabase.from('tournament_standings').select('id, tournament_id, participant_id, position, points, wins, losses, sets_won, sets_lost, games_won, games_lost, seed, team_name, created_at, updated_at').eq('tournament_id', id),
      ])

      if (tournamentRes.error) throw tournamentRes.error
      setTournament(tournamentRes.data)
      setParticipants(participantsRes.data || [])
      setMatches(matchesRes.data || [])
      setStandings(standingsRes.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Search players
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, elo_rating')
        .ilike('display_name', `%${searchQuery}%`)
        .limit(10)
      setSearchResults(data || [])
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  // Search partner for self-registration
  useEffect(() => {
    if (regPartnerQuery.length < 2) {
      setRegPartnerResults([])
      return
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, elo_rating')
        .ilike('display_name', `%${regPartnerQuery}%`)
        .neq('id', user?.id || '')
        .limit(10)
      setRegPartnerResults(data || [])
    }, 300)
    return () => clearTimeout(timeout)
  }, [regPartnerQuery, user?.id])

  const handleSelfRegister = async () => {
    if (!user || !regPartner) return
    setRegistering(true)
    try {
      const teamName = regTeamName.trim() || `${user.user_metadata?.display_name || 'Jugador'} & ${regPartner.display_name}`
      const result = await registerTeam(id, user.id, regPartner.id, teamName)
      if (result) {
        setShowRegisterForm(false)
        setRegPartner(null)
        setRegPartnerQuery('')
        setRegTeamName('')
        await fetchData()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setRegistering(false)
    }
  }

  const handleCancelRegistration = async () => {
    if (!myRegistration) return
    const ok = await useUiStore.getState().confirm({
      message: t('tournament.confirm_cancel'),
      danger: true,
    })
    if (!ok) return
    try {
      await cancelRegistration(myRegistration.id, id)
      await fetchData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAddTeam = async () => {
    if (!selectedP1 || !selectedP2) return
    setAddingTeam(true)
    try {
      const { error: insertErr } = await supabase.from('tournament_participants').insert({
        tournament_id: id,
        p1_id: selectedP1.id,
        p2_id: selectedP2.id,
        team_name: `${selectedP1.display_name} & ${selectedP2.display_name}`,
        status: 'registered',
      })
      if (insertErr) throw insertErr
      setSelectedP1(null)
      setSelectedP2(null)
      setSearchQuery('')
      setSearchResults([])
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setAddingTeam(false)
    }
  }

  const handleRemoveTeam = async (participantId) => {
    try {
      const { error: delErr } = await supabase
        .from('tournament_participants')
        .delete()
        .eq('id', participantId)
      if (delErr) throw delErr
      await fetchData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleGenerateBracket = async () => {
    setGeneratingBracket(true)
    try {
      const sorted = [...activeRegistered].sort((a, b) => {
        if (a.seed && b.seed) return a.seed - b.seed
        if (a.seed) return -1
        if (b.seed) return 1
        return Math.random() - 0.5
      })

      let bracketSize = 2
      while (bracketSize < sorted.length) bracketSize *= 2

      const seeded = new Array(bracketSize).fill(null)
      for (let i = 0; i < sorted.length; i++) {
        seeded[i] = sorted[i]
      }

      const firstRoundMatchups = []
      for (let i = 0; i < bracketSize / 2; i++) {
        firstRoundMatchups.push({
          team1: seeded[i],
          team2: seeded[bracketSize - 1 - i],
        })
      }

      const totalRounds = Math.log2(bracketSize)
      const allMatches = []
      const matchesByRound = {}

      const firstRoundValue = bracketSize / 2
      matchesByRound[0] = []
      for (let i = 0; i < firstRoundMatchups.length; i++) {
        const { team1, team2 } = firstRoundMatchups[i]
        allMatches.push({
          tournament_id: id,
          team1_id: team1 ? team1.id : null,
          team2_id: team2 ? team2.id : null,
          round: firstRoundValue,
          bracket_slot: i + 1,
          status: 'pending',
          match_number: i + 1,
          stage: 'bracket',
        })
        matchesByRound[0].push(allMatches.length - 1)
      }

      let matchNumber = firstRoundMatchups.length + 1
      for (let r = 1; r < totalRounds; r++) {
        const numMatches = firstRoundMatchups.length / Math.pow(2, r)
        const roundValue = firstRoundValue / Math.pow(2, r)
        matchesByRound[r] = []
        for (let i = 0; i < numMatches; i++) {
          allMatches.push({
            tournament_id: id,
            team1_id: null,
            team2_id: null,
            round: roundValue,
            bracket_slot: i + 1,
            status: 'pending',
            match_number: matchNumber++,
            stage: 'bracket',
          })
          matchesByRound[r].push(allMatches.length - 1)
        }
      }

      const { data: insertedMatches, error: insertErr } = await supabase
        .from('tournament_matches')
        .insert(allMatches)
        .select('id, tournament_id, team1_id, team2_id, next_match_id, round, bracket_slot, status, match_number, stage, winner_team_id, team1_sets, team2_sets, created_at, updated_at')
      if (insertErr) throw insertErr

      // Link next_match_id
      const updates = []
      for (let r = 0; r < totalRounds - 1; r++) {
        const currentRoundIdxs = matchesByRound[r]
        const nextRoundIdxs = matchesByRound[r + 1]
        for (let i = 0; i < currentRoundIdxs.length; i++) {
          const currentMatch = insertedMatches[currentRoundIdxs[i]]
          const nextMatch = insertedMatches[nextRoundIdxs[Math.floor(i / 2)]]
          updates.push(
            supabase
              .from('tournament_matches')
              .update({ next_match_id: nextMatch.id })
              .eq('id', currentMatch.id)
          )
        }
      }
      if (updates.length > 0) {
        const results = await Promise.all(updates)
        for (const res of results) {
          if (res.error) throw res.error
        }
      }

      // Auto-advance BYE matches
      const byeAdvances = []
      for (const idx of matchesByRound[0]) {
        const match = insertedMatches[idx]
        const hasBye = !match.team1_id || !match.team2_id
        const hasTeam = match.team1_id || match.team2_id
        if (hasBye && hasTeam) {
          const winnerId = match.team1_id || match.team2_id
          byeAdvances.push(
            supabase
              .from('tournament_matches')
              .update({
                winner_team_id: winnerId,
                team1_sets: match.team1_id ? 1 : 0,
                team2_sets: match.team2_id ? 1 : 0,
                status: 'finished',
              })
              .eq('id', match.id)
          )

          const nextRoundIdxs = matchesByRound[1]
          if (nextRoundIdxs) {
            const firstRoundIdx = matchesByRound[0].indexOf(idx)
            const nextMatchData = insertedMatches[nextRoundIdxs[Math.floor(firstRoundIdx / 2)]]
            if (nextMatchData) {
              const isFirstFeeder = firstRoundIdx % 2 === 0
              const updateField = isFirstFeeder ? 'team1_id' : 'team2_id'
              byeAdvances.push(
                supabase
                  .from('tournament_matches')
                  .update({ [updateField]: winnerId })
                  .eq('id', nextMatchData.id)
              )
            }
          }
        }
      }
      if (byeAdvances.length > 0) {
        const results = await Promise.all(byeAdvances)
        for (const res of results) {
          if (res.error) throw res.error
        }
      }

      // Update status
      await supabase.from('tournaments').update({ status: 'in_progress' }).eq('id', id)
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setGeneratingBracket(false)
    }
  }

  const handleScoreSubmit = async (matchId, team1Sets, team2Sets) => {
    if (scoreSubmitting) return
    setScoreSubmitting(true)
    try {
      const match = matches.find((m) => m.id === matchId)
      if (!match) throw new Error('Partido no encontrado')

      const winnerId = team1Sets > team2Sets ? match.team1_id : match.team2_id

      const { error: updateErr } = await supabase
        .from('tournament_matches')
        .update({
          team1_sets: team1Sets,
          team2_sets: team2Sets,
          winner_team_id: winnerId,
          status: 'finished',
        })
        .eq('id', matchId)
      if (updateErr) throw updateErr

      // Advance winner
      if (match.next_match_id) {
        const feeders = matches
          .filter((m) => m.next_match_id === match.next_match_id)
          .sort((a, b) => a.bracket_slot - b.bracket_slot)
        const feederIndex = feeders.findIndex((m) => m.id === matchId)
        const updateField = feederIndex === 0 ? 'team1_id' : 'team2_id'

        const { error: advanceErr } = await supabase
          .from('tournament_matches')
          .update({ [updateField]: winnerId })
          .eq('id', match.next_match_id)
        if (advanceErr) throw advanceErr
      } else {
        // Final match — mark tournament finished
        await supabase.from('tournaments').update({ status: 'finished' }).eq('id', match.tournament_id)
      }

      setScoreMatch(null)
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setScoreSubmitting(false)
    }
  }

  // Find team name by participant id
  const getTeamName = (teamId) => {
    const p = participants.find((pp) => pp.id === teamId)
    return p?.team_name || 'TBD'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="animate-spin w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full" />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-400">Torneo no encontrado</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
        >
          Volver
        </button>
      </div>
    )
  }

  const statusBadge = STATUS_BADGES[tournament.status] || STATUS_BADGES.registration
  const completedMatches = matches.filter((m) => m.status === 'finished')
  const finalMatch = matches.find((m) => !m.next_match_id && m.status === 'finished')

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      {/* Header */}
      <div className="glass-card rounded-none border-x-0 border-t-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{tournament.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md">
                {FORMAT_LABELS[tournament.format] || tournament.format}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-md border ${statusBadge.color} ${
                  statusBadge.pulse ? 'animate-pulse' : ''
                }`}
              >
                {statusBadge.label}
              </span>
            </div>
          </div>
          {tournament.join_code && (
            <div className="text-right shrink-0">
              <p className="text-[10px] text-zinc-500 uppercase">Codigo</p>
              <p className="font-mono text-sm font-bold text-emerald-400">#{tournament.join_code}</p>
            </div>
          )}
        </div>
      </div>

      {/* Registration Info Bar */}
      {tournament.status === 'registration' && (
        <div className="px-4 pt-3">
          <div className="glass-card p-3 space-y-3">
            {/* Spots counter */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">{spotsText}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isFull
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {isFull ? t('tournament.full') : t('tournament.registration_open')}
              </span>
            </div>

            {/* Deadline */}
            {tournament.deadline && (
              <p className="text-xs text-zinc-500">
                Cierre: {new Date(tournament.deadline).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}

            {/* Registration actions (non-admin) */}
            {user && !isAdmin && (
              <div>
                {myRegistration ? (
                  <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-1.5 text-sm font-semibold ${
                      myRegistration.status === 'waitlisted' ? 'text-yellow-400' : 'text-emerald-400'
                    }`}>
                      {myRegistration.status === 'waitlisted' ? (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                          </svg>
                          {t('tournament.waitlisted')} — {t('tournament.position', { n: waitlistedParticipants.findIndex(p => p.id === myRegistration.id) + 1 })}
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          {t('tournament.registered')}
                        </>
                      )}
                    </span>
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelRegistration}
                      className="text-red-400 hover:text-red-300"
                    >
                      {myRegistration.status === 'waitlisted' ? t('tournament.leave_waitlist') : t('tournament.cancel_registration')}
                    </GlassButton>
                  </div>
                ) : (
                  <div>
                    {!showRegisterForm ? (
                      <GlassButton
                        variant="primary"
                        fullWidth
                        onClick={() => setShowRegisterForm(true)}
                      >
                        {isFull ? t('tournament.waitlist') : t('tournament.register')}
                      </GlassButton>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-white">{t('tournament.select_partner')}</p>
                        <input
                          type="text"
                          value={regPartnerQuery}
                          onChange={(e) => setRegPartnerQuery(e.target.value)}
                          placeholder={t('tournament.select_partner') + '...'}
                          className="glass-input"
                        />
                        {regPartnerResults.length > 0 && !regPartner && (
                          <div className="bg-zinc-800 border border-zinc-700 rounded-lg max-h-40 overflow-y-auto divide-y divide-zinc-700">
                            {regPartnerResults.map((player) => (
                              <button
                                key={player.id}
                                onClick={() => {
                                  setRegPartner(player)
                                  setRegPartnerQuery(player.display_name)
                                  setRegPartnerResults([])
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-700 transition-colors"
                              >
                                <div className="w-7 h-7 rounded-full bg-zinc-600 overflow-hidden shrink-0">
                                  {player.avatar_url && (
                                    <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                                  )}
                                </div>
                                <span className="text-white">{player.display_name}</span>
                                <span className="text-zinc-500 text-xs ml-auto">{player.elo_rating} ATP</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {regPartner && (
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400">
                              {regPartner.display_name}
                              <button onClick={() => { setRegPartner(null); setRegPartnerQuery('') }} className="hover:text-white">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          </div>
                        )}
                        <input
                          type="text"
                          value={regTeamName}
                          onChange={(e) => setRegTeamName(e.target.value)}
                          placeholder={t('tournament.team_name')}
                          className="glass-input"
                        />
                        <div className="flex gap-2">
                          <GlassButton
                            variant="ghost"
                            size="sm"
                            onClick={() => { setShowRegisterForm(false); setRegPartner(null); setRegPartnerQuery(''); setRegTeamName('') }}
                          >
                            {t('common.cancel')}
                          </GlassButton>
                          <GlassButton
                            variant="primary"
                            size="sm"
                            onClick={handleSelfRegister}
                            disabled={!regPartner}
                            loading={registering}
                            className="flex-1"
                          >
                            {isFull ? t('tournament.waitlist') : t('tournament.register')}
                          </GlassButton>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <GlassButton
              key={tab.key}
              pill
              pillColor={activeTab === tab.key ? 'emerald' : undefined}
              variant={activeTab === tab.key ? 'primary' : 'ghost'}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1"
            >
              {tab.label}
            </GlassButton>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Tab content */}
      <div className="px-4 pt-4">
        <AnimatePresence mode="wait">
          {/* BRACKET TAB */}
          {activeTab === 'bracket' && (
            <motion.div
              key="bracket"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {matches.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h4l3 4-3 4H3m18-8h-4l-3 4 3 4h4M12 3v18" />
                    </svg>
                  </div>
                  <p className="text-zinc-500 text-sm">No hay bracket generado aun</p>
                  {isAdmin && tournament.status === 'registration' && activeRegistered.length >= 2 && (
                    <div className="flex gap-2 flex-wrap justify-center">
                      <GlassButton
                        variant="primary"
                        onClick={handleGenerateBracket}
                        disabled={generatingBracket}
                        loading={generatingBracket}
                      >
                        Generar Bracket
                      </GlassButton>
                      {/* ─── Balanced bracket button (Updated: 2026-05-08) ─── */}
                      <button
                        onClick={async () => {
                          const { generateLevelBracket } = useTournamentDetailStore.getState()
                          const { pairs, byes, error } = await generateLevelBracket(tournament.id)
                          if (error) { showToast({ type: 'error', message: error }); return }
                          showToast({ type: 'success', message: `Bracket balanceado: ${pairs.length} partidos${byes.length > 0 ? `, ${byes.length} bye(s)` : ''}` })
                        }}
                        className="px-4 py-2 rounded-lg bg-blue-600/20 border border-blue-600/40 text-blue-400 text-sm font-semibold hover:bg-blue-600/30 transition"
                      >
                        ⚖️ Bracket balanceado
                      </button>
                    </div>
                  )}
                  {isAdmin && activeRegistered.length < 2 && (
                    <p className="text-zinc-600 text-xs">Se necesitan al menos 2 equipos para generar bracket</p>
                  )}
                </div>
              ) : tournament.format === 'eliminacion' ? (
                <div className="overflow-x-auto -mx-4 px-4">
                  <EliminacionBracket
                    matches={matches}
                    participants={participants}
                    isAdmin={isAdmin}
                    onRecordResult={(matchId) => setScoreMatch(matches.find(m => m.id === matchId))}
                  />
                </div>
              ) : tournament.format === 'liguilla' ? (
                <LiguillaGroups
                  groups={tournament.groups || []}
                  matches={matches}
                  participants={participants}
                  isAdmin={isAdmin}
                  onRecordResult={(matchId) => setScoreMatch(matches.find(m => m.id === matchId))}
                />
              ) : tournament.format === 'americano' ? (
                <AmericanoView
                  rounds={matches}
                  standings={standings}
                  participants={participants}
                  isAdmin={isAdmin}
                  onRecordResult={(matchId) => setScoreMatch(matches.find(m => m.id === matchId))}
                />
              ) : (
                <div className="space-y-3">
                  {matches.map((match) => (
                    <div key={match.id} className="glass-card p-3 flex items-center justify-between">
                      <span className="text-sm text-white">{getTeamName(match.team1_id)}</span>
                      <span className="text-xs text-zinc-500 mx-2">
                        {match.status === 'finished' ? `${match.team1_sets ?? 0} - ${match.team2_sets ?? 0}` : 'vs'}
                      </span>
                      <span className="text-sm text-white">{getTeamName(match.team2_id)}</span>
                      {isAdmin && match.status !== 'finished' && match.team1_id && match.team2_id && (
                        <button onClick={() => setScoreMatch(match)} className="ml-2 text-xs text-emerald-400">Registrar</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* PARTICIPANTS TAB */}
          {activeTab === 'participantes' && (
            <motion.div
              key="participantes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-400">{spotsText}</p>
                {waitlistedParticipants.length > 0 && (
                  <span className="text-xs text-yellow-400">+{waitlistedParticipants.length} {t('tournament.waitlist').toLowerCase()}</span>
                )}
              </div>

              {/* Add team form (admin only, registration phase) */}
              {isAdmin && tournament.status === 'registration' && (
                <div className="glass-card p-4 space-y-3">
                  <p className="text-sm font-semibold">Agregar equipo</p>

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar jugador por nombre..."
                    className="glass-input"
                  />

                  {searchResults.length > 0 && (
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg max-h-40 overflow-y-auto divide-y divide-zinc-700">
                      {searchResults.map((player) => {
                        const alreadySelected = player.id === selectedP1?.id || player.id === selectedP2?.id
                        return (
                          <button
                            key={player.id}
                            disabled={alreadySelected}
                            onClick={() => {
                              if (!selectedP1) setSelectedP1(player)
                              else if (!selectedP2) setSelectedP2(player)
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                              alreadySelected ? 'opacity-40' : 'hover:bg-zinc-700'
                            }`}
                          >
                            <div className="w-7 h-7 rounded-full bg-zinc-600 overflow-hidden shrink-0">
                              {player.avatar_url && (
                                <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                            <span>{player.display_name}</span>
                            <span className="text-zinc-500 text-xs ml-auto">{player.elo_rating} ATP</span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Selected players */}
                  <div className="flex items-center gap-2">
                    <PlayerChip player={selectedP1} onRemove={() => setSelectedP1(null)} label="J1" />
                    <span className="text-zinc-600 text-xs">&</span>
                    <PlayerChip player={selectedP2} onRemove={() => setSelectedP2(null)} label="J2" />
                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={handleAddTeam}
                      disabled={!selectedP1 || !selectedP2}
                      loading={addingTeam}
                      className="ml-auto"
                    >
                      Agregar
                    </GlassButton>
                  </div>
                </div>
              )}

              {/* Registered participants */}
              <div className="space-y-2">
                {activeRegistered.map((p, idx) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`glass-card p-3 flex items-center gap-3 ${myRegistration?.id === p.id ? 'ring-1 ring-emerald-500/40' : ''}`}
                  >
                    <span className="w-7 h-7 flex items-center justify-center bg-zinc-800 rounded-full text-xs font-bold text-zinc-400 shrink-0">
                      {p.seed || idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-sm truncate">{p.team_name}</p>
                        {/* Level badge (Updated: 2026-05-08) */}
                        {p.p1_profile?.level != null && (
                          <PlayerLevelBadge level={p.p1_profile.level} size="sm" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <AvatarName profile={p.p1_profile} />
                        <span>&</span>
                        <AvatarName profile={p.p2_profile} />
                      </div>
                    </div>
                    {isAdmin && tournament.status === 'registration' && (
                      <button
                        onClick={() => handleRemoveTeam(p.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </motion.div>
                ))}

                {activeRegistered.length === 0 && waitlistedParticipants.length === 0 && (
                  <p className="text-center text-zinc-600 text-sm py-8">No hay equipos inscritos</p>
                )}
              </div>

              {/* Waitlisted participants */}
              {waitlistedParticipants.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    {t('tournament.waitlist')} ({waitlistedParticipants.length})
                  </p>
                  {waitlistedParticipants.map((p, idx) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`glass-card p-3 flex items-center gap-3 opacity-60 ${myRegistration?.id === p.id ? 'ring-1 ring-yellow-500/40 opacity-100' : ''}`}
                    >
                      <span className="w-7 h-7 flex items-center justify-center bg-yellow-500/20 rounded-full text-xs font-bold text-yellow-400 shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{p.team_name}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <AvatarName profile={p.p1_profile} />
                          <span>&</span>
                          <AvatarName profile={p.p2_profile} />
                        </div>
                      </div>
                      {isAdmin && tournament.status === 'registration' && (
                        <button
                          onClick={() => handleRemoveTeam(p.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* RESULTS TAB */}
          {activeTab === 'resultados' && (
            <motion.div
              key="resultados"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Podium */}
              {tournament.status === 'finished' && finalMatch && (
                <div className="glass-card p-6">
                  <h3 className="text-center text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Podio</h3>
                  <div className="flex items-end justify-center gap-4">
                    {/* 2nd place */}
                    <PodiumSlot
                      place={2}
                      teamName={getTeamName(
                        finalMatch.winner_team_id === finalMatch.team1_id
                          ? finalMatch.team2_id
                          : finalMatch.team1_id
                      )}
                      height="h-20"
                      color="bg-zinc-400"
                    />
                    {/* 1st place */}
                    <PodiumSlot
                      place={1}
                      teamName={getTeamName(finalMatch.winner_team_id)}
                      height="h-28"
                      color="bg-yellow-400"
                    />
                    {/* 3rd place */}
                    <PodiumSlot
                      place={3}
                      teamName={(() => {
                        // Find semifinal losers
                        const semiFinals = matches.filter(
                          (m) => m.next_match_id === finalMatch.id && m.status === 'finished'
                        )
                        const semiLosers = semiFinals.map((m) =>
                          m.winner_team_id === m.team1_id ? m.team2_id : m.team1_id
                        )
                        return semiLosers[0] ? getTeamName(semiLosers[0]) : 'N/A'
                      })()}
                      height="h-14"
                      color="bg-amber-700"
                    />
                  </div>
                </div>
              )}

              {/* Match history */}
              <div className="space-y-2">
                {completedMatches.length === 0 ? (
                  <p className="text-center text-zinc-600 text-sm py-8">No hay resultados aun</p>
                ) : (
                  completedMatches.map((match) => (
                    <div
                      key={match.id}
                      className="glass-card p-3 flex items-center gap-3"
                    >
                      <div className="flex-1 text-right">
                        <p
                          className={`text-sm font-semibold ${
                            match.winner_team_id === match.team1_id ? 'text-emerald-400' : 'text-zinc-400'
                          }`}
                        >
                          {getTeamName(match.team1_id)}
                        </p>
                      </div>
                      <div className="px-3 py-1 bg-white/[0.06] rounded-lg text-center min-w-[60px]">
                        <p className="text-sm font-bold">
                          {match.team1_sets} - {match.team2_sets}
                        </p>
                        <p className="text-[10px] text-zinc-500">R{match.round}</p>
                      </div>
                      <div className="flex-1">
                        <p
                          className={`text-sm font-semibold ${
                            match.winner_team_id === match.team2_id ? 'text-emerald-400' : 'text-zinc-400'
                          }`}
                        >
                          {getTeamName(match.team2_id)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Delete Tournament - creator only */}
      {isAdmin && (
        <div className="px-4 mt-6">
          <GlassButton variant="danger" fullWidth onClick={async () => {
            const ok = await useUiStore.getState().confirm({
              message: '⚠️ ¿Eliminar este torneo? Esta acción no se puede deshacer.',
              danger: true,
            })
            if (!ok) return
            const { error } = await supabase.from('tournaments').delete().eq('id', id)
            if (!error) {
              navigate('/torneos')
            }
          }}>
            🗑 Eliminar Torneo
          </GlassButton>
        </div>
      )}

      {/* Score Modal */}
      {scoreMatch && (
        <ScoreModal
          isOpen={!!scoreMatch}
          team1Name={getTeamName(scoreMatch.team1_id)}
          team2Name={getTeamName(scoreMatch.team2_id)}
          loading={scoreSubmitting}
          onSubmit={({ team1Sets, team2Sets }) => handleScoreSubmit(scoreMatch.id, team1Sets, team2Sets)}
          onClose={() => !scoreSubmitting && setScoreMatch(null)}
        />
      )}
    </div>
  )
}

/* ── Sub-components ── */

function PlayerChip({ player, onRemove, label }) {
  if (!player) {
    return (
      <span className="px-3 py-1.5 bg-zinc-800 border border-dashed border-zinc-600 rounded-lg text-xs text-zinc-500">
        {label}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400">
      {player.display_name}
      <button onClick={onRemove} className="hover:text-white">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  )
}

function AvatarName({ profile }) {
  if (!profile) return <span className="text-zinc-600">?</span>
  return (
    <span className="flex items-center gap-1">
      <span className="w-4 h-4 rounded-full bg-zinc-700 overflow-hidden inline-block">
        {profile.avatar_url && (
          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
        )}
      </span>
      <span className="truncate max-w-[80px]">{profile.display_name}</span>
    </span>
  )
}

function MatchCard({ match, getTeamName, isAdmin, onScoreClick }) {
  const isPending = match.status === 'pending' && match.team1_id && match.team2_id
  return (
    <div className="glass-card p-3 flex items-center gap-3">
      <div className="flex-1 text-right">
        <p className="text-sm font-semibold">{getTeamName(match.team1_id)}</p>
      </div>
      <div className="px-3 py-1 bg-white/[0.06] rounded-lg text-center min-w-[60px]">
        {match.status === 'finished' ? (
          <p className="text-sm font-bold">
            {match.team1_sets} - {match.team2_sets}
          </p>
        ) : (
          <p className="text-xs text-zinc-500">vs</p>
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">{getTeamName(match.team2_id)}</p>
      </div>
      {isAdmin && isPending && (
        <GlassButton
          variant="primary"
          size="xs"
          onClick={onScoreClick}
          className="shrink-0"
        >
          Registrar
        </GlassButton>
      )}
    </div>
  )
}

function PodiumSlot({ place, teamName, height, color }) {
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' }
  return (
    <div className="flex flex-col items-center gap-2 w-24">
      <p className="text-xs font-bold text-zinc-300 truncate w-full text-center">{teamName}</p>
      <div className={`${height} w-full ${color} rounded-t-lg flex items-start justify-center pt-2`}>
        <span className="text-xl">{medals[place]}</span>
      </div>
    </div>
  )
}
