import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSessionStore } from '@/stores/sessionStore'
import { useUiStore } from '@/stores/uiStore'
import { getTheme } from '@/lib/themes'
import Bracket from './Bracket'

// ── Helpers ──────────────────────────────────────────────────────────────────
function teamDisplayName(team) {
  if (!team) return '?'
  if (team.name) return team.name
  const p1 = team.p1?.display_name?.split(' ')[0] || '?'
  const p2 = team.p2?.display_name?.split(' ')[0] || '?'
  return `${p1} / ${p2}`
}

function computeStandings(teams, matches) {
  const stats = {}
  teams.forEach(t => {
    stats[t.id] = { team: t, w: 0, l: 0, setsFor: 0, setsAgainst: 0 }
  })
  matches.forEach(m => {
    if (m.status !== 'done') return
    const s1 = stats[m.team1_id]
    const s2 = stats[m.team2_id]
    if (!s1 || !s2) return
    s1.setsFor += m.team1_sets ?? 0
    s1.setsAgainst += m.team2_sets ?? 0
    s2.setsFor += m.team2_sets ?? 0
    s2.setsAgainst += m.team1_sets ?? 0
    if (m.winner_team_id === m.team1_id) { s1.w++; s2.l++ }
    else { s2.w++; s1.l++ }
  })
  return Object.values(stats).sort((a, b) => {
    if (b.w !== a.w) return b.w - a.w
    const aSD = a.setsFor - a.setsAgainst
    const bSD = b.setsFor - b.setsAgainst
    return bSD - aSD
  })
}

