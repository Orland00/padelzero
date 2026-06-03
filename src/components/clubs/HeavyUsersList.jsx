/**
 * HeavyUsersList
 *
 * Top 10 players by heavy_user_score with debt badges.
 * Used by club admins to identify VIP members and outstanding balances.
 * Score formula: (classes_taken * 2) + floor(total_spend / 100).
 *
 * Updated: 2026-05-07
 */
import React, { useEffect } from 'react'
import { useCrmStore } from '@/stores/crmStore'
import PlayerLevelBadge from '@/components/PlayerLevelBadge'
import { useI18n } from '@/lib/i18n'

export default function HeavyUsersList() {
  const { clubStats, clubStatsLoading, loadClubStats } = useCrmStore()
  const { lang } = useI18n()
  const es = lang === 'es'

  useEffect(() => {
    loadClubStats(10)
  }, [])

  if (clubStatsLoading) {
    return <p className="text-zinc-500 text-sm">{es ? 'Cargando…' : 'Loading…'}</p>
  }

  if (clubStats.length === 0) {
    return <p className="text-zinc-500 text-sm">{es ? 'Sin datos' : 'No data'}</p>
  }

  return (
    <div className="space-y-2">
      {clubStats.map((stat, i) => (
        <div
          key={stat.player_id}
          className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800"
        >
          <span className="text-xs text-zinc-500 w-4 text-right">{i + 1}</span>

          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
            {stat.profile?.display_name?.charAt(0)?.toUpperCase() || '?'}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-200 truncate">
              {stat.profile?.display_name}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {stat.profile?.level != null && (
                <PlayerLevelBadge level={stat.profile.level} size="sm" />
              )}
              <span className="text-xs text-zinc-500">
                {stat.freq_classes_taken} {es ? 'clases' : 'classes'}
              </span>
            </div>
          </div>

          {stat.pending_debt > 0 && (
            <span className="text-xs font-semibold text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full shrink-0">
              ${stat.pending_debt.toFixed(0)}
            </span>
          )}

          <span className="text-xs font-bold text-emerald-400 shrink-0">
            ★{stat.heavy_user_score}
          </span>
        </div>
      ))}
    </div>
  )
}
