import GlassButton from '@/components/ui/GlassButton'
import { useClubStore } from '@/stores/clubStore'
import { useI18n } from '@/lib/i18n'

export default function BookingSheet() {
  const { selectedSlot, selectedDate, bookingInProgress, bookSlot, clearSlot } = useClubStore()
  const { lang } = useI18n()
  const es = lang === 'es'

  if (!selectedSlot) return null

  const formatTime = (t) => {
    const [h, m] = t.split(':')
    return `${parseInt(h)}:${m}`
  }
  const formatPrice = (cents) => `$${(cents / 100).toFixed(0)} MXN`
  const formatDate = (iso) => {
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString(es ? 'es-MX' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={clearSlot} />

      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-4 rounded-t-2xl"
        style={{
          background: 'linear-gradient(170deg, rgba(28,28,38,0.96) 0%, rgba(18,18,26,0.98) 100%)',
          backdropFilter: 'blur(40px)',
          borderTop: '1.5px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />

        <h3 className="text-lg font-black text-white mb-1">
          {es ? 'Confirmar reserva' : 'Confirm booking'}
        </h3>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">{es ? 'Cancha' : 'Court'}</span>
            <span className="text-white font-bold">{selectedSlot.courtName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">{es ? 'Fecha' : 'Date'}</span>
            <span className="text-white font-bold">{formatDate(selectedDate)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">{es ? 'Horario' : 'Time'}</span>
            <span className="text-white font-bold">
              {formatTime(selectedSlot.start_time)} - {formatTime(selectedSlot.end_time)}
            </span>
          </div>
          {selectedSlot.is_peak && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">{es ? 'Tipo' : 'Type'}</span>
              <span className="text-amber-400 font-bold text-xs uppercase">Peak</span>
            </div>
          )}
          <div className="h-px bg-zinc-800 my-1" />
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">{es ? 'Precio' : 'Price'}</span>
            <span className="text-emerald-400 font-black text-lg">{formatPrice(selectedSlot.price_cents)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <GlassButton variant="ghost" className="flex-1" onClick={clearSlot}>
            {es ? 'Cancelar' : 'Cancel'}
          </GlassButton>
          <GlassButton
            variant="primary"
            className="flex-1"
            loading={bookingInProgress}
            onClick={bookSlot}
          >
            {es ? 'Reservar' : 'Book'}
          </GlassButton>
        </div>
      </div>
    </>
  )
}
