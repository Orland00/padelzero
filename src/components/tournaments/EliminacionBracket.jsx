import { motion } from 'framer-motion'

const getTeamName = (teamId, participants) => {
  if (!teamId) return null
  const p = participants.find(p => p.id === teamId)
  if (!p) return 'Por definir'
  const names = [p.p1_profile?.display_name, p.p2_profile?.display_name].filter(Boolean)
  return p.team_name || names.join(' & ') || 'Equipo'
}

function MatchCard({ match, participants, isAdmin, onRecordResult, index }) {
  const team1Name = match.team1_id ? getTeamName(match.team1_id, participants) : (match.team1_id === null && !match.prev_match_1 ? 'BYE' : 'Por definir')
  const team2Name = match.team2_id ? getTeamName(match.team2_id, participants) : (match.team2_id === null && !match.prev_match_2 ? 'BYE' : 'Por definir')

  const isFinished = match.status === 'finished' || match.winner_team_id
  const isPending = !isFinished && match.team1_id && match.team2_id
  const team1Won = isFinished && match.winner_team_id === match.team1_id
  const team2Won = isFinished && match.winner_team_id === match.team2_id

  const isBye = (name) => name === 'BYE'
  const isTbd = (name) => name === 'Por definir'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 w-52 shrink-0"
    >
      {/* Team 1 */}
      <div
        className={`flex items-center justify-between px-2 py-1.5 rounded-t ${
          team1Won ? 'bg-emerald-500/10' : ''
        }`}
      >
        <span
          className={`text-sm truncate mr-2 ${
            isBye(team1Name)
              ? 'text-zinc-600 italic'
              : isTbd(team1Name)
              ? 'text-zinc-500 italic'
              : team1Won
              ? 'text-emerald-400 font-bold'
              : isFinished
              ? 'text-zinc-500'
              : 'text-zinc-200'
          }`}
        >
          {team1Name}
        </span>
        {isFinished && (
          <span
            className={`text-sm font-mono ${
              team1Won ? 'text-emerald-400 font-bold' : 'text-zinc-500'
            }`}
          >
            {match.team1_sets ?? 0}
          </span>
        )}
      </div>

      <div className="border-t border-zinc-700/50" />

      {/* Team 2 */}
      <div
        className={`flex items-center justify-between px-2 py-1.5 rounded-b ${
          team2Won ? 'bg-emerald-500/10' : ''
        }`}
      >
        <span
          className={`text-sm truncate mr-2 ${
            isBye(team2Name)
              ? 'text-zinc-600 italic'
              : isTbd(team2Name)
              ? 'text-zinc-500 italic'
              : team2Won
              ? 'text-emerald-400 font-bold'
              : isFinished
              ? 'text-zinc-500'
              : 'text-zinc-200'
          }`}
        >
          {team2Name}
        </span>
        {isFinished && (
          <span
            className={`text-sm font-mono ${
              team2Won ? 'text-emerald-400 font-bold' : 'text-zinc-500'
            }`}
          >
            {match.team2_sets ?? 0}
          </span>
        )}
      </div>

      {/* Admin action */}
      {isPending && isAdmin && onRecordResult && (
        <button
          onClick={() => onRecordResult(match.id)}
          className="mt-2 w-full text-xs font-medium py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
        >
          Registrar
        </button>
      )}
    </motion.div>
  )
}

function RoundColumn({ title, matches, participants, isAdmin, onRecordResult, side }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">
        {title}
      </span>
      <div className="flex flex-col justify-around flex-1 gap-6">
        {matches.map((m, i) => (
          <div key={m.id} className="relative flex items-center">
            {/* Connector line going right (left side of bracket) */}
            {side === 'left' && (
              <div className="absolute -right-4 top-1/2 w-4 border-t border-zinc-600" />
            )}
            {/* Connector line going left (right side of bracket) */}
            {side === 'right' && (
              <div className="absolute -left-4 top-1/2 w-4 border-t border-zinc-600" />
            )}
            <MatchCard
              match={m}
              participants={participants}
              isAdmin={isAdmin}
              onRecordResult={onRecordResult}
              index={i}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

const ROUND_LABELS = {
  1: 'Primera Ronda',
  2: 'Cuartos',
  3: 'Semifinal',
  4: 'FINAL',
}

function getRoundLabel(roundNumber, totalRounds) {
  const roundFromFinal = totalRounds - roundNumber + 1
  if (roundFromFinal === 1) return 'FINAL'
  if (roundFromFinal === 2) return 'Semifinal'
  if (roundFromFinal === 3) return 'Cuartos'
  return `Ronda ${roundNumber}`
}

export default function EliminacionBracket({ matches, participants, isAdmin, onRecordResult }) {
  if (!matches || matches.length === 0) {
    return (
      <div className="text-center text-zinc-500 py-10">
        No hay partidos en el bracket todavia.
      </div>
    )
  }

  // Group matches by round
  const roundsMap = {}
  matches.forEach((m) => {
    const r = m.round || 1
    if (!roundsMap[r]) roundsMap[r] = []
    roundsMap[r].push(m)
  })

  const roundNumbers = Object.keys(roundsMap)
    .map(Number)
    .sort((a, b) => a - b)
  const totalRounds = roundNumbers.length

  // Build the bracket structure
  // For mirrored bracket: split each round's matches into left and right halves
  // Final round stays in the center
  const finalRound = roundNumbers[roundNumbers.length - 1]
  const nonFinalRounds = roundNumbers.slice(0, -1)

  // Split non-final rounds into left and right
  const leftRounds = []
  const rightRounds = []

  nonFinalRounds.forEach((rn) => {
    const roundMatches = roundsMap[rn]
    const half = Math.ceil(roundMatches.length / 2)
    leftRounds.push({
      round: rn,
      label: getRoundLabel(rn, totalRounds),
      matches: roundMatches.slice(0, half),
    })
    rightRounds.push({
      round: rn,
      label: getRoundLabel(rn, totalRounds),
      matches: roundMatches.slice(half),
    })
  })

  // Right rounds should be displayed in reverse order (mirrored)
  const rightRoundsReversed = [...rightRounds].reverse()

  const finalMatches = roundsMap[finalRound] || []

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-stretch gap-6 min-w-[700px] py-4 px-2 justify-center">
        {/* Left side: early rounds → later rounds */}
        {leftRounds.map((r) => (
          <RoundColumn
            key={`left-${r.round}`}
            title={r.label}
            matches={r.matches}
            participants={participants}
            isAdmin={isAdmin}
            onRecordResult={onRecordResult}
            side="left"
          />
        ))}

        {/* Center: FINAL */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-1">
            FINAL
          </span>
          <div className="flex flex-col justify-center flex-1 gap-6">
            {finalMatches.map((m, i) => (
              <div key={m.id} className="relative">
                {/* Left connector */}
                <div className="absolute -left-4 top-1/2 w-4 border-t border-zinc-600" />
                {/* Right connector */}
                <div className="absolute -right-4 top-1/2 w-4 border-t border-zinc-600" />
                <MatchCard
                  match={m}
                  participants={participants}
                  isAdmin={isAdmin}
                  onRecordResult={onRecordResult}
                  index={i}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right side: later rounds → early rounds (mirrored) */}
        {rightRoundsReversed.map((r) => (
          <RoundColumn
            key={`right-${r.round}`}
            title={r.label}
            matches={r.matches}
            participants={participants}
            isAdmin={isAdmin}
            onRecordResult={onRecordResult}
            side="right"
          />
        ))}
      </div>
    </div>
  )
}
