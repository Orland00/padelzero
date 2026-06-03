/**
 * PlayerLevelBadge
 *
 * Displays a Playtomic-style player level (0.0–7.0) with color coding:
 *   0.0–2.0  → emerald (beginner)
 *   2.0–4.0  → blue    (intermediate)
 *   4.0–5.5  → purple  (advanced)
 *   5.5–7.0  → gold    (elite)
 *
 * Shows a provisional asterisk (*) when matchesPlayed < 15.
 * Available sizes: 'sm', 'md', 'lg'.
 *
 * Updated: 2026-05-07
 */
import React from 'react'

// ─── Color scheme by level range ────────────────────────────────────────────

function getLevelColor(level) {
  if (level < 2.0) return 'text-emerald-400 border-emerald-400 bg-emerald-400/10'
  if (level < 4.0) return 'text-blue-400 border-blue-400 bg-blue-400/10'
  if (level < 5.5) return 'text-purple-400 border-purple-400 bg-purple-400/10'
  return 'text-yellow-400 border-yellow-400 bg-yellow-400/10'
}

// ─── Size presets ────────────────────────────────────────────────────────────

const SIZE_CLASSES = {
  sm: 'text-xs px-1.5 py-0.5 rounded border text-[10px] font-bold',
  md: 'text-sm px-2 py-1 rounded-md border font-bold',
  lg: 'text-base px-3 py-1.5 rounded-lg border-2 font-bold',
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * @param {Object}  props
 * @param {number}  props.level           - Player level 0.0–7.0
 * @param {string}  [props.size='md']     - 'sm' | 'md' | 'lg'
 * @param {number}  [props.matchesPlayed] - Show asterisk if < 15
 * @param {string}  [props.className]     - Extra Tailwind classes
 *
 * Updated: 2026-05-07
 */
export default function PlayerLevelBadge({ level, size = 'md', matchesPlayed, className = '' }) {
  const safeLevel = typeof level === 'number' ? level : 0
  const isProvisional = typeof matchesPlayed === 'number' && matchesPlayed < 15
  const colorClasses = getLevelColor(safeLevel)
  const sizeClasses = SIZE_CLASSES[size] || SIZE_CLASSES.md

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${colorClasses} ${sizeClasses} ${className}`}
    >
      {safeLevel.toFixed(2)}
      {isProvisional && (
        <span
          title="Nivel provisional — necesitas 15+ partidos confirmados"
          className="opacity-70 cursor-help"
        >
          *
        </span>
      )}
    </span>
  )
}
