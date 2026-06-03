import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { calculateJornadaPoints } from '@/utils/americanoEngine'
import { motion } from 'framer-motion'
import { formatDateSafe, formatDisplayName } from '@/utils/dateFormatters'

export default function LigaJornadaDetail() {
  const { ligaId, jornadaId } = useParams()
  const navigate = useNavigate()

  const [jornada, setJornada] = useState(null)
  const [rounds, setRounds] = useState([])
  const [matches, setMatches] = useState([])
  const [standings, setStandings] = useState([])
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedRounds, setExpandedRounds] = useState({})

  useEffect(() => {
    if (jornadaId) {
      fetchJornadaDetails()
    }
  }, [jornadaId])

  const fetchJornadaDetails = async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch jornada
      const { data: jornadaData, error: jornadaErr } = await supabase
        .from('jornadas')
        .select('id, liga_id, jornada_number, date, status, completed_at, created_by')
        .eq('id', jornadaId)
        .single()

      if (jornadaErr) throw jornadaErr
      setJornada(jornadaData)

      // Fetch all rounds for this jornada
      const { data: roundsData, error: roundsErr } = await supabase
        .from('americano_rounds')
        .select('id, jornada_id, round_number, status')
        .eq('jornada_id', jornadaId)
        .order('round_number', { ascending: true })

      if (roundsErr) throw roundsErr
      setRounds(roundsData || [])

      // Fetch all matches for this jornada's rounds
      const roundIds = (roundsData || []).map(r => r.id)
      let matchesData = []
      if (roundIds.length > 0) {
        const { data: mData, error: matchesErr } = await supabase
          .from('americano_matches')
          .select(`
            *,
            round:americano_rounds(round_number),
            p1:team_a_player1(id, display_name),
            p2:team_a_player2(id, display_name),
            p3:team_b_player1(id, display_name),
            p4:team_b_player2(id, display_name),
            bye:bye_player(id, display_name)
          `)
          .in('round_id', roundIds)
          .order('court_number', { ascending: true })

        if (matchesErr) throw matchesErr
        matchesData = mData || []
      }

      setMatches(matchesData)

      // Fetch participants
      const { data: checkIns, error: checkInErr } = await supabase
        .from('jornada_checkins')
        .select('*, profiles(id, display_name, avatar_url)')
        .eq('jornada_id', jornadaId)

      if (checkInErr) throw checkInErr
      setParticipants(checkIns || [])

      // Calculate standings from matches
      if (matchesData && matchesData.length > 0) {
        const pointsByPlayer = calculateJornadaPoints(matchesData)
        const playerIds = Object.keys(pointsByPlayer)

        // Get player profiles
        const { data: profiles, error: profileErr } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', playerIds)

        if (!profileErr && profiles) {
          const standings_list = playerIds
            .map(playerId => ({
              player_id: playerId,
              total_points: pointsByPlayer[playerId],
              profile: profiles.find(p => p.id === playerId),
              games_played: matchesData.filter(m =>
                [m.team_a_player1, m.team_a_player2, m.team_b_player1, m.team_b_player2].includes(playerId)
              ).length,
            }))
            .sort((a, b) => b.total_points - a.total_points)

          setStandings(standings_list)
        }
      }

      // Expand all rounds by default
      if (roundsData && roundsData.length > 0) {
        const expandedObj = {}
        roundsData.forEach(r => {
          expandedObj[r.id] = true
        })
        setExpandedRounds(expandedObj)
      }
    } catch (err) {
      // error state shown via setError below
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleRound = (roundId) => {
    setExpandedRounds(prev => ({
      ...prev,
      [roundId]: !prev[roundId],
    }))
  }

  const getRoundMatches = (roundId) => {
    return matches.filter(m => m.round_id === roundId)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-zinc-950">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !jornada) {
    return (
      <div className="min-h-screen bg-zinc-950 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate(`/liga/${ligaId}`)}
            className="text-zinc-400 hover:text-white mb-4 transition"
          >
            ← VOLVER
          </button>
          <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
            {error || 'Jornada no encontrada'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/liga/${ligaId}`)}
          className="text-zinc-400 hover:text-white mb-4 transition"
        >
          ← VOLVER
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black uppercase tracking-widest text-white mb-2">
            🎮 Jornada {jornada.jornada_number}
          </h1>
          <div className="flex items-center gap-4 text-zinc-400 mb-4">
            <span>📅 {formatDateSafe(jornada.date, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }, 'Fecha pendiente')}</span>
            <span>👥 {participants.length} jugadores</span>
          </div>

          {/* Status Badge */}
          <div className="inline-flex gap-2">
            {jornada.status === 'completed' && (
              <span className="text-xs px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full font-bold">
                ✓ Completada
              </span>
            )}
            {jornada.status === 'in_progress' && (
              <span className="text-xs px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full font-bold">
                🔴 En Vivo
              </span>
            )}
            {jornada.status === 'upcoming' && (
              <span className="text-xs px-3 py-1 bg-zinc-700 text-zinc-300 rounded-full font-bold">
                ⏰ Próxima
              </span>
            )}
          </div>
        </div>

        {/* Rounds Section */}
        {rounds.length > 0 && (
          <div className="mb-8 space-y-3">
            <h2 className="text-xl font-black uppercase tracking-widest text-white mb-4">
              Rondas
            </h2>

            {rounds.map((round, roundIdx) => {
              const roundMatches = getRoundMatches(round.id)
              const isExpanded = expandedRounds[round.id]

              return (
                <motion.div
                  key={round.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
                >
                  {/* Round Header */}
                  <button
                    onClick={() => toggleRound(round.id)}
                    className="w-full p-4 hover:bg-zinc-800 transition flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-emerald-500">
                        Ronda {round.round_number}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {roundMatches.length} partidos
                      </span>
                    </div>
                    <span className="text-zinc-400">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </button>

                  {/* Round Matches */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-zinc-800 p-4 space-y-4"
                    >
                      {roundMatches.length > 0 ? (
                        roundMatches.map((match) => (
                          <div
                            key={match.id}
                            className="p-4 bg-zinc-800 rounded-lg space-y-3"
                          >
                            {/* Court Number */}
                            <div className="text-center mb-3">
                              <p className="text-xs text-zinc-400 font-bold">CANCHA</p>
                              <p className="text-2xl font-black text-emerald-500">
                                {match.court_number}
                              </p>
                            </div>

                            {/* Match Result */}
                            <div className="grid grid-cols-2 gap-3 items-center">
                              {/* Team A */}
                              <div className="space-y-2">
                                <p className="text-xs text-zinc-400 font-bold">EQUIPO A</p>
                                <div className="space-y-1">
                                  <p className="text-sm text-white font-bold">
                                    {match.p1?.display_name || '?'}
                                  </p>
                                  <p className="text-sm text-white font-bold">
                                    {match.p2?.display_name || '?'}
                                  </p>
                                </div>
                              </div>

                              {/* Team B */}
                              <div className="space-y-2">
                                <p className="text-xs text-zinc-400 font-bold">EQUIPO B</p>
                                <div className="space-y-1">
                                  <p className="text-sm text-white font-bold">
                                    {match.p3?.display_name || '?'}
                                  </p>
                                  <p className="text-sm text-white font-bold">
                                    {match.p4?.display_name || '?'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Score */}
                            {match.status === 'completed' ? (
                              <div className="text-center p-3 bg-emerald-500/20 border border-emerald-500 rounded">
                                <p className="text-2xl font-black text-emerald-400">
                                  {match.score_team_a} - {match.score_team_b}
                                </p>
                              </div>
                            ) : (
                              <div className="text-center p-3 bg-zinc-700 rounded text-zinc-400 text-sm">
                                Pendiente
                              </div>
                            )}

                            {/* Bye Indicator */}
                            {match.bye?.display_name && (
                              <div className="text-center p-2 bg-amber-500/20 border border-amber-500 rounded">
                                <p className="text-xs text-amber-300 font-bold">
                                  BYE: {match.bye.display_name}
                                </p>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-zinc-400 text-sm text-center py-4">
                          Sin partidos en esta ronda
                        </p>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Final Leaderboard Section */}
        {standings.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-black uppercase tracking-widest text-white mb-4">
              Ranking Final
            </h2>

            <div className="space-y-2">
              {standings.map((standing, idx) => (
                <motion.div
                  key={standing.player_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* Rank Badge */}
                    <span className="text-2xl font-black text-emerald-500 w-8 text-center">
                      #{idx + 1}
                    </span>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">
                        {formatDisplayName(standing.profile?.display_name)}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {standing.games_played} partidos
                      </p>
                    </div>
                  </div>

                  {/* Points */}
                  <div className="text-right">
                    <p className="text-xl font-black text-emerald-500">
                      {standing.total_points}
                    </p>
                    <p className="text-xs text-zinc-400">puntos</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Participants List (if no results yet) */}
        {standings.length === 0 && participants.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-black uppercase tracking-widest text-white mb-4">
              Participantes
            </h2>

            <div className="space-y-2">
              {participants.map((participant, idx) => (
                <motion.div
                  key={participant.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-3"
                >
                  <span className="text-green-500">●</span>
                  <span className="font-bold text-white">
                    {formatDisplayName(participant.profiles?.display_name)}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* No Data State */}
        {rounds.length === 0 && standings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-400 mb-4">Esta jornada aún no tiene resultados</p>
            {jornada.status === 'upcoming' && (
              <p className="text-sm text-zinc-500">La jornada aún no ha comenzado</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
