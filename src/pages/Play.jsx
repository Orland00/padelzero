import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useMatchStore } from '@/stores/matchStore'
import { useUiStore } from '@/stores/uiStore'
import { useLigaStore } from '@/stores/ligaStore'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'
import { LIGA_FOREVER_ID, LIGA_PROLEAGUE_ID } from '@/lib/constants'
import GlassButton from '@/components/ui/GlassButton'
import { motion, AnimatePresence } from 'framer-motion'
import CrownBadge from '@/components/CrownBadge'
import { formatRelativeTime } from '@/utils/dateFormatters'

const GAME_MODE_COLORS = {
  quick: 'from-blue-500/20 to-blue-500/5 border-blue-500/30 hover:border-blue-500/50',
  ranked: 'from-purple-500/20 to-purple-500/5 border-purple-500/30 hover:border-purple-500/50',
  league: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50',
  tournament: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30 hover:border-yellow-500/50',
}

function getGameModes(t) {
  return [
    { id: 'quick', label: `⚡ ${t('play.quick')}`, description: t('play.quick_desc'), color: GAME_MODE_COLORS.quick },
    { id: 'ranked', label: `🎯 ${t('play.ranked')}`, description: t('play.ranked_desc'), color: GAME_MODE_COLORS.ranked },
    { id: 'league', label: `⚡ ${t('play.league')}`, description: t('play.league_desc'), color: GAME_MODE_COLORS.league },
    { id: 'tournament', label: `🏆 ${t('play.tournament')}`, description: t('play.tournament_desc'), color: GAME_MODE_COLORS.tournament },
  ]
}

