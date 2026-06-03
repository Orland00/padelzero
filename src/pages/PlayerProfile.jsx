import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'
import GlassButton from '@/components/ui/GlassButton'
import EloBadge from '@/components/EloBadge'
import PlayerLevelBadge from '@/components/PlayerLevelBadge'
import MatchConfirmCard from '@/components/MatchConfirmCard'
import { usePlayerStore } from '@/stores/playerStore'
import FollowButton from '@/components/FollowButton'
import AchievementsGrid from '@/components/AchievementsGrid'
import { useSocialStore } from '@/stores/socialStore'
import { formatDateSafe, formatDisplayName } from '@/utils/dateFormatters'

/**
 * PlayerProfile Page Component
 *
 * Public-facing profile for players. Shows stats, medals, badges,
 * head-to-head comparison with the currently logged-in user,
 * follow button, and achievements grid.
 *
 * Updated: 2026-05-07
 */

const hasRecentTitle = (p) =>
  p?.last_title_won_at &&
  new Date(p.last_title_won_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

const MATCH_HISTORY_COLUMNS = 'id, p1_id, p1b_id, p2_id, p2b_id, winner_id, sets, finished, created_at, played_at, confirmation_status, tipo'
const FRIENDSHIP_COLUMNS = 'id, status, requester_id, addressee_id, created_at, updated_at'
const PROFILE_MEDAL_COLUMNS = 'id, profile_id, medal_id, awarded_at, medal:medals(id, name, description, icon_text, rarity)'
const PLAYER_BADGE_COLUMNS = 'id, player_id, badge_id, unlocked_at, badges(id, name_es, name_en, icon, rarity, criteria_json)'
const BADGE_COLUMNS = 'id, name_es, name_en, icon, rarity, criteria_json'
const H2H_MATCH_COLUMNS = 'id, team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id, score_team_a, score_team_b, created_at'

export default function PlayerProfile() {
  const { id: playerId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { showToast } = useUiStore()
  const { t, lang } = useI18n()

  const [playerProfile, setPlayerProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [matchHistory, setMatchHistory] = useState([])
  const [friendship, setFriendship] = useState(null) // null | {id, status, requester_id}
  const [fsLoading, setFsLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false) // Added
  const [medals, setMedals] = useState([])
  const [localRank, setLocalRank] = useState(null) // Added
  const [h2h, setH2h] = useState(null) // Head-to-head stats
  const [pairStats, setPairStats] = useState([]) // Pair chemistry stats
  const [playerBadges, setPlayerBadges] = useState([]) // Earned badges
  const [allBadges, setAllBadges] = useState([]) // All available badges
  const fileInputRef = useRef(null) // Added

  const isOwnProfile = user?.id === playerId
  const { history, loadHistory, pendingConfirmations, loadPendingConfirmations } = usePlayerStore()
  const { achievements } = useSocialStore()

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true)
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, level_self, favorite_club_id, elo_rating, matches_played, matches_won, win_streak, best_streak, elo_peak, is_founder, created_at, updated_at, username, avatar_url, preferred_position, zone, last_match_at, city, country, last_title_won_at, favorite_club, is_dummy, preferred_language, level, preferred_side, achievements, role')
          .eq('id', playerId).single()
        if (profileError) throw profileError
        setPlayerProfile(profileData)

        // Load rating history (Updated: 2026-05-07)
        usePlayerStore.getState().loadHistory(playerId, true)

        // Load pending confirmations for own profile (Updated: 2026-05-07)
        if (user?.id === playerId) {
          usePlayerStore.getState().loadPendingConfirmations(playerId)
        }

        // Load social data (Updated: 2026-05-07)
        useSocialStore.getState().loadAchievements(playerId)
        if (user?.id) useSocialStore.getState().loadFollowing(user.id)

        const { data: matchData } = await supabase
          .from('matches').select(MATCH_HISTORY_COLUMNS)
          .or(`p1_id.eq.${playerId},p2_id.eq.${playerId}`)
          .eq('finished', true).order('created_at', { ascending: false }).limit(10)
        setMatchHistory(matchData || [])

        // Load friendship status
        if (user?.id && user.id !== playerId) {
          const { data: fsData } = await supabase
            .from('friendships').select(FRIENDSHIP_COLUMNS)
            .or(`and(requester_id.eq.${user.id},addressee_id.eq.${playerId}),and(requester_id.eq.${playerId},addressee_id.eq.${user.id})`)
            .maybeSingle()
          setFriendship(fsData)
        }

        // Fetch Medals (table may not exist yet)
        try {
          const { data: medalData } = await supabase
            .from('profile_medals')
            .select(PROFILE_MEDAL_COLUMNS)
            .eq('profile_id', playerId)
            .order('awarded_at', { ascending: false })
          setMedals(medalData || [])
        } catch { setMedals([]) }

        // Fetch Badges
        try {
          const [{ data: pbData }, { data: abData }] = await Promise.all([
            supabase.from('player_badges').select(PLAYER_BADGE_COLUMNS).eq('player_id', playerId),
            supabase.from('badges').select(BADGE_COLUMNS),
          ])
          setPlayerBadges(pbData || [])
          setAllBadges(abData || [])
        } catch { setPlayerBadges([]); setAllBadges([]) }

        // Fetch Local Rank
        if (profileData.zone) {
          const { data: zonePlayers } = await supabase
            .from('profiles')
            .select('id')
            .eq('zone', profileData.zone)
            .order('elo_rating', { ascending: false })

          if (zonePlayers) {
            const rank = zonePlayers.findIndex(p => p.id === playerId) + 1 // Changed to playerId from targetId
            if (rank <= 10) setLocalRank(rank)
          }
        }

        // Fetch Head-to-Head stats (only when viewing another player)
        if (user?.id && user.id !== playerId) {
          const { data: h2hMatches } = await supabase
            .from('liga_matches')
            .select(H2H_MATCH_COLUMNS)
            .or([
              `and(team_a_player1_id.eq.${user.id},team_b_player1_id.eq.${playerId})`,
              `and(team_a_player1_id.eq.${user.id},team_b_player2_id.eq.${playerId})`,
              `and(team_a_player2_id.eq.${user.id},team_b_player1_id.eq.${playerId})`,
              `and(team_a_player2_id.eq.${user.id},team_b_player2_id.eq.${playerId})`,
              `and(team_b_player1_id.eq.${user.id},team_a_player1_id.eq.${playerId})`,
              `and(team_b_player1_id.eq.${user.id},team_a_player2_id.eq.${playerId})`,
              `and(team_b_player2_id.eq.${user.id},team_a_player1_id.eq.${playerId})`,
              `and(team_b_player2_id.eq.${user.id},team_a_player2_id.eq.${playerId})`,
            ].join(','))
            .order('created_at', { ascending: false })

          if (h2hMatches && h2hMatches.length > 0) {
            let wins = 0, losses = 0, totalDiff = 0
            h2hMatches.forEach(m => {
              const meInA = m.team_a_player1_id === user.id || m.team_a_player2_id === user.id
              const aWon = m.score_team_a > m.score_team_b
              const diff = meInA
                ? m.score_team_a - m.score_team_b
                : m.score_team_b - m.score_team_a
              totalDiff += diff
              if ((meInA && aWon) || (!meInA && !aWon)) wins++
              else losses++
            })
            const avgDiff = (totalDiff / h2hMatches.length).toFixed(1)
            const last5 = h2hMatches.slice(0, 5).map(m => {
              const meInA = m.team_a_player1_id === user.id || m.team_a_player2_id === user.id
              return {
                date: m.created_at,
                scoreA: m.score_team_a,
                scoreB: m.score_team_b,
                won: meInA ? m.score_team_a > m.score_team_b : m.score_team_b > m.score_team_a,
              }
            })
            setH2h({ wins, losses, total: h2hMatches.length, lastMatch: h2hMatches[0], avgDiff, last5 })
          }
        }
        // Fetch Pair Chemistry stats
        try {
          const { data: allMatches } = await supabase
            .from('liga_matches')
            .select('team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id, score_team_a, score_team_b')
            .or(`team_a_player1_id.eq.${playerId},team_a_player2_id.eq.${playerId},team_b_player1_id.eq.${playerId},team_b_player2_id.eq.${playerId}`)

          if (allMatches && allMatches.length > 0) {
            const partnerMap = {}
            allMatches.forEach(m => {
              const inA = m.team_a_player1_id === playerId || m.team_a_player2_id === playerId
              let partnerId = null
              if (inA) {
                partnerId = m.team_a_player1_id === playerId ? m.team_a_player2_id : m.team_a_player1_id
              } else {
                partnerId = m.team_b_player1_id === playerId ? m.team_b_player2_id : m.team_b_player1_id
              }
              if (!partnerId) return // solo match or no partner
              if (!partnerMap[partnerId]) partnerMap[partnerId] = { matches: 0, wins: 0, totalDiff: 0 }
              partnerMap[partnerId].matches++
              const won = inA ? m.score_team_a > m.score_team_b : m.score_team_b > m.score_team_a
              if (won) partnerMap[partnerId].wins++
              const diff = inA ? m.score_team_a - m.score_team_b : m.score_team_b - m.score_team_a
              partnerMap[partnerId].totalDiff += diff
            })
            // Filter min 3 matches, sort by win rate
            const partnerIds = Object.keys(partnerMap).filter(id => partnerMap[id].matches >= 3)
            if (partnerIds.length > 0) {
              const { data: partnerProfiles } = await supabase
                .from('profiles')
                .select('id, display_name, avatar_url')
                .in('id', partnerIds)
              const statsArr = partnerIds.map(id => {
                const s = partnerMap[id]
                const profile = partnerProfiles?.find(p => p.id === id)
                return {
                  id,
                  name: formatDisplayName(profile?.display_name),
                  avatar_url: profile?.avatar_url,
                  matches: s.matches,
                  wins: s.wins,
                  winRate: Math.round((s.wins / s.matches) * 100),
                  avgDiff: (s.totalDiff / s.matches).toFixed(1),
                }
              }).sort((a, b) => b.winRate - a.winRate).slice(0, 5)
              setPairStats(statsArr)
            }
          }
        } catch { /* pair stats are optional */ }

      } catch (err) {
        showToast({ type: 'error', message: 'Error al cargar perfil', duration: 3000 })
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [playerId, user?.id, showToast])

  const handleAddFriend = async () => {
    setFsLoading(true)
    const { data, error } = await supabase
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: playerId })
      .select(FRIENDSHIP_COLUMNS).single()
    setFsLoading(false)
    if (error) {
      showToast({ type: 'error', message: 'Error al enviar solicitud', duration: 2000 })
    } else {
      setFriendship(data)
      showToast({ type: 'success', message: 'Solicitud enviada', duration: 2000 })
    }
  }

  const handleAcceptFriend = async () => {
    setFsLoading(true)
    const { data, error } = await supabase
      .from('friendships').update({ status: 'accepted' }).eq('id', friendship.id).select(FRIENDSHIP_COLUMNS).single()
    setFsLoading(false)
    if (!error) {
      setFriendship(data)
      showToast({ type: 'success', message: '¡Ahora son amigos!', duration: 2000 })
    }
  }

  const handleRemoveFriend = async () => {
    setFsLoading(true)
    await supabase.from('friendships').delete().eq('id', friendship.id)
    setFsLoading(false)
    setFriendship(null)
    showToast({ type: 'success', message: 'Amistad eliminada', duration: 2000 })
  }

  const FriendButton = () => {
    if (isOwnProfile || !user) return null
    if (fsLoading) return (
      <div className="px-4 py-2 bg-zinc-800 rounded-lg text-zinc-400 text-sm flex items-center gap-2">
        <div className="w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
    if (!friendship) return (
      <GlassButton variant="primary" size="sm" onClick={handleAddFriend}>
        {t('player.add_friend')}
      </GlassButton>
    )
    if (friendship.status === 'pending' && friendship.requester_id === user.id) return (
      <GlassButton variant="secondary" size="sm" onClick={handleRemoveFriend}>
        {t('player.request_sent')} ✓ ({t('common.cancel')})
      </GlassButton>
    )
    if (friendship.status === 'pending' && friendship.addressee_id === user.id) return (
      <div className="flex gap-2">
        <GlassButton variant="primary" size="sm" onClick={handleAcceptFriend}>
          {t('player.accept')}
        </GlassButton>
        <GlassButton variant="secondary" size="sm" onClick={handleRemoveFriend}>
          {t('player.reject_friend')}
        </GlassButton>
      </div>
    )
    if (friendship.status === 'accepted') return (
      <GlassButton variant="danger" size="sm" onClick={handleRemoveFriend}>
        {t('player.friends')} ✓ ({t('common.delete')})
      </GlassButton>
    )
    return null
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full mx-auto mb-4"></div>
        <p className="text-zinc-400">{t('player.loading')}</p>
      </div>
    </div>
  )

  if (!playerProfile) return (
    <div className="p-8 text-center space-y-4">
      <p className="text-zinc-400">{t('player.profile_not_found')}</p>
      <GlassButton variant="ghost" size="sm" onClick={() => navigate(-1)}>
        ← {t('common.back')}
      </GlassButton>
    </div>
  )

  return (
    <div className="space-y-4 pb-24 bg-zinc-950 min-h-screen glass-ambient">
      {/* Back button */}
      <div className="px-4 pt-4">
        <GlassButton variant="ghost" size="xs" onClick={() => navigate(-1)}>
          ← {t('common.back')}
        </GlassButton>
      </div>
      <div className="bg-gradient-to-b from-emerald-500/10 to-transparent px-4 pt-4 pb-4 border-b border-zinc-900">
        <div className="flex flex-col items-center text-center">
            {/* Avatar Section */}
            <div className="relative mb-4">
              {playerProfile.avatar_url ? (
                <img
                  src={playerProfile.avatar_url}
                  alt={playerProfile.display_name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-emerald-500 shadow-xl shadow-emerald-500/20" style={{ borderTopColor: 'rgba(255,255,255,0.4)' }}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-4 border-emerald-500 flex items-center justify-center" style={{ borderTopColor: 'rgba(255,255,255,0.4)' }}>
                  <span className="text-4xl font-bold text-emerald-400">
                    {formatDisplayName(playerProfile.display_name, 'Jugador').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {hasRecentTitle(playerProfile) && (
                <span className="absolute -top-1 -right-1 text-3xl drop-shadow-md">👑</span>
              )}
            </div>

            <h1 className="text-2xl font-black text-white flex items-center gap-2 flex-wrap justify-center">
              {playerProfile.display_name}
              {playerProfile.current_streak >= 3 && (
                <span className="text-xl animate-pulse" title={`${playerProfile.current_streak} victorias seguidas`}>🔥</span>
              )}
              {playerProfile.level != null && (
                <PlayerLevelBadge
                  level={playerProfile.level}
                  matchesPlayed={playerProfile.matches_played}
                  size="lg"
                />
              )}
            </h1>

            {/* Follow button (Updated: 2026-05-07) */}
            <FollowButton targetId={playerId} />

            {playerProfile.username && (
              <p className="text-sm text-zinc-500 mb-2">@{playerProfile.username}</p>
            )}

            <div className="flex justify-center mb-4">
              <EloBadge elo={playerProfile.elo_rating} showIcon className="scale-110" />
            </div>

            <div className="flex justify-center gap-2 mb-6">
              {localRank && (
                <span className="text-[10px] bg-zinc-900 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full font-bold uppercase tracking-tighter">
                  #{localRank} en {playerProfile.zone}
                </span>
              )}
              {playerProfile.level_self && (
                <span className="text-[10px] font-black uppercase tracking-widest bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full border border-zinc-700">
                  Lvl {playerProfile.level_self}
                </span>
              )}
            </div>

            <div className="flex gap-4 items-center">
               <div className="glass-card px-6 py-2" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
                 <p className="text-[10px] text-zinc-400 uppercase font-black mb-1">Rating ATP</p>
                 <p className="text-2xl font-black text-emerald-500">{Math.round(playerProfile.elo_rating || 1200)}</p>
               </div>
               <FriendButton />
            </div>
        </div>
      </div>

      <div className="px-4 grid grid-cols-3 gap-3">
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-zinc-400 mb-1">{t('player.matches_label')}</p>
          <p className="text-2xl font-bold text-white">{playerProfile.matches_played || 0}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-zinc-400 mb-1">{t('player.won')}</p>
          <p className="text-2xl font-bold text-emerald-500">{playerProfile.matches_won || 0}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-zinc-400 mb-1">Win%</p>
          <p className="text-2xl font-bold text-white">
            {playerProfile.matches_played > 0
              ? Math.round((playerProfile.matches_won / playerProfile.matches_played) * 100)
              : 0}%
          </p>
        </div>
        <div className="glass-card p-3 text-center" style={{ borderColor: 'rgba(251,146,60,0.2)' }}>
          <p className="text-xs text-zinc-400 mb-1">{t('player.streak')}</p>
          <p className="text-2xl font-bold text-orange-500">
            {playerProfile.current_streak || 0}
          </p>
        </div>
      </div>

      {/* Medals Showcase */}
      {medals.length > 0 && (
        <div className="px-4 space-y-2">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <span>{t('player.medals')}</span>
            <span className="bg-zinc-800 text-zinc-500 text-[10px] px-1.5 py-0.5 rounded-full">{medals.length}</span>
          </h2>
          <div className="flex flex-wrap gap-3">
            {medals.map(({ medal, awarded_at }) => (
              <div 
                key={medal.id} 
                className={`relative group flex flex-col items-center justify-center p-3 rounded-2xl border transition-all hover:scale-105 active:scale-95 w-[90px] h-[90px] text-center ${
                  medal.rarity === 'legendary' ? 'bg-yellow-500/10 border-yellow-500/30' :
                  medal.rarity === 'epic' ? 'bg-purple-500/10 border-purple-500/30' :
                  medal.rarity === 'rare' ? 'bg-blue-500/10 border-blue-500/30' :
                  'bg-zinc-900 border-zinc-800'
                }`}
              >
                <div className="text-3xl mb-1 drop-shadow-md">{medal.icon_text}</div>
                <p className="text-[10px] font-bold text-white uppercase leading-tight line-clamp-2">{medal.name}</p>
                
                {/* Tooltip on hover */}
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10 pointer-events-none">
                  {medal.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Badges / Logros */}
      {allBadges.length > 0 && (
        <div className="px-4 space-y-2">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <span>{t('badges.section_title')}</span>
            <span className="bg-zinc-800 text-zinc-500 text-[10px] px-1.5 py-0.5 rounded-full">
              {playerBadges.length}/{allBadges.length}
            </span>
          </h2>
          <div className="flex flex-wrap gap-3">
            {allBadges.map((badge) => {
              const earned = playerBadges.find(pb => pb.badge_id === badge.id)
              const rarity = badge.rarity || 'common'
              const rarityStyles = {
                common: 'border-zinc-700 bg-zinc-900',
                rare: 'border-blue-500/40 bg-blue-500/10 shadow-[0_0_8px_rgba(59,130,246,0.15)]',
                epic: 'border-purple-500/40 bg-purple-500/10 shadow-[0_0_12px_rgba(168,85,247,0.2)]',
                legendary: 'border-amber-500/40 bg-amber-500/10 shadow-[0_0_16px_rgba(245,158,11,0.25)]',
              }
              const rarityLabel = t(`badges.rarity_${rarity}`)
              const rarityTextColor = {
                common: 'text-zinc-500',
                rare: 'text-blue-400',
                epic: 'text-purple-400',
                legendary: 'text-amber-400',
              }
              return (
                <div
                  key={badge.id}
                  className={`relative group flex flex-col items-center justify-center p-3 rounded-2xl border transition-all w-[90px] h-[100px] text-center ${
                    earned ? rarityStyles[rarity] : 'border-zinc-800 bg-zinc-900/50 opacity-40'
                  }`}
                >
                  <div className={`text-2xl mb-1 ${earned ? '' : 'grayscale'}`}>
                    {badge.icon || '🏅'}
                  </div>
                  <p className="text-[10px] font-bold text-white uppercase leading-tight line-clamp-2">
                    {lang === 'en' ? (badge.name_en || badge.name_es) : badge.name_es}
                  </p>
                  <p className={`text-[8px] font-semibold mt-0.5 ${rarityTextColor[rarity]}`}>
                    {rarityLabel}
                  </p>

                  {/* Tooltip */}
                  <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10 pointer-events-none max-w-[160px] text-center">
                    {earned
                      ? t('badges.earned_on').replace('{date}', formatDateSafe(earned.earned_at, { month: 'short', day: 'numeric' }, lang === 'en' ? 'Date pending' : 'Fecha pendiente'))
                      : badge.criteria_json?.description || t('badges.how_to_earn')
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Head-to-Head */}
      {h2h && !isOwnProfile && (
        <div className="px-4">
          <div className="glass-card p-4">
            <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">
              {t('player.history_vs')} {playerProfile?.display_name}
            </h2>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-400">{h2h.wins}</p>
                <p className="text-[10px] text-zinc-500 uppercase font-bold">{t('player.wins')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-red-400">{h2h.losses}</p>
                <p className="text-[10px] text-zinc-500 uppercase font-bold">{t('player.losses')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-zinc-300">
                  {h2h.total > 0 ? Math.round((h2h.wins / h2h.total) * 100) : 0}%
                </p>
                <p className="text-[10px] text-zinc-500 uppercase font-bold">{t('player.victories')}</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-black ${parseFloat(h2h.avgDiff) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {parseFloat(h2h.avgDiff) > 0 ? '+' : ''}{h2h.avgDiff}
                </p>
                <p className="text-[10px] text-zinc-500 uppercase font-bold">{t('player.h2h_avg_diff')}</p>
              </div>
            </div>

            {/* Last 5 meetings */}
            {h2h.last5 && h2h.last5.length > 0 && (
              <div className="mt-4 pt-3 border-t border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-2">{t('player.h2h_last_meetings')}</p>
                <div className="space-y-1.5">
                  {h2h.last5.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">
                        {formatDateSafe(m.date, { month: 'short', day: 'numeric' }, lang === 'en' ? 'Date pending' : 'Fecha pendiente')}
                      </span>
                      <span className="font-mono text-zinc-300">{m.scoreA} - {m.scoreB}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.won ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {m.won ? 'W' : 'L'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Best Partners / Pair Chemistry */}
      {pairStats.length > 0 && (
        <div className="px-4">
          <div className="glass-card p-4">
            <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">
              {t('player.best_partners')}
            </h2>
            <div className="space-y-3">
              {pairStats.map((partner) => (
                <div
                  key={partner.id}
                  className="flex items-center gap-3 cursor-pointer hover:bg-zinc-800/50 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => navigate(`/player/${partner.id}`)}
                >
                  {partner.avatar_url ? (
                    <img src={partner.avatar_url} alt={partner.name} className="w-9 h-9 rounded-full object-cover border-2 border-zinc-700" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center">
                      <span className="text-sm font-bold text-zinc-400">{(partner.name || '?')[0].toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate">{partner.name}</p>
                      <span className="text-xs">
                        {partner.winRate > 70 ? '\uD83D\uDD25' : partner.winRate > 50 ? '\u2728' : '\uD83D\uDCAA'}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500">
                      {t('player.matches_together').replace('{n}', partner.matches)} · {partner.wins}W
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-400">{partner.winRate}%</p>
                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${partner.winRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {matchHistory.length > 0 && (
        <div className="px-4 space-y-2">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase">{t('player.recent_matches')}</h2>
          {matchHistory.map((match) => {
            const isTeam1 = match.p1_id === playerId || match.p1b_id === playerId
            const won = isTeam1
              ? (match.winner_id === match.p1_id || match.winner_id === match.p1b_id)
              : (match.winner_id === match.p2_id || match.winner_id === match.p2b_id)
            return (
              <div key={match.id} className="glass-card p-3 text-sm">
                <p className="text-xs text-zinc-500 mb-1">{formatDateSafe(match.created_at, { day: 'numeric', month: 'short', year: 'numeric' }, lang === 'en' ? 'Date pending' : 'Fecha pendiente')}</p>
                <p className="text-white font-medium">{isTeam1 ? 'Equipo 1' : 'Equipo 2'}</p>
                <p className={`text-xs mt-1 ${won ? 'text-emerald-500' : 'text-red-500'}`}>
                  {won ? 'Victoria' : 'Derrota'}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Rating History (Updated: 2026-05-07) ─────────────────────── */}
      {history.length > 0 && (
        <section className="px-4 mt-6">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            Historial de rating
          </h2>
          <div className="space-y-2">
            {history.slice(0, 5).map(h => (
              <div key={h.id} className="flex justify-between items-center py-2 border-b border-zinc-800/50 text-sm">
                <span className="text-zinc-400">
                  {formatDateSafe(h.created_at, { month: 'short', day: 'numeric' }, 'Fecha pendiente')}
                </span>
                <span className={`font-bold ${h.delta_elo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {h.delta_elo >= 0 ? '+' : ''}{h.delta_elo}
                </span>
                <span className="text-zinc-300 font-mono">{h.elo_after}</span>
                <PlayerLevelBadge level={h.level_after} size="sm" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Achievements grid (Updated: 2026-05-07) ─────────────────────── */}
      <div className="px-4 mt-6">
        <AchievementsGrid achievements={achievements} />
      </div>

      {/* ─── Pending match confirmations (Updated: 2026-05-07) ──────────── */}
      {isOwnProfile && pendingConfirmations.length > 0 && (
        <section className="px-4 mt-6">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            Partidos por confirmar
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5">
              {pendingConfirmations.length}
            </span>
          </h2>
          <div className="space-y-3">
            {pendingConfirmations.map(m => (
              <MatchConfirmCard
                key={m.id}
                match={m}
                onDecide={() => usePlayerStore.getState().loadPendingConfirmations(user.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
