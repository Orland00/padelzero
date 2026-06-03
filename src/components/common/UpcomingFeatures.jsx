import InterestButton from '@/components/common/InterestButton'
import { useI18n } from '@/lib/i18n'

export default function UpcomingFeatures({ features }) {
  const { lang } = useI18n()
  const es = lang === 'es'

  return (
    <div className="mt-8 space-y-3">
      <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
        {es ? 'Próximamente' : 'Coming soon'}
      </h3>
      {features.map(f => (
        <div key={f.key} className="glass-card p-3 opacity-40 hover:opacity-60 transition">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{f.icon}</span>
              <div>
                <p className="text-xs font-bold text-zinc-400">{f.label}</p>
                <p className="text-[10px] text-zinc-600">{f.description}</p>
              </div>
            </div>
            <InterestButton featureKey={f.key} />
          </div>
        </div>
      ))}
    </div>
  )
}
