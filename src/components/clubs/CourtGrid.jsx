import SlotCell from './SlotCell'
import { SkeletonCard } from '@/components/common/LoadingSkeleton'
import { useI18n } from '@/lib/i18n'

export default function CourtGrid({ courtSlots, loading, onSelectSlot }) {
  const { lang } = useI18n()
  const es = lang === 'es'

  if (loading) {
    return (
      <div className="space-y-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const entries = Object.entries(courtSlots)
  if (!entries.length) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500 text-sm">
          {es ? 'No hay horarios configurados para este día' : 'No schedules configured for this day'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {entries.map(([courtId, { courtName, slots }]) => (
        <div key={courtId} className="glass-card p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">{courtName}</h4>
            <span className="text-[10px] text-zinc-500 ml-auto">
              {slots.filter(s => s.is_available).length}/{slots.length} {es ? 'disponibles' : 'available'}
            </span>
          </div>

          {slots.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-2">
              {es ? 'Sin horarios' : 'No slots'}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {slots.map((slot) => (
                <SlotCell
                  key={`${courtId}-${slot.start_time}`}
                  slot={slot}
                  courtId={courtId}
                  courtName={courtName}
                  onSelect={onSelectSlot}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
