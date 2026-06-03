/**
 * ActivityFeed Page — /actividad
 *
 * Shows recent confirmed matches from players the current user follows.
 * If following nobody, prompts to follow players from Ranking.
 *
 * Updated: 2026-05-08
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocialStore } from '@/stores/socialStore'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import { usePageTitle } from '@/hooks/usePageTitle'
import PlayerLevelBadge from '@/components/PlayerLevelBadge'

export default function ActivityFeed() {
  const { user } = useAuthStore()
  const { feed, feedLoading, following, loadFollowing, loadFeed } = useSocialStore()
  const { lang } = useI18n()
  const es = lang === 'es'
  const navigate = useNavigate()
  usePageTitle(es ? 'Actividad' : 'Activity')

  useEffect(() => {
    if (!user?.id) return
    const init = async () => {
      await loadFollowing(user.id)
      await loadFeed(user.id)
    }
    init()
  }, [user?.id])

  if (feedLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-zinc-700 border-t-emerald-500 rounded-full" />
      </div>
    )
  }

  if (following.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-4">
        <p className="text-4xl">👥</p>
        <p className="text-zinc-300 font-semibold text-center">
          {es ? 'Sigue a jugadores para ver su actividad' : 'Follow players to see their activity'}
        </p>
        <button
          onClick={() => navigate('/ranking')}
          className="px-4 py-2 rounded-lg bg-emerald-600/20 border border-emerald-600/40 text-emerald-400 text-sm font-semibold"
        >
          {es ? 'Ver ranking' : 'Browse ranking'}
        </button>
      </div>
    )
  }

  if (feed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <p className="text-zinc-400 text-center">
          {es ? 'Nadie que sigues ha jugado recientemente' : 'Nobody you follow has played recently'}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-3">
      <h1 className="text-xl font-bold text-zinc-100">{es ? 'Actividad' : 'Activity'}</h1>

      {feed.map(match => (
        <div key={match.id} className="rounded-xl border border-zinc-700/50 bg-zinc-900/70 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-200 font-semibold">{match.p1?.display_name}</span>
              {match.p1?.level != null && <PlayerLevelBadge level={match.p1.level} size="sm" />}
            </div>
            <span className="text-zinc-500 text-xs font-mono">vs</span>
            <div className="flex items-center gap-1.5">
              {match.p2?.level != null && <PlayerLevelBadge level={match.p2.level} size="sm" />}
              <span className="text-zinc-200 font-semibold">{match.p2?.display_name}</span>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            {new Date(match.played_at).toLocaleDateString(es ? 'es-MX' : 'en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
            })}
          </p>
        </div>
      ))}
    </div>
  )
}
