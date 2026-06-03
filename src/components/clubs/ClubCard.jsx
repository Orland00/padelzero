import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/lib/i18n'

const TYPE_STYLES = {
  publica: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: '🏛️' },
  comunitaria: { bg: 'bg-blue-500/15', text: 'text-blue-400', icon: '🏘️' },
  club: { bg: 'bg-amber-500/15', text: 'text-amber-400', icon: '🏟️' },
  country_club: { bg: 'bg-yellow-500/15', text: 'text-yellow-300', icon: '🏰' },
}

export default function ClubCard({ club }) {
  const navigate = useNavigate()
  const { lang, t } = useI18n()
  const es = lang === 'es'
  const typeKey = club.court_type || 'club'
  const typeStyle = TYPE_STYLES[typeKey] || TYPE_STYLES.club

  return (
    <button
      onClick={() => club.slug && navigate(`/club/${club.slug}`)}
      className="glass-card p-4 w-full text-left flex gap-3 items-start active:scale-[0.98] transition-transform"
    >
      <div className="w-14 h-14 rounded-xl bg-zinc-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
        {club.logo_url ? (
          <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl">{typeStyle.icon}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-white truncate">{club.name}</h3>
          {club.verified && <span className="text-emerald-400 text-xs">✓</span>}
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${typeStyle.bg} ${typeStyle.text}`}>
            {t(`courts.type_${typeKey}`)}
          </span>
          {club.is_sponsor && (
            <span
              className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
              style={{
                background: club.sponsor_tier === 'gold' ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.15)',
                color: club.sponsor_tier === 'gold' ? '#fbbf24' : '#c4b5fd',
              }}
            >
              {club.sponsor_tier || 'sponsor'}
            </span>
          )}
        </div>

        {club.address && (
          <p className="text-xs text-zinc-500 truncate mt-0.5">{club.address}</p>
        )}

        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-xs text-zinc-400">
            {club.courts_count || 0} {es ? 'canchas' : 'courts'}
          </span>
          {club._distance != null && (
            <span className="text-xs text-emerald-400 font-bold">
              {club._distance < 1
                ? `${Math.round(club._distance * 1000)}m`
                : `${club._distance.toFixed(1)}km`}
            </span>
          )}
        </div>
      </div>

      <span className="text-zinc-600 text-sm mt-1">›</span>
    </button>
  )
}
