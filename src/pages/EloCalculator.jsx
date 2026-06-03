import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'
import { calculateMatchEloChanges } from '@/utils/eloEngine'
import GlassButton from '@/components/ui/GlassButton'
import TennisballLoader from '@/components/TennisballLoader'

const K_NEW = 40
const K_STANDARD = 32
const MATCH_THRESHOLD = 20
const ATP_FLOOR = 800

function PlayerDropdown({ players, selected, onChange, exclude, label }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const { t } = useI18n()

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return players
      .filter(p => !exclude.includes(p.id))
      .filter(p =>
        !q ||
        p.display_name?.toLowerCase().includes(q) ||
        p.username?.toLowerCase().includes(q)
      )
      .slice(0, 30)
  }, [players, search, exclude])

  const selectedPlayer = players.find(p => p.id === selected)

  return (
    <div className="relative">
      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1 block">{label}</label>
      <button
        onClick={() => setOpen(!open)}
        className="w-full glass-card !rounded-xl p-3 text-left flex items-center justify-between gap-2 hover:bg-white/5 transition"
      >
        {selectedPlayer ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-white font-semibold truncate">{selectedPlayer.display_name}</span>
            <span className="text-emerald-400 font-bold text-sm flex-shrink-0">{Math.round(selectedPlayer.elo_rating || 1200)}</span>
          </div>
        ) : (
          <span className="text-zinc-500 text-sm">{t('calculator.select_player')}</span>
        )}
        <span className={`text-zinc-500 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-2 border-b border-zinc-800">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('ranking.search_player')}
                className="w-full bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 outline-none placeholder-zinc-500 focus:ring-1 focus:ring-emerald-500/50"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-center text-zinc-500 text-xs py-4">Sin resultados</p>
              ) : (
                filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { onChange(p.id); setOpen(false); setSearch('') }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-emerald-500/10 transition text-left"
                  >
                    <span className="text-white text-sm truncate">{p.display_name}</span>
                    <span className="text-emerald-400 font-bold text-xs flex-shrink-0">{Math.round(p.elo_rating || 1200)}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function EloResult({ label, oldElo, newElo, delta, kFactor, matchesPlayed }) {
  const { t } = useI18n()
  const isGain = delta > 0
  const isLoss = delta < 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-card !rounded-xl p-3 flex items-center justify-between gap-3"
    >
      <div className="min-w-0 flex-1">
        <p className="text-white font-semibold text-sm truncate">{label}</p>
        <p className="text-[10px] text-zinc-500">
          {t('calculator.k_factor')}: {kFactor} ({matchesPlayed < MATCH_THRESHOLD ? `<${MATCH_THRESHOLD} partidos` : `>=${MATCH_THRESHOLD} partidos`})
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400 text-sm">{oldElo}</span>
          <span className="text-zinc-600 text-xs">→</span>
          <span className="text-white font-bold text-sm">{newElo}</span>
        </div>
        <span className={`text-xs font-black ${isGain ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-zinc-500'}`}>
          {isGain ? '+' : ''}{delta}
        </span>
      </div>
    </motion.div>
  )
}