function groupByRound(matches) {
  const rounds = {}
  matches.forEach(m => {
    const r = m.round || 1
    if (!rounds[r]) rounds[r] = []
    rounds[r].push(m)
  })
  return Object.entries(rounds).map(([r, ms]) => ({ round: Number(r), matches: ms }))
    .sort((a, b) => a.round - b.round)
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function UnifiedSessionView({ sessionId: propSessionId, forcedTheme }) {
  const { id: paramSessionId } = useParams()
  const sessionId = propSessionId || paramSessionId
  const navigate = useNavigate()
  const { fetchSession, recordResult, currentSession, loading } = useSessionStore()
  const { showToast } = useUiStore()

  const [tab, setTab] = useState('Matches')
  const [scoring, setScoring] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Determine theme
  const theme = forcedTheme || (currentSession ? getTheme(currentSession.name) : getTheme(''))

  useEffect(() => {
    if (!sessionId) return
    fetchSession(sessionId)
  }, [sessionId, fetchSession])

  if (loading || !currentSession) {
    return (
      <div className={`flex items-center justify-center h-screen ${theme.id === 'manada' ? 'bg-black' : 'bg-zinc-950'}`}>
        <div className="animate-spin w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full" />
      </div>
    )
  }

  const isTournament = currentSession.type === 'tournament'
  const isLeague = currentSession.type === 'league'
  const teams = currentSession.teams || []
  const matches = currentSession.matches || []
  const roundGroups = groupByRound(matches)
  const standings = computeStandings(teams, matches)
  const doneCount = matches.filter(m => m.status === 'done').length
  const totalCount = matches.length

  const handleRegister = (match) => {
    setScoring({
      matchId: match.id,
      team1Name: teamDisplayName(match.team1),
      team2Name: teamDisplayName(match.team2),
      t1: 0,
      t2: 0,
      maxSets: currentSession.sets_to_win * 2 - 1,
    })
  }

  const handleSubmitResult = async () => {
    if (!scoring) return
    if (scoring.t1 === scoring.t2) {
      showToast({ type: 'warning', message: 'No puede haber empate', duration: 2000 })
      return
    }
    setSubmitting(true)
    const { error } = await recordResult(scoring.matchId, scoring.t1, scoring.t2)
    setSubmitting(false)
    if (error) {
      showToast({ type: 'error', message: 'Error al registrar', duration: 3000 })
    } else {
      showToast({ type: 'success', message: '¡Resultado guardado!', duration: 1500 })
      setScoring(null)
    }
  }

  return (
    <div className={`min-h-screen pb-24 ${theme.id === 'manada' ? 'bg-black text-white' : 'bg-zinc-950'}`}>
      {/* Hero / Header */}
      <div className={`relative px-4 pt-10 pb-8 overflow-hidden bg-gradient-to-b ${theme.bgGradient} border-b border-zinc-900`}>
        {theme.icon && (
          <div className="absolute top-4 right-4 text-7xl opacity-5 pointer-events-none rotate-12">
            {theme.icon}
          </div>
        )}
        
        <button onClick={() => navigate(-1)} className="mb-6 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
          <span>←</span> Regresar
        </button>

        <div className="flex items-center gap-2 mb-4">
          <span className={`text-[10px] font-black px-2 py-1 rounded uppercase tracking-[0.2em] border ${
            theme.id === 'manada' ? 'bg-white text-black border-white' : 
            theme.id === 'proleague' ? 'bg-[#25d366]/10 text-[#25d366] border-[#25d366]/30' : 
            'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          }`}>
            {isLeague ? 'Liga' : 'Torneo'} {currentSession.status}
          </span>
        </div>

        <h1 className="text-4xl font-black text-white leading-none uppercase tracking-tighter mb-2">
          {currentSession.name}
        </h1>
        <p className="text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-black">
          {doneCount}/{totalCount} Partidos · {teams.length} Parejas
        </p>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-8 flex bg-zinc-950 p-1 rounded-2xl border border-zinc-900 sticky top-2 z-30 mx-4">
        {[
          { id: 'Matches', label: isTournament ? 'Cruces' : 'Jornadas' },
          { id: 'Ranking', label: 'Tabla' },
          { id: 'Bracket', label: 'Bracket', hide: !isTournament },
        ].filter(t => !t.hide).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
              tab === t.id ? theme.tabActive : theme.tabInactive
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-8">
        {tab === 'Matches' && (
          <div className="space-y-10">
            {roundGroups.map(({ round, matches: roundMatches }) => (
              <div key={round} className="space-y-4">
                <h2 className="text-white font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2">
                  <span className={`w-1 h-3 rounded-full ${theme.id === 'manada' ? 'bg-white' : theme.id === 'proleague' ? 'bg-[#6b2f9d]' : 'bg-emerald-500'}`} />
                  {isLeague ? `Jornada ${round}` : `Ronda ${round}`}
                </h2>
                <div className="space-y-3">
                  {roundMatches.map(match => {
                    const done = match.status === 'done'
                    return (
                      <div key={match.id} className={`bg-zinc-900/50 rounded-2xl p-4 border ${done ? 'border-zinc-800' : 'border-zinc-800/50'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`flex-1 text-sm font-black uppercase tracking-tight truncate ${done && match.winner_team_id === match.team1_id ? 'text-emerald-400' : 'text-white'}`}>
                            {teamDisplayName(match.team1)}
                          </div>
                          <div className="text-center px-4 bg-zinc-950 py-2 rounded-xl border border-zinc-800 min-w-[4rem]">
                            {done ? (
                              <span className="text-lg font-black text-white">{match.team1_sets} – {match.team2_sets}</span>
                            ) : (
                              <span className="text-[10px] font-black text-zinc-600 uppercase">VS</span>
                            )}
                          </div>
                          <div className={`flex-1 text-right text-sm font-black uppercase tracking-tight truncate ${done && match.winner_team_id === match.team2_id ? 'text-emerald-400' : 'text-white'}`}>
                            {teamDisplayName(match.team2)}
                          </div>
                        </div>
                        {!done && (
                          <button
                            onClick={() => handleRegister(match)}
                            className={`mt-4 w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              theme.id === 'manada' ? 'bg-zinc-800 text-white border border-zinc-700' : 
                              theme.id === 'proleague' ? 'bg-[#6b2f9d]/10 text-[#6b2f9d] border border-[#6b2f9d]/20' : 
                              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            Registrar Resultado
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Ranking' && (
          <div className="space-y-4">
            <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-[1.5rem_1fr_2rem_2rem_3rem] gap-1 px-4 py-3 text-[10px] text-zinc-500 font-black uppercase tracking-widest border-b border-zinc-800">
                <span>#</span>
                <span>Pareja</span>
                <span className="text-center">G</span>
                <span className="text-center">P</span>
                <span className="text-center">Sets</span>
              </div>
              {standings.map((s, idx) => (
                <div key={s.team.id} className={`grid grid-cols-[1.5rem_1fr_2rem_2rem_3rem] gap-1 px-4 py-4 text-sm items-center ${idx < standings.length - 1 ? 'border-b border-zinc-800/50' : ''}`}>
                  <span className="text-zinc-600 font-black text-xs">{idx + 1}</span>
                  <div className="truncate pr-2">
                    <p className="text-white font-black text-xs uppercase truncate">{teamDisplayName(s.team)}</p>
                  </div>
                  <span className="text-emerald-400 font-black text-center text-sm">{s.w}</span>
                  <span className="text-red-400 font-black text-center text-sm">{s.l}</span>
                  <span className="text-zinc-500 text-center text-[10px] font-black">{s.setsFor}–{s.setsAgainst}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Bracket' && isTournament && (
          <div className="-mx-4 overflow-hidden">
             {/* Map session_matches to old tournament_matches format for component compatibility */}
             <Bracket 
                matches={matches.map(m => ({
                  ...m,
                  player1_id: m.team1?.p1?.id, // Simplified for now
                  player2_id: m.team2?.p1?.id,
                  match: { status: m.status, p1_score: m.team1_sets, p2_score: m.team2_sets }
                }))} 
                participants={teams.map(t => ({ player_id: t.p1?.id, profile: { display_name: teamDisplayName(t) } }))} 
             />
          </div>
        )}
      </div>

      {/* Scoring Modal */}
      {scoring && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl w-full max-w-sm border border-zinc-800 p-6 space-y-6 animate-in slide-in-from-bottom duration-300">
            <h3 className="text-white font-black uppercase tracking-widest text-center text-xs">Registrar Resultado</h3>
            <div className="space-y-4">
              {[
                { key: 't1', name: scoring.team1Name },
                { key: 't2', name: scoring.team2Name },
              ].map(({ key, name }) => (
                <div key={key} className="flex items-center gap-4 bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                  <p className="flex-1 text-white text-sm font-black uppercase truncate">{name}</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setScoring(s => ({ ...s, [key]: Math.max(0, s[key] - 1) }))} className="w-10 h-10 bg-zinc-900 border border-zinc-800 text-white rounded-xl font-black transition active:scale-95">−</button>
                    <span className="w-6 text-center text-xl font-black text-white">{scoring[key]}</span>
                    <button onClick={() => setScoring(s => ({ ...s, [key]: Math.min(scoring.maxSets, s[key] + 1) }))} className="w-10 h-10 bg-zinc-900 border border-zinc-800 text-white rounded-xl font-black transition active:scale-95">+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setScoring(null)} className="flex-1 py-4 bg-zinc-800 text-zinc-400 font-black uppercase tracking-widest rounded-2xl text-xs transition active:scale-95">Regresar</button>
              <button onClick={handleSubmitResult} disabled={submitting || scoring.t1 === scoring.t2} className={`flex-1 py-4 text-white font-black uppercase tracking-widest rounded-2xl text-xs transition active:scale-95 disabled:opacity-30 ${theme.id === 'manada' ? 'bg-white text-black' : 'bg-emerald-500'}`}>
                {submitting ? '...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
