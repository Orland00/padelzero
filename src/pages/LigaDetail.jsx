import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useLigaStore } from '@/stores/ligaStore'
import { useJornadaStore } from '@/stores/jornadaStore'
import { generateAmericanoSchedule, calculateRounds } from '@/utils/americanoEngine'
import { useAuthStore } from '@/stores/authStore'
import PlayerAvatar from '@/components/PlayerAvatar'
import { useUiStore } from '@/stores/uiStore'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import CrownBadge from '@/components/CrownBadge'
import CrownTransferCard from '@/components/Liga/CrownTransferCard'
import JornadaHistoryCard from '@/components/Liga/JornadaHistoryCard'
import TennisballLoader from '@/components/TennisballLoader'
import TorneosTab from '@/components/tournaments/TorneosTab'
import GlassButton from '@/components/ui/GlassButton'
import { LIGA_FOREVER_ID, LIGA_PROLEAGUE_ID } from '@/lib/constants'
import { useI18n } from '@/lib/i18n'
import { getLigaRules, getLigaRulesLabel, validateLigaScore } from '@/lib/ligaRules'
import MatchShareCard from '@/components/MatchShareCard'
import SponsorBanner from '@/components/SponsorBanner'
import { formatDateSafe, formatDisplayName } from '@/utils/dateFormatters'

