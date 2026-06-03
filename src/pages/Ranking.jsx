import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useUiStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import TennisballLoader from '@/components/TennisballLoader'
import GlassButton from '@/components/ui/GlassButton'
import EloBadge from '@/components/EloBadge'
import PlayerLevelBadge from '@/components/PlayerLevelBadge'
import { eloToLevel } from '@/utils/eloEngine'

const RANKING_PROFILE_COLUMNS = 'id, display_name, username, avatar_url, city, country, zone, phone, elo_rating, matches_played, level, showcase_medal_ids, is_founder, last_title_won_at'
const SEASON_COLUMNS = 'id, name, start_date, end_date, is_active'
const FRIENDSHIP_COLUMNS = 'id, status, requester_id, addressee_id, created_at, updated_at'

/**
 * Ranking Page Component
 * 
 * Displays player leaderboards across different scopes: local (city), national (country), 
 * global, and friends. Includes real-time updates and ATP tier filtering.
 * 
 * Updated: 2026-04-29
 */
export default function Ranking() {
  const navigate = useNavigate()
  const { showToast } = useUiStore()
  const { user, profile } = useAuthStore()
  const { t } = useI18n()

  const [tab, setTab] = useState('local')             // 'local' | 'nacional' | 'global' | 'amigos'
  const [tierFilter, setTierFilter] = useState('all')  // 'all' | 'bronce' | 'plata' | 'oro' | 'platino' | 'diamante'
  const [levelFilter, setLevelFilter] = useState('all') // 'all' | 'beginner' | 'intermediate' | 'advanced' | 'elite'
  const [searchQuery, setSearchQuery] = useState('')

  const [global, setGlobal] = useState([])
  const [nacional, setNacional] = useState([])
  const [local, setLocal] = useState([])
  const [amigos, setAmigos] = useState([])
  const [loading, setLoading] = useState(true)
  const [friendships, setFriendships] = useState({})   // playerId -> {id, status, requester_id}
  const [fsLoading, setFsLoading] = useState({})
  const [activeSeason, setActiveSeason] = useState(null)

  /**
   * Fetches all ranking data on mount or when user context changes.
   * Handles global, national, local, and friend lists.
   */
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        // Global: top 100
        const { data: globData, error: globErr } = await supabase
          .from('profiles')
          .select(RANKING_PROFILE_COLUMNS)
          .order('elo_rating', { ascending: false })
          .limit(100)
        if (globErr) throw globErr
        setGlobal(globData || [])

        // Fetch Active Season (table may not exist yet)
        try {
          const { data: sData } = await supabase
            .from('seasons')
            .select(SEASON_COLUMNS)
            .eq('is_active', true)
            .maybeSingle()
          setActiveSeason(sData)
        } catch {}

        // Nacional: players in same country
        if (profile?.country) {
          const { data: nacData } = await supabase
            .from('profiles')
            .select(RANKING_PROFILE_COLUMNS)
            .eq('country', profile.country)
            .order('elo_rating', { ascending: false })
            .limit(100)
          setNacional(nacData || [])
        } else {
          // Fallback or just empty
          setNacional([])
        }

        // Local: players in same city (or zone)
        const cityFilter = profile?.city || profile?.zone
        if (cityFilter) {
          const { data: locData } = await supabase
            .from('profiles')
            .select(RANKING_PROFILE_COLUMNS)
            .or(`city.eq."${cityFilter.replace(/[,.()"']/g, '')}",zone.eq."${cityFilter.replace(/[,.()"']/g, '')}"`)

            .order('elo_rating', { ascending: false })
            .limit(50)
          setLocal(locData || [])
        } else {
          setLocal([])
        }

        // Friendships + amigos profiles
        if (user?.id) {
          const { data: fsData } = await supabase
            .from('friendships')
            .select('id, status, requester_id, addressee_id')
            .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

          if (fsData) {
            const map = {}
            fsData.forEach(f => {
              const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id
              map[otherId] = f
            })
            setFriendships(map)

            // Fetch profiles of accepted friends
            const friendIds = fsData
              .filter(f => f.status === 'accepted')
              .map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)

            if (friendIds.length > 0) {
              const { data: friendProfiles } = await supabase
                .from('profiles')
                .select(RANKING_PROFILE_COLUMNS)
                .in('id', friendIds)
                .order('elo_rating', { ascending: false })
              setAmigos(friendProfiles || [])
            } else {
              setAmigos([])
            }
          }
        }
      } catch (err) {
        showToast({ type: 'error', message: 'Error al cargar ranking', duration: 3000 })
      } finally {
        setLoading(false)
      }
    }
    fetchAll()

    // Real-time subscription for ATP changes
    const channel = supabase
      .channel('ranking-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const updated = payload.new
        // Helper to update a list with the new profile data and re-sort
        const updateList = (prev) => {
          const index = prev.findIndex(p => p.id === updated.id)
          if (index === -1) return prev
          const newList = [...prev]
          newList[index] = { ...newList[index], ...updated }
          return newList.sort((a, b) => (b.elo_rating || 0) - (a.elo_rating || 0))
        }

        setNacional(prev => updateList(prev))
        setLocal(prev => updateList(prev))
        setAmigos(prev => updateList(prev))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, profile?.zone, showToast])

  /**
   * Handles friend requests, acceptance, and removal.
   * Updates local state to provide immediate feedback.
   */
  const handleFriendAction = async (e, player) => {
    e.stopPropagation()
    if (!user?.id || user.id === player.id) return
    const existing = friendships[player.id]
    setFsLoading(p => ({ ...p, [player.id]: true }))

    if (!existing) {
      const { data, error } = await supabase
        .from('friendships')
        .insert({ requester_id: user.id, addressee_id: player.id })
        .select(FRIENDSHIP_COLUMNS).single()
      if (!error) {
        setFriendships(f => ({ ...f, [player.id]: data }))
        showToast({ type: 'success', message: `Solicitud enviada a ${player.display_name}`, duration: 2000 })
      }
    } else if (existing.status === 'pending' && existing.requester_id === user.id) {
      await supabase.from('friendships').delete().eq('id', existing.id)
      setFriendships(f => { const n = { ...f }; delete n[player.id]; return n })
    } else if (existing.status === 'pending' && existing.addressee_id === user.id) {
      const { data } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', existing.id).select(FRIENDSHIP_COLUMNS).single()
      if (data) {
        setFriendships(f => ({ ...f, [player.id]: data }))
        // Add to amigos list
        setAmigos(a => [...a, player].sort((x, y) => (y.elo_rating || 0) - (x.elo_rating || 0)))
        showToast({ type: 'success', message: `¡Ahora eres amigo de ${player.display_name}!`, duration: 2000 })
      }
    } else if (existing.status === 'accepted') {
      await supabase.from('friendships').delete().eq('id', existing.id)
      setFriendships(f => { const n = { ...f }; delete n[player.id]; return n })
      setAmigos(a => a.filter(p => p.id !== player.id))
    }

    setFsLoading(p => ({ ...p, [player.id]: false }))
  }

  const getFriendIcon = (player) => {
    if (!user?.id || user.id === player.id) return null
    const fs = friendships[player.id]
    if (!fs) return { icon: '+', title: 'Agregar amigo', cls: 'text-zinc-400 hover:text-emerald-400' }
    if (fs.status === 'accepted') return { icon: '✓', title: 'Amigos (toca para eliminar)', cls: 'text-emerald-400 hover:text-red-400' }
    if (fs.status === 'pending' && fs.requester_id === user.id) return { icon: '⏳', title: 'Solicitud enviada', cls: 'text-yellow-400' }
    if (fs.status === 'pending' && fs.addressee_id === user.id) return { icon: '!', title: 'Aceptar solicitud', cls: 'text-blue-400 hover:text-emerald-400' }
    return null
  }

  const hasRecentTitle = (p) =>
    p?.last_title_won_at &&
    new Date(p.last_title_won_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  /**
   * Maps ATP rating to a tier key for filtering.
   * Matches tiers defined in EloBadge component.
   */
  const getTierKey = (elo) => {
    if (elo < 1400) return 'bronce'
    if (elo < 1600) return 'plata'
    if (elo < 1800) return 'oro'
    if (elo < 2000) return 'platino'
    return 'diamante'
  }

  const applyTierFilter = (list) =>
    tierFilter === 'all' ? list : list.filter(p => getTierKey(p.elo_rating || 1200) === tierFilter)

  // Apply level filter (Updated: 2026-05-07)
  const filterByLevel = (players) => {
    if (levelFilter === 'all') return players
    return players.filter(p => {
      const lvl = p.level ?? eloToLevel(p.elo_rating ?? 1200)
      if (levelFilter === 'beginner')     return lvl < 2.0
      if (levelFilter === 'intermediate') return lvl >= 2.0 && lvl < 4.0
      if (levelFilter === 'advanced')     return lvl >= 4.0 && lvl < 5.5
      if (levelFilter === 'elite')        return lvl >= 5.5
      return true
    })
  }

  // Pick active list
  const activeList = tab === 'amigos' ? amigos : tab === 'nacional' ? nacional : tab === 'local' ? local : global

  const applySearch = (list) => {
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase().trim()
    return list.filter(p =>
      p.display_name?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.phone?.endsWith(q)
    )
  }

  const filteredPlayers = applySearch(filterByLevel(applyTierFilter(activeList)))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 flex-col gap-4">
        <TennisballLoader size="lg" />
        <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest">{t('ranking.loading')}</p>
      </div>
    )
  }

  /**
   * Main render logic for the Ranking page.
   * Includes tabs, search, filters, and the player list.
   */
  return (
    <div className="space-y-3 pb-24 glass-ambient">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600/20 via-zinc-900 to-zinc-900 border-b border-zinc-800 px-4 py-6">
        <h1 className="text-2xl font-black text-white uppercase tracking-widest">
          padel<span className="text-emerald-400">ZERO</span>
        </h1>
        <p className="text-zinc-400 text-sm mt-1">{t('ranking.title')}</p>
        <button
          onClick={() => navigate('/calculator')}
          className="mt-2 inline-flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full hover:bg-purple-500/20 transition"
        >
          <span>🧮</span>
          <span>{t('calculator.title')}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'local',    label: t('ranking.local'),    color: 'emerald' },
            { key: 'nacional', label: t('ranking.national'), color: 'purple' },
            { key: 'global',   label: t('ranking.global'),   color: 'cyan' },
            { key: 'amigos',   label: t('ranking.friends'),  color: 'amber' },
          ].map(tb => (
            <GlassButton
              key={tb.key}
              pill
              pillColor={tab === tb.key ? tb.color : undefined}
              variant={tab === tb.key ? 'primary' : 'ghost'}
              onClick={() => {
                setTab(tb.key)
                setTierFilter('all')
              }}
              className="flex-1 text-[10px] font-bold uppercase tracking-widest"
            >
              {tb.label}
              {tb.key === 'amigos' && amigos.length > 0 && (
                <span className="ml-1 opacity-70">({amigos.length})</span>
              )}
            </GlassButton>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('ranking.search_placeholder')}
            className="glass-input !pl-9 !pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Local Ranking */}
      {tab === 'local' && (
        <div className="px-4">
          {!(profile?.city || profile?.zone) ? (
            <div className="glass-card p-6 text-center space-y-2">
              <p className="text-2xl">📍</p>
              <p className="text-white font-bold uppercase tracking-widest text-xs">{t('ranking.local_title')}</p>
              <p className="text-xs text-zinc-500">{t('ranking.configure_city')}</p>
              <GlassButton variant="secondary" size="xs" onClick={() => navigate('/profile')} className="mt-2">
                {t('ranking.configure_profile')}
              </GlassButton>
            </div>
          ) : local.length === 1 ? (
            <div className="glass-card p-6 text-center">
              <p className="text-xs text-zinc-500 font-medium">{t('ranking.only_one_local', { city: profile?.city || profile?.zone })}</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Nacional Ranking Empty State */}
      {tab === 'nacional' && (
        <div className="px-4">
          {!profile?.country ? (
            <div className="glass-card p-6 text-center space-y-2">
              <p className="text-2xl">🇲🇽</p>
              <p className="text-white font-bold uppercase tracking-widest text-xs">{t('ranking.national_title')}</p>
              <p className="text-xs text-zinc-500">{t('ranking.configure_country')}</p>
              <GlassButton variant="secondary" size="xs" onClick={() => navigate('/profile')} className="mt-2">
                {t('ranking.configure_profile')}
              </GlassButton>
            </div>
          ) : nacional.length === 1 ? (
             <div className="glass-card p-6 text-center">
               <p className="text-xs text-zinc-500 font-medium">{t('ranking.only_one_national', { country: profile.country })}</p>
             </div>
          ) : null}
        </div>
      )}

      {/* Amigos empty state */}
      {tab === 'amigos' && amigos.length === 0 && (
        <div className="px-4">
          <div className="glass-card p-6 text-center space-y-2">
            <p className="text-2xl">👥</p>
            {!user ? (
              <>
                <p className="text-white font-semibold">{t('ranking.no_friends_login')}</p>
                <p className="text-xs text-zinc-500">{t('ranking.no_friends_desc')}</p>
                <GlassButton variant="primary" size="sm" onClick={() => navigate('/')} className="mt-2">
                  {t('auth.login')}
                </GlassButton>
              </>
            ) : (
              <>
                <p className="text-white font-semibold">{t('ranking.no_friends_yet')}</p>
                <p className="text-sm text-zinc-400">{t('ranking.add_friends_desc')}</p>
                <GlassButton variant="primary" size="sm" onClick={() => setTab('nacional')} className="mt-2">
                  {t('ranking.view_national')}
                </GlassButton>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tier filter */}
      {!(tab === 'amigos' && amigos.length === 0) && (
        <div className="px-4 flex gap-2 flex-wrap">
          {['all', 'bronce', 'plata', 'oro', 'platino', 'diamante'].map((f) => {
            const tierPillColors = { all: 'emerald', bronce: 'amber', plata: 'slate', oro: 'amber', platino: 'cyan', diamante: 'purple' }
            return (
              <GlassButton
                key={f}
                pill
                pillColor={tierFilter === f ? tierPillColors[f] : undefined}
                variant={tierFilter === f ? 'primary' : 'ghost'}
                onClick={() => setTierFilter(f)}
                className="text-[10px] font-bold uppercase tracking-widest"
              >
                {f === 'all' ? t('ranking.all_tiers') : f}
              </GlassButton>
            )
          })}
        </div>
      )}

      {/* ─── Level filter tabs (Updated: 2026-05-07) ───────────────────── */}
      {!(tab === 'amigos' && amigos.length === 0) && (
        <div className="px-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'beginner', label: '0–2' },
            { key: 'intermediate', label: '2–4' },
            { key: 'advanced', label: '4–5.5' },
            { key: 'elite', label: '5.5+' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setLevelFilter(f.key)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition ${
                levelFilter === f.key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Season Banner */}
      {activeSeason && (
        <div className="px-4">
          <div className="glass-card p-3 flex items-center justify-between" style={{ borderColor: 'rgba(16,185,129,0.2)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl">
                🏆
              </div>
              <div>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">{activeSeason.name}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">{t('ranking.ends_in')}</p>
                  <p className="text-sm font-black text-emerald-400">
                    {Math.ceil((new Date(activeSeason.end_date) - new Date()) / (1000 * 60 * 60 * 24))} {t('ranking.days')}
                  </p>
                </div>
              </div>
            </div>
            <GlassButton variant="ghost" size="xs" className="!min-h-0 !py-1 !px-2 text-[10px]">
              {t('ranking.prizes')}
            </GlassButton>
          </div>
        </div>
      )}

      {/* List */}
      {!(tab === 'amigos' && amigos.length === 0) && (
        <div className="px-4 space-y-2">
          {filteredPlayers.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              {tierFilter === 'all' ? t('ranking.no_players') : t('ranking.no_players_tier', { tier: tierFilter })}
            </div>
          ) : (
            filteredPlayers.map((player, idx) => (
              <div
                key={player.id}
                onClick={() => navigate(player.id === user?.id ? '/profile' : `/player/${player.id}`)}
                className={`glass-card !rounded-2xl p-3 flex items-center gap-3 cursor-pointer transition ${
                  player.id === user?.id ? 'ring-1 ring-emerald-500/40' : ''
                }`}
              >
                <div className="text-center font-bold text-zinc-400 w-8 text-sm">#{idx + 1}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-white font-semibold truncate">{player.display_name}</p>
                    <PlayerLevelBadge
                      level={player.level ?? eloToLevel(player.elo_rating ?? 1200)}
                      matchesPlayed={player.matches_played}
                      size="sm"
                      className="ml-1"
                    />
                    {idx === 0 && (tab === 'local' || tab === 'club') && (
                      <span className="text-sm" title="Héroe Local #1">🏅</span>
                    )}
                    {hasRecentTitle(player) && (
                    <span className="text-base leading-none flex-shrink-0" title="Campeón reciente">👑</span>
                  )}
                  {/* Showcase Medals */}
                  {(player.showcase_medal_ids || []).slice(0, 3).map(mid => (
                    <span key={mid} className="text-[10px] flex-shrink-0 opacity-80" title={mid.replace('_', ' ')}>
                      {mid === 'first_win' ? '🏸' : mid === 'ten_matches' ? '🏅' : mid === 'elite_ranking' ? '💎' : mid === 'founder' ? '👑' : '🎖️'}
                    </span>
                  ))}
                  {player.is_founder && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">🏆</span>
                    )}
                    {player.id === user?.id && (
                      <span className="text-xs text-emerald-400 font-medium flex-shrink-0">{t('ranking.you')}</span>
                    )}
                  </div>
                  {player.username && (
                    <p className="text-xs text-zinc-600 truncate">@{player.username}</p>
                  )}
                  <div className="mt-1">
                    <EloBadge elo={player.elo_rating} />
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-emerald-500 font-bold">{Math.round(player.elo_rating || 1200)}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-tighter font-bold">{player.matches_played || 0} {t('ranking.matches_short')}</p>
                </div>

                {/* Friend button */}
                {(() => {
                  const fi = getFriendIcon(player)
                  if (!fi) return null
                  return (
                    <GlassButton
                      variant="ghost"
                      size="icon"
                      className={`!w-8 !h-8 !min-h-0 !rounded-full flex-shrink-0 font-bold text-sm ${fi.cls}`}
                      onClick={e => handleFriendAction(e, player)}
                      disabled={fsLoading[player.id]}
                      loading={fsLoading[player.id]}
                      title={fi.title}
                    >
                      {fi.icon}
                    </GlassButton>
                  )
                })()}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
