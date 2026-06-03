import { motion } from 'framer-motion'
import CrownBadge from '@/components/CrownBadge'
import { formatRelativeTime } from '@/utils/dateFormatters'

export default function ActivityEventCard({ event }) {
  if (!event) return null

  const getEventIcon = (type) => {
    switch (type) {
      case 'crown_transfer':
        return '👑'
      case 'jornada_created':
        return '🎮'
      case 'jornada_completed':
        return '✓'
      case 'member_joined':
        return '🎉'
      default:
        return '📌'
    }
  }

  const getEventColor = (type) => {
    switch (type) {
      case 'crown_transfer':
        return 'border-amber-500/30 bg-amber-500/10'
      case 'jornada_created':
        return 'border-blue-500/30 bg-blue-500/10'
      case 'jornada_completed':
        return 'border-emerald-500/30 bg-emerald-500/10'
      case 'member_joined':
        return 'border-purple-500/30 bg-purple-500/10'
      default:
        return 'border-zinc-700 bg-zinc-900'
    }
  }

  const getEventDescription = (event) => {
    switch (event.type) {
      case 'crown_transfer':
        return (
          <>
            <p className="text-sm font-bold text-amber-300">
              {event.player?.display_name || 'Jugador desconocido'} 👑 recibió la corona
            </p>
            {event.previousHolder && (
              <p className="text-xs text-zinc-400">
                Destronó a {event.previousHolder.display_name}
              </p>
            )}
          </>
        )

      case 'jornada_created':
        return (
          <p className="text-sm font-bold text-blue-300">
            Jornada #{event.eventData.jornada_number} creada por {event.player?.display_name || 'Admin'}
          </p>
        )

      case 'jornada_completed': {
        // Try to get participant count from checkins
        return (
          <p className="text-sm font-bold text-emerald-300">
            Jornada #{event.eventData.jornada_number} completada
          </p>
        )
      }

      case 'member_joined':
        return (
          <p className="text-sm font-bold text-purple-300">
            {event.player?.display_name || 'Nuevo jugador'} se unió a la liga
          </p>
        )

      default:
        return <p className="text-sm text-zinc-300">Evento de liga</p>
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`p-4 border rounded-lg ${getEventColor(event.type)}`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 text-2xl">
          {event.type === 'crown_transfer' ? (
            <CrownBadge size="sm" animate={false} />
          ) : (
            getEventIcon(event.type)
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {getEventDescription(event)}
        </div>

        {/* Timestamp */}
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-zinc-400">
            {formatRelativeTime(event.timestamp)}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