export default function EloCalculator() {
  const navigate = useNavigate()
  const { t } = useI18n()

  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  // Team A
  const [teamA1, setTeamA1] = useState(null)
  const [teamA2, setTeamA2] = useState(null)
  // Team B
  const [teamB1, setTeamB1] = useState(null)
  const [teamB2, setTeamB2] = useState(null)

  // Score
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')

  // Reverse calculator
  const [targetPlayer, setTargetPlayer] = useState(null)
  const [targetElo, setTargetElo] = useState('')
  const [reverseResult, setReverseResult] = useState(null)

  useEffect(() => {
    async function fetchPlayers() {
      setLoading(true)
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, username, elo_rating, matches_played, avatar_url')
        .order('elo_rating', { ascending: false })
        .limit(200)
      setPlayers(data || [])
      setLoading(false)
    }
    fetchPlayers()
  }, [])

  const selectedIds = [teamA1, teamA2, teamB1, teamB2].filter(Boolean)
  const allSelected = teamA1 && teamA2 && teamB1 && teamB2
  const hasScore = scoreA !== '' && scoreB !== '' && Number(scoreA) !== Number(scoreB)
  const isDraw = scoreA !== '' && scoreB !== '' && Number(scoreA) === Number(scoreB)

  const results = useMemo(() => {
    if (!allSelected || !hasScore) return null

    const playerData = {}
    ;[teamA1, teamA2, teamB1, teamB2].forEach(id => {
      const p = players.find(pl => pl.id === id)
      if (p) {
        playerData[id] = { elo: Math.round(p.elo_rating || 1200), matches_played: p.matches_played || 0 }
      }
    })

    if (Object.keys(playerData).length < 4) return null

    return calculateMatchEloChanges({
      teamAPlayer1: teamA1,
      teamAPlayer2: teamA2,
      teamBPlayer1: teamB1,
      teamBPlayer2: teamB2,
      scoreTeamA: Number(scoreA),
      scoreTeamB: Number(scoreB),
      playerData,
    })
  }, [allSelected, hasScore, teamA1, teamA2, teamB1, teamB2, scoreA, scoreB, players])

  const teamAWins = Number(scoreA) > Number(scoreB)

  const getPlayerName = (id) => players.find(p => p.id === id)?.display_name || '?'

  // Reverse calculator: what score do I need?
  const calculateReverse = () => {
    if (!allSelected || !targetPlayer || !targetElo) return

    const tp = players.find(p => p.id === targetPlayer)
    if (!tp) return

    const currentElo = Math.round(tp.elo_rating || 1200)
    const target = Number(targetElo)
    const needed = target - currentElo

    if (needed <= 0) {
      setReverseResult({ message: `${tp.display_name} ya tiene ${currentElo} ATP (meta: ${target})`, wins: 0 })
      return
    }

    // Simulate wins with current team setup
    const playerData = {}
    ;[teamA1, teamA2, teamB1, teamB2].forEach(id => {
      const p = players.find(pl => pl.id === id)
      if (p) playerData[id] = { elo: Math.round(p.elo_rating || 1200), matches_played: p.matches_played || 0 }
    })

    // Check if target player is in team A or B
    const isTeamA = targetPlayer === teamA1 || targetPlayer === teamA2

    let simElo = currentElo
    let wins = 0
    const maxIterations = 100

    while (simElo < target && wins < maxIterations) {
      const simData = { ...playerData }
      // Update the target player's elo in simulation
      simData[targetPlayer] = { ...simData[targetPlayer], elo: simElo }

      const simResults = calculateMatchEloChanges({
        teamAPlayer1: teamA1,
        teamAPlayer2: teamA2,
        teamBPlayer1: teamB1,
        teamBPlayer2: teamB2,
        scoreTeamA: isTeamA ? 6 : 2,
        scoreTeamB: isTeamA ? 2 : 6,
        playerData: simData,
      })

      const playerResult = simResults.find(r => r.playerId === targetPlayer)
      if (!playerResult || playerResult.delta <= 0) break

      simElo = Math.max(ELO_FLOOR, simElo + playerResult.delta)
      wins++
    }

    setReverseResult({
      message: `${tp.display_name} necesita ~${wins} victoria${wins !== 1 ? 's' : ''} consecutiva${wins !== 1 ? 's' : ''} para llegar a ${target} ATP`,
      wins,
      current: currentElo,
      target,
    })
  }

  const handleShare = () => {
    if (!results) return
    const lines = results.map(r => {
      const name = getPlayerName(r.playerId)
      const sign = r.delta > 0 ? '+' : ''
      return `${name}: ${r.oldElo} → ${r.newElo} (${sign}${r.delta})`
    })
    const winner = teamAWins ? t('calculator.team_a') : t('calculator.team_b')
    const text = `${t('calculator.share_text')}\n\n${winner} gana ${scoreA}-${scoreB}\n\n${lines.join('\n')}\n\n🏸 padelZERO`
    if (navigator.share) {
      navigator.share({ text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).catch(() => {})
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 flex-col gap-4">
        <TennisballLoader size="lg" />
        <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-24 glass-ambient">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600/20 via-zinc-900 to-emerald-600/10 border-b border-zinc-800 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-widest">
              {t('calculator.title')}
            </h1>
            <p className="text-zinc-400 text-xs mt-1">Simula partidos y ve el impacto en ATP</p>
          </div>
          <button
            onClick={() => navigate('/elo-guide')}
            className="text-purple-400 text-xs font-bold uppercase tracking-wider hover:text-purple-300 transition"
          >
            ?
          </button>
        </div>
      </div>

      {/* Team A */}
      <div className="px-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <h2 className="text-xs font-black text-emerald-400 uppercase tracking-widest">{t('calculator.team_a')}</h2>
        </div>
        <PlayerDropdown
          players={players}
          selected={teamA1}
          onChange={setTeamA1}
          exclude={selectedIds.filter(id => id !== teamA1)}
          label="Jugador 1"
        />
        <PlayerDropdown
          players={players}
          selected={teamA2}
          onChange={setTeamA2}
          exclude={selectedIds.filter(id => id !== teamA2)}
          label="Jugador 2"
        />
      </div>

      {/* VS Divider */}
      <div className="flex items-center justify-center gap-3 px-4">
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-zinc-600 font-black text-xs tracking-widest">VS</span>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      {/* Team B */}
      <div className="px-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <h2 className="text-xs font-black text-red-400 uppercase tracking-widest">{t('calculator.team_b')}</h2>
        </div>
        <PlayerDropdown
          players={players}
          selected={teamB1}
          onChange={setTeamB1}
          exclude={selectedIds.filter(id => id !== teamB1)}
          label="Jugador 3"
        />
        <PlayerDropdown
          players={players}
          selected={teamB2}
          onChange={setTeamB2}
          exclude={selectedIds.filter(id => id !== teamB2)}
          label="Jugador 4"
        />
      </div>

      {/* Score Input */}
      {allSelected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4"
        >
          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">{t('calculator.score')}</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1 block">{t('calculator.team_a')}</label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="99"
                value={scoreA}
                onChange={e => setScoreA(e.target.value)}
                className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl text-center text-white text-2xl font-black py-3 outline-none focus:ring-2 focus:ring-emerald-500/50 transition"
                placeholder="0"
              />
            </div>
            <span className="text-zinc-600 font-black text-xl mt-5">-</span>
            <div className="flex-1">
              <label className="text-[10px] text-red-400 font-bold uppercase tracking-widest mb-1 block">{t('calculator.team_b')}</label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="99"
                value={scoreB}
                onChange={e => setScoreB(e.target.value)}
                className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl text-center text-white text-2xl font-black py-3 outline-none focus:ring-2 focus:ring-red-500/50 transition"
                placeholder="0"
              />
            </div>
          </div>

          {isDraw && (
            <p className="text-yellow-400 text-xs text-center mt-2 font-medium">{t('calculator.no_change')}</p>
          )}

          {hasScore && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 text-center"
            >
              <p className={`text-sm font-black uppercase tracking-wider ${teamAWins ? 'text-emerald-400' : 'text-red-400'}`}>
                {teamAWins ? t('calculator.team_a') : t('calculator.team_b')} gana {scoreA}-{scoreB}
              </p>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Results */}
      {results && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="px-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-white uppercase tracking-widest">{t('calculator.result')}</h3>
            <GlassButton
              variant="ghost"
              size="xs"
              onClick={handleShare}
              className="!min-h-0 !py-1 !px-3 text-[10px]"
            >
              {t('calculator.share_text')}
            </GlassButton>
          </div>

          <div className="space-y-2">
            {results.map(r => {
              const player = players.find(p => p.id === r.playerId)
              const mp = player?.matches_played || 0
              return (
                <EloResult
                  key={r.playerId}
                  label={player?.display_name || '?'}
                  oldElo={r.oldElo}
                  newElo={r.newElo}
                  delta={r.delta}
                  kFactor={mp < MATCH_THRESHOLD ? K_NEW : K_STANDARD}
                  matchesPlayed={mp}
                />
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Reverse Calculator */}
      {allSelected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="px-4"
        >
          <div className="glass-card !rounded-2xl p-4 space-y-3 border border-purple-500/20">
            <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest">Meta ATP</h3>
            <p className="text-[10px] text-zinc-500">Cuantas victorias necesito para llegar a mi meta?</p>

            <div className="flex gap-2">
              <div className="flex-1">
                <select
                  value={targetPlayer || ''}
                  onChange={e => setTargetPlayer(e.target.value || null)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm px-3 py-2.5 outline-none focus:ring-1 focus:ring-purple-500/50"
                >
                  <option value="">{t('calculator.select_player')}</option>
                  {[teamA1, teamA2, teamB1, teamB2].filter(Boolean).map(id => {
                    const p = players.find(pl => pl.id === id)
                    return (
                      <option key={id} value={id}>
                        {p?.display_name} ({Math.round(p?.elo_rating || 1200)})
                      </option>
                    )
                  })}
                </select>
              </div>
              <input
                type="number"
                inputMode="numeric"
                value={targetElo}
                onChange={e => setTargetElo(e.target.value)}
                placeholder="Meta ATP"
                className="w-28 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm px-3 py-2.5 outline-none text-center focus:ring-1 focus:ring-purple-500/50"
              />
            </div>

            <GlassButton
              variant="primary"
              size="sm"
              onClick={calculateReverse}
              disabled={!targetPlayer || !targetElo}
              className="w-full"
            >
              {t('calculator.calculate')}
            </GlassButton>

            {reverseResult && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3"
              >
                <p className="text-purple-300 text-sm font-semibold">{reverseResult.message}</p>
                {reverseResult.wins > 0 && (
                  <p className="text-[10px] text-zinc-500 mt-1">
                    *Estimado con victorias 6-2 consecutivas contra este equipo
                  </p>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* Footer tip */}
      <div className="px-4 text-center pt-2">
        <p className="text-zinc-600 text-[10px] uppercase tracking-widest font-bold">
          Simulador -- no afecta tu ATP real
        </p>
      </div>
    </div>
  )
}
