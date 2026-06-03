import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useJornadaStore } from '@/stores/jornadaStore'
import { useLigaStore } from '@/stores/ligaStore'
import { motion } from 'framer-motion'
import CrownCelebration from '@/components/CrownCelebration'
import { formatDisplayName } from '@/utils/dateFormatters'

export default function LigaJornada() {
  const { ligaId, jornadaId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    jornada,
    checkIns,
    rounds,
    matches,
    loading,
    checkIn,
    fetchCheckIns,
    fetchMatches,
    generateRounds,
    recordMatchScore,
    finalizeJornada,
    subscribeJornada,
  } = useJornadaStore()
  const { currentLiga, members, fetchLiga } = useLigaStore()
  const [matchScores, setMatchScores] = useState({})
  const [showCrownCelebration, setShowCrownCelebration] = useState(false)
  const [crownWinnerName, setCrownWinnerName] = useState(null)

  useEffect(() => {
    if (ligaId) {
      fetchLiga(ligaId)
    }
  }, [ligaId, fetchLiga])

  useEffect(() => {
    if (jornadaId) {
      fetchCheckIns(jornadaId)
      fetchMatches(jornadaId)
      const unsub = subscribeJornada(jornadaId)
      return unsub
    }
  }, [jornadaId, fetchCheckIns, fetchMatches, subscribeJornada])

  const hasCheckedIn = checkIns?.some(ci => ci.player_id === user?.id)
  const isAdmin = members?.some(m => m.player_id === user?.id && m.role === 'admin')
  const canGenerateRounds = isAdmin && checkIns && checkIns.length >= 4 && rounds.length === 0

  // Get matches for current round
  const currentRoundMatches = rounds.length > 0 && rounds[0]
    ? matches.filter(m => m.round?.round_number === rounds[0].round_number)
    : []

  const handleCheckIn = async () => {
    try {
      await checkIn(jornadaId, user.id)
    } catch (err) {
      // error handled by store
    }
  }

  const handleGenerateRounds = async () => {
    try {
      await generateRounds(jornadaId, ligaId, 3)
    } catch (err) {
      // error handled by store
    }
  }

  const handleRecordScore = async (matchId) => {
    const scores = matchScores[matchId]
    if (scores?.teamA !== undefined && scores?.teamB !== undefined) {
      try {
        await recordMatchScore(matchId, scores.teamA, scores.teamB)
        setMatchScores({ ...matchScores, [matchId]: { teamA: '', teamB: '' } })
      } catch (err) {
        // error handled by store
      }
    }
  }

  const handleFinalize = async () => {
    try {
      const result = await finalizeJornada(jornadaId, ligaId)

      // Task 15: Show crown celebration if crown transferred
      if (result?.crownWinnerName) {
        setCrownWinnerName(result.crownWinnerName)
        setShowCrownCelebration(true)
      } else {
        // Navigate immediately if no crown transfer
        navigate(`/liga/${ligaId}`)
      }
    } catch (err) {
      // error handled by store
    }
  }

  // Navigate after celebration completes
  const handleCelebratonComplete = () => {
    setShowCrownCelebration(false)
    navigate(`/liga/${ligaId}`)
  }

  if (loading && !jornada) {
    return (
      <div className="flex justify-center items-center h-screen bg-zinc-950">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Task 15: Crown celebration overlay */}
      <CrownCelebration
        playerName={crownWinnerName}
        isVisible={showCrownCelebration}
        onComplete={handleCelebratonComplete}
      />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`/liga/${ligaId}`)}
            className="text-zinc-400 hover:text-white mb-4 transition"
          >
            ← VOLVER
          </button>
          <h1 className="text-3xl font-black uppercase tracking-widest text-white">
            🎮 Jornada {jornada?.jornada_number || '?'}
          </h1>
          <p className="text-zinc-400 mt-2">{currentLiga?.name}</p>
        </div>

        {/* CHECK-IN PHASE */}
        {rounds.length === 0 && (
          <div className="space-y-6">
            {/* Player Check-In Button */}
            {!hasCheckedIn && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCheckIn}
                disabled={loading}
                className="w-full py-6 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-black text-xl rounded-xl transition"
              >
                {loading ? 'REGISTRANDO...' : '✅ ESTOY AQUÍ'}
              </motion.button>
            )}

            {hasCheckedIn && (
              <div className="p-4 bg-emerald-500/20 border border-emerald-500 rounded-xl text-center">
                <p className="text-emerald-300 font-bold">✓ YA HICISTE CHECK-IN</p>
              </div>
            )}

            {/* Check-ins List */}
            <div className="space-y-2">
              <p className="text-sm text-zinc-400 font-bold">PRESENTES ({checkIns?.length || 0})</p>
              {checkIns && checkIns.length > 0 ? (
                <div className="space-y-2">
                  {checkIns.map((ci, idx) => (
                    <motion.div
                      key={ci.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-3"
                    >
                      <span className="text-green-500">●</span>
                      <span className="font-bold text-white">{formatDisplayName(ci.profiles?.display_name)}</span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 text-sm py-4 text-center">Esperando jugadores...</p>
              )}
            </div>

            {/* Generate Rounds Button */}
            {canGenerateRounds && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerateRounds}
                disabled={loading}
                className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black rounded-xl transition"
              >
                {loading ? 'GENERANDO...' : `⚡ GENERAR ${checkIns.length} JUGADORES`}
              </motion.button>
            )}
          </div>
        )}

        {/* LIVE ROUNDS PHASE */}
        {rounds.length > 0 && (
          <div className="space-y-6">
            {/* Round Header */}
            <div className="text-center">
              <p className="text-zinc-400 text-sm mb-2">RONDA {rounds[0]?.round_number || 1}</p>
              <h2 className="text-2xl font-black text-emerald-500">EN VIVO</h2>
            </div>

            {/* Matches Grid */}
            <div className="space-y-4">
              {currentRoundMatches.length > 0 ? (
                currentRoundMatches.map((match) => (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4"
                  >
                    {/* Court Number */}
                    <div className="text-center">
                      <p className="text-xs text-zinc-400 mb-1">CANCHA</p>
                      <p className="text-2xl font-black text-emerald-500">{match.court_number}</p>
                    </div>

                    {/* Teams */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Team A */}
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-400 font-bold">EQUIPO A</p>
                        <div className="space-y-1 text-sm">
                          <p className="text-white font-bold">{match.p1?.display_name || '?'}</p>
                          <p className="text-white font-bold">{match.p2?.display_name || '?'}</p>
                        </div>
                      </div>

                      {/* Team B */}
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-400 font-bold">EQUIPO B</p>
                        <div className="space-y-1 text-sm">
                          <p className="text-white font-bold">{match.p3?.display_name || '?'}</p>
                          <p className="text-white font-bold">{match.p4?.display_name || '?'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Bye Indicator */}
                    {match.bye?.display_name && (
                      <div className="text-center p-2 bg-amber-500/20 border border-amber-500 rounded">
                        <p className="text-xs text-amber-300 font-bold">BYE: {match.bye.display_name}</p>
                      </div>
                    )}

                    {/* Score Section (Admin Only) */}
                    {isAdmin && match.status !== 'completed' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="number"
                            min="0"
                            max="30"
                            placeholder="A"
                            value={matchScores[match.id]?.teamA || ''}
                            onChange={(e) =>
                              setMatchScores({
                                ...matchScores,
                                [match.id]: {
                                  ...matchScores[match.id],
                                  teamA: parseInt(e.target.value) || 0,
                                },
                              })
                            }
                            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-center text-white font-black focus:outline-none focus:border-emerald-500"
                          />
                          <input
                            type="number"
                            min="0"
                            max="30"
                            placeholder="B"
                            value={matchScores[match.id]?.teamB || ''}
                            onChange={(e) =>
                              setMatchScores({
                                ...matchScores,
                                [match.id]: {
                                  ...matchScores[match.id],
                                  teamB: parseInt(e.target.value) || 0,
                                },
                              })
                            }
                            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-center text-white font-black focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <button
                          onClick={() => handleRecordScore(match.id)}
                          disabled={loading || matchScores[match.id]?.teamA === undefined || matchScores[match.id]?.teamB === undefined}
                          className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold rounded transition text-sm"
                        >
                          {loading ? '...' : 'REGISTRAR'}
                        </button>
                      </div>
                    )}

                    {/* Score Display (After Recorded) */}
                    {match.status === 'completed' && (
                      <div className="text-center p-3 bg-emerald-500/20 border border-emerald-500 rounded">
                        <p className="text-lg font-black text-emerald-400">
                          {match.score_team_a} - {match.score_team_b}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ))
              ) : (
                <p className="text-zinc-400 text-center py-8">Sin partidos generados</p>
              )}
            </div>

            {/* Finalize Button */}
            {isAdmin && matches.every(m => m.status === 'completed') && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleFinalize}
                disabled={loading}
                className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black rounded-xl transition"
              >
                {loading ? 'FINALIZANDO...' : '🏁 FINALIZAR JORNADA'}
              </motion.button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
