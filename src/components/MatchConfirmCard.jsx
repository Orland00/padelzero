/**
 * MatchConfirmCard
 *
 * Shows a pending match that the current user needs to confirm or dispute.
 * Calls playerStore.decideMatch() which records the decision and optionally
 * fires the atomic confirm_match_and_update_ratings RPC.
 *
 * Updated: 2026-05-07
 */
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'

// ─── Helper: format sets score ───────────────────────────────────────────────

function formatSets(sets) {
  if (!Array.isArray(sets) || sets.length === 0) return '–'
  return sets.map(s => `${s.p1 ?? s[0] ?? 0}-${s.p2 ?? s[1] ?? 0}`).join(' / ')
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {Object}   props.match   - Match row from matches table
 * @param {Function} props.onDecide - Called after a decision is made
 *
 * Updated: 2026-05-07
 */
export default function MatchConfirmCard({ match, onDecide }) {
  const { user } = useAuthStore()
  const { decideMatch } = usePlayerStore()
  const { showToast } = useUiStore()
  const [deciding, setDeciding] = useState(false)

  const userIsWinner =
    match.winner === 'p1'
      ? [match.p1_id, match.p1b_id].includes(user?.id)
      : [match.p2_id, match.p2b_id].includes(user?.id)

  const handleDecide = async (decision) => {
    if (!user?.id || deciding) return
    setDeciding(true)

    const { error } = await decideMatch(match.id, decision, user.id)

    setDeciding(false)

    if (error) {
      showToast('Error al registrar decisión', 'error')
      return
    }

    showToast(
      decision === 'confirm' ? 'Partido confirmado ✓' : 'Partido disputado',
      decision === 'confirm' ? 'success' : 'warning'
    )

    onDecide?.()
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-zinc-700/50 bg-zinc-900/70 p-4 space-y-3"
    >
      <div className="flex justify-between items-center">
        <span className="text-xs text-zinc-400">
          {new Date(match.played_at).toLocaleDateString('es-MX', {
            month: 'short', day: 'numeric',
          })}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          userIsWinner ? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'
        }`}>
          {userIsWinner ? 'Ganaste' : 'Perdiste'}
        </span>
      </div>

      <p className="text-zinc-200 font-mono text-sm">{formatSets(match.sets)}</p>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => handleDecide('confirm')}
          disabled={deciding}
          className="flex-1 py-2 rounded-lg bg-emerald-600/20 border border-emerald-600/40 text-emerald-400 text-sm font-semibold hover:bg-emerald-600/30 transition disabled:opacity-40"
        >
          Confirmar
        </button>
        <button
          onClick={() => handleDecide('dispute')}
          disabled={deciding}
          className="flex-1 py-2 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 text-sm font-semibold hover:bg-red-600/20 transition disabled:opacity-40"
        >
          Disputar
        </button>
      </div>
    </motion.div>
  )
}