export default function Play() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { fetchMatches } = useMatchStore()
  const { showToast } = useUiStore()
  const { ligas, standings, members, fetchMyLigas, joinLiga } = useLigaStore()
  const { t, lang } = useI18n()

  const [recentMatches, setRecentMatches] = useState([])
  const [activeMatch, setActiveMatch] = useState(null)
  const [recentSessions, setRecentSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [pendingConfirmations, setPendingConfirmations] = useState([])
  const [showQuickSetsModal, setShowQuickSetsModal] = useState(false)
  const [showCreateLigaModal, setShowCreateLigaModal] = useState(false)
  const [ligaForm, setLigaForm] = useState({ name: '', description: '', maxScore: 4, allowGuests: false })
  const [creatingLiga, setCreatingLiga] = useState(false)
  const [createdLiga, setCreatedLiga] = useState(null) // shows join code after creation
  const [challenges, setChallenges] = useState([])
  const [progress, setProgress] = useState({}) // { challenge_id: progress_obj }
  const [quickT1, setQuickT1] = useState('')
  const [quickT2, setQuickT2] = useState('')
  const [quickUseAdvantage, setQuickUseAdvantage] = useState(true)
  const [topCities, setTopCities] = useState([])
  const [foreverMember, setForeverMember] = useState(false)
  const [joiningForever, setJoiningForever] = useState(false)
  const [ligaActivity, setLigaActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [upcomingBooking, setUpcomingBooking] = useState(null)

  // Fetch upcoming coach booking
  useEffect(() => {
    if (!user?.id) return
    const fetchBooking = async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('coach_bookings')
        .select('*, coach:coaches(id, profiles(display_name, avatar_url))')
        .eq('booked_by', user.id)
        .eq('status', 'confirmed')
        .gte('booking_date', today)
        .order('booking_date')
        .order('start_time')
        .limit(1)
        .maybeSingle()
      setUpcomingBooking(data)
    }
    fetchBooking()
  }, [user?.id])

  // Check if user is already in Forever League
  useEffect(() => {
    if (!user) return
    supabase.from('liga_members').select('id').eq('liga_id', LIGA_FOREVER_ID).eq('player_id', user.id).maybeSingle()
      .then(({ data }) => setForeverMember(!!data))
  }, [user])

  // Calculate next Monday
  const getNextMonday = () => {
    const today = new Date()
    const day = today.getDay()
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 9 - day
    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + daysUntilMonday)
    return nextMonday
  }

  // Fetch cities and countries from active users
  useEffect(() => {
    const fetchTopCities = async () => {
      try {
        // Fetch profiles with city and country info
        const { data } = await supabase
          .from('profiles')
          .select('city, country')
          .not('city', 'is', null)

        const cityCount = {}
        const countryCount = {}

        data?.forEach(p => {
          const city = p.city?.trim()
          const country = p.country?.trim()
          if (!city || !country) return
          cityCount[city] = (cityCount[city] || 0) + 1
          countryCount[country] = (countryCount[country] || 0) + 1
        })

        // Combine and format results: show countries with their top cities
        const topCountries = Object.entries(countryCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)

        const formattedCities = topCountries.flatMap(([country, countryTotal]) => {
          const citiesInCountry = Object.entries(cityCount)
            .filter(([city]) => {
              // Get sample to determine country (simplified - in real app, would normalize)
              const citySample = data?.find(p => p.city === city)
              return citySample?.country === country
            })
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)

          return citiesInCountry.map(([city, count]) => ({
            city,
            country,
            count,
            type: 'city'
          }))
        }).slice(0, 5)

        setTopCities(formattedCities)
      } catch (err) {
        // silently fail — cities are optional UI enhancement
      }
    }

    fetchTopCities()
  }, [])

  // Fetch ligas
  useEffect(() => {
    fetchMyLigas()
  }, [fetchMyLigas])

  // Fetch recent liga activity for "Actividad Reciente" section
  useEffect(() => {
    if (!user?.id || ligas.length === 0) return

    const ligaIds = ligas.map(l => l.id)

    const loadLigaActivity = async () => {
      setActivityLoading(true)
      try {
        const events = []

        // Fetch recent liga_matches from user's ligas
        const { data: recentLigaMatches } = await supabase
          .from('liga_matches')
          .select('*, ligas(name), team_a_p1:profiles!liga_matches_team_a_p1_id_fkey(display_name), team_a_p2:profiles!liga_matches_team_a_p2_id_fkey(display_name), team_b_p1:profiles!liga_matches_team_b_p1_id_fkey(display_name), team_b_p2:profiles!liga_matches_team_b_p2_id_fkey(display_name)')
          .in('liga_id', ligaIds)
          .order('played_at', { ascending: false })
          .limit(10)

        recentLigaMatches?.forEach(m => {
          events.push({
            id: `match-${m.id}`,
            type: 'match_played',
            timestamp: m.played_at || m.created_at,
            ligaName: m.ligas?.name,
            data: m,
          })
        })

        // Fetch crown transfers from user's ligas
        const { data: crowns } = await supabase
          .from('crown_history')
          .select('*, profiles:player_id(display_name), dethroned:dethroned_id(display_name), ligas:liga_id(name)')
          .in('liga_id', ligaIds)
          .order('crowned_at', { ascending: false })
          .limit(5)

        crowns?.forEach(c => {
          events.push({
            id: `crown-${c.id}`,
            type: 'crown_transfer',
            timestamp: c.crowned_at,
            ligaName: c.ligas?.name,
            data: c,
          })
        })

        // Fetch new members joining user's ligas
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 14)
        const { data: newMembers } = await supabase
          .from('liga_members')
          .select('*, profiles:player_id(display_name), ligas:liga_id(name)')
          .in('liga_id', ligaIds)
          .gte('joined_at', cutoff.toISOString())
          .order('joined_at', { ascending: false })
          .limit(5)

        newMembers?.forEach(m => {
          events.push({
            id: `member-${m.id}`,
            type: 'new_member',
            timestamp: m.joined_at,
            ligaName: m.ligas?.name,
            data: m,
          })
        })

        // Sort all events by timestamp
        events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        setLigaActivity(events.slice(0, 10))
      } catch (err) {
        // silently fail
      } finally {
        setActivityLoading(false)
      }
    }

    loadLigaActivity()

    // Realtime subscription for liga_matches in user's ligas
    const activityChannel = supabase
      .channel('home-feed')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'liga_matches',
      }, () => {
        loadLigaActivity()
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'crown_history',
      }, () => {
        loadLigaActivity()
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'liga_members',
      }, () => {
        loadLigaActivity()
      })
      .subscribe()

    return () => supabase.removeChannel(activityChannel)
  }, [user?.id, ligas])

  useEffect(() => {
    const loadMatches = async () => {
      setLoading(true)

      // Timeout after 3 seconds to prevent infinite loading
      const timeout = setTimeout(() => setLoading(false), 3000)

      try {
        // Fetch active match (if any)
        const { data: activeList } = await Promise.race([
          supabase
            .from('matches')
            .select('*, p1:profiles!p1_id(display_name, elo_rating), p2:profiles!p2_id(display_name, elo_rating)')
            .eq('finished', false)
            .limit(1),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
        ])

        if (activeList && activeList.length > 0) {
          setActiveMatch(activeList[0])
        }

        // Fetch recent matches
        const { data: recent } = await Promise.race([
          fetchMatches({
            finished: true,
            limit: 5,
            page: 0
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
        ])

        if (recent?.matches) {
          setRecentMatches(recent.matches)
        }

        // Fetch recent sessions
        if (user?.id) {
          const { data: sessData } = await supabase
            .from('sessions')
            .select('id, name, type, status, created_at')
            .eq('created_by', user.id)
            .order('created_at', { ascending: false })
            .limit(3)
          setRecentSessions(sessData || [])
        }
        // Fetch pending confirmations (table may not exist yet)
        try {
          if (user?.id) {
            const { data: pending } = await supabase
              .from('match_confirmations')
              .select('*, match:matches(*, p1:profiles!p1_id(display_name), p2:profiles!p2_id(display_name))')
              .eq('player_id', user.id)
              .eq('status', 'pending')
              .limit(3)
            setPendingConfirmations(pending || [])
          }
        } catch {}

        // Fetch Challenges (table may not exist yet)
        try {
          const { data: cData } = await supabase.from('weekly_challenges').select('id, title, description, reward_points, week_number, is_active, created_at')
          setChallenges(cData || [])

          if (user?.id) {
            const { data: pData } = await supabase
              .from('player_challenge_progress')
              .select('id, profile_id, challenge_id, week_number, progress, completed, completed_at, created_at')
              .eq('profile_id', user.id)
              .eq('week_number', Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000)) + 1)
            if (pData) {
              const pMap = {}
              pData.forEach(p => pMap[p.challenge_id] = p)
              setProgress(pMap)
            }
          }
        } catch {}
      } catch (err) {
        // Silent fail for optional data
      } finally {
        clearTimeout(timeout)
        setLoading(false)
      }
    }

    loadMatches()

    // Realtime: auto-refresh when matches or profiles change
    const channel = supabase
      .channel('play-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => loadMatches())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => loadMatches())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'liga_standings' }, () => fetchMyLigas())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchMatches])

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full mx-auto mb-4"></div>
          <p className="text-zinc-400">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24 glass-ambient">
      {/* Header */}
      <div className="px-4 pt-6">
        <h1 className="text-3xl font-bold text-white mb-2">{lang === 'es' ? '¡Hola!' : 'Hello!'} 👋</h1>
        <p className="text-sm text-zinc-400">{t('play.title')}</p>
      </div>

      {/* Weekly Challenges Widget */}
      {challenges.length > 0 && (
        <div className="px-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase text-zinc-500 tracking-widest">Retos Semanales</h2>
            <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
              Gana ATP extra
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {challenges.map(challenge => {
              const p = progress[challenge.id] || { current_count: 0, is_completed: false }
              const percent = Math.min(100, (p.current_count / challenge.goal_count) * 100)
              
              return (
                <div key={challenge.id} className={`glass-card p-3 transition ${p.is_completed ? 'border-emerald-500/30' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-bold text-white">{challenge.title}</p>
                      <p className="text-[10px] text-zinc-500">{challenge.description}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-black ${p.is_completed ? 'text-emerald-500' : 'text-zinc-400'}`}>
                        +{challenge.reward_elo} ATP
                      </p>
                      <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-tighter">PREMIO</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tighter">
                      <span className={p.is_completed ? 'text-emerald-500' : 'text-zinc-500'}>
                        {p.is_completed ? '¡Completado!' : `Progreso: ${p.current_count}/${challenge.goal_count}`}
                      </span>
                      <span className="text-zinc-600">{Math.round(percent)}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${p.is_completed ? 'bg-emerald-500' : 'bg-zinc-600'}`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pending Confirmations Banner */}
      {pendingConfirmations.length > 0 && (
        <div className="px-4 space-y-2">
          {pendingConfirmations.map(conf => (
            <div key={conf.id} className="glass-card border-yellow-500/30 p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase text-yellow-500 tracking-widest bg-yellow-500/10 px-2 py-0.5 rounded">
                  Confirmación Pendiente
                </span>
                <span className="text-[10px] text-zinc-500">{new Date(conf.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-white text-sm font-bold mb-3">
                ¿Confirmas el resultado contra <span className="text-emerald-400">
                  {conf.match?.p1_id === user.id ? conf.match?.p2?.display_name : conf.match?.p1?.display_name}
                </span>?
              </p>
              <div className="flex gap-2">
                <GlassButton
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={async () => {
                    await supabase.rpc('confirm_match', { m_id: conf.match_id })
                    setPendingConfirmations(prev => prev.filter(p => p.id !== conf.id))
                    showToast({ type: 'success', message: '¡Resultado confirmado!' })
                  }}
                >
                  Confirmar ✅
                </GlassButton>
                <GlassButton
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => navigate(`/match/${conf.match_id}/result`)}
                >
                  Ver Detalle
                </GlassButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Match Card */}
      {activeMatch && (
        <div
          onClick={() => navigate(`/match/${activeMatch.id}`)}
          className="mx-4 glass-card border-emerald-500/30 p-4 cursor-pointer hover:border-emerald-500/50 transition"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-emerald-400 uppercase">Partido en vivo</span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1 text-center">
              <p className="text-white font-semibold text-lg">{activeMatch.p1?.display_name}</p>
              <p className="text-xs text-zinc-400">{Math.round(activeMatch.p1?.elo_rating || 1200)} ATP</p>
            </div>

            <div className="px-4 text-center">
              <p className="text-3xl font-bold text-emerald-500">
                {activeMatch.live_state?.p1_points || 0} - {activeMatch.live_state?.p2_points || 0}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Toca para ver</p>
            </div>

            <div className="flex-1 text-center">
              <p className="text-white font-semibold text-lg">{activeMatch.p2?.display_name}</p>
              <p className="text-xs text-zinc-400">{Math.round(activeMatch.p2?.elo_rating || 1200)} ATP</p>
            </div>
          </div>
        </div>
      )}

      {/* Coaches & Classes Section */}
      <div className="px-4 space-y-3">
        <h2 className="text-xs font-black uppercase text-zinc-500 tracking-widest">Clases y Coaches</h2>
        {upcomingBooking ? (
          <div 
            onClick={() => navigate('/coaches')}
            className="glass-card p-4 border-blue-500/30 flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center border border-blue-500/20">
                {upcomingBooking.coach?.profiles?.avatar_url ? (
                  <img src={upcomingBooking.coach.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">🎓</span>
                )}
              </div>
              <div>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Próxima Clase</p>
                <p className="text-sm font-bold text-white">{upcomingBooking.coach?.profiles?.display_name || 'Coach'}</p>
                <p className="text-xs text-zinc-400">{upcomingBooking.booking_date} · {upcomingBooking.start_time?.substring(0,5)}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl">🎾</span>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => navigate('/coaches')}
            className="w-full glass-card p-4 flex items-center justify-between hover:border-emerald-500/30 transition group"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-2xl group-hover:scale-110 transition">
                🎓
              </div>
              <div>
                <p className="text-sm font-bold text-white">Mejora tu juego</p>
                <p className="text-xs text-zinc-500">Encuentra entrenadores y reserva clases</p>
              </div>
            </div>
            <span className="text-zinc-600 group-hover:text-emerald-400 transition">›</span>
          </button>
        )}
      </div>


      {/* Liga ProLeague Banner at Top */}
      <div className="px-4 pt-4">
        <button
          onClick={() => navigate('/liga-proleague')}
          className="w-full rounded-2xl overflow-hidden relative active:scale-95 transition"
          style={{
            background: 'linear-gradient(135deg, #6b2f9d 0%, #3273dc 100%)',
            boxShadow: '0 4px 20px #6b2f9d55',
          }}
        >
          <div className="absolute top-2 right-12 w-16 h-16 rounded-full opacity-10" style={{ background: '#e3f2fd' }} />
          <div className="absolute bottom-0 right-4 w-10 h-10 rounded-full opacity-15" style={{ background: '#25d366' }} />
          <div className="relative flex items-center gap-3 px-4 py-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border border-white/20"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              <img src="/proleague-logo.png" alt="ProLeague" className="w-7 h-7 object-contain" />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest" style={{ background: '#25d366', color: '#fff' }}>
                  ACTIVO
                </span>
              </div>
              <h1 className="text-white font-black text-base leading-tight">Liga <span style={{ color: '#25d366' }}>ProLeague</span></h1>
              <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.7)' }}>Gestiona 24 jugadores · Juega diariamente</p>
            </div>
            <span className="text-white/60 text-lg">›</span>
          </div>
        </button>
      </div>

      {/* Forever League Banner */}
      <div className="px-4">
        <div className="glass-card overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative flex items-center gap-3 px-4 py-4">
            <button
              onClick={() => navigate(`/liga/${LIGA_FOREVER_ID}`)}
              className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border border-emerald-500/30 bg-emerald-500/10 text-2xl"
            >
              ♾️
            </button>
            <button onClick={() => navigate(`/liga/${LIGA_FOREVER_ID}`)} className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest bg-emerald-400 text-zinc-950">
                  {lang === 'es' ? 'ABIERTA' : 'OPEN'}
                </span>
              </div>
              <h1 className="text-white font-black text-base leading-tight">Liga Infinita ♾️</h1>
              <p className="text-[10px] uppercase font-bold tracking-widest text-white/70">
                {lang === 'es' ? 'Todos juegan · -2 pts si no juegas en la semana' : 'Everyone plays · -2 pts if you skip a week'}
              </p>
            </button>
            {!foreverMember ? (
              <GlassButton
                variant="primary"
                size="sm"
                onClick={async () => {
                  const confirmed = await useUiStore.getState().confirm({
                    title: '⚡ Liga Infinita',
                    message: lang === 'es'
                      ? '• Si no juegas en una semana, pierdes 2 puntos\n• Ganas descuentos en clubes participantes\n• Puedes salirte cuando quieras\n\n¿Unirte?'
                      : '• -2 points if you skip a week\n• Earn discounts at participating clubs\n• You can leave anytime\n\nJoin?',
                  })
                  if (!confirmed) return
                  setJoiningForever(true)
                  try {
                    await joinLiga(LIGA_FOREVER_ID)
                    setForeverMember(true)
                    showToast({ type: 'success', message: lang === 'es' ? '¡Te uniste a Liga Infinita! 🎉' : 'Joined Liga Infinita! 🎉' })
                  } catch (err) {
                    showToast({ type: 'error', message: err.message })
                  } finally {
                    setJoiningForever(false)
                  }
                }}
                loading={joiningForever}
                disabled={joiningForever}
              >
                {lang === 'es' ? 'Unirme' : 'Join'}
              </GlassButton>
            ) : (
              <div className="flex gap-2">
                <GlassButton variant="secondary" size="sm" onClick={() => navigate(`/liga/${LIGA_FOREVER_ID}`)}>
                  {lang === 'es' ? 'Ver' : 'View'}
                </GlassButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Game Mode Selection */}
      {!showJoinForm && (
        <div className="px-4 pt-4 space-y-2">
          {getGameModes(t).map((mode) => (
            <div
              key={mode.id}
              onClick={() => {
                if (mode.id === 'quick') {
                  setShowQuickSetsModal(true)
                } else if (mode.id === 'tournament') {
                  navigate('/create-tournament')
                } else if (mode.id === 'league') {
                  setShowCreateLigaModal(true)
                } else {
                  navigate('/create-match', { state: { gameMode: mode.id } })
                }
              }}
              className="glass-card relative w-full p-4 text-left transition active:scale-95 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">{mode.label}</p>
                  <p className="text-xs text-zinc-400 mt-1">{mode.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Buscar partido card (Updated: 2026-05-08) ──────────────────── */}
      <div className="px-4">
        <button
          onClick={() => navigate('/partidos-abiertos')}
          className="w-full rounded-xl border border-emerald-600/30 bg-emerald-900/10 p-4 flex items-center gap-4 hover:bg-emerald-900/20 transition text-left"
        >
          <span className="text-3xl">🔍</span>
          <div>
            <p className="font-semibold text-zinc-100">
              {lang === 'es' ? 'Buscar partido' : 'Find a match'}
            </p>
            <p className="text-sm text-zinc-400 mt-0.5">
              {lang === 'es' ? 'Únete a un partido abierto cerca de tu nivel' : 'Join an open match near your level'}
            </p>
          </div>
        </button>
      </div>

      {/* Join by Code (Zoom-style) */}
      <div className="px-4">
        <GlassButton
          variant={showJoinForm ? 'secondary' : 'ghost'}
          fullWidth
          onClick={() => setShowJoinForm(!showJoinForm)}
        >
          {showJoinForm ? '← Atrás' : '📋 Tengo un código'}
        </GlassButton>

        {showJoinForm && (
          <div className="mt-3 space-y-3">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Ingresa el código de liga o torneo</p>
            <input
              type="text"
              placeholder="ej: ABC123"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="glass-input w-full text-center text-lg font-mono tracking-widest"
              maxLength={10}
            />
            <button
              onClick={async () => {
                if (!joinCode.trim()) return
                const code = joinCode.trim()

                try {
                  // Search ligas first
                  const { data: ligaData } = await supabase
                    .from('ligas')
                    .select('id, name, description, join_code')
                    .eq('join_code', code)
                    .eq('is_active', true)
                    .maybeSingle()

                  if (ligaData) {
                    navigate(`/liga/${ligaData.id}?invite=true`)
                    setJoinCode('')
                    setShowJoinForm(false)
                    return
                  }

                  // Search tournaments
                  const { data: tourneyData } = await supabase
                    .from('tournaments')
                    .select('id, name, join_code')
                    .eq('join_code', code)
                    .maybeSingle()

                  if (tourneyData) {
                    navigate(`/tournament/${tourneyData.id}`)
                    setJoinCode('')
                    setShowJoinForm(false)
                    return
                  }

                  showToast({ type: 'error', message: 'Código no encontrado. Verifica e intenta de nuevo.' })
                } catch {
                  showToast({ type: 'error', message: 'Error al buscar. Intenta de nuevo.' })
                }
              }}
              disabled={!joinCode.trim()}
              className="glass-btn glass-primary glass-btn-md glass-btn-full"
            >
              Buscar y Unirse
            </button>
          </div>
        )}
      </div>

      {/* My Ligas */}
      {ligas.length > 0 && (
        <div className="px-4 space-y-2">
          <h2 className="text-xs font-black uppercase text-zinc-500 tracking-widest">Mis Ligas</h2>
          {ligas.map(liga => (
            <div
              key={liga.id}
              onClick={() => navigate(`/liga/${liga.id}`)}
              className="glass-card p-3 flex items-center justify-between cursor-pointer transition"
            >
              <div>
                <p className="text-white text-sm font-bold">{liga.name}</p>
                <p className="text-xs text-zinc-500">{liga.description || 'Liga'}</p>
              </div>
              <span className="text-emerald-400 text-xs font-bold">ENTRAR →</span>
            </div>
          ))}
        </div>
      )}

      {/* Sponsored Tournaments Row */}
      <div className="px-4 grid grid-cols-1 gap-3">
        {/* Torneo La DemoClub Banner - Próximamente */}
        <div
          className="w-full rounded-2xl overflow-hidden relative border border-zinc-800 opacity-50"
          style={{
            background: 'linear-gradient(135deg, #000 0%, #27272a 100%)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <div className="relative flex items-center gap-3 px-4 py-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border border-white/10"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              <span className="text-2xl">🐺</span>
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-black px-2 py-0.5 bg-zinc-700 text-zinc-200 rounded uppercase tracking-widest">
                  PRÓXIMAMENTE
                </span>
              </div>
              <h1 className="text-white font-black text-base leading-tight uppercase tracking-tighter">Torneo <span className="italic">La DemoClub</span></h1>
              <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-600">Mexico City Elite · 2026</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Matches */}
      {recentMatches.length > 0 && (
        <div className="px-4 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase">Partidos recientes</h2>

          {recentMatches.map((match) => (
            <div
              key={match.id}
              onClick={() => navigate(`/match/${match.id}/result`)}
              className="glass-card p-3 cursor-pointer transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500">{formatDate(match.created_at)}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${
                  match.finished ? 'bg-zinc-800 text-zinc-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {match.finished ? 'Finalizado' : 'En vivo'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">{match.p1?.display_name}</p>
                </div>

                <div className="px-3 text-center">
                  <p className="text-lg font-bold text-zinc-300">
                    {match.live_state?.p1_points || 0} - {match.live_state?.p2_points || 0}
                  </p>
                </div>

                <div className="flex-1 text-right">
                  <p className="text-white font-semibold text-sm">{match.p2?.display_name}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mis Sesiones */}
      {recentSessions.length > 0 && (
        <div className="px-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase">Mis Sesiones</h2>
            <button
              onClick={() => navigate('/sessions')}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition"
            >
              Ver todas →
            </button>
          </div>
          {recentSessions.map(sess => (
            <div
              key={sess.id}
              onClick={() => navigate(`/session/${sess.id}`)}
              className="glass-card p-3 flex items-center justify-between cursor-pointer transition"
            >
              <div>
                <p className="text-white text-sm font-medium">{sess.name || (sess.type === 'league' ? 'Liga Rápida' : 'Torneo')}</p>
                <p className="text-xs text-zinc-500">{sess.type === 'league' ? 'Liga' : 'Torneo'} · {new Date(sess.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                sess.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                sess.status === 'finished' ? 'bg-zinc-800 text-zinc-500' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {sess.status === 'active' ? 'Activa' : sess.status === 'finished' ? 'Finalizada' : 'Configuración'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Actividad Reciente — Liga Activity Feed */}
      {ligas.length > 0 && (
        <div className="px-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase text-zinc-500 tracking-widest">{t('feed.recent_activity')}</h2>
            <button
              onClick={() => navigate('/social')}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition"
            >
              {t('feed.see_all')} →
            </button>
          </div>

          {activityLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 glass-card animate-pulse" />
              ))}
            </div>
          ) : ligaActivity.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-zinc-500 text-sm">{t('feed.no_activity')}</p>
            </div>
          ) : (
            ligaActivity.map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass-card p-3 ${
                  event.type === 'crown_transfer' ? 'border-amber-500/20' :
                  event.type === 'new_member' ? 'border-purple-500/20' :
                  'border-zinc-800'
                }`}
              >
                {event.type === 'match_played' && (
                  <>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                        {event.ligaName || t('feed.match_played')}
                      </span>
                      <span className="text-[10px] text-zinc-600">{formatRelativeTime(event.timestamp)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {event.data.team_a_p1?.display_name}
                          {event.data.team_a_p2?.display_name ? ` + ${event.data.team_a_p2.display_name}` : ''}
                        </p>
                      </div>
                      <div className="px-3 text-center">
                        <span className="text-sm font-black text-zinc-300">
                          {event.data.score_a ?? 0}-{event.data.score_b ?? 0}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-xs font-bold text-white truncate">
                          {event.data.team_b_p1?.display_name}
                          {event.data.team_b_p2?.display_name ? ` + ${event.data.team_b_p2.display_name}` : ''}
                        </p>
                      </div>
                    </div>
                    {(event.data.elo_change_a != null && event.data.elo_change_a !== 0) && (
                      <p className="text-[10px] text-zinc-500 mt-1">
                        ATP: <span className={event.data.elo_change_a > 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {event.data.elo_change_a > 0 ? '+' : ''}{event.data.elo_change_a}
                        </span>
                        {' / '}
                        <span className={event.data.elo_change_b > 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {event.data.elo_change_b > 0 ? '+' : ''}{event.data.elo_change_b}
                        </span>
                      </p>
                    )}
                  </>
                )}

                {event.type === 'crown_transfer' && (
                  <div className="flex items-center gap-3">
                    <span className="text-xl">👑</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-amber-300 truncate">
                        {event.data.profiles?.display_name} {lang === 'es' ? 'recibió la corona' : 'received the crown'}
                      </p>
                      {event.data.dethroned?.display_name && (
                        <p className="text-[10px] text-zinc-500 truncate">
                          {lang === 'es' ? 'Destronó a' : 'Dethroned'} {event.data.dethroned.display_name}
                        </p>
                      )}
                      <p className="text-[10px] text-zinc-600">{event.ligaName} · {formatRelativeTime(event.timestamp)}</p>
                    </div>
                  </div>
                )}

                {event.type === 'new_member' && (
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🎉</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-purple-300 truncate">
                        {event.data.profiles?.display_name} {lang === 'es' ? 'se unió a' : 'joined'} {event.ligaName}
                      </p>
                      <p className="text-[10px] text-zinc-600">{formatRelativeTime(event.timestamp)}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Empty State */}
      {!activeMatch && recentMatches.length === 0 && recentSessions.length === 0 && (
        <div className="px-4 py-12 text-center">
          <p className="text-zinc-400 mb-4">Sin partidos aún</p>
          <p className="text-xs text-zinc-500">¡Selecciona un modo de juego para comenzar!</p>
        </div>
      )}

      {/* ATP Guide Link */}
      <div className="px-4 pb-6 pt-2">
        <button
          onClick={() => navigate('/elo-guide')}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#6b2f9d]/20 to-[#3273dc]/20 border border-[#6b2f9d]/30 rounded-xl text-sm text-zinc-400 hover:text-white transition"
        >
          <span className="text-base">📊</span>
          <span className="font-medium">¿Cómo funciona el ATP?</span>
        </button>
      </div>

      {/* Quick Match Sets Modal */}
      {/* Create Liga Modal */}
      <AnimatePresence>
        {showCreateLigaModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => { setShowCreateLigaModal(false); setCreatedLiga(null) }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="glass-card p-6 max-w-md w-full"
            >
              {createdLiga ? (
                /* Success screen with join code */
                <div className="text-center space-y-4">
                  <p className="text-emerald-400 text-4xl">✅</p>
                  <h2 className="text-xl font-bold text-white">Liga Creada</h2>
                  <p className="text-zinc-400 text-sm">Comparte este código para que otros se unan:</p>
                  <div className="bg-zinc-800 border border-emerald-500/30 rounded-xl p-4">
                    <p className="text-3xl font-mono font-black text-emerald-400 tracking-widest">{createdLiga.join_code}</p>
                  </div>
                  <GlassButton
                    variant="secondary"
                    fullWidth
                    onClick={() => {
                      navigator.clipboard?.writeText(createdLiga.join_code)
                      showToast({ type: 'success', message: 'Código copiado' })
                    }}
                  >
                    📋 COPIAR CÓDIGO
                  </GlassButton>
                  <GlassButton
                    variant="primary"
                    fullWidth
                    onClick={() => {
                      setShowCreateLigaModal(false)
                      setCreatedLiga(null)
                      navigate(`/liga/${createdLiga.id}`)
                    }}
                  >
                    IR A MI LIGA →
                  </GlassButton>
                </div>
              ) : (
                /* Create form */
                <>
                  <h2 className="text-xl font-bold text-white mb-4">CREAR NUEVA LIGA</h2>
                  <form onSubmit={async (e) => {
                    e.preventDefault()
                    if (!ligaForm.name.trim()) return
                    setCreatingLiga(true)
                    try {
                      const { createLiga } = useLigaStore.getState()
                      const liga = await createLiga(ligaForm.name, ligaForm.description, { days: [], time: '' })
                      if (ligaForm.maxScore && ligaForm.maxScore !== 4) {
                        await supabase.from('ligas').update({ max_score: ligaForm.maxScore }).eq('id', liga.id)
                      }
                      // Fetch the liga with join_code
                      const { data: fullLiga } = await supabase.from('ligas').select('id, name, join_code').eq('id', liga.id).single()
                      setLigaForm({ name: '', description: '', maxScore: 4 })
                      setCreatedLiga(fullLiga || liga)
                      fetchMyLigas()
                    } catch (err) {
                      showToast({ type: 'error', message: err.message || 'Error al crear liga' })
                    } finally {
                      setCreatingLiga(false)
                    }
                  }} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Nombre *</label>
                      <input
                        type="text"
                        placeholder="Ej: Liga Demo Brand"
                        value={ligaForm.name}
                        onChange={e => setLigaForm({ ...ligaForm, name: e.target.value })}
                        className="glass-input w-full"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Descripción</label>
                      <textarea
                        placeholder="Descripción de la liga (opcional)"
                        value={ligaForm.description}
                        onChange={e => setLigaForm({ ...ligaForm, description: e.target.value })}
                        className="glass-input w-full h-20 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Puntos máximos por partido</label>
                      <div className="flex gap-2">
                        {[3, 4, 5, 6, 7].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setLigaForm({ ...ligaForm, maxScore: n })}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition border ${
                              ligaForm.maxScore === n
                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                                : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-zinc-800 border border-zinc-700 rounded-lg">
                      <div>
                        <p className="text-xs font-bold text-zinc-300">¿Habrá jugadores sin cuenta?</p>
                        <p className="text-[10px] text-zinc-500">Si sí, los partidos NO impactan el ATP oficial</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLigaForm({ ...ligaForm, allowGuests: !ligaForm.allowGuests })}
                        className={`w-12 h-6 rounded-full transition-colors relative ${ligaForm.allowGuests ? 'bg-yellow-500' : 'bg-zinc-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${ligaForm.allowGuests ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    {ligaForm.allowGuests && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                        <p className="text-[10px] text-yellow-400 font-bold">⚠️ Los partidos en esta liga NO afectarán el ATP oficial de ningún jugador.</p>
                      </div>
                    )}
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Al crear la liga:</p>
                      <ul className="text-[10px] text-zinc-400 space-y-0.5">
                        <li>• Tú serás el admin/dueño</li>
                        <li>• Se genera un código para invitar</li>
                        <li>• {ligaForm.allowGuests ? 'ATP no oficial (hay invitados)' : 'Los partidos participan en el ATP'}</li>
                      </ul>
                    </div>
                    <div className="flex gap-3">
                      <GlassButton variant="secondary" fullWidth onClick={() => setShowCreateLigaModal(false)} type="button">
                        CANCELAR
                      </GlassButton>
                      <GlassButton variant="primary" fullWidth type="submit" disabled={creatingLiga || !ligaForm.name.trim()} loading={creatingLiga}>
                        {creatingLiga ? 'CREANDO...' : 'CREAR'}
                      </GlassButton>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showQuickSetsModal && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="glass-card p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-bold text-white">Juego Rápido</h2>

            {/* Team names */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-blue-400 font-semibold block mb-1">Equipo 1</label>
                <input
                  type="text"
                  placeholder="Team A"
                  value={quickT1}
                  onChange={e => setQuickT1(e.target.value)}
                  className="glass-input w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-pink-400 font-semibold block mb-1">Equipo 2</label>
                <input
                  type="text"
                  placeholder="Team B"
                  value={quickT2}
                  onChange={e => setQuickT2(e.target.value)}
                  className="glass-input w-full text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-xl">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Ventaja (Punto Oro)</span>
              <button 
                onClick={() => setQuickUseAdvantage(!quickUseAdvantage)}
                className={`w-12 h-6 rounded-full transition-colors relative ${quickUseAdvantage ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${quickUseAdvantage ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Sets Section */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Modo Sets</p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { label: 'Best of 1', sets: 1 },
                    { label: 'Best of 2', sets: 2 },
                    { label: 'Best of 3', sets: 3 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => {
                        setShowQuickSetsModal(false)
                        navigate('/match/local', {
                          state: {
                            isPointsMode: false,
                            setsToWin: opt.sets,
                            useAdvantage: quickUseAdvantage,
                            t1Name: quickT1.trim() || 'Team A',
                            t2Name: quickT2.trim() || 'Team B',
                          }
                        })
                      }}
                      className="glass-btn glass-secondary glass-btn-md glass-btn-full"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Points Section */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest pl-1">Modo Puntos (15, 30, 40...)</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '1 de 1', win: 1 },
                    { label: '3 de 2', win: 2 },
                    { label: '4 de 3', win: 3 },
                    { label: '5 de 4', win: 4 },
                    { label: '6 de 5', win: 5 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => {
                        setShowQuickSetsModal(false)
                        navigate('/match/local', {
                          state: {
                            isPointsMode: false,
                            isShortMatch: true,
                            gamesToWinMatch: opt.win,
                            useAdvantage: quickUseAdvantage,
                            t1Name: quickT1.trim() || 'Team A',
                            t2Name: quickT2.trim() || 'Team B',
                          }
                        })
                      }}
                      className="glass-btn glass-primary glass-btn-md glass-btn-full"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <GlassButton variant="ghost" fullWidth onClick={() => setShowQuickSetsModal(false)}>
              Cancelar
            </GlassButton>
          </div>
        </div>
      )}
    </div>
  )
}
