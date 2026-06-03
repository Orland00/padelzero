import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProLeagueStore } from '@/stores/proleagueStore'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { getLigaRules, getLigaRulesLabel, validateLigaScore } from '@/lib/ligaRules'
import PlayerAvatar from '@/components/PlayerAvatar'
import TrendBadge from '@/components/TrendBadge'
import { motion, AnimatePresence } from 'framer-motion'
import TennisballLoader from '@/components/TennisballLoader'
import GlassButton from '@/components/ui/GlassButton'
import { formatDateSafe, formatDisplayName } from '@/utils/dateFormatters'
import { LIGA_PROLEAGUE_ID } from '@/lib/constants'

// 🎯 Imágenes promo ProLeague — se muestran de forma aleatoria tras guardar partido
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/banners/`
const PROMO_IMAGES = [
  BASE + 'Tu_mejor_juego_te_espera_version_1.png',
  BASE + 'Gana_el_tercer_set_version_1.png',
  BASE + 'Vence_la_humedad_version_1.png',
]
const getRandomPromo = () => PROMO_IMAGES[Math.floor(Math.random() * PROMO_IMAGES.length)]

export default function LigaProLeagueDetail() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { showToast } = useUiStore()
  const {
    liga, members, standings, matches, currentJornada, jornadas,
    teamStats, jornadaParticipants, loading, error,
    fetchAll, recordMatch, updateTeamName, addMember, removeMember,
    searchPlayers, createNextJornada, updateLigaSettings, deleteMatch, updateMemberRole, resetPeriod,
  } = useProLeagueStore()

  const [activeTab, setActiveTab] = useState('individual')
  const [showAddMatch, setShowAddMatch] = useState(false)
  const [showTeamNameModal, setShowTeamNameModal] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [playerCardData, setPlayerCardData] = useState(null)
  const [playerCardLoading, setPlayerCardLoading] = useState(false)
  const [deletingMatchId, setDeletingMatchId] = useState(null)

  // Match form state
  const [teamA1, setTeamA1] = useState('')
  const [teamA2, setTeamA2] = useState('')
  const [teamB1, setTeamB1] = useState('')
  const [teamB2, setTeamB2] = useState('')
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [matchSaving, setMatchSaving] = useState(false)
  const [matchError, setMatchError] = useState(null)
  const [matchResult, setMatchResult] = useState(null)
  const matchRules = getLigaRules(liga)
  const matchRulesLabel = getLigaRulesLabel(liga)

  // Team name state
  const [newTeamName, setNewTeamName] = useState('')

  // Open player card popup
  const openPlayerCard = async (playerId) => {
    setPlayerCardLoading(true)
    setPlayerCardData(null)
    try {
      const [profileRes, friendRes] = await Promise.all([
        supabase.from('profiles')
          .select('id, display_name, level_self, favorite_club_id, elo_rating, matches_played, matches_won, win_streak, best_streak, elo_peak, is_founder, created_at, updated_at, username, avatar_url, preferred_position, zone, last_match_at, city, country, last_title_won_at, favorite_club, is_dummy, preferred_language, level, preferred_side, achievements, role')
          .eq('id', playerId).single(),
        user?.id ? supabase.from('friendships').select('id, status, requester_id')
          .or(`and(requester_id.eq.${user.id},addressee_id.eq.${playerId}),and(requester_id.eq.${playerId},addressee_id.eq.${user.id})`)
          .maybeSingle() : Promise.resolve({ data: null }),
      ])
      if (profileRes.data) {
        setPlayerCardData({ ...profileRes.data, friendship: friendRes.data })
      }
    } catch {}
    setPlayerCardLoading(false)
  }

  const handleAddFriendFromCard = async (playerId) => {
    try {
      await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: playerId })
      showToast({ type: 'success', message: 'Solicitud enviada ✓' })
      setPlayerCardData(prev => prev ? { ...prev, friendship: { status: 'pending', requester_id: user.id } } : prev)
    } catch (err) {
      showToast({ type: 'error', message: err.message })
    }
  }

  // Admin search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Admin settings state
  const [editMaxScore, setEditMaxScore] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    fetchAll().catch(() => {})

    // Realtime: auto-refresh standings + matches when DB changes
    const channel = supabase
      .channel('proleague-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'liga_standings', filter: `liga_id=eq.${LIGA_PROLEAGUE_ID}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'liga_matches', filter: `liga_id=eq.${LIGA_PROLEAGUE_ID}` }, () => fetchAll())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => fetchAll())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const isAdmin = useMemo(() => {
    if (!user) return false
    const m = members.find(m => m.player_id === user.id)
    return m?.role === 'admin' || m?.role === 'creator'
  }, [user, members])

  const isMember = useMemo(() => {
    if (!user) return false
    return members.some(m => m.player_id === user.id && (m.status === 'active' || m.is_active))
  }, [user, members])

  const myMember = useMemo(() => {
    if (!user) return null
    return members.find(m => m.player_id === user.id)
  }, [user, members])

  const activeMembers = useMemo(() => {
    return members.filter(m => m.status === 'active' || m.is_active)
  }, [members])

  const getMemberName = (playerId) => {
    const m = members.find(m => m.player_id === playerId)
    return formatDisplayName(m?.profiles?.display_name)
  }

  const getMemberTeamName = (playerId) => {
    const m = members.find(m => m.player_id === playerId)
    return m?.team_name || ''
  }

  const getAvailablePlayers = (excludeIds) => {
    return activeMembers.filter(m => !excludeIds.includes(m.player_id))
  }

  // Jornada info
  const jornadaEndDate = useMemo(() => {
    if (!currentJornada) return null
    const d = new Date(currentJornada.date)
    // Find next Sunday 10 PM
    const daysUntilSunday = (7 - d.getDay()) % 7 || 7
    const sunday = new Date(d)
    sunday.setDate(d.getDate() + daysUntilSunday)
    sunday.setHours(22, 0, 0, 0)
    return sunday
  }, [currentJornada])

  const daysUntilReset = useMemo(() => {
    if (!jornadaEndDate) return null
    const now = new Date()
    const diff = jornadaEndDate - now
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }, [jornadaEndDate])

  // Current jornada matches
  const jornadaMatches = useMemo(() => {
    if (!currentJornada) return matches
    return matches.filter(m => m.jornada_id === currentJornada.id)
  }, [matches, currentJornada])

  // Handle match recording
  const handleRecordMatch = async () => {
    setMatchError(null)
    if (!teamA1 || !teamA2 || !teamB1 || !teamB2) {
      setMatchError('Selecciona los 4 jugadores')
      return
    }
    const selected = [teamA1, teamA2, teamB1, teamB2]
    if (new Set(selected).size !== 4) {
      setMatchError('No puedes repetir jugadores')
      return
    }
    const sA = scoreA === '' ? 0 : Number(scoreA)
    const sB = scoreB === '' ? 0 : Number(scoreB)
    const scoreValidation = validateLigaScore(sA, sB, liga)
    if (!scoreValidation.valid) {
      setMatchError(scoreValidation.message)
      return
    }

    setMatchSaving(true)
    try {
      const result = await recordMatch({
        teamAPlayer1: teamA1, teamAPlayer2: teamA2,
        teamBPlayer1: teamB1, teamBPlayer2: teamB2,
        scoreTeamA: sA, scoreTeamB: sB,
      })
      // Cerrar form y mostrar resultado en modal separado
      setShowAddMatch(false)
      setMatchResult({ ...result, finalScoreA: sA, finalScoreB: sB, promoUrl: getRandomPromo() })
    } catch (err) {
      setMatchError(err?.message || 'Error al guardar el partido')
    } finally {
      setMatchSaving(false)
    }
  }

  const resetMatchForm = () => {
    setTeamA1(''); setTeamA2(''); setTeamB1(''); setTeamB2('')
    setScoreA(''); setScoreB('')
    setMatchError(null); setMatchResult(null)
  }

  // Admin search
  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) return
    setSearchLoading(true)
    try {
      const results = await searchPlayers(searchQuery)
      setSearchResults(results)
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Error al eliminar' })
    } finally {
      setSearchLoading(false)
    }
  }

  const handleAddMember = async (playerId) => {
    try {
      await addMember(playerId)
      showToast({ type: 'success', message: 'Jugador agregado' })
      setSearchResults(prev => prev.filter(p => p.id !== playerId))
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Error al eliminar' })
    }
  }

  const handleRemoveMember = async (playerId) => {
    try {
      await removeMember(playerId)
      showToast({ type: 'success', message: 'Jugador removido' })
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Error al eliminar' })
    }
  }

  const handleSaveTeamName = async () => {
    try {
      await updateTeamName(newTeamName)
      showToast({ type: 'success', message: 'Nombre de equipo actualizado' })
      setShowTeamNameModal(false)
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Error al eliminar' })
    }
  }

  if (loading && !liga) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <TennisballLoader size="lg" />
      </div>
    )
  }

  if (loading && !liga) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <TennisballLoader size="lg" />
      </div>
    )
  }

  if (!loading && !liga) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest">No se pudo cargar la liga</p>
        {error && <p className="text-red-400 text-xs text-center max-w-xs">{error}</p>}
        <button
          onClick={() => { window.location.reload() }}
          className="px-6 py-2 bg-[#6b2f9d] text-white text-sm font-black uppercase tracking-widest rounded-lg"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const tabs = [
    { id: 'individual', label: 'Individual' },
    { id: 'equipos', label: 'Equipos' },
    { id: 'partidos', label: 'Partidos' },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin' }] : []),
  ]

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* ============ PROLEAGUE HEADER ============ */}
      <div className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #6b2f9d 0%, #3273dc 100%)' }}>
        {/* Decorative bubbles */}
        <div className="absolute top-2 right-12 w-20 h-20 rounded-full opacity-10" style={{ background: '#e3f2fd' }} />
        <div className="absolute bottom-0 right-4 w-12 h-12 rounded-full opacity-15" style={{ background: '#25d366' }} />
        <div className="absolute top-10 left-6 w-8 h-8 rounded-full opacity-10" style={{ background: '#fff' }} />

        <div className="relative px-4 pt-12 pb-6">
          {/* Back button */}
          <button onClick={() => navigate(-1)} className="absolute top-4 left-4 text-white/70 text-sm font-bold">
            &larr; Volver
          </button>
          {/* Admin gear icon */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className="absolute top-4 right-4 text-white text-2xl hover:text-[#25d366] transition"
              title="Admin Panel"
            >
              ⚙️
            </button>
          )}

          <div className="flex items-center gap-3 mb-3">
            {/* Water drop icon */}
            <div className="w-14 h-14 rounded-xl flex items-center justify-center border border-white/20"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              <img src="/proleague-logo.png" alt="ProLeague" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-white font-black text-xl leading-tight">
                Liga <span style={{ color: '#25d366' }}>ProLeague</span>
              </h1>
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest">
                Dobles 2v2 &middot; ATP en tiempo real
              </p>
            </div>
          </div>

          {/* Jornada info */}
          {currentJornada && (
            <div className="flex items-center gap-3 mt-2">
              <div className="bg-white/15 rounded-lg px-3 py-1.5 flex items-center gap-2">
                <span className="text-white font-black text-sm">Jornada {currentJornada.jornada_number}</span>
                <span className="text-white/50 text-xs">|</span>
                <span className="text-white/70 text-xs font-bold">
                  {daysUntilReset != null ? `${daysUntilReset} días para cerrar` : ''}
                </span>
              </div>
              <div className="bg-white/10 rounded-lg px-3 py-1.5">
                <span className="text-white/70 text-xs font-bold">
                  {activeMembers.length} jugadores
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============ TABS ============ */}
      <div className="px-4 mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <GlassButton
            key={tab.id}
            pill
            pillColor={activeTab === tab.id ? 'purple' : undefined}
            variant={activeTab === tab.id ? 'accent-purple' : 'ghost'}
            onClick={() => setActiveTab(tab.id)}
            className="text-xs font-black uppercase tracking-widest whitespace-nowrap"
          >
            {tab.label}
          </GlassButton>
        ))}
      </div>

      {/* ============ TAB CONTENT ============ */}
      <div className="px-4 mt-4">

        {/* ─── INDIVIDUAL TAB ─── */}
        {activeTab === 'individual' && (
          <div className="space-y-2">
            <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">Ranking Individual</h2>

            {standings.map((s, i) => {
              const isMe = user?.id === s.player_id
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => openPlayerCard(s.player_id)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer active:scale-[0.98] transition ${
                    isMe ? 'bg-[#6b2f9d]/20 border border-[#6b2f9d]/40' : 'glass-card'
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                    i === 0 ? 'bg-yellow-500 text-black' :
                    i === 1 ? 'bg-zinc-400 text-black' :
                    i === 2 ? 'bg-amber-700 text-white' :
                    'bg-zinc-800 text-zinc-400'
                  }`}>
                    {i + 1}
                  </span>

                  <PlayerAvatar
                    avatarUrl={s.profile?.avatar_url}
                    displayName={s.profile?.display_name}
                    hasCrown={i === 0}
                    size="sm"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm truncate">
                        {formatDisplayName(s.profile?.display_name)}
                      </span>
                      {getMemberTeamName(s.player_id) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#6b2f9d]/30 text-[#b794f6] font-bold">
                          {getMemberTeamName(s.player_id)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-zinc-500 font-bold">
                        {s.matches_won || 0}W-{s.matches_lost || 0}L
                      </span>
                      <span className="text-[10px] text-zinc-600">|</span>
                      <span className="text-[10px] text-zinc-500 font-bold">
                        {s.total_points || 0} pts
                      </span>
                      {(s.penalty_points || 0) > 0 && (
                        <span className="text-[10px] text-red-400 font-bold">
                          (-{s.penalty_points})
                        </span>
                      )}
                      <TrendBadge delta={s.period_points_delta} label="pts" />
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-white font-black text-lg">{s.elo_rating || 1200}</span>
                    <p className="text-[10px] text-zinc-500 font-bold">ATP</p>
                    <TrendBadge delta={s.period_elo_delta} />
                  </div>
                </motion.div>
              )
            })}

            {standings.length === 0 && (
              <p className="text-zinc-500 text-center py-8 text-sm">No hay standings aún</p>
            )}
          </div>
        )}

        {/* ─── PARTIDOS TAB ─── */}
        {activeTab === 'partidos' && (
          <div className="space-y-3">
            <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">
              {currentJornada ? `Jornada ${currentJornada.jornada_number}` : 'Partidos'}
            </h2>

            {jornadaMatches.map((m, i) => {
              const teamAWon = m.score_team_a > m.score_team_b
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card p-4"
                >
                  {/* Team A */}
                  <div className={`flex items-center justify-between mb-2 ${teamAWon ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    <div className="flex-1">
                      <span className="text-sm font-bold cursor-pointer underline-offset-2 hover:underline" onClick={(e) => { e.stopPropagation(); openPlayerCard(m.team_a_player1_id) }}>{m.player_a1?.display_name}</span>
                      <span className="text-zinc-600 mx-1">&</span>
                      <span className="text-sm font-bold cursor-pointer underline-offset-2 hover:underline" onClick={(e) => { e.stopPropagation(); openPlayerCard(m.team_a_player2_id) }}>{m.player_a2?.display_name}</span>
                    </div>
                    <span className="text-2xl font-black">{m.score_team_a}</span>
                  </div>
                  {/* Team B */}
                  <div className={`flex items-center justify-between ${!teamAWon ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    <div className="flex-1">
                      <span className="text-sm font-bold cursor-pointer underline-offset-2 hover:underline" onClick={(e) => { e.stopPropagation(); openPlayerCard(m.team_b_player1_id) }}>{m.player_b1?.display_name}</span>
                      <span className="text-zinc-600 mx-1">&</span>
                      <span className="text-sm font-bold cursor-pointer underline-offset-2 hover:underline" onClick={(e) => { e.stopPropagation(); openPlayerCard(m.team_b_player2_id) }}>{m.player_b2?.display_name}</span>
                    </div>
                    <span className="text-2xl font-black">{m.score_team_b}</span>
                  </div>
                  {/* Meta */}
                  <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-600">
                      {formatDateSafe(m.played_at || m.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, 'Fecha pendiente')}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-600">
                        por {m.recorder?.display_name}
                      </span>
                      {isAdmin && (
                        <button
                          disabled={deletingMatchId === m.id}
                          onClick={async () => {
                            if (deletingMatchId) return
                            const ok = await useUiStore.getState().confirm({
                              message: '¿Eliminar este partido? Se revertirán los puntos de standings.',
                              danger: true,
                            })
                            if (!ok) return
                            setDeletingMatchId(m.id)
                            try {
                              await deleteMatch(m.id)
                              showToast({ type: 'success', message: 'Partido eliminado' })
                            } catch (err) {
                              showToast({ type: 'error', message: err.message || 'Error al eliminar' })
                            } finally {
                              setDeletingMatchId(null)
                            }
                          }}
                          className="text-[10px] text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 rounded font-bold transition disabled:opacity-50"
                        >
                          {deletingMatchId === m.id ? '...' : 'Eliminar'}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}

            {jornadaMatches.length === 0 && (
              <p className="text-zinc-500 text-center py-8 text-sm">Sin partidos en esta jornada</p>
            )}
          </div>
        )}

        {/* ─── EQUIPOS TAB ─── */}
        {activeTab === 'equipos' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Ranking por Equipo</h2>
              {myMember && (
                <GlassButton
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setNewTeamName(myMember.team_name || '')
                    setShowTeamNameModal(true)
                  }}
                >
                  Mi Equipo
                </GlassButton>
              )}
            </div>

            {teamStats.map((ts, i) => (
              <motion.div
                key={ts.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass-card p-4 flex items-center gap-3"
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                  i === 0 ? 'bg-yellow-500 text-black' :
                  i === 1 ? 'bg-zinc-400 text-black' :
                  i === 2 ? 'bg-amber-700 text-white' :
                  'bg-zinc-800 text-zinc-400'
                }`}>
                  {i + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-white font-bold text-sm truncate">
                      {ts.player1?.display_name}
                    </span>
                    <span className="text-zinc-600 text-xs">&</span>
                    <span className="text-white font-bold text-sm truncate">
                      {ts.player2?.display_name}
                    </span>
                  </div>
                  {ts.team_name && (
                    <span className="text-[10px] text-[#b794f6] font-bold">{ts.team_name}</span>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-zinc-500 font-bold">
                      {ts.matches_won}W-{ts.matches_lost}L
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      ({ts.matches_played} partidos)
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-white font-black text-lg">{ts.team_elo}</span>
                  <p className="text-[10px] text-zinc-500 font-bold">ATP</p>
                  <TrendBadge delta={ts.period_elo_delta} />
                </div>
              </motion.div>
            ))}

            {teamStats.length === 0 && (
              <p className="text-zinc-500 text-center py-8 text-sm">Sin equipos registrados aún</p>
            )}
          </div>
        )}

        {/* ─── ADMIN TAB ─── */}
        {activeTab === 'admin' && isAdmin && (
          <div className="space-y-6">

            {/* Reset Período */}
            <div className="glass-card p-4 space-y-2">
              <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Período de Tendencias</h2>
              <p className="text-xs text-zinc-500">Resetea los indicadores ▲▼ de subida/bajada en los rankings. Úsalo al iniciar una nueva jornada o ciclo.</p>
              <GlassButton
                variant="danger"
                fullWidth
                size="sm"
                onClick={async () => {
                  const ok = await useUiStore.getState().confirm({
                    message: '¿Resetear todos los deltas de período? Los rankings quedarán en 0 hasta el próximo partido.',
                    danger: true,
                  })
                  if (!ok) return
                  await resetPeriod()
                }}
              >
                🔄 Resetear Período
              </GlassButton>
            </div>

            {/* Search & Add Players */}
            <div className="space-y-3">
              <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Agregar Jugador</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Buscar por nombre o email..."
                  className="glass-input flex-1"
                />
                <GlassButton
                  variant="accent-purple"
                  size="sm"
                  onClick={handleSearch}
                  loading={searchLoading}
                >
                  Buscar
                </GlassButton>
              </div>

              {searchResults.map(p => {
                const alreadyMember = members.some(m => m.player_id === p.id)
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 glass-card">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{p.display_name || p.email}</p>
                      <p className="text-zinc-500 text-xs truncate">{p.email}</p>
                    </div>
                    {alreadyMember ? (
                      <span className="text-[10px] text-emerald-400 font-bold">YA MIEMBRO</span>
                    ) : (
                      <GlassButton
                        variant="primary"
                        size="xs"
                        onClick={() => handleAddMember(p.id)}
                      >
                        Agregar
                      </GlassButton>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Jornada Management */}
            <div className="space-y-3">
              <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Jornadas</h2>
              <div className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold">Jornada actual: {currentJornada?.jornada_number || '-'}</span>
                  <span className={`text-xs px-2 py-1 rounded font-bold ${
                    currentJornada?.status === 'in_progress' ? 'bg-emerald-500/20 text-emerald-400' :
                    currentJornada?.status === 'completed' ? 'bg-zinc-700 text-zinc-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {currentJornada?.status || 'Pendiente'}
                  </span>
                </div>

                {/* Participants status */}
                {jornadaParticipants.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">Participación:</p>
                    {jornadaParticipants.map(jp => (
                      <div key={jp.id} className="flex items-center justify-between py-1">
                        <span className="text-zinc-300 text-xs">{formatDisplayName(jp.profile?.display_name)}</span>
                        <span className={`text-[10px] font-bold ${jp.played ? 'text-emerald-400' : 'text-red-400'}`}>
                          {jp.played ? 'JUGÓ' : 'NO JUGÓ'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={async () => {
                    try {
                      await createNextJornada()
                      showToast({ type: 'success', message: 'Nueva jornada creada' })
                    } catch (err) {
                      showToast({ type: 'error', message: err.message || 'Error al eliminar' })
                    }
                  }}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white bg-[#3273dc] hover:bg-[#3273dc]/80"
                >
                  Cerrar Jornada + Aplicar Penalidades
                </button>
              </div>
            </div>

            {/* Liga Settings */}
            <div className="space-y-3">
              <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Configuración de Partido</h2>
              <div className="glass-card p-4 space-y-3">
                <div>
                  <p className="text-white text-sm font-bold mb-1">Puntos máximos por partido</p>
                  <p className="text-zinc-500 text-xs mb-3">Actualmente: <span className="text-emerald-400 font-bold">{liga?.max_score || 4}</span></p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={editMaxScore}
                      onChange={(e) => setEditMaxScore(e.target.value)}
                      placeholder={String(liga?.max_score || 4)}
                      className="glass-input w-24"
                    />
                    <GlassButton
                      variant="accent-purple"
                      size="sm"
                      onClick={async () => {
                        const val = parseInt(editMaxScore)
                        if (!val || val < 1) return
                        setSavingSettings(true)
                        try {
                          await updateLigaSettings({ max_score: val })
                          showToast({ type: 'success', message: `Máximo actualizado a ${val}` })
                          setEditMaxScore('')
                        } catch (err) {
                          showToast({ type: 'error', message: err.message || 'Error al eliminar' })
                        } finally {
                          setSavingSettings(false)
                        }
                      }}
                      disabled={!editMaxScore}
                      loading={savingSettings}
                    >
                      Guardar
                    </GlassButton>
                  </div>
                </div>
              </div>
            </div>

            {/* Players list */}
            <div className="space-y-3">
              <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Jugadores</h2>
              {members.filter(m => m.status === 'active' || m.is_active).map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 glass-card">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{m.profiles?.display_name}</p>
                    <p className="text-zinc-500 text-xs">{m.role === 'admin' ? 'Admin' : 'Player'}</p>
                  </div>
                  {m.player_id !== user?.id && (
                    <div className="flex gap-2">
                      {m.role !== 'admin' && (
                        <GlassButton
                          variant="accent-purple"
                          size="xs"
                          onClick={async () => {
                            try {
                              await updateMemberRole(m.player_id, 'admin')
                              showToast({ type: 'success', message: `${m.profiles?.display_name} ahora es Admin` })
                            } catch (err) {
                              showToast({ type: 'error', message: err.message || 'Error al eliminar' })
                            }
                          }}
                        >
                          Hacer Admin
                        </GlassButton>
                      )}
                      {m.role === 'admin' && (
                        <GlassButton
                          variant="ghost"
                          size="xs"
                          onClick={async () => {
                            try {
                              await updateMemberRole(m.player_id, 'player')
                              showToast({ type: 'success', message: `${m.profiles?.display_name} ahora es Player` })
                            } catch (err) {
                              showToast({ type: 'error', message: err.message || 'Error al eliminar' })
                            }
                          }}
                        >
                          Quitar Admin
                        </GlassButton>
                      )}
                      <GlassButton
                        variant="danger"
                        size="xs"
                        onClick={() => handleRemoveMember(m.player_id)}
                      >
                        Eliminar
                      </GlassButton>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ============ ADD MATCH MODAL ============ */}
      <AnimatePresence>
        {showAddMatch && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="glass-card !rounded-b-none sm:!rounded-2xl p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
            >
              {(
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-widest text-white">
                      Nuevo Partido
                    </h2>
                    <button onClick={() => { setShowAddMatch(false); resetMatchForm() }} className="text-zinc-400 text-2xl leading-none">&times;</button>
                  </div>

                  {matchError && (
                    <div className="p-3 bg-red-500/20 border border-red-500 text-red-300 rounded-lg text-sm">
                      {matchError}
                    </div>
                  )}

                  {/* Team A */}
                  <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(107,47,157,0.15)', border: '1px solid rgba(107,47,157,0.3)' }}>
                    <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#b794f6' }}>Equipo A</p>
                    <select
                      value={teamA1}
                      onChange={(e) => setTeamA1(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#6b2f9d]"
                    >
                      <option value="">Jugador 1...</option>
                      {getAvailablePlayers([teamA2, teamB1, teamB2]).map(m => (
                        <option key={m.player_id} value={m.player_id}>
                          {formatDisplayName(m.profiles?.display_name)} ({m.profiles?.elo_rating || 1200})
                        </option>
                      ))}
                    </select>
                    <select
                      value={teamA2}
                      onChange={(e) => setTeamA2(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#6b2f9d]"
                    >
                      <option value="">Jugador 2...</option>
                      {getAvailablePlayers([teamA1, teamB1, teamB2]).map(m => (
                        <option key={m.player_id} value={m.player_id}>
                          {formatDisplayName(m.profiles?.display_name)} ({m.profiles?.elo_rating || 1200})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Nombre del equipo (opcional)"
                      maxLength={100}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#6b2f9d]"
                    />
                  </div>

                  {/* Score */}
                  <p className="text-center text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{matchRulesLabel}</p>
                  <div className="flex items-center gap-4 justify-center">
                    <div className="text-center">
                      <p className="text-[10px] font-bold mb-1 uppercase tracking-widest" style={{ color: '#b794f6' }}>EQ. A</p>
                      <input
                        type="number"
                        value={scoreA}
                        onChange={(e) => setScoreA(e.target.value)}
                        placeholder="0"
                        min="0"
                        max={matchRules.maxScore}
                        className="w-20 h-16 text-center text-3xl font-black bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-[#6b2f9d]"
                      />
                    </div>
                    <span className="text-3xl font-black text-zinc-600 pt-5">-</span>
                    <div className="text-center">
                      <p className="text-[10px] font-bold mb-1 uppercase tracking-widest" style={{ color: '#3273dc' }}>EQ. B</p>
                      <input
                        type="number"
                        value={scoreB}
                        onChange={(e) => setScoreB(e.target.value)}
                        placeholder="0"
                        min="0"
                        max={matchRules.maxScore}
                        className="w-20 h-16 text-center text-3xl font-black bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-[#3273dc]"
                      />
                    </div>
                  </div>

                  {/* Team B */}
                  <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(50,115,220,0.15)', border: '1px solid rgba(50,115,220,0.3)' }}>
                    <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#63b3ed' }}>Equipo B</p>
                    <select
                      value={teamB1}
                      onChange={(e) => setTeamB1(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#3273dc]"
                    >
                      <option value="">Jugador 1...</option>
                      {getAvailablePlayers([teamA1, teamA2, teamB2]).map(m => (
                        <option key={m.player_id} value={m.player_id}>
                          {formatDisplayName(m.profiles?.display_name)} ({m.profiles?.elo_rating || 1200})
                        </option>
                      ))}
                    </select>
                    <select
                      value={teamB2}
                      onChange={(e) => setTeamB2(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#3273dc]"
                    >
                      <option value="">Jugador 2...</option>
                      {getAvailablePlayers([teamA1, teamA2, teamB1]).map(m => (
                        <option key={m.player_id} value={m.player_id}>
                          {formatDisplayName(m.profiles?.display_name)} ({m.profiles?.elo_rating || 1200})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Nombre del equipo (opcional)"
                      maxLength={100}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#3273dc]"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <GlassButton
                      variant="secondary"
                      className="flex-1"
                      onClick={() => { setShowAddMatch(false); resetMatchForm() }}
                    >
                      Cancelar
                    </GlassButton>
                    <button
                      onClick={handleRecordMatch}
                      disabled={matchSaving}
                      className="flex-1 px-4 py-3 text-white font-bold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #6b2f9d, #3273dc)' }}
                    >
                      {matchSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        'Guardar Partido'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============ MATCH RESULT MODAL ============ */}
      <AnimatePresence>
        {matchResult && (
          <div className="fixed inset-0 bg-black/90 flex items-end sm:items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              className="w-full sm:max-w-md overflow-hidden"
              style={{ borderRadius: '24px 24px 0 0' }}
            >
              {/* ── Header con gradiente ProLeague ── */}
              <div
                className="px-6 pt-8 pb-6 text-center relative"
                style={{ background: 'linear-gradient(135deg, #1a0a2e 0%, #3b1467 50%, #1a1a3e 100%)' }}
              >
                {/* Glow sutil detrás del score */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  background: 'radial-gradient(ellipse at center, rgba(107,47,157,0.4) 0%, transparent 70%)'
                }} />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2" style={{ color: '#b794f6' }}>
                  LIGA PROLEAGUE · PARTIDO REGISTRADO
                </p>
                <p
                  className="text-7xl font-black tracking-tight"
                  style={{
                    color: '#fff',
                    textShadow: '0 0 30px rgba(183,148,246,0.6), 0 2px 4px rgba(0,0,0,0.5)'
                  }}
                >
                  {matchResult.finalScoreA}
                  <span style={{ color: '#6b2f9d', margin: '0 8px' }}>—</span>
                  {matchResult.finalScoreB}
                </p>
              </div>

              {/* ── Cuerpo ── */}
              <div className="px-6 py-5 space-y-3" style={{ background: '#111118' }}>

                {/* ATP deltas */}
                {matchResult.eloChanges?.map(change => {
                  const won = change.delta > 0
                  return (
                    <div
                      key={change.playerId}
                      className="flex items-center justify-between px-4 py-3 rounded-2xl"
                      style={{
                        background: won
                          ? 'linear-gradient(90deg, rgba(107,47,157,0.25), rgba(50,115,220,0.15))'
                          : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${won ? 'rgba(107,47,157,0.5)' : 'rgba(239,68,68,0.25)'}`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <PlayerAvatar
                          avatarUrl={members?.find(m => m.player_id === change.playerId)?.profiles?.avatar_url}
                          displayName={getMemberName(change.playerId)}
                          size="sm"
                        />
                        <span className="text-white font-bold text-sm">{getMemberName(change.playerId)}</span>
                        {won && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(107,47,157,0.4)', color: '#b794f6' }}>GANÓ</span>}
                      </div>
                      <span
                        className="text-2xl font-black"
                        style={{ color: won ? '#b794f6' : '#ef4444' }}
                      >
                        {change.delta > 0 ? '+' : ''}{change.delta}
                      </span>
                    </div>
                  )
                })}

                {/* Promo image — completa, sin recortar */}
                {matchResult.promoUrl && (
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(107,47,157,0.3)' }}>
                    <img
                      src={matchResult.promoUrl}
                      alt="ProLeague"
                      className="w-full"
                      style={{ display: 'block', objectFit: 'contain', maxHeight: 180, background: '#000' }}
                      onError={(e) => { e.currentTarget.closest('div').style.display = 'none' }}
                    />
                  </div>
                )}

                {/* Botón LISTO */}
                <button
                  onClick={() => setMatchResult(null)}
                  className="w-full py-3.5 font-black rounded-2xl text-sm uppercase tracking-widest text-white"
                  style={{ background: 'linear-gradient(135deg, #6b2f9d, #3273dc)' }}
                >
                  LISTO
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============ TEAM NAME MODAL ============ */}
      <AnimatePresence>
        {showTeamNameModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card p-6 w-full max-w-sm mx-4"
            >
              <h2 className="text-lg font-black text-white uppercase tracking-widest mb-4">Mi Equipo</h2>
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Nombre de tu equipo..."
                maxLength={100}
                className="glass-input mb-4"
              />
              <div className="flex gap-2">
                <GlassButton
                  variant="secondary"
                  fullWidth
                  onClick={() => setShowTeamNameModal(false)}
                >
                  Cancelar
                </GlassButton>
                <button
                  onClick={handleSaveTeamName}
                  className="flex-1 px-4 py-3 text-white font-bold rounded-xl"
                  style={{ background: '#6b2f9d' }}
                >
                  Guardar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============ JOIN BUTTON FOR NON-MEMBERS ============ */}
      {!isMember && user && !loading && (
        <button
          onClick={async () => {
            try {
              await addMember(user.id)
              showToast({ type: 'success', message: '¡Te uniste a Liga ProLeague!' })
            } catch (err) {
              showToast({ type: 'error', message: err.message || 'Error al unirse' })
            }
          }}
          className="fixed z-50 left-4 bottom-20 px-5 py-3.5 rounded-2xl text-white font-black text-sm uppercase tracking-widest shadow-2xl active:scale-95 transition flex items-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #6b2f9d 0%, #3273dc 100%)',
            boxShadow: '0 8px 30px #6b2f9d88',
          }}
        >
          Unirme a Liga
        </button>
      )}

      {/* ============ FLOATING + NUEVO PARTIDO BUTTON ============ */}
      {!showAddMatch && isMember && (
        <button
          onClick={() => setShowAddMatch(true)}
          className="fixed z-50 left-4 bottom-20 px-5 py-3.5 rounded-2xl text-white font-black text-sm uppercase tracking-widest shadow-2xl active:scale-95 transition flex items-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #6b2f9d 0%, #3273dc 100%)',
            boxShadow: '0 8px 30px #6b2f9d88',
          }}
        >
          <span className="text-lg">+</span>
          Nuevo Partido
        </button>
      )}

      {/* ============ PLAYER CARD POPUP ============ */}
      <AnimatePresence>
        {(playerCardData || playerCardLoading) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => { setPlayerCardData(null); setPlayerCardLoading(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card w-full max-w-sm p-6"
              onClick={e => e.stopPropagation()}
              style={{ borderColor: 'rgba(139,92,246,0.2)' }}
            >
              {playerCardLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-3 border-zinc-700 border-t-emerald-500 rounded-full" />
                </div>
              ) : playerCardData && (
                <>
                  {/* Avatar + Name */}
                  <div className="text-center mb-4">
                    {playerCardData.avatar_url ? (
                      <img src={playerCardData.avatar_url} alt={playerCardData.display_name}
                        className="w-20 h-20 rounded-full object-cover mx-auto mb-3"
                        style={{ border: '2px solid rgba(139,92,246,0.4)', borderTopColor: 'rgba(255,255,255,0.3)' }} />
                    ) : (
                      <div className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl font-black"
                        style={{ background: 'linear-gradient(170deg, rgba(139,92,246,0.2), rgba(50,115,220,0.15))', border: '2px solid rgba(139,92,246,0.4)', borderTopColor: 'rgba(255,255,255,0.3)', color: '#c4b5fd' }}>
                        {(playerCardData.display_name || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <h3 className="text-xl font-black text-white">{playerCardData.display_name}</h3>
                    {playerCardData.username && <p className="text-xs text-zinc-400">{playerCardData.username}</p>}
                    {playerCardData.city && <p className="text-xs text-zinc-500 mt-1">{playerCardData.city}{playerCardData.country ? `, ${playerCardData.country}` : ''}</p>}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="glass-card p-3 text-center" style={{ borderRadius: '14px' }}>
                      <p className="text-xl font-black text-emerald-400">{Math.round(playerCardData.elo_rating || 1200)}</p>
                      <p className="text-[10px] text-zinc-500">ATP</p>
                    </div>
                    <div className="glass-card p-3 text-center" style={{ borderRadius: '14px' }}>
                      <p className="text-xl font-black text-white">{playerCardData.matches_played || 0}</p>
                      <p className="text-[10px] text-zinc-500">Partidos</p>
                    </div>
                    <div className="glass-card p-3 text-center" style={{ borderRadius: '14px' }}>
                      <p className="text-xl font-black text-white">
                        {playerCardData.matches_played > 0
                          ? Math.round((playerCardData.matches_won / playerCardData.matches_played) * 100)
                          : 0}%
                      </p>
                      <p className="text-[10px] text-zinc-500">Win</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {!playerCardData.friendship ? (
                      <GlassButton variant="primary" fullWidth onClick={() => handleAddFriendFromCard(playerCardData.id)}>
                        👋 Agregar amigo
                      </GlassButton>
                    ) : playerCardData.friendship.status === 'pending' ? (
                      <GlassButton variant="secondary" fullWidth disabled>
                        Solicitud enviada ✓
                      </GlassButton>
                    ) : (
                      <GlassButton variant="secondary" fullWidth disabled>
                        Ya son amigos ✓
                      </GlassButton>
                    )}
                    <GlassButton variant="secondary" onClick={() => navigate(`/player/${playerCardData.id}`)}>
                      Ver perfil →
                    </GlassButton>
                  </div>

                  {/* Close */}
                  <button
                    onClick={() => { setPlayerCardData(null) }}
                    className="absolute top-3 right-3 text-zinc-500 hover:text-white text-lg"
                  >✕</button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ PROLEAGUE FOOTER BANNER ============ */}
      <div className="fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: 'linear-gradient(135deg, #6b2f9d 0%, #3273dc 100%)',
          boxShadow: '0 -4px 20px #6b2f9d55',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <svg width="18" height="22" viewBox="0 0 40 48" fill="none">
              <path d="M20 2C20 2 4 18 4 28C4 37.3 11.2 44 20 44C28.8 44 36 37.3 36 28C36 18 20 2 20 2Z"
                fill="white" fillOpacity="0.9" />
            </svg>
            <span className="text-white font-black text-sm uppercase tracking-widest">Liga ProLeague</span>
          </div>
          <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
            Dobles &middot; ATP en vivo
          </span>
        </div>
      </div>
    </div>
  )
}
