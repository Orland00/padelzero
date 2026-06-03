import { useState } from 'react'
import { motion } from 'framer-motion'

export default function AmericanoView({ rounds = [], standings = [], participants = [], isAdmin, onRecordResult }) {
  const [activeRound, setActiveRound] = useState(null)

  // Resolve team name from participant
  const getTeamName = (teamId) => {
    const p = participants.find(p => p.id === teamId)
    if (!p) return 'TBD'
    const names = [p.p1_profile?.display_name, p.p2_profile?.display_name].filter(Boolean)
    return p.team_name || names.join(' & ') || 'Equipo'
  }

  // Group matches by round
  const roundGroups = rounds.reduce((acc, match) => {
    const round = match.round || 1
    if (!acc[round]) acc[round] = []
    acc[round].push(match)
    return acc
  }, {})

  const roundNumbers = Object.keys(roundGroups).map(Number).sort((a, b) => a - b)
  const currentRound = activeRound || roundNumbers[roundNumbers.length - 1] || 1

  return (
    <div className="space-y-6">
      {/* Leaderboard */}
      <div>
        <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-3">Tabla de Posiciones</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 px-4 py-2 bg-zinc-800/50 text-xs font-bold text-zinc-500 uppercase">
            <span className="w-6">#</span>
            <span>Equipo</span>
            <span className="w-10 text-center">PJ</span>
            <span className="w-10 text-center">PG</span>
            <span className="w-12 text-center text-amber-400">PTS</span>
          </div>
          {/* Rows */}
          {standings.length > 0 ? (
            standings
              .sort((a, b) => (b.points || 0) - (a.points || 0))
              .map((team, idx) => (
                <motion.div
                  key={team.id || idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 px-4 py-3 border-t border-zinc-800/50 ${
                    idx < 2 ? 'border-l-2 border-l-emerald-500' : ''
                  }`}
                >
                  <span className={`w-6 font-black text-sm ${
                    idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-zinc-300' : idx === 2 ? 'text-amber-700' : 'text-zinc-500'
                  }`}>
                    {idx + 1}
                  </span>
                  <span className="text-white font-semibold text-sm truncate">
                    {getTeamName(team.team_id)}
                  </span>
                  <span className="w-10 text-center text-zinc-400 text-sm">{team.matches_played || 0}</span>
                  <span className="w-10 text-center text-zinc-400 text-sm">{team.matches_won || 0}</span>
                  <span className="w-12 text-center text-amber-400 font-black text-sm">{team.points || 0}</span>
                </motion.div>
              ))
          ) : (
            <p className="text-zinc-500 text-sm text-center py-6">Sin resultados aun</p>
          )}
        </div>
      </div>

      {/* Round Selector */}
      {roundNumbers.length > 0 && (
        <div>
          <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-3">Rondas</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {roundNumbers.map(round => (
              <button
                key={round}
                onClick={() => setActiveRound(round)}
                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition ${
                  currentRound === round
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Ronda {round}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Current Round Matches */}
      {roundGroups[currentRound] && (
        <div className="space-y-2">
          {roundGroups[currentRound].map((match, idx) => {
            const team1Name = getTeamName(match.team1_id)
            const team2Name = getTeamName(match.team2_id)
            const isFinished = match.status === 'finished'
            const team1Won = match.winner_team_id === match.team1_id
            const team2Won = match.winner_team_id === match.team2_id

            return (
              <motion.div
                key={match.id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-1">
                    <div className={`flex items-center justify-between ${team1Won ? 'text-emerald-400 font-bold' : isFinished && team2Won ? 'text-zinc-500' : 'text-white'}`}>
                      <span className="text-sm">{team1Name}</span>
                      {isFinished && <span className="text-sm font-mono">{match.team1_sets || 0}</span>}
                    </div>
                    <div className={`flex items-center justify-between ${team2Won ? 'text-emerald-400 font-bold' : isFinished && team1Won ? 'text-zinc-500' : 'text-white'}`}>
                      <span className="text-sm">{team2Name}</span>
                      {isFinished && <span className="text-sm font-mono">{match.team2_sets || 0}</span>}
                    </div>
                  </div>
                  {!isFinished && isAdmin && (
                    <button
                      onClick={() => onRecordResult?.(match.id)}
                      className="ml-3 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg hover:bg-emerald-500/30 transition"
                    >
                      Registrar
                    </button>
                  )}
                  {isFinished && (
                    <span className="ml-3 text-xs text-zinc-600">Finalizado</span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {roundNumbers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🎾</p>
          <p className="text-zinc-400">Las rondas se generaran cuando inicie el torneo</p>
        </div>
      )}
    </div>
  )
}
