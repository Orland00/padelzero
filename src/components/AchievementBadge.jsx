/**
 * AchievementBadge
 *
 * Renders a single achievement with emoji icon and label.
 * Shows unlock date as a tooltip. Locked achievements appear greyed out.
 *
 * Updated: 2026-05-08
 */
import React from 'react'
import { ACHIEVEMENT_META } from '@/stores/socialStore'

/**
 * @param {Object}  props
 * @param {string}  props.achievementKey  - One of the 10 achievement keys
 * @param {string}  [props.unlockedAt]    - ISO timestamp for tooltip
 * @param {boolean} [props.locked=false]  - Show as greyed-out locked state
 *
 * Updated: 2026-05-08
 */
export default function AchievementBadge({ achievementKey, unlockedAt, locked = false }) {
  const meta = ACHIEVEMENT_META[achievementKey]
  if (!meta) return null

  const dateLabel = unlockedAt
    ? new Date(unlockedAt).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div
      title={locked ? meta.label : `${meta.label}${dateLabel ? ` — ${dateLabel}` : ''}`}
      className={`flex flex-col items-center gap-1 p-2 rounded-lg transition ${
        locked
          ? 'opacity-30 grayscale'
          : 'bg-zinc-800/60 border border-zinc-700/50'
      }`}
    >
      <span className="text-2xl">{meta.icon}</span>
      <span className="text-[10px] text-zinc-400 text-center leading-tight max-w-[56px]">
        {meta.label}
      </span>
    </div>
  )
}
