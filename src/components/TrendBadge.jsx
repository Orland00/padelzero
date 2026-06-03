/**
 * TrendBadge — muestra cuánto subió o bajó un jugador/equipo en el período actual.
 * Props:
 *  - delta   number   positivo = subió, negativo = bajó, 0 = sin cambio
 *  - label   string   opcional, por defecto "pts" o "elo"
 */
export default function TrendBadge({ delta = 0, label = '' }) {
  if (delta === 0 || delta == null) {
    return (
      <span className="text-[10px] text-zinc-600 font-bold">—</span>
    )
  }

  const up = delta > 0
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full"
      style={{
        background: up ? 'rgba(37,211,102,0.12)' : 'rgba(239,68,68,0.12)',
        color: up ? '#25d366' : '#ef4444',
      }}
    >
      {up ? '▲' : '▼'} {up ? '+' : ''}{delta}{label ? ` ${label}` : ''}
    </span>
  )
}
