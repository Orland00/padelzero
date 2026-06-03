import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useMatchStore } from '@/stores/matchStore'
import { useUiStore } from '@/stores/uiStore'
import BannerOverlay from '@/components/BannerOverlay'
import GlassButton from '@/components/ui/GlassButton'

const FIRE_NAMES = ['fire', 'hot']

export default function Match() {
  const { id: matchId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isLocal = matchId === 'local'

  const { fetchMatch, updateScore, finishMatch, subscribeToMatch, unsubscribe, currentMatch, loading } = useMatchStore()
  const { showToast } = useUiStore()

  // Remote match state
  const [points, setPoints] = useState({ p1: 0, p2: 0 })
  const [sets, setSets] = useState([])
  const [isLive, setIsLive] = useState(false)
  const [useAdvantage, setUseAdvantage] = useState(location.state?.useAdvantage !== false)
  const [isExiting, setIsExiting] = useState(false)

  // Local match state (proper tennis/padel scoring)
  const setsToWin = location.state?.setsToWin || 1
  const t1Name = location.state?.t1Name || 'Team A'
  const t2Name = location.state?.t2Name || 'Team B'
  const [fireTeam, setFireTeam] = useState(null) // 'p1' | 'p2' | null
  const [local, setLocal] = useState({
    gamePoints: { p1: 0, p2: 0 },
    setGames: { p1: 0, p2: 0 },
    completedSets: [],
    inTiebreak: false,
    matchWinner: null,
  })
  const [history, setHistory] = useState([]) // undo stack

  const isPointsMode = location.state?.isPointsMode || currentMatch?.live_state?.is_points_mode || false
  const pointsLimit = location.state?.pointsLimit || currentMatch?.live_state?.points_limit || (isPointsMode ? currentMatch?.best_of : 7)
  const isShortMatch = location.state?.isShortMatch || false
  const gamesToWinMatch = location.state?.gamesToWinMatch || 1

  // ── Local: start live ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLocal) return
    setIsLive(true)
    if (isPointsMode) {
      setLocal(prev => ({ ...prev, inTiebreak: true }))
    }
  }, [isLocal, isPointsMode])

  // ── Local: detect match winner ──────────────────────────────────────────────
  useEffect(() => {
    if (!isLocal || !local.matchWinner) return
    const winner = local.matchWinner === 'p1' ? t1Name : t2Name
    showToast({ type: 'success', message: `¡Ganó ${winner}! 🏆`, duration: 3000 })
    setIsExiting(true)
  }, [local.matchWinner, isLocal, t1Name, t2Name])

  // ── Remote: load match from DB ──────────────────────────────────────────────
  useEffect(() => {
    if (isLocal) return

    const loadMatch = async () => {
      const { data, error } = await fetchMatch(matchId)
      if (error) {
        showToast({ type: 'error', message: 'Error al cargar partido', duration: 3000 })
        return
      }
      if (data.live_state) {
        setPoints({ p1: data.live_state.p1_points, p2: data.live_state.p2_points })
      }
      if (data.sets && Array.isArray(data.sets)) {
        setSets(data.sets)
      }
      subscribeToMatch(matchId, (updatedMatch) => {
        if (updatedMatch.live_state) {
          setPoints({ p1: updatedMatch.live_state.p1_points, p2: updatedMatch.live_state.p2_points })
        }
      })
      setIsLive(true)
    }

    loadMatch()
    return () => {
      unsubscribe()
      setIsLive(false)
    }
  }, [matchId, isLocal]) // eslint-disable-line


  // ── Local scoring logic ─────────────────────────────────────────────────────
  const scoreLocalPoint = (scorer) => {
    if (local.matchWinner) return
    const opponent = scorer === 'p1' ? 'p2' : 'p1'

    // Fire animation
    const teamName = scorer === 'p1' ? t1Name : t2Name
    if (isFireName(teamName)) {
      setFireTeam(scorer)
      setTimeout(() => setFireTeam(null), 1800)
    }
    setHistory(h => [...h, local])

    setLocal(prev => {
      const { gamePoints, setGames, completedSets, inTiebreak } = prev
      let nextGamePoints = { ...gamePoints }
      let nextSetGames = { ...setGames }
      let nextCompletedSets = [...completedSets]
      let nextInTiebreak = inTiebreak
      let nextMatchWinner = null

      // 1. Increment points
      nextGamePoints[scorer]++

      // 2. Check if game is won
      let hasWonGame = false
      if (isPointsMode) {
        hasWonGame = nextGamePoints[scorer] >= pointsLimit
      } else if (nextInTiebreak) {
        hasWonGame = nextGamePoints[scorer] >= 7 && nextGamePoints[scorer] - nextGamePoints[opponent] >= 2
      } else {
        if (useAdvantage) {
          // Standard tennis advantage
          hasWonGame = nextGamePoints[scorer] >= 4 && nextGamePoints[scorer] - nextGamePoints[opponent] >= 2
        } else {
          // Golden point (no AD)
          hasWonGame = nextGamePoints[scorer] >= 4
        }
      }

        if (hasWonGame) {
          // Reset points
          nextGamePoints = { p1: 0, p2: 0 }
          nextSetGames[scorer]++
          nextInTiebreak = false

          // 3. New: Short Match mode (win match by winning X games)
          if (location.state?.isShortMatch && nextSetGames[scorer] >= (location.state?.gamesToWinMatch || 1)) {
            nextMatchWinner = scorer
          }

          // 4. Standard Case: Check if set is won
          const hasWonSet = (nextSetGames[scorer] >= 6 && nextSetGames[scorer] - nextSetGames[opponent] >= 2) || (nextSetGames[scorer] === 7)
        const isTiebreak = nextSetGames.p1 === 6 && nextSetGames.p2 === 6

        if (hasWonSet) {
          nextCompletedSets.push({ ...nextSetGames })
          nextSetGames = { p1: 0, p2: 0 }

          // 4. Check if match is won
          const p1Sets = nextCompletedSets.filter(s => s.p1 > s.p2).length
          const p2Sets = nextCompletedSets.filter(s => s.p2 > s.p1).length
          if (p1Sets >= setsToWin) nextMatchWinner = 'p1'
          else if (p2Sets >= setsToWin) nextMatchWinner = 'p2'
        } else if (isTiebreak) {
          nextInTiebreak = true
        }
      }

      return {
        gamePoints: nextGamePoints,
        setGames: nextSetGames,
        completedSets: nextCompletedSets,
        inTiebreak: nextInTiebreak,
        matchWinner: nextMatchWinner
      }
    })
  }

  function isFireName(name = '') {
    const n = name.toLowerCase()
    return FIRE_NAMES.some(f => n.includes(f))
  }

  const undoLocalPoint = () => {
    if (history.length === 0) return
    setLocal(history[history.length - 1])
    setHistory(h => h.slice(0, -1))
  }

  // ── Remote scoring ──────────────────────────────────────────────────────────
  const handlePointChange = async (player, delta) => {
    const newPoints = { ...points, [player]: points[player] + delta }
    if (newPoints.p1 < 0 || newPoints.p2 < 0) return
    setPoints(newPoints)
    const { error } = await updateScore(matchId, sets.length, newPoints.p1, newPoints.p2)
    if (error) {
      showToast({ type: 'error', message: 'Error al actualizar puntos', duration: 2000 })
      setPoints(points)
    }
  }

  const handleFinishMatch = async () => {
    if (isLocal) {
      setIsExiting(true)
      return
    }
    if (!currentMatch) return
    const winnerId = points.p1 > points.p2 ? currentMatch.p1_id : currentMatch.p2_id
    const { error } = await finishMatch(matchId, winnerId)
    if (error) {
      showToast({ type: 'error', message: 'Error al terminar partido', duration: 3000 })
    } else {
      showToast({
        type: 'success',
        message: `¡Ganador: ${winnerId === currentMatch.p1_id ? currentMatch.p1?.display_name : currentMatch.p2?.display_name}!`,
        duration: 3000,
      })
      setTimeout(() => setIsExiting(true), 2000)
    }
  }

  const handleExit = () => {
    setIsExiting(true)
  }

  const p1 = isLocal ? null : currentMatch?.p1
  const p2 = isLocal ? null : currentMatch?.p2

  const handleExitNavigate = () => {
    if (isLocal) navigate('/play', { replace: true })
    else navigate(`/match/${matchId}/result`, { replace: true })
  }

  if (!isLocal && !currentMatch) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full mx-auto mb-4"></div>
          <p className="text-zinc-400">Cargando partido...</p>
        </div>
      </div>
    )
  }

  // Fire overlay for remote match too
  const handleRemoteScore = (player, delta) => {
    if (delta > 0) {
      const name = player === 'p1' ? (p1?.display_name || '') : (p2?.display_name || '')
      if (isFireName(name)) {
        setFireTeam(player)
        setTimeout(() => setFireTeam(null), 1800)
      }
    }
    handlePointChange(player, delta)
  }

  const formatPoints = (pts, isTiebreak) => {
    if (isPointsMode || isTiebreak) return String(pts)
    const mapping = { 0: '0', 1: '15', 2: '30', 3: '40', 4: 'AD' }
    if (!useAdvantage && pts === 4) return '40' // Should not happen in local but good for manual remote
    return mapping[pts] || String(pts)
  }

  // ── LOCAL LAYOUT ────────────────────────────────────────────────────────────
  if (isLocal) {
    return (
      <div className="h-full bg-zinc-950 flex flex-col select-none relative">
        {/* Top bar */}
        <div className="glass-card rounded-none border-x-0 border-t-0 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <p className="text-xs text-zinc-500">
              {isPointsMode ? `OBJETIVO: ${pointsLimit} PTS` : `Juego Rápido ${local.inTiebreak ? '· TIEBREAK' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
             {!isPointsMode && (
               <>
                 <button
                   onClick={() => setUseAdvantage(!useAdvantage)}
                   className={`text-[10px] font-black px-2 py-0.5 rounded border ${useAdvantage ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-orange-500/20 border-orange-500 text-orange-400'}`}
                 >
                   {useAdvantage ? 'VENTAJA' : 'PUNTO ORO'}
                 </button>
                 {/* Current Set Games */}
                 <div className="flex gap-2 text-xs font-bold">
                    <span className="text-blue-400">{local.setGames.p1}</span>
                    <span className="text-zinc-600">—</span>
                    <span className="text-pink-400">{local.setGames.p2}</span>
                 </div>
               </>
             )}
          </div>
        </div>

        {/* Set History (Hide in points mode) */}
        {!isPointsMode && local.completedSets.length > 0 && (
          <div className="bg-zinc-900/50 backdrop-blur-md flex justify-center gap-4 py-2 border-b border-white/5">
            {local.completedSets.map((s, i) => (
              <div key={i} className="text-xs font-bold uppercase tracking-tighter">
                <span className="text-blue-400">{s.p1}</span>
                <span className="text-zinc-700 mx-2">-</span>
                <span className="text-pink-400">{s.p2}</span>
              </div>
            ))}
          </div>
        )}

        {/* Fire overlay */}
        {fireTeam && (
          <div className={`absolute inset-0 z-20 flex items-center justify-center pointer-events-none`}>
            <div className="text-center animate-bounce">
              <div className="text-8xl">🔥</div>
              <p className="text-orange-400 font-black text-xl mt-1">ON FIRE!</p>
            </div>
          </div>
        )}

        {/* Main tap areas — full screen */}
        <div className="flex-1 flex">
          {/* Team A — tap entire left half */}
          <button
            onClick={() => scoreLocalPoint('p1')}
            disabled={!!local.matchWinner}
            className="flex-1 flex flex-col items-center justify-center gap-3 active:brightness-125 transition-all disabled:opacity-50 border-r border-white/5"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <p className="text-xs text-zinc-400 uppercase tracking-widest">{t1Name}</p>
            <div className={`font-black text-blue-400 leading-none text-9xl`}>
              {formatPoints(local.gamePoints.p1, local.inTiebreak)}
            </div>
          </button>

          {/* Team B — tap entire right half */}
          <button
            onClick={() => scoreLocalPoint('p2')}
            disabled={!!local.matchWinner}
            className="flex-1 flex flex-col items-center justify-center gap-3 active:brightness-125 transition-all disabled:opacity-50"
            style={{
              background: 'linear-gradient(225deg, rgba(236,72,153,0.15) 0%, rgba(236,72,153,0.05) 100%)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <p className="text-xs text-zinc-400 uppercase tracking-widest">{t2Name}</p>
            <div className={`font-black text-pink-400 leading-none text-9xl`}>
              {formatPoints(local.gamePoints.p2, local.inTiebreak)}
            </div>
          </button>
        </div>

        {/* Bottom controls */}
        <div className="glass-card rounded-none border-x-0 border-b-0 px-4 py-3 flex gap-3">
          <GlassButton
            variant="secondary"
            size="sm"
            fullWidth
            onClick={undoLocalPoint}
            disabled={history.length === 0}
          >
            ↩ Deshacer
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            fullWidth
            onClick={handleFinishMatch}
          >
            Salir
          </GlassButton>
        </div>

        {isExiting && <BannerOverlay onClose={handleExitNavigate} />}
      </div>
    )
  }

  // ── REMOTE LAYOUT ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col pb-24">
      <div className="glass-card rounded-none border-x-0 border-t-0 p-2 flex justify-between items-center px-4">
        <GlassButton variant="ghost" size="xs" onClick={() => navigate(-1)}>
          ← Salir
        </GlassButton>
        {isLive && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <p className="text-xs text-zinc-500">{isShortMatch ? 'Modo Corto' : isPointsMode ? `MODO PUNTOS (${pointsLimit})` : 'En vivo'}</p>
          </div>
        )}
        {!isPointsMode && (
          <button
            onClick={() => setUseAdvantage(!useAdvantage)}
            className={`text-[10px] font-black px-2 py-1 rounded border ${useAdvantage ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-orange-500/20 border-orange-500 text-orange-400'}`}
          >
            {useAdvantage ? 'VENTAJA' : 'PUNTO ORO'}
          </button>
        )}
      </div>

      {/* Remote: Set History bar */}
      {!isPointsMode && sets.length > 0 && (
        <div className="bg-zinc-900/50 backdrop-blur-md flex justify-center gap-4 py-2 border-b border-white/5">
          {sets.map((s, i) => (
            <div key={i} className="text-xs font-bold uppercase tracking-tighter">
              <span className="text-blue-400">{s.p1_games}</span>
              <span className="text-zinc-700 mx-2">-</span>
              <span className="text-pink-400">{s.p2_games}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 flex">
        <div
          className="flex-1 flex flex-col items-center justify-center p-4 border-r border-white/5"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="text-center space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-white font-bold uppercase truncate max-w-[120px]">{p1?.display_name || 'Player 1'}</p>
              {currentMatch?.p1b && (
                <p className="text-[10px] text-zinc-400 uppercase truncate max-w-[120px]">{currentMatch.p1b.display_name}</p>
              )}
            </div>
            {p1?.elo_rating && (
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">
                Avg ATP: {Math.round((p1.elo_rating + (currentMatch?.p1b?.elo_rating || p1.elo_rating)) / 2)}
              </p>
            )}
            <div className="text-9xl font-black text-blue-400 leading-none">
              {formatPoints(points.p1, currentMatch?.set_games_p1 === 6 && currentMatch?.set_games_p2 === 6)}
            </div>
          </div>
        </div>
        <div
          className="flex-1 flex flex-col items-center justify-center p-4"
          style={{
            background: 'linear-gradient(225deg, rgba(236,72,153,0.15) 0%, rgba(236,72,153,0.05) 100%)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="text-center space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-white font-bold uppercase truncate max-w-[120px]">{p2?.display_name || 'Player 2'}</p>
              {currentMatch?.p2b && (
                <p className="text-[10px] text-zinc-400 uppercase truncate max-w-[120px]">{currentMatch.p2b.display_name}</p>
              )}
            </div>
            {p2?.elo_rating && (
              <p className="text-[10px] text-pink-400 font-bold uppercase tracking-tighter">
                Avg ATP: {Math.round((p2.elo_rating + (currentMatch?.p2b?.elo_rating || p2.elo_rating)) / 2)}
              </p>
            )}
            <div className="text-9xl font-black text-pink-400 leading-none">
              {formatPoints(points.p2, currentMatch?.set_games_p1 === 6 && currentMatch?.set_games_p2 === 6)}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <GlassButton
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => handleRemoteScore('p1', 1)}
              className="!text-2xl !font-bold"
              style={{
                background: 'linear-gradient(165deg, rgba(59,130,246,0.35) 0%, rgba(59,130,246,0.15) 100%)',
                borderColor: 'rgba(59,130,246,0.3)',
              }}
            >
              +
            </GlassButton>
            <GlassButton
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => handleRemoteScore('p1', -1)}
              disabled={points.p1 === 0}
              className="!text-2xl !font-bold"
              style={{
                background: 'linear-gradient(165deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.04) 100%)',
              }}
            >
              −
            </GlassButton>
          </div>
          <div className="space-y-3">
            <GlassButton
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => handleRemoteScore('p2', 1)}
              className="!text-2xl !font-bold"
              style={{
                background: 'linear-gradient(165deg, rgba(236,72,153,0.35) 0%, rgba(236,72,153,0.15) 100%)',
                borderColor: 'rgba(236,72,153,0.3)',
              }}
            >
              +
            </GlassButton>
            <GlassButton
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => handleRemoteScore('p2', -1)}
              disabled={points.p2 === 0}
              className="!text-2xl !font-bold"
              style={{
                background: 'linear-gradient(165deg, rgba(236,72,153,0.12) 0%, rgba(236,72,153,0.04) 100%)',
              }}
            >
              −
            </GlassButton>
          </div>
        </div>
        <GlassButton
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleFinishMatch}
          disabled={loading}
          loading={loading}
        >
          Terminar Reta
        </GlassButton>
      </div>

      {isExiting && <BannerOverlay onClose={handleExitNavigate} />}
    </div>
  )
}