export default function LigaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, profile } = useAuthStore()
  const { showToast } = useUiStore()
  const { t, lang } = useI18n()
  const {
    currentLiga, members, standings, jornadas, crownHistory, ligaMatches, pairStats, teamStats,
    fetchLiga, fetchJornadas, fetchCrownHistory, fetchLigaMatches, fetchPairStats, fetchTeamStats,
    subscribeLiga, loading, removeMember, joinLiga, recordLigaMatch,
    deleteMatch, deleteLiga, leaveLiga, addMember: storeAddMember, updateMemberRole, resetPeriod,
    searchPlayers, updateLigaSettings, createNextJornada,
  } = useLigaStore()
  const { createJornada, loading: jornadaLoading } = useJornadaStore()

  // Admin panel state
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState(null)

  const [activeTab, setActiveTab] = useState('standings')
  const [copying, setCopying] = useState(false)
  const [profilesMap, setProfilesMap] = useState({})
  const [showCreateJornada, setShowCreateJornada] = useState(false)
  const [jornadaDate, setJornadaDate] = useState('')
  const [jornadaError, setJornadaError] = useState(null)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [sharingMatch, setSharingMatch] = useState(null)
  const [joiningLiga, setJoiningLiga] = useState(false)
  const [shareToast, setShareToast] = useState(null)

  // Schedule generator state
  const [schedulePreview, setSchedulePreview] = useState(null)
  const [scheduleSaving, setScheduleSaving] = useState(false)

  // Match creation state
  const [showAddMatch, setShowAddMatch] = useState(false)
  const [matchTeamA1, setMatchTeamA1] = useState('')
  const [matchTeamA2, setMatchTeamA2] = useState('')
  const [matchTeamB1, setMatchTeamB1] = useState('')
  const [matchTeamB2, setMatchTeamB2] = useState('')
  const [matchScoreA, setMatchScoreA] = useState('')
  const [matchScoreB, setMatchScoreB] = useState('')
  const [matchError, setMatchError] = useState(null)
  const [matchSaving, setMatchSaving] = useState(false)
  const [matchResult, setMatchResult] = useState(null)
  const matchRules = getLigaRules(currentLiga)
  const matchRulesLabel = getLigaRulesLabel(currentLiga)

  useEffect(() => {
    if (id) {
      fetchLiga(id)
      fetchJornadas(id)
      fetchCrownHistory(id)
      fetchLigaMatches(id)
      fetchPairStats(id)
      fetchTeamStats(id)
      const unsub = subscribeLiga(id)
      return unsub
    }
  }, [id])

  // Handle deep link invite parameter
  useEffect(() => {
    const inviteParam = searchParams.get('invite')
    if (inviteParam === 'true' && currentLiga) {
      const isMember = members?.some(m => m.player_id === user?.id)
      if (!isMember && user) {
        setShowInviteModal(true)
      }
    }
  }, [searchParams, currentLiga, members, user])

  // Build profiles map from standings
  useEffect(() => {
    const map = {}
    standings.forEach(s => {
      if (s.profile) {
        map[s.player_id] = s.profile
      }
    })
    setProfilesMap(map)
  }, [standings])

  const generateShareLink = () => {
    if (currentLiga?.join_code) {
      return `${window.location.origin}/liga/join/${currentLiga.join_code}`
    }
    return `${window.location.origin}/liga/${id}?invite=true`
  }

  const handleCopyLink = async () => {
    try {
      const link = generateShareLink()
      await navigator.clipboard.writeText(link)
      setShareToast('Enlace copiado')
      setTimeout(() => setShareToast(null), 2000)
      setShowShareMenu(false)
    } catch (err) {
      // clipboard error — silently fail
    }
  }

  const handleNativeShare = async () => {
    try {
      const link = generateShareLink()
      if (navigator.share) {
        await navigator.share({
          title: currentLiga?.name || 'Liga PadelZero',
          text: `Únete a "${currentLiga?.name}" en PadelZero!`,
          url: link,
        })
        setShowShareMenu(false)
      } else {
        handleCopyLink()
      }
    } catch (err) {
      // share cancelled or failed — silently handled
    }
  }

  const handleJoinLiga = async () => {
    setJoiningLiga(true)
    try {
      await joinLiga(id)
      setShowInviteModal(false)
      navigate(`/liga/${id}`)
    } catch (err) {
      // error handled by store toast
    } finally {
      setJoiningLiga(false)
    }
  }

  const handleCreateJornada = async () => {
    if (!jornadaDate) {
      setJornadaError('Por favor selecciona una fecha')
      return
    }
    try {
      setJornadaError(null)
      await createJornada(id, jornadaDate)
      setJornadaDate('')
      setShowCreateJornada(false)
      await fetchJornadas(id)
    } catch (err) {
      setJornadaError(err.message || 'Error al crear jornada')
    }
  }

  const resetMatchForm = () => {
    setMatchTeamA1('')
    setMatchTeamA2('')
    setMatchTeamB1('')
    setMatchTeamB2('')
    setMatchScoreA('')
    setMatchScoreB('')
    setMatchError(null)
    setMatchResult(null)
  }

  const handleRecordMatch = async () => {
    // Validate all fields
    if (!matchTeamA1 || !matchTeamA2 || !matchTeamB1 || !matchTeamB2) {
      setMatchError('Selecciona los 4 jugadores')
      return
    }

    const allPlayers = [matchTeamA1, matchTeamA2, matchTeamB1, matchTeamB2]
    if (new Set(allPlayers).size !== 4) {
      setMatchError('No puedes repetir jugadores')
      return
    }

    const scoreA = Number(matchScoreA)
    const scoreB = Number(matchScoreB)
    const scoreValidation = validateLigaScore(scoreA, scoreB, currentLiga)
    if (!scoreValidation.valid) {
      setMatchError(scoreValidation.message)
      return
    }

    setMatchError(null)
    setMatchSaving(true)
    try {
      const result = await recordLigaMatch(id, {
        teamAPlayer1: matchTeamA1,
        teamAPlayer2: matchTeamA2,
        teamBPlayer1: matchTeamB1,
        teamBPlayer2: matchTeamB2,
        scoreTeamA: scoreA,
        scoreTeamB: scoreB,
      })
      setMatchResult(result)
    } catch (err) {
      setMatchError(err.message || 'Error al guardar el partido')
    } finally {
      setMatchSaving(false)
    }
  }

  // CSV Export: Standings
  const exportStandingsCSV = () => {
    const headers = ['Rank','Jugador','ATP','Puntos','Partidos','Ganados','Perdidos','Win%'];
    const rows = standings.map((s, i) => [
      i + 1,
      formatDisplayName(s.profile?.display_name),
      s.elo_rating,
      s.total_points,
      s.matches_played,
      s.matches_won,
      s.matches_lost,
      s.matches_played > 0 ? ((s.matches_won / s.matches_played) * 100).toFixed(1) : '0'
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentLiga.name}_standings_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ type: 'success', message: t('export.downloaded') })
  }

  // CSV Export: Match History
  const exportMatchesCSV = () => {
    const headers = ['Fecha','Equipo A P1','Equipo A P2','Equipo B P1','Equipo B P2','Score A','Score B','Ganador'];
    const rows = (ligaMatches || []).map(m => {
      const teamAWon = m.score_team_a > m.score_team_b;
      return [
        formatDateSafe(m.played_at, { day: 'numeric', month: 'short', year: 'numeric' }, 'Fecha pendiente'),
        formatDisplayName(m.p1?.display_name, 'Jugador pendiente'),
        formatDisplayName(m.p2?.display_name, 'Jugador pendiente'),
        formatDisplayName(m.p3?.display_name, 'Jugador pendiente'),
        formatDisplayName(m.p4?.display_name, 'Jugador pendiente'),
        m.score_team_a,
        m.score_team_b,
        teamAWon ? 'Equipo A' : 'Equipo B'
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentLiga.name}_partidos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ type: 'success', message: t('export.downloaded') })
  }

  // Helper to get member name by ID
  const getMemberName = (playerId) => {
    const member = members?.find(m => m.player_id === playerId)
    return formatDisplayName(member?.profiles?.display_name)
  }

  // Get available players for selection (exclude already selected, and must be active)
  const getAvailablePlayers = (exclude = []) => {
    return members?.filter(m => !exclude.includes(m.player_id) && m.status === 'active') || []
  }

  // Admin: search for players to add
  const handleSearchPlayers = async (query) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, city, elo_rating')
        .or(`display_name.ilike.%${query.replace(/[%_\\,.()"']/g, '')}%,username.ilike.%${query.replace(/[%_\\,.()"']/g, '')}%`)
        .limit(10)

      if (error) throw error
      // Filter out existing members
      const existingIds = new Set(members?.map(m => m.player_id) || [])
      setSearchResults(data?.filter(p => !existingIds.has(p.id)) || [])
    } catch (err) {
      showToast({ type: 'error', message: 'Error buscando jugadores' })
    } finally {
      setSearchLoading(false)
    }
  }

  // Admin: add member to liga (uses store function which also creates standing)
  const handleAddMember = async (playerId) => {
    try {
      await storeAddMember(id, playerId)
      showToast({ type: 'success', message: 'Jugador agregado a la liga' })
      setSearchQuery('')
      setSearchResults([])
    } catch (err) {
      showToast({ type: 'error', message: err.message })
    }
  }

  // Admin: remove member from liga
  const handleRemoveMember = async (memberId, playerName) => {
    const ok = await useUiStore.getState().confirm({
      message: lang === 'es' ? `¿Eliminar ${playerName} de la liga?` : `Remove ${playerName} from league?`,
      danger: true,
    })
    if (!ok) return

    try {
      setRemovingMemberId(memberId)
      await removeMember(memberId, id)
      showToast({ type: 'success', message: `${playerName} eliminado de la liga` })
    } catch (err) {
      showToast({ type: 'error', message: 'Error al eliminar' })
    } finally {
      setRemovingMemberId(null)
    }
  }

  if (loading && !currentLiga) {
    return (
      <div className="flex justify-center items-center h-screen bg-zinc-950 flex-col gap-4">
        <TennisballLoader size="lg" />
        <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest">Cargando liga...</p>
      </div>
    )
  }

  if (!currentLiga) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="animate-spin w-10 h-10 border-4 border-zinc-700 border-t-emerald-500 rounded-full" />
      </div>
    )
  }

  const isAdmin = members?.some(m => m.player_id === user?.id && m.role === 'admin')
  const isMember = members?.some(m => m.player_id === user?.id && m.status === 'active')
  const crownedPlayer = standings?.[0]
  const isProLeagueAdmin = isAdmin && id === LIGA_PROLEAGUE_ID

  const hasDummyPlayers = members?.some(m => m.profiles?.is_dummy)
  const baseTabs = ['standings', 'partidos', 'jornadas', 'parejas', 'crown', 'members', 'torneos']
  const tabs = isAdmin ? [...baseTabs, 'admin'] : baseTabs

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          {/* Back button */}
          <button
            onClick={() => navigate('/liga')}
            className="text-zinc-400 text-sm font-bold mb-3 flex items-center gap-1 hover:text-white transition"
          >
            ← {t('common.back')}
          </button>
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <h1 className="text-3xl font-black uppercase tracking-widest text-white mb-1">
                {currentLiga.name}
              </h1>
              {currentLiga.description && (
                <p className="text-sm text-zinc-400">{currentLiga.description}</p>
              )}
                <p className="text-xs text-zinc-500 mt-1">
                {lang === 'es' ? 'Creada por' : 'Created by'}{' '}
                <span className="text-zinc-300 font-bold">
                  {formatDisplayName(members?.find(m => m.player_id === currentLiga.created_by)?.profiles?.display_name, 'Sin creador')}
                </span>
                {currentLiga.created_by === user?.id && (
                  <span className="text-emerald-500 ml-1">(tú)</span>
                )}
              </p>
              <SponsorBanner ligaId={id} placement="title" />
            </div>

            {/* Share Button */}
            <div className="relative">
              <GlassButton
                variant="ghost"
                size="icon"
                onClick={() => setShowShareMenu(!showShareMenu)}
              >
                🔗
              </GlassButton>
              <AnimatePresence>
                {showShareMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute top-full right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-40 min-w-48 overflow-hidden"
                  >
                    <button onClick={handleCopyLink} className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-zinc-800 transition text-white text-sm font-bold border-b border-zinc-700">
                      📋 COPIAR ENLACE
                    </button>
                    {navigator.share && (
                      <button onClick={handleNativeShare} className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-zinc-800 transition text-white text-sm font-bold">
                        📤 COMPARTIR
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Crown + Add Match Button */}
          <div className="flex items-center gap-3 flex-wrap">
            {isMember && crownedPlayer && (
              <div className="inline-block glass-pill-amber px-3 py-1.5 rounded-lg">
                <p className="text-xs text-amber-300 font-bold">
                  👑 {crownedPlayer.player_id === user?.id ? 'TIENES LA CORONA' : formatDisplayName(crownedPlayer.profile?.display_name)}
                </p>
              </div>
            )}

            {isMember && (
              <GlassButton
                variant="primary"
                size="sm"
                onClick={() => { resetMatchForm(); setShowAddMatch(true) }}
              >
                + AGREGAR PARTIDO
              </GlassButton>
            )}

            {/* Join button for non-members */}
            {!isMember && user && (
              <GlassButton
                variant={id === LIGA_PROLEAGUE_ID ? 'accent-purple' : 'primary'}
                size="sm"
                disabled={joiningLiga}
                loading={joiningLiga}
                onClick={async () => {
                  setJoiningLiga(true)
                  try {
                    await joinLiga(id)
                    const senderName = profile?.display_name || user.user_metadata?.display_name || user.email
                    const admins = members?.filter(m => m.role === 'admin') || []
                    for (const admin of admins) {
                      await supabase.from('notifications').insert({
                        recipient_id: admin.player_id,
                        sender_id: user.id,
                        type: 'liga_event',
                        title: id === LIGA_PROLEAGUE_ID ? 'Solicitud de acceso' : 'Nuevo miembro',
                        message: `${senderName} ${id === LIGA_PROLEAGUE_ID ? 'quiere unirse a' : 'se unió a'} ${currentLiga.name}`,
                        data: { liga_id: id, requester_name: senderName },
                      })
                    }
                    showToast({
                      type: 'success',
                      message: id === LIGA_PROLEAGUE_ID
                        ? 'Solicitud enviada. Un admin debe aprobarla.'
                        : `¡Te uniste a ${currentLiga.name}!`
                    })
                    fetchLiga(id)
                  } catch (err) {
                    showToast({ type: 'error', message: err.message || 'Error al unirse' })
                  } finally {
                    setJoiningLiga(false)
                  }
                }}
              >
                {joiningLiga ? '' : id === LIGA_PROLEAGUE_ID ? '🔒 Pedir Acceso' : '🤝 Unirme'}
              </GlassButton>
            )}
          </div>

          {/* Dummy players warning */}
          {hasDummyPlayers && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-3">
              <p className="text-[10px] text-yellow-400 font-bold">⚠️ Esta liga tiene jugadores invitados — Los resultados de ATP son orientativos, no oficiales.</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 glass-card rounded-xl mb-6 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <GlassButton
              key={tab}
              pill
              pillColor={activeTab === tab ? 'emerald' : undefined}
              variant={activeTab === tab ? 'primary' : 'ghost'}
              onClick={() => setActiveTab(tab)}
              className="whitespace-nowrap"
            >
              {tab === 'standings' && '🏆 Ranking'}
              {tab === 'partidos' && '🎾 Partidos'}
              {tab === 'jornadas' && '🎮 Jornadas'}
              {tab === 'parejas' && '🤝 Parejas'}
              {tab === 'crown' && '👑 Corona'}
              {tab === 'members' && '👥'}
              {tab === 'torneos' && '🏆 Torneos'}
              {tab === 'admin' && '⚙️ Admin'}
            </GlassButton>
          ))}
        </div>

        {/* STANDINGS Tab - with ATP */}
        {activeTab === 'standings' && (
          <div className="space-y-2">
            {standings && standings.length > 0 && (
              <div className="flex justify-end mb-2">
                <button
                  onClick={exportStandingsCSV}
                  className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition px-3 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800"
                  title={t('export.standings')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  {t('export.standings')}
                </button>
              </div>
            )}
            {standings && standings.length > 0 ? (
              standings.map((player, idx) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => navigate(`/player/${player.player_id}`)}
                  className={`glass-card p-4 flex items-center justify-between cursor-pointer active:scale-[0.98] transition ${
                    idx === 0 ? 'border-amber-500/50' : idx === 1 ? 'border-zinc-500/50' : idx === 2 ? 'border-amber-700/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl font-black w-8 ${
                      idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-zinc-400' : idx === 2 ? 'text-amber-600' : 'text-zinc-600'
                    }`}>
                      #{idx + 1}
                    </span>
                    {player.has_crown && <CrownBadge size="md" animate={true} />}
                    <div>
                      <p className="font-bold text-white">{formatDisplayName(player.profile?.display_name)}</p>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span>{player.matches_played}P {player.matches_won}W {player.matches_lost}L</span>
                        {player.elo_rating && (
                          <span className="text-cyan-400 font-bold">{player.elo_rating} ATP</span>
                        )}
                        {player.period_elo_delta != null && player.period_elo_delta !== 0 && (
                          <span className={`font-bold ${player.period_elo_delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {player.period_elo_delta > 0 ? '↑' : '↓'}{Math.abs(player.period_elo_delta)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-emerald-500">{player.total_points}</p>
                    <p className="text-[10px] text-zinc-500 font-bold">PTS</p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-zinc-400 mb-2">Sin jugadores aún</p>
                <p className="text-zinc-600 text-sm">Agrega un partido para comenzar</p>
              </div>
            )}
            <SponsorBanner ligaId={id} placement="leaderboard" />
          </div>
        )}

        {/* PARTIDOS Tab - Match History */}
        {activeTab === 'partidos' && (
          <div className="space-y-3">
            {ligaMatches && ligaMatches.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={exportMatchesCSV}
                  className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition px-3 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800"
                  title={t('export.matches')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  {t('export.matches')}
                </button>
              </div>
            )}
            {/* 24h delete rule legend */}
            <div className="glass-card p-3">
              <p className="text-xs text-zinc-400">
                ⏱ {lang === 'es'
                  ? 'Los participantes pueden eliminar un partido dentro de las 24 horas después de registrarlo.'
                  : 'Participants can delete a match within 24 hours of recording it.'}
              </p>
            </div>
            {isMember && (
              <GlassButton variant="primary" fullWidth onClick={() => { resetMatchForm(); setShowAddMatch(true) }}>
                + AGREGAR PARTIDO
              </GlassButton>
            )}

            {ligaMatches && ligaMatches.length > 0 ? (
              ligaMatches.map((match, idx) => {
                const teamAWon = match.score_team_a > match.score_team_b
                return (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="glass-card p-4"
                  >
                    {/* Date */}
                    <p className="text-[10px] text-zinc-500 font-bold mb-3 uppercase tracking-widest">
                      {formatDateSafe(match.played_at, {
                        weekday: 'short', day: 'numeric', month: 'short'
                      }, 'Fecha pendiente')}
                    </p>

                    <div className="flex items-center gap-3">
                      {/* Team A */}
                      <div className={`flex-1 text-right ${teamAWon ? 'opacity-100' : 'opacity-50'}`}>
                        <p className="text-sm font-bold text-white">{match.p1?.display_name || '?'}</p>
                        <p className="text-sm font-bold text-white">{match.p2?.display_name || '?'}</p>
                      </div>

                      {/* Score */}
                      <div className="flex items-center gap-2 px-3">
                        <span className={`text-2xl font-black ${teamAWon ? 'text-emerald-400' : 'text-zinc-500'}`}>
                          {match.score_team_a}
                        </span>
                        <span className="text-zinc-600 text-sm">-</span>
                        <span className={`text-2xl font-black ${!teamAWon ? 'text-emerald-400' : 'text-zinc-500'}`}>
                          {match.score_team_b}
                        </span>
                      </div>

                      {/* Team B */}
                      <div className={`flex-1 ${!teamAWon ? 'opacity-100' : 'opacity-50'}`}>
                        <p className="text-sm font-bold text-white">{match.p3?.display_name || '?'}</p>
                        <p className="text-sm font-bold text-white">{match.p4?.display_name || '?'}</p>
                      </div>
                    </div>

                    {/* ATP deltas + share + delete button */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800">
                      <div className="flex gap-2 text-[10px]">
                        {match.elo_delta_a1 != null && match.elo_delta_a1 !== 0 && (
                          <span className={match.elo_delta_a1 > 0 ? 'text-emerald-500' : 'text-red-400'}>
                            {match.elo_delta_a1 > 0 ? '+' : ''}{match.elo_delta_a1}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSharingMatch(match)}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-widest"
                        >
                          Compartir
                        </button>
                        {isAdmin && (
                          <button
                            onClick={async () => {
                              const ok = await useUiStore.getState().confirm({
                                message: lang === 'es' ? '¿Eliminar partido y revertir ATP?' : 'Delete match and revert ATP?',
                                danger: true,
                              })
                              if (ok) deleteMatch(match.id, id)
                            }}
                            className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-widest"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })
            ) : (
              <div className="text-center py-12">
                <p className="text-zinc-400 mb-2">Sin partidos registrados</p>
                <p className="text-zinc-600 text-sm">Toca "Agregar Partido" para comenzar</p>
              </div>
            )}
          </div>
        )}

        {/* PAREJAS Tab */}
        {activeTab === 'parejas' && (
          <div className="space-y-2">
            {pairStats && pairStats.length > 0 ? (
              pairStats.map((pair, idx) => {
                const winRate = pair.matches_played > 0
                  ? Math.round((pair.matches_won / pair.matches_played) * 100)
                  : 0
                return (
                  <motion.div
                    key={pair.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="glass-card p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-white text-sm">
                          {pair.player1?.display_name || '?'} & {pair.player2?.display_name || '?'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span>{pair.matches_played} partidos</span>
                        <span>{pair.matches_won}W - {pair.matches_played - pair.matches_won}L</span>
                        <span className="text-zinc-500">
                          GF: {pair.total_score_for} GA: {pair.total_score_against}
                        </span>
                      </div>
                    </div>
                    <div className={`text-right ${winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                      <p className="text-xl font-black">{winRate}%</p>
                      <p className="text-[10px] font-bold text-zinc-500">WIN RATE</p>
                    </div>
                  </motion.div>
                )
              })
            ) : (
              <div className="text-center py-12">
                <p className="text-zinc-400 mb-2">Todavía no hay parejas registradas</p>
                <p className="text-zinc-600 text-sm">Se acumula al registrar partidos</p>
              </div>
            )}
          </div>
        )}

        {/* JORNADAS Tab */}
        {activeTab === 'jornadas' && (
          <div className="space-y-4">
            {isAdmin && (
              <GlassButton variant="primary" fullWidth onClick={() => setShowCreateJornada(true)} disabled={jornadaLoading} loading={jornadaLoading}>
                {jornadaLoading ? 'CREANDO...' : '+ Nueva Jornada'}
              </GlassButton>
            )}
            <div className="space-y-2">
              {jornadas && jornadas.length > 0 ? (
                jornadas.map(jornada => (
                  <JornadaHistoryCard key={jornada.id} jornada={jornada} ligaId={id} />
                ))
              ) : (
                <p className="text-zinc-400 text-center py-8">Sin jornadas aún</p>
              )}
            </div>
          </div>
        )}

        {/* CROWN HISTORY Tab */}
        {activeTab === 'crown' && (
          <div className="space-y-2">
            {crownHistory && crownHistory.length > 0 ? (
              crownHistory.map(transfer => (
                <CrownTransferCard key={transfer.id} transfer={transfer} profiles={profilesMap} />
              ))
            ) : (
              <p className="text-zinc-400 text-center py-8">Sin transferencias de corona aún</p>
            )}
          </div>
        )}

        {/* MEMBERS Tab */}
        {activeTab === 'members' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-zinc-400 font-bold">{members?.length || 0}/{currentLiga?.max_members || 30} jugadores</p>
            </div>
            {members && members.length > 0 ? (
              members.map(member => (
                <div key={member.id} className="glass-card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PlayerAvatar
                      avatarUrl={member.profiles?.avatar_url}
                      displayName={member.profiles?.display_name}
                      hasCrown={member.role === 'admin'}
                      size="sm"
                    />
                    <div>
                      <p className="font-bold text-white flex items-center gap-2">
                        {formatDisplayName(member.profiles?.display_name)}
                        {member.status === 'invited' && (
                          <span className="text-[9px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded font-black uppercase">
                            Invitado
                          </span>
                        )}
                        {member.status === 'pending' && (
                          <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-black uppercase">
                            Pendiente
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-400">{member.role === 'admin' ? 'Admin' : 'Jugador'}</p>
                    </div>
                  </div>
                  {isAdmin && member.player_id !== user?.id && (
                    <GlassButton
                      variant="danger"
                      size="xs"
                      onClick={() => handleRemoveMember(member.id, formatDisplayName(member.profiles?.display_name))}
                      disabled={removingMemberId === member.id}
                    >
                      {removingMemberId === member.id ? '...' : 'Remover'}
                    </GlassButton>
                  )}
                </div>
              ))
            ) : (
              <p className="text-zinc-400 text-center py-8">Sin miembros</p>
            )}
          </div>
        )}

        {/* TORNEOS Tab */}
        {activeTab === 'torneos' && (
          <TorneosTab ligaId={id} isAdmin={isAdmin} />
        )}

        {/* ADMIN Tab - Participant Management */}
        {activeTab === 'admin' && isAdmin && (
          <div className="space-y-6">
            {/* Add Players Section */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Agregar Jugadores</h3>

              {/* Search Input */}
              <div className="space-y-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    handleSearchPlayers(e.target.value)
                  }}
                  placeholder="Busca por nombre o usuario..."
                  className="glass-input w-full"
                />

                {/* Search Results */}
                {searchQuery && (
                  <div className="border border-zinc-700 rounded-lg bg-zinc-950 max-h-64 overflow-y-auto">
                    {searchLoading ? (
                      <div className="p-4 text-center">
                        <TennisballLoader size="sm" className="inline-block" />
                      </div>
                    ) : searchResults.length === 0 ? (
                      <p className="p-4 text-zinc-500 text-sm text-center">No encontrado</p>
                    ) : (
                      searchResults.map(player => (
                        <button
                          key={player.id}
                          onClick={() => handleAddMember(player.id)}
                          className="w-full p-3 border-b border-zinc-800 hover:bg-zinc-900/50 transition text-left flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-white">{player.display_name}</p>
                            {player.city && <p className="text-xs text-zinc-500">{player.city}</p>}
                          </div>
                          <span className="text-emerald-400 font-bold">{Math.round(player.elo_rating || 1200)} ATP</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Add Dummy Player */}
            <div className="glass-card border-yellow-500/20 p-6">
              <h3 className="text-sm font-bold text-yellow-400 mb-1">Agregar Jugador Invitado (Dummy)</h3>
              <p className="text-[10px] text-zinc-500 mb-3">⚠️ Si agregas invitados, los partidos NO cuentan para el ATP oficial.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nombre del invitado..."
                  id="dummy-name-input"
                  className="glass-input flex-1 text-sm"
                />
                <button
                  onClick={async () => {
                    const input = document.getElementById('dummy-name-input')
                    const name = input?.value?.trim()
                    if (!name) return
                    try {
                      // Create dummy profile with random UUID
                      const dummyId = crypto.randomUUID()
                      const { data: dummyProfile, error: profileErr } = await supabase
                        .from('profiles')
                        .insert({
                          id: dummyId,
                          display_name: name,
                          is_dummy: true,
                          elo_rating: 1200,
                        })
                        .select('id, display_name, is_dummy, elo_rating')
                        .single()
                      if (profileErr) throw profileErr
                      // Add to liga
                      await storeAddMember(id, dummyProfile.id)
                      input.value = ''
                      showToast({ type: 'success', message: `${name} agregado como invitado` })
                    } catch (err) {
                      showToast({ type: 'error', message: err.message || 'Error al agregar' })
                    }
                  }}
                  className="glass-btn glass-accent-amber glass-btn-sm"
                >
                  Agregar
                </button>
              </div>
            </div>

            {/* Current Participants */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Participantes ({members?.length || 0})</h3>
              <div className="space-y-2">
                {members?.map(member => (
                  <div key={member.id} className="glass-card p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <PlayerAvatar
                        avatarUrl={member.profiles?.avatar_url}
                        displayName={member.profiles?.display_name}
                        hasCrown={member.role === 'admin'}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate">{formatDisplayName(member.profiles?.display_name)}</p>
                        <p className="text-xs text-zinc-500">
                          {member.role === 'admin' ? '👑 Admin' : member.status === 'active' ? 'Jugador' : 'Pendiente'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && member.player_id !== user?.id && member.role !== 'admin' && (
                        <GlassButton variant="accent-purple" size="xs" onClick={() => updateMemberRole(id, member.player_id, 'admin')} title="Hacer admin">
                          ↑ Admin
                        </GlassButton>
                      )}
                      {isAdmin && member.player_id !== user?.id && member.role === 'admin' && (
                        <GlassButton variant="ghost" size="xs" onClick={() => updateMemberRole(id, member.player_id, 'player')} title="Quitar admin">
                          ↓ Jugador
                        </GlassButton>
                      )}
                      {member.player_id !== user?.id && (
                        <GlassButton
                          variant="danger"
                          size="xs"
                          onClick={() => handleRemoveMember(member.id, formatDisplayName(member.profiles?.display_name))}
                          disabled={removingMemberId === member.id}
                        >
                          {removingMemberId === member.id ? '...' : 'X'}
                        </GlassButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Americano Schedule Generator */}
            {currentLiga?.format === 'americano' && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-white mb-4">{t('schedule.generate')}</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-zinc-400">
                    <span className="bg-zinc-800 px-3 py-1.5 rounded-lg font-mono">
                      {t('schedule.players_detected').replace('{n}', members?.length || 0)}
                    </span>
                    {members?.length >= 4 && (
                      <span className="bg-zinc-800 px-3 py-1.5 rounded-lg font-mono">
                        {t('schedule.rounds_needed').replace('{n}', calculateRounds(members?.length || 0).recommendedRounds)}
                      </span>
                    )}
                  </div>

                  {members?.length < 4 ? (
                    <p className="text-yellow-400 text-sm">{t('schedule.min_players')}</p>
                  ) : !schedulePreview ? (
                    <GlassButton
                      variant="primary"
                      fullWidth
                      onClick={() => {
                        const players = members.map(m => ({
                          id: m.player_id,
                          name: formatDisplayName(m.profiles?.display_name),
                        }))
                        const schedule = generateAmericanoSchedule(players)
                        setSchedulePreview(schedule)
                      }}
                    >
                      {t('schedule.generate')}
                    </GlassButton>
                  ) : (
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">{t('schedule.preview')}</h4>
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {schedulePreview.rounds.map(round => (
                          <div key={round.round} className="glass-card p-3 bg-zinc-900/50">
                            <p className="text-xs font-bold text-zinc-300 mb-2 uppercase tracking-wider">
                              {t('schedule.round').replace('{n}', round.round)}
                            </p>
                            <div className="space-y-1.5">
                              {round.matches.map((match, mi) => (
                                <div key={mi} className="flex items-center gap-2 text-xs">
                                  <span className="text-zinc-500 w-5 text-right">C{match.court}</span>
                                  <span className="text-emerald-300 font-medium">{match.teamANames.join(' + ')}</span>
                                  <span className="text-zinc-600">{t('schedule.vs')}</span>
                                  <span className="text-amber-300 font-medium">{match.teamBNames.join(' + ')}</span>
                                </div>
                              ))}
                              {round.byeName && (
                                <p className="text-xs text-zinc-500 italic">{t('schedule.bye')}: {round.byeName}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <GlassButton
                          variant="secondary"
                          fullWidth
                          onClick={() => setSchedulePreview(null)}
                        >
                          {t('common.cancel')}
                        </GlassButton>
                        <GlassButton
                          variant="primary"
                          fullWidth
                          disabled={scheduleSaving}
                          loading={scheduleSaving}
                          onClick={async () => {
                            try {
                              setScheduleSaving(true)
                              const today = new Date().toISOString().split('T')[0]

                              // Create jornada
                              const jornada = await createJornada(id, today)

                              // Insert americano_rounds
                              const roundsToInsert = schedulePreview.rawRounds.map(r => ({
                                jornada_id: jornada.id,
                                round_number: r.round,
                                status: r.round === 1 ? 'in_progress' : 'pending',
                              }))
                              const { data: insertedRounds, error: roundErr } = await supabase
                                .from('americano_rounds')
                                .insert(roundsToInsert)
                                .select('id, jornada_id, round_number, status')
                              if (roundErr) throw roundErr

                              // Insert americano_matches
                              const matchesToInsert = []
                              schedulePreview.rawRounds.forEach((genRound, idx) => {
                                const roundId = insertedRounds[idx].id
                                genRound.matches.forEach(match => {
                                  matchesToInsert.push({
                                    round_id: roundId,
                                    court_number: match.court,
                                    team_a_player1: match.teamA[0],
                                    team_a_player2: match.teamA[1],
                                    team_b_player1: match.teamB[0],
                                    team_b_player2: match.teamB[1],
                                    bye_player: genRound.bye || null,
                                    status: 'pending',
                                  })
                                })
                              })
                              const { error: matchErr } = await supabase
                                .from('americano_matches')
                                .insert(matchesToInsert)
                              if (matchErr) throw matchErr

                              // Update jornada status
                              await supabase
                                .from('jornadas')
                                .update({ status: 'in_progress' })
                                .eq('id', jornada.id)

                              setSchedulePreview(null)
                              await fetchJornadas(id)
                              showToast({ type: 'success', message: t('schedule.generated') })
                            } catch (err) {
                              showToast({ type: 'error', message: err.message || 'Error' })
                            } finally {
                              setScheduleSaving(false)
                            }
                          }}
                        >
                          {scheduleSaving ? t('schedule.saving') : t('schedule.confirm')}
                        </GlassButton>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS Section (part of admin tab) */}
        {activeTab === 'admin' && isAdmin && (
          <div className="space-y-4">
            {isAdmin ? (
              <>
                <div className="glass-card p-4">
                  <p className="text-sm text-zinc-400 mb-2">Código de invitación:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-zinc-800 rounded font-mono text-white text-xs">{currentLiga.id}</code>
                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(currentLiga.id)
                        setCopying(true)
                        setTimeout(() => setCopying(false), 2000)
                      }}
                    >
                      {copying ? '✓' : 'Copiar'}
                    </GlassButton>
                  </div>
                </div>

                {/* QR Code Share Section */}
                <div className="glass-card p-4">
                  <h3 className="text-sm font-bold text-white mb-1">{t('liga.qr_share')}</h3>
                  <p className="text-xs text-zinc-500 mb-3">{t('liga.qr_title')}</p>
                  {(() => {
                    const qrUrl = currentLiga.join_code
                      ? `${window.location.origin}/liga/join/${currentLiga.join_code}`
                      : `${window.location.origin}/liga/${id}?invite=true`
                    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`
                    return (
                      <div className="flex flex-col items-center gap-3">
                        <div className="bg-white p-3 rounded-xl">
                          <img
                            src={qrApiUrl}
                            alt="QR Code"
                            width={180}
                            height={180}
                            className="rounded"
                          />
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono break-all text-center max-w-[220px]">{qrUrl}</p>
                        <GlassButton
                          variant="primary"
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await fetch(qrApiUrl)
                              const blob = await response.blob()
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `liga-qr-${currentLiga.join_code || id}.png`
                              document.body.appendChild(a)
                              a.click()
                              document.body.removeChild(a)
                              URL.revokeObjectURL(url)
                            } catch {
                              showToast({ type: 'error', message: 'Error al descargar QR' })
                            }
                          }}
                        >
                          ⬇ {t('liga.qr_download')}
                        </GlassButton>
                      </div>
                    )
                  })()}
                </div>
                <div className="glass-card p-4">
                  <p className="text-sm text-zinc-400 mb-2">Días de juego:</p>
                  <p className="font-bold text-white">{currentLiga.schedule?.days?.join(', ') || 'No configurado'}</p>
                </div>
              {/* Admin Actions */}
              <div className="space-y-3 mt-4">
                <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Acciones Admin</h3>
                <GlassButton variant="accent-purple" fullWidth onClick={async () => {
                    const ok = await useUiStore.getState().confirm({
                      message: lang === 'es' ? '¿Reiniciar deltas del período? Los ATPs globales NO cambian.' : 'Reset period deltas? Global ATPs are NOT affected.',
                      danger: true,
                    })
                    if (!ok) return
                    try {
                      await resetPeriod(id)
                      useUiStore.getState().showToast({ type: 'success', message: lang === 'es' ? 'Período reiniciado' : 'Period reset', duration: 2500 })
                    } catch (err) {
                      useUiStore.getState().showToast({ type: 'error', message: err?.message || (lang === 'es' ? 'Error al reiniciar' : 'Reset failed'), duration: 4000 })
                    }
                  }}>
                  Reiniciar Período (deltas a 0)
                </GlassButton>
                <GlassButton variant="accent-purple" fullWidth onClick={async () => {
                    try {
                      await createNextJornada(id)
                    } catch {}
                  }}>
                  Crear Nueva Jornada
                </GlassButton>

                {/* Delete Liga - creator only */}
                {currentLiga.created_by === user?.id && (
                  <GlassButton variant="danger" fullWidth onClick={async () => {
                    const ok = await useUiStore.getState().confirm({
                      message: lang === 'es' ? '⚠️ ¿Eliminar esta liga? Esta acción no se puede deshacer.' : '⚠️ Delete this league? This cannot be undone.',
                      danger: true,
                    })
                    if (!ok) return
                    const { error } = await deleteLiga(id)
                    if (!error) {
                      showToast({ type: 'success', message: lang === 'es' ? 'Liga eliminada' : 'League deleted' })
                      navigate('/liga')
                    } else {
                      showToast({ type: 'error', message: error.message })
                    }
                  }}>
                    🗑 {lang === 'es' ? 'Eliminar Liga' : 'Delete League'}
                  </GlassButton>
                )}
              </div>
              </>
            ) : (
              <p className="text-zinc-400 text-center py-8">Solo admins pueden ver ajustes</p>
            )}
          </div>
        )}

        {/* Action Buttons for non-members */}
        {!isMember && (
          <div className="mt-8 flex gap-3">
            <GlassButton variant="secondary" fullWidth onClick={() => navigate('/liga')}>
              VOLVER
            </GlassButton>
            <GlassButton variant="primary" fullWidth onClick={() => joinLiga(id)} disabled={loading} loading={loading}>
              {loading ? 'UNIÉNDOSE...' : 'UNIRME A LIGA'}
            </GlassButton>
          </div>
        )}

        {/* Leave button for members */}
        {isMember && (
          <div className="mt-6">
            <GlassButton variant="danger" fullWidth onClick={async () => {
              const ok = await useUiStore.getState().confirm({
                message: lang === 'es' ? '¿Seguro que quieres salir de esta liga?' : 'Are you sure you want to leave this league?',
                danger: true,
              })
              if (!ok) return
              const { error } = await leaveLiga(id)
              if (!error) {
                showToast({ type: 'success', message: lang === 'es' ? 'Saliste de la liga' : 'Left the league' })
                navigate('/liga')
              } else {
                showToast({ type: 'error', message: error.message })
              }
            }}>
              🚪 {lang === 'es' ? 'Salir de la Liga' : 'Leave League'}
            </GlassButton>
          </div>
        )}

        {/* Delete button — always visible for creator */}
        {currentLiga.created_by === user?.id && (
          <div className="mt-3">
            <GlassButton variant="danger" fullWidth onClick={async () => {
              const ok = await useUiStore.getState().confirm({
                message: lang === 'es' ? '⚠️ ¿Eliminar esta liga permanentemente? Todos los partidos, standings y datos se perderán.' : '⚠️ Delete this league permanently? All matches, standings and data will be lost.',
                danger: true,
              })
              if (!ok) return
              const { error } = await deleteLiga(id)
              if (!error) {
                showToast({ type: 'success', message: lang === 'es' ? 'Liga eliminada' : 'League deleted' })
                navigate('/liga')
              } else {
                showToast({ type: 'error', message: error.message })
              }
            }}>
              🗑 {lang === 'es' ? 'Eliminar Liga (Soy el creador)' : 'Delete League (I am the creator)'}
            </GlassButton>
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
              className="glass-card border-t sm:border sm:rounded-2xl p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
            >
              {/* Show result after successful save */}
              {matchResult ? (
                <div className="space-y-4">
                  <h2 className="text-xl font-black uppercase tracking-widest text-white text-center">
                    Partido Registrado
                  </h2>

                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                    <p className="text-3xl font-black text-emerald-400">{matchScoreA} - {matchScoreB}</p>
                  </div>

                  {/* ATP Changes */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Cambios ATP</p>
                    {matchResult.eloChanges?.map(change => (
                      <div key={change.playerId} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                        <span className="text-white text-sm font-bold">{getMemberName(change.playerId)}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400 text-sm">{change.oldElo}</span>
                          <span className="text-zinc-600">→</span>
                          <span className="text-white text-sm font-bold">{change.newElo}</span>
                          <span className={`text-xs font-black px-2 py-0.5 rounded ${
                            change.delta > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {change.delta > 0 ? '+' : ''}{change.delta}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <GlassButton variant="primary" fullWidth onClick={() => { setShowAddMatch(false); resetMatchForm() }}>
                    LISTO
                  </GlassButton>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-widest text-white">
                      Nuevo Partido
                    </h2>
                    <button onClick={() => setShowAddMatch(false)} className="text-zinc-400 text-2xl leading-none">&times;</button>
                  </div>

                  {matchError && (
                    <div className="p-3 bg-red-500/20 border border-red-500 text-red-300 rounded-lg text-sm">
                      {matchError}
                    </div>
                  )}

                  {/* Team A */}
                  <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">Equipo A (Drive/Revés)</p>
                    <select
                      value={matchTeamA1}
                      onChange={(e) => setMatchTeamA1(e.target.value)}
                      className="glass-input w-full"
                    >
                      <option value="">Jugador 1...</option>
                      {getAvailablePlayers([matchTeamA2, matchTeamB1, matchTeamB2]).map(m => (
                        <option key={m.player_id} value={m.player_id}>
                          {formatDisplayName(m.profiles?.display_name)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={matchTeamA2}
                      onChange={(e) => setMatchTeamA2(e.target.value)}
                      className="glass-input w-full"
                    >
                      <option value="">Jugador 2...</option>
                      {getAvailablePlayers([matchTeamA1, matchTeamB1, matchTeamB2]).map(m => (
                        <option key={m.player_id} value={m.player_id}>
                          {formatDisplayName(m.profiles?.display_name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Score */}
                  <p className="text-center text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                    {matchRulesLabel}
                  </p>
                  <div className="flex items-center gap-4 justify-center">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-zinc-500 mb-1 uppercase tracking-widest">EQ. A</p>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={matchScoreA}
                        onChange={(e) => setMatchScoreA(e.target.value)}
                        placeholder="0"
                        min="0"
                        max={matchRules.maxScore}
                        className="glass-input w-20 h-16 text-center text-3xl font-black"
                      />
                    </div>
                    <span className="text-3xl font-black text-zinc-600 pt-5">-</span>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-zinc-500 mb-1 uppercase tracking-widest">EQ. B</p>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={matchScoreB}
                        onChange={(e) => setMatchScoreB(e.target.value)}
                        placeholder="0"
                        min="0"
                        max={matchRules.maxScore}
                        className="glass-input w-20 h-16 text-center text-3xl font-black"
                      />
                    </div>
                  </div>

                  {/* Team B */}
                  <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-black text-blue-400 uppercase tracking-widest">Equipo B (Drive/Revés)</p>
                    <select
                      value={matchTeamB1}
                      onChange={(e) => setMatchTeamB1(e.target.value)}
                      className="glass-input w-full"
                    >
                      <option value="">Jugador 1...</option>
                      {getAvailablePlayers([matchTeamA1, matchTeamA2, matchTeamB2]).map(m => (
                        <option key={m.player_id} value={m.player_id}>
                          {formatDisplayName(m.profiles?.display_name)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={matchTeamB2}
                      onChange={(e) => setMatchTeamB2(e.target.value)}
                      className="glass-input w-full"
                    >
                      <option value="">Jugador 2...</option>
                      {getAvailablePlayers([matchTeamA1, matchTeamA2, matchTeamB1]).map(m => (
                        <option key={m.player_id} value={m.player_id}>
                          {formatDisplayName(m.profiles?.display_name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <GlassButton variant="secondary" className="flex-1" onClick={() => setShowAddMatch(false)}>
                      Cancelar
                    </GlassButton>
                    <GlassButton variant="primary" className="flex-1" onClick={handleRecordMatch} disabled={matchSaving} loading={matchSaving}>
                      {matchSaving ? 'Guardando...' : 'Guardar Partido'}
                    </GlassButton>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Jornada Modal */}
      {showCreateJornada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-6 max-w-sm w-full"
          >
            <h2 className="text-xl font-black uppercase tracking-widest text-white mb-4">Nueva Jornada</h2>
            {jornadaError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-300 rounded text-sm">{jornadaError}</div>
            )}
            <div className="mb-4">
              <label className="block text-sm text-zinc-400 mb-2 font-bold">Fecha</label>
              <input
                type="date"
                value={jornadaDate}
                onChange={(e) => setJornadaDate(e.target.value)}
                className="glass-input w-full"
              />
            </div>
            <div className="flex gap-2">
              <GlassButton variant="secondary" fullWidth onClick={() => { setShowCreateJornada(false); setJornadaDate(''); setJornadaError(null) }}>
                Cancelar
              </GlassButton>
              <GlassButton variant="primary" fullWidth onClick={handleCreateJornada} disabled={jornadaLoading} loading={jornadaLoading}>
                {jornadaLoading ? 'Creando...' : 'Crear'}
              </GlassButton>
            </div>
          </motion.div>
        </div>
      )}

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-6 max-w-sm w-full"
            >
              <div className="text-center mb-4">
                <div className="text-4xl mb-4">🔗</div>
                <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-2">{currentLiga?.name}</h2>
                <p className="text-zinc-400 text-sm mb-4">{currentLiga?.description}</p>
                <p className="text-emerald-300 font-bold text-sm">Te invitaron a unirte a esta liga</p>
              </div>
              <div className="glass-card p-4 mb-6 text-center">
                <p className="text-xs text-zinc-400 mb-2">Miembros</p>
                <p className="text-2xl font-black text-emerald-400">{members?.length || 0}</p>
              </div>
              <div className="flex gap-2">
                <GlassButton variant="secondary" fullWidth onClick={() => setShowInviteModal(false)}>
                  DESCARTAR
                </GlassButton>
                <GlassButton variant="primary" fullWidth onClick={handleJoinLiga} disabled={joiningLiga} loading={joiningLiga}>
                  {joiningLiga ? 'UNIÉNDOSE...' : 'UNIRME'}
                </GlassButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {shareToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-zinc-950 px-6 py-3 rounded-full font-bold text-sm shadow-lg z-50"
          >
            {shareToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Match Share Card Modal */}
      {sharingMatch && (
        <MatchShareCard
          match={sharingMatch}
          ligaName={currentLiga?.name}
          ligaId={id}
          onClose={() => setSharingMatch(null)}
        />
      )}
    </div>
  )
}
