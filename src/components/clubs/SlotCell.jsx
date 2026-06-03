export default function SlotCell({ slot, courtId, courtName, onSelect }) {
  const formatTime = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    return `${parseInt(h)}:${m}`
  }

  const formatPrice = (cents) => {
    return `$${(cents / 100).toFixed(0)}`
  }

  if (!slot.is_available) {
    return (
      <div className="px-2 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-800 opacity-50">
        <p className="text-[10px] text-zinc-600 text-center font-medium">
          {formatTime(slot.start_time)}
        </p>
      </div>
    )
  }

  return (
    <button
      onClick={() => onSelect({ courtId, courtName, ...slot })}
      className="px-2 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 active:scale-95 transition-all"
    >
      <p className="text-[10px] text-emerald-400 text-center font-bold">
        {formatTime(slot.start_time)}
      </p>
      <p className="text-[9px] text-zinc-400 text-center">
        {formatPrice(slot.price_cents)}
      </p>
    </button>
  )
}
