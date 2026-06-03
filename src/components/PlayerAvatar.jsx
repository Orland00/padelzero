import { motion } from 'framer-motion'
import CrownBadge from '@/components/CrownBadge'

/**
 * PlayerAvatar — avatar circular universal con foto o inicial como fallback.
 * Muestra corona flotante al campeón (como Fortnite).
 *
 * Props:
 *  - avatarUrl     string | null
 *  - displayName   string
 *  - hasCrown      boolean — muestra coronita encima
 *  - size          'xs' | 'sm' | 'md' | 'lg' | 'xl'
 *  - className     string extra
 */
const SIZES = {
  xs: { container: 'w-6 h-6',   text: 'text-[10px]', crown: 'sm', crownPos: '-top-2 -right-1.5' },
  sm: { container: 'w-8 h-8',   text: 'text-xs',     crown: 'sm', crownPos: '-top-2.5 -right-1.5' },
  md: { container: 'w-10 h-10', text: 'text-sm',     crown: 'sm', crownPos: '-top-3 -right-1.5' },
  lg: { container: 'w-14 h-14', text: 'text-lg',     crown: 'md', crownPos: '-top-4 -right-2' },
  xl: { container: 'w-24 h-24', text: 'text-4xl',    crown: 'lg', crownPos: '-top-6 -right-3' },
}

export default function PlayerAvatar({
  avatarUrl,
  displayName = '?',
  hasCrown = false,
  size = 'md',
  className = '',
}) {
  const s = SIZES[size] || SIZES.md
  const initial = (displayName || '?')[0].toUpperCase()

  return (
    <div className={`relative flex-shrink-0 ${s.container} ${className}`}>
      {/* Circle */}
      <div className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-zinc-800 border border-zinc-700 font-bold text-zinc-400 ${s.text}`}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>

      {/* Crown overlay — Fortnite style */}
      {hasCrown && (
        <div className={`absolute ${s.crownPos} pointer-events-none`}>
          <CrownBadge size={s.crown} animate={true} />
        </div>
      )}
    </div>
  )
}
