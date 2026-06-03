/**
 * EloBadge Component
 * 
 * Displays a styled badge indicating the player's ATP tier (Bronce, Plata, Oro, Platino, Diamante).
 * Used across the application in rankings, profiles, and match listings to provide quick visual 
 * feedback on player skill levels.
 * 
 * Updated: 2026-04-29
 */

import React from 'react'

const ATP_TIERS = {
  bronce: { 
    label: 'Bronce', 
    color: 'bg-amber-900/20 text-amber-600 border-amber-600/20',
    icon: '🥉'
  },
  plata: { 
    label: 'Plata', 
    color: 'bg-slate-900/20 text-slate-400 border-slate-400/20',
    icon: '🥈'
  },
  oro: { 
    label: 'Oro', 
    color: 'bg-yellow-900/20 text-yellow-400 border-yellow-400/20',
    icon: '🥇'
  },
  platino: { 
    label: 'Platino', 
    color: 'bg-cyan-900/20 text-cyan-200 border-cyan-200/20',
    icon: '💎'
  },
  diamante: { 
    label: 'Diamante', 
    color: 'bg-purple-900/20 text-purple-400 border-purple-400/20',
    icon: '👑'
  }
}

/**
 * Maps ATP rating to a tier key.
 * @param {number} elo 
 * @returns {string} tier key
 */
const getTierKey = (elo) => {
  if (elo < 1400) return 'bronce'
  if (elo < 1600) return 'plata'
  if (elo < 1800) return 'oro'
  if (elo < 2000) return 'platino'
  return 'diamante'
}

export const EloBadge = ({ elo, showIcon = false, className = '' }) => {
  const tierKey = getTierKey(elo || 1200)
  const tier = ATP_TIERS[tierKey]

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${tier.color} ${className}`}>
      {showIcon && <span>{tier.icon}</span>}
      {tier.label}
    </span>
  )
}

export default EloBadge
