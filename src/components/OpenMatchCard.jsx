/**
 * OpenMatchCard
 *
 * Displays a single open match from the feed: creator info, level range,
 * time, court, and remaining slots. Join button calls openMatchStore.joinMatch.
 *
 * Updated: 2026-05-08
 */
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useOpenMatchStore } from '@/stores/openMatchStore'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/lib/i18n'
import PlayerLevelBadge from '@/components/PlayerLevelBadge'
import { formatDateSafe, formatDisplayName, formatTimeSafe } from '@/utils/dateFormatters'

// ─── Slot count indicator ────────────────────────────────────────────────────

function SlotDots({ total, filled }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${i < filled ? 'bg-emerald-400' : 'bg-zinc-600'}`}
        />
      ))}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {Object}   props.match     - Open match row from Supabase
 * @param {Function} props.onJoined  - Called after successful join
 *
 * Updated: 2026-05-08
 */
export default function OpenMatchCard({ match, onJoined }) {
  const { user } = useAuthStore()
  const { joinMatch } = useOpenMatchStore()
  const { showToast } = useUiStore()
  const { lang } = useI18n()
  const es = lang === 'es'
  const [joining, setJoining] = useState(false)

  // Total slots = 3 (doubles needs 4 players: 1 creator + 3 slots max)
  const totalSlots = 3
  const filledSlots = totalSlots - (match.slots_needed || 0)

  const handleJoin = async () => {
    if (!user?.id || joining) return
    setJoining(true)
    const { error } = await joinMatch(match.id, user.id)
    setJoining(false)

    if (error) {
      showToast(es ? 'No se pudo unir al partido' : 'Could not join match', 'error')
      return
    }

    showToast(es ? '¡Te uniste al partido!' : 'You joined the match!', 'success')
    onJoined?.()
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-zinc-700/50 bg-zinc-900/70 p-4 space-y-3"
    >
      {/* Creator row */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
          {formatDisplayName(match.creator?.display_name, 'C').charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-200">{formatDisplayName(match.creator?.display_name, 'Creador pendiente')}</p>
          {match.creator?.level != null && (
            <PlayerLevelBadge level={match.creator.level} size="sm" />
          )}
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-zinc-400">
            {formatDateSafe(match.played_at, {
              weekday: 'short', month: 'short', day: 'numeric',
            }, es ? 'Fecha pendiente' : 'Date pending')}
          </p>
          <p className="text-xs text-zinc-300 font-mono">
            {formatTimeSafe(match.played_at, {
              hour: '2-digit', minute: '2-digit',
            }, es ? 'Hora pendiente' : 'Time pending')}
          </p>
        </div>
      </div>

      {/* Level range + slots */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-400">{es ? 'Nivel' : 'Level'}:</span>
          <span className="text-xs font-semibold text-zinc-200">
            {match.level_min?.toFixed(1)}–{match.level_max?.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">{es ? 'Lugares' : 'Slots'}:</span>
          <SlotDots total={totalSlots} filled={filledSlots} />
        </div>
      </div>

      {/* Join button — hidden if user is already the creator */}
      {match.p1_id !== user?.id && (
        <button
          onClick={handleJoin}
          disabled={joining || match.slots_needed === 0}
          className="w-full py-2.5 rounded-lg bg-emerald-600/20 border border-emerald-600/40 text-emerald-400 text-sm font-semibold hover:bg-emerald-600/30 transition disabled:opacity-40"
        >
          {joining
            ? (es ? 'Uniéndose…' : 'Joining…')
            : (match.slots_needed === 0
              ? (es ? 'Partido lleno' : 'Full')
              : (es ? 'Unirme' : 'Join'))}
        </button>
      )}
    </motion.div>
  )
}
