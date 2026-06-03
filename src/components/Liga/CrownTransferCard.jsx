import { motion } from 'framer-motion'
import CrownBadge from '@/components/CrownBadge'

export default function CrownTransferCard({ transfer, profiles }) {
  const newCrownProfile = profiles?.[transfer.player_id]
  const dethroned = transfer.dethroned_id ? profiles?.[transfer.dethroned_id] : null

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg"
    >
      <div className="flex items-center gap-4">
        {/* Crown Icon */}
        <div className="flex-shrink-0">
          <CrownBadge size="sm" animate={false} />
        </div>

        {/* Transfer Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-amber-300">
              {newCrownProfile?.display_name || '?'} tiene la corona
            </p>
            {dethroned && (
              <p className="text-xs text-zinc-400">
                Destronó a {dethroned.display_name}
              </p>
            )}
          </div>
        </div>

        {/* Date */}
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-zinc-500">
            {new Date(transfer.crowned_at).toLocaleDateString('es-ES', {
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
