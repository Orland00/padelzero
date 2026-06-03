import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useMatchStore } from '@/stores/matchStore'
import { useLigaStore } from '@/stores/ligaStore'
import { useI18n } from '@/lib/i18n'
import { formatRelativeTime } from '@/utils/dateFormatters'
import PlayerAvatar from '@/components/PlayerAvatar'
import GlassButton from '@/components/ui/GlassButton'

export default function Feed({ hideHeader = false }) {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { fetchMatches } = useMatchStore()
  const { ligas, fetchMyLigas } = useLigaStore()
  const { t, lang } = useI18n()
  const [matches, setMatches] = useState([])
  const [ligaEvents, setLigaEvents] = useState([])
  const [filter, setFilter] = useState('global') // 'global', 'zone', or 'ligas'
  const [loading, setLoading] = useState(true)

  // Fetch ligas on mount
  useEffect(() => {
    if (user?.id) fetchMyLigas()
  }, [user?.id])

  // Load liga events (crown transfers, new members, badges)
  useEffect(() => {
    if (filter !== 'ligas' || !user?.id) return

    const loadLigaEvents = async () => {
      setLoading(true)
      try {
        const events = []
        const ligaIds = ligas.map(l => l.id)
        if (ligaIds.length === 0) {
          setLigaEvents([])
          setLoading(false)
          return
        }

        // Liga matches
        const { data: ligaMatches } = await supabase
          .from('liga_matches')
          .select('*, ligas(name), team_a_p1:profiles!liga_matches_team_a_p1_id_fkey(display_name, avatar_url), team_a_p2:profiles!liga_matches_team_a_p2_id_fkey(display_name, avatar_url), team_b_p1:profiles!liga_matches_team_b_p1_id_fkey(display_name, avatar_url), team_b_p2:profiles!liga_matches_team_b_p2_id_fkey(display_name, avatar_url)')
          .in('liga_id', ligaIds)
          .order('played_at', { ascending: false })
          .limit(15)

        ligaMatches?.forEach(m => {
          events.push({
            id: `lm-${m.id}`,
            type: 'match_played',
            timestamp: m.played_at || m.created_at,
            ligaName: m.ligas?.name,
            data: m,
          })
        })

        // Crown transfers
        const { data: crowns } = await supabase
          .from('crown_history')
          .select('*, profiles:player_id(display_name, avatar_url), dethroned:dethroned_id(display_name, avatar_url), ligas:liga_id(name)')
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

        // New members
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 30)
        const { data: members } = await supabase
          .from('liga_members')
          .select('*, profiles:player_id(display_name, avatar_url), ligas:liga_id(name)')
          .in('liga_id', ligaIds)
          .gte('joined_at', cutoff.toISOString())
          .order('joined_at', { ascending: false })
          .limit(10)

        members?.forEach(m => {
          events.push({
            id: `member-${m.id}`,
            type: 'new_member',
            timestamp: m.joined_at,
            ligaName: m.ligas?.name,
            data: m,
          })
        })

        // Player badges (if table exists)
        try {
          const { data: badges } = await supabase
            .from('player_badges')
            .select('*, profiles:player_id(display_name, avatar_url)')
            .gte('earned_at', cutoff.toISOString())
            .order('earned_at', { ascending: false })
            .limit(5)

          badges?.forEach(b => {
            events.push({
              id: `badge-${b.id}`,
              type: 'badge_earned',
              timestamp: b.earned_at,
              data: b,
            })
          })
        } catch {} // table may not exist

        events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        setLigaEvents(events)
      } catch (err) {
        // silently fail
      } finally {
        setLoading(false)
      }
    }

    loadLigaEvents()

    // Realtime for liga events
    const channel = supabase
      .channel('feed-liga-events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'liga_matches' }, () => loadLigaEvents())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crown_history' }, () => loadLigaEvents())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'liga_members' }, () => loadLigaEvents())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [filter, user?.id, ligas])

  useEffect(() => {
    if (filter === 'ligas') return // handled above

    const loadMatches = async () => {
      setLoading(true)

      let query = supabase
        .from('matches')
        .select(`
          *,
          p1:profiles!p1_id(display_name, avatar_url, elo_rating, zone),
          p1b:profiles!p1b_id(display_name, avatar_url, elo_rating, zone),
          p2:profiles!p2_id(display_name, avatar_url, elo_rating, zone),
          p2b:profiles!p2b_id(display_name, avatar_url, elo_rating, zone),
          club:clubs(name)
        `)
        .order('created_at', { ascending: false })
        .limit(20)

      if (filter === 'zone' && profile?.zone) {
        const safeZone = (profile.zone || '').replace(/[%_\\,.()"']/g, '')
        query = query.or(`p1.zone.eq.${safeZone},p2.zone.eq.${safeZone}`)
      }

      const { data, error } = await query
      if (!error) setMatches(data || [])
      setLoading(false)
    }

    loadMatches()

    // Subscribe to real-time updates
    const channel = supabase
      .channel('social-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        loadMatches()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [filter, profile?.zone])

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Header */}
      {!hideHeader && (
        <div className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 px-4 pt-6 pb-4">
          <h1 className="text-2xl font-black text-white italic tracking-tighter mb-4">FEED <span className="text-emerald-500">SOCIAL</span></h1>

          <div className="flex gap-2">
            <GlassButton
              pill
              pillColor={filter === 'global' ? 'cyan' : undefined}
              variant={filter === 'global' ? 'secondary' : 'ghost'}
              onClick={() => setFilter('global')}
              className="flex-1 text-xs font-bold"
            >
              GLOBAL
            </GlassButton>
            <GlassButton
              pill
              pillColor={filter === 'zone' ? 'emerald' : undefined}
              variant={filter === 'zone' ? 'primary' : 'ghost'}
              onClick={() => setFilter('zone')}
              className="flex-1 text-xs font-bold"
            >
              {profile?.zone ? `ZONA: ${profile.zone.toUpperCase()}` : 'MI ZONA'}
            </GlassButton>
            {user && (
              <GlassButton
                pill
                pillColor={filter === 'ligas' ? 'amber' : undefined}
                variant={filter === 'ligas' ? 'primary' : 'ghost'}
                onClick={() => setFilter('ligas')}
                className="flex-1 text-xs font-bold"
              >
                {lang === 'es' ? 'MIS LIGAS' : 'MY LIGAS'}
              </GlassButton>
            )}
          </div>
        </div>
      )}

      {/* Feed Content */}
      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-full h-40 glass-card animate-pulse" />
            ))}
          </div>
        ) : filter === 'ligas' ? (
          /* Liga Events Feed */
          ligaEvents.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-zinc-500 text-sm">{t('feed.no_activity')}</p>
            </div>
          ) : (
            ligaEvents.map(event => (
              <div key={event.id} className={`glass-card overflow-hidden ${
                event.type === 'crown_transfer' ? 'border-amber-500/20' :
                event.type === 'new_member' ? 'border-purple-500/20' :
                event.type === 'badge_earned' ? 'border-yellow-500/20' :
                ''
              }`}>
                {/* Event Header */}
                <div className="px-4 py-2.5 flex items-center justify-between bg-white/[0.03] border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {event.type === 'match_played' ? '🎾' :
                       event.type === 'crown_transfer' ? '👑' :
                       event.type === 'new_member' ? '🎉' :
                       event.type === 'badge_earned' ? '🏅' : '📌'}
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      event.type === 'match_played' ? 'text-emerald-500' :
                      event.type === 'crown_transfer' ? 'text-amber-400' :
                      event.type === 'new_member' ? 'text-purple-400' :
                      event.type === 'badge_earned' ? 'text-yellow-400' : 'text-zinc-500'
                    }`}>
                      {event.ligaName || t(`feed.${event.type}`)}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-600 font-bold">{formatRelativeTime(event.timestamp)}</span>
                </div>

                {/* Event Content */}
                <div className="p-4">
                  {event.type === 'match_played' && (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {event.data.team_a_p1?.avatar_url && (
                              <PlayerAvatar avatarUrl={event.data.team_a_p1.avatar_url} displayName={event.data.team_a_p1.display_name} size="sm" />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{event.data.team_a_p1?.display_name}</p>
                              {event.data.team_a_p2 && <p className="text-[10px] text-zinc-500 truncate">{event.data.team_a_p2.display_name}</p>}
                            </div>
                          </div>
                        </div>
                        <div className="px-4 text-center">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-black text-zinc-400">{event.data.score_a ?? 0}</span>
                            <span className="text-zinc-700 font-black">-</span>
                            <span className="text-2xl font-black text-zinc-400">{event.data.score_b ?? 0}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{event.data.team_b_p1?.display_name}</p>
                              {event.data.team_b_p2 && <p className="text-[10px] text-zinc-500 truncate">{event.data.team_b_p2.display_name}</p>}
                            </div>
                            {event.data.team_b_p1?.avatar_url && (
                              <PlayerAvatar avatarUrl={event.data.team_b_p1.avatar_url} displayName={event.data.team_b_p1.display_name} size="sm" />
                            )}
                          </div>
                        </div>
                      </div>
                      {(event.data.elo_change_a != null && event.data.elo_change_a !== 0) && (
                        <div className="mt-2 pt-2 border-t border-white/[0.06] text-[10px] text-zinc-500">
                          ATP: <span className={event.data.elo_change_a > 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {event.data.elo_change_a > 0 ? '+' : ''}{event.data.elo_change_a}
                          </span>
                          {' / '}
                          <span className={event.data.elo_change_b > 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {event.data.elo_change_b > 0 ? '+' : ''}{event.data.elo_change_b}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {event.type === 'crown_transfer' && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-amber-300">
                          {event.data.profiles?.display_name} {lang === 'es' ? 'recibió la corona' : 'received the crown'}
                        </p>
                        {event.data.dethroned?.display_name && (
                          <p className="text-xs text-zinc-400 mt-1">
                            {lang === 'es' ? 'Destronó a' : 'Dethroned'} {event.data.dethroned.display_name}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {event.type === 'new_member' && (
                    <p className="text-sm font-bold text-purple-300">
                      {event.data.profiles?.display_name} {lang === 'es' ? 'se unió a' : 'joined'} {event.ligaName}
                    </p>
                  )}

                  {event.type === 'badge_earned' && (
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{event.data.badge_icon || '🏅'}</span>
                      <div>
                        <p className="text-sm font-bold text-yellow-300">{event.data.badge_name || t('feed.badge_earned')}</p>
                        <p className="text-xs text-zinc-400">{event.data.profiles?.display_name}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )
        ) : matches.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-zinc-500 text-sm">{t('feed.no_activity')}</p>
          </div>
        ) : (
          matches.map(match => (
            <div
              key={match.id}
              onClick={() => navigate(match.finished ? `/match/${match.id}/result` : `/match/${match.id}`)}
              className="glass-card overflow-hidden active:scale-[0.98] transition"
            >
              {/* Card Header */}
              <div className="px-4 py-3 flex items-center justify-between bg-white/[0.03] border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${match.finished ? 'bg-zinc-700' : 'bg-emerald-500 animate-pulse'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    {match.finished ? 'Finalizado' : 'Partido en Vivo'}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-600 font-bold">{formatRelativeTime(match.created_at)}</span>
              </div>

              {/* Match Content */}
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  {/* Team 1 */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <PlayerAvatar
                        avatarUrl={match.p1?.avatar_url}
                        displayName={match.p1?.display_name}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{match.p1?.display_name}</p>
                        {match.p1b && <p className="text-[10px] text-zinc-500 truncate">{match.p1b?.display_name}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="px-4 text-center">
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-black ${match.finished ? 'text-zinc-400' : 'text-emerald-400'}`}>
                        {match.live_state?.p1_points || 0}
                      </span>
                      <span className="text-zinc-700 font-black">-</span>
                      <span className={`text-2xl font-black ${match.finished ? 'text-zinc-400' : 'text-pink-400'}`}>
                        {match.live_state?.p2_points || 0}
                      </span>
                    </div>
                    {match.tipo === 'ranked' && (
                      <span className="text-[8px] font-black uppercase text-purple-500/80 bg-purple-500/10 px-1 rounded">Ranked</span>
                    )}
                  </div>

                  {/* Team 2 */}
                  <div className="flex-1 space-y-2 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{match.p2?.display_name}</p>
                        {match.p2b && <p className="text-[10px] text-zinc-500 truncate">{match.p2b?.display_name}</p>}
                      </div>
                      <PlayerAvatar
                        avatarUrl={match.p2?.avatar_url}
                        displayName={match.p2?.display_name}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                  <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-tighter">
                    📍 {match.club?.name || 'Club Privado'} {match.court_number && `· C${match.court_number}`}
                  </p>
                  {match.finished && (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-zinc-500">ATP Logueado</span>
                      <span className="text-emerald-400 text-[10px] font-black">✓</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
