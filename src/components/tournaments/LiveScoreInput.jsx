/**
 * LiveScoreInput
 *
 * Set-by-set score entry widget for tournament match referees.
 * Validates legal padel set scores (first to 6, tiebreak rules).
 * Supports 2 or 3 sets. Calls onSubmit with the sets array on save.
 *
 * Updated: 2026-05-08
 */
import React, { useState } from 'react'

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Returns true if a set score is legal in padel.
 * Regular set: 6-x (diff>=2) or 7-6 (tiebreak).
 * Super tiebreak (3rd set): first to 10, win by 2.
 *
 * Updated: 2026-05-08
 */
function isLegalSet(p1, p2, isSuperTiebreak = false) {
  const winner = Math.max(p1, p2)
  const loser = Math.min(p1, p2)
  if (isSuperTiebreak) {
    return winner >= 10 && winner - loser >= 2
  }
  if (winner === 6 && loser <= 4) return true
  if (winner === 7 && loser === 6) return true
  return false
}

// ─── Component ───────────────────────────────────────────────────────────────

const DEFAULT_SETS = [
  { p1: '', p2: '' },
  { p1: '', p2: '' },
  { p1: '', p2: '' },
]

/**
 * @param {Object}   props
 * @param {string}   props.team1Name
 * @param {string}   props.team2Name
 * @param {Function} props.onSubmit   - Called with { sets: [{p1,p2}], winner: 'p1'|'p2' }
 * @param {Function} props.onCancel
 *
 * Updated: 2026-05-08
 */
export default function LiveScoreInput({ team1Name, team2Name, onSubmit, onCancel }) {
  const [sets, setSets] = useState(DEFAULT_SETS)
  const [errors, setErrors] = useState([])

  const updateSet = (setIdx, side, value) => {
    const num = parseInt(value, 10)
    setSets(prev => prev.map((s, i) =>
      i === setIdx ? { ...s, [side]: isNaN(num) ? '' : num } : s
    ))
  }

  const computeWinner = (completeSets) => {
    let p1wins = 0, p2wins = 0
    completeSets.forEach(s => {
      if (s.p1 > s.p2) p1wins++
      else if (s.p2 > s.p1) p2wins++
    })
    if (p1wins > p2wins) return 'p1'
    if (p2wins > p1wins) return 'p2'
    return null
  }

  // Determine if third set is needed (split first two sets)
  const showThirdSet = (() => {
    const s1 = sets[0], s2 = sets[1]
    if (s1.p1 === '' || s1.p2 === '' || s2.p1 === '' || s2.p2 === '') return false
    const p1won1 = Number(s1.p1) > Number(s1.p2)
    const p1won2 = Number(s2.p1) > Number(s2.p2)
    return p1won1 !== p1won2
  })()

  const handleSubmit = () => {
    const newErrors = []
    const completeSets = sets
      .filter(s => s.p1 !== '' && s.p2 !== '')
      .slice(0, showThirdSet ? 3 : 2)

    if (completeSets.length < 2) {
      setErrors(['Necesitas al menos 2 sets'])
      return
    }

    completeSets.forEach((s, i) => {
      const isSuper = i >= 2
      if (!isLegalSet(Number(s.p1), Number(s.p2), isSuper)) {
        newErrors.push(`Set ${i + 1}: marcador inválido (${s.p1}-${s.p2})`)
      }
    })

    if (newErrors.length > 0) {
      setErrors(newErrors)
      return
    }

    const winner = computeWinner(completeSets)
    if (!winner) {
      setErrors(['No se puede determinar ganador'])
      return
    }

    setErrors([])
    onSubmit({ sets: completeSets, winner })
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const setIndices = [0, 1, ...(showThirdSet ? [2] : [])]

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/70 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-zinc-300">Registrar resultado</h3>

      {/* Team labels */}
      <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400 font-semibold">
        <span className="text-center truncate">{team1Name || 'Equipo A'}</span>
        <span className="text-center">vs</span>
        <span className="text-center truncate">{team2Name || 'Equipo B'}</span>
      </div>

      {/* Set inputs */}
      {setIndices.map(i => (
        <div key={i} className="grid grid-cols-3 gap-2 items-center">
          <input
            type="number"
            min="0"
            max="10"
            value={sets[i]?.p1 ?? ''}
            onChange={e => updateSet(i, 'p1', e.target.value)}
            placeholder={i >= 2 ? '10' : '6'}
            className="text-center bg-zinc-800 border border-zinc-700 rounded-lg py-2 text-zinc-200 text-sm"
          />
          <span className="text-center text-zinc-500 text-xs">
            {i >= 2 ? 'Super TB' : `Set ${i + 1}`}
          </span>
          <input
            type="number"
            min="0"
            max="10"
            value={sets[i]?.p2 ?? ''}
            onChange={e => updateSet(i, 'p2', e.target.value)}
            placeholder={i >= 2 ? '10' : '6'}
            className="text-center bg-zinc-800 border border-zinc-700 rounded-lg py-2 text-zinc-200 text-sm"
          />
        </div>
      ))}

      {/* Errors */}
      {errors.map((e, i) => (
        <p key={i} className="text-red-400 text-xs">{e}</p>
      ))}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-400 text-sm font-semibold hover:bg-zinc-700 transition"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 py-2 rounded-lg bg-emerald-600/20 border border-emerald-600/40 text-emerald-400 text-sm font-semibold hover:bg-emerald-600/30 transition"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}
