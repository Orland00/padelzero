import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'

function safeUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return url
  } catch { return null }
}

const sizeConfig = {
  title: { wrapper: 'py-3 px-4', logo: 'h-8 max-w-[160px]', text: 'text-sm font-bold', label: 'text-[10px]' },
  leaderboard: { wrapper: 'py-2 px-3', logo: 'h-6 max-w-[120px]', text: 'text-xs font-semibold', label: 'text-[9px]' },
  match_card: { wrapper: 'pt-2', logo: 'h-4 max-w-[80px]', text: 'text-[10px] font-semibold', label: 'text-[8px]' },
  footer: { wrapper: 'py-1.5 px-3', logo: 'h-4 max-w-[100px]', text: 'text-[10px] font-medium', label: 'text-[8px]' },
}

export default function SponsorBanner({ ligaId, placement = 'leaderboard' }) {
  const { t } = useI18n()
  const [sponsor, setSponsor] = useState(null)

  useEffect(() => {
    if (!ligaId) return
    let cancelled = false

    supabase
      .from('liga_sponsors')
      .select('*, sponsors(*)')
      .eq('liga_id', ligaId)
      .eq('placement', placement)
      .eq('is_active', true)
      .limit(1)
      .single()
      .then(({ data }) => {
        if (!cancelled && data?.sponsors) setSponsor(data.sponsors)
      })

    return () => { cancelled = true }
  }, [ligaId, placement])

  if (!sponsor) return null

  const cfg = sizeConfig[placement] || sizeConfig.leaderboard

  const content = (
    <div className={`flex items-center justify-center gap-2 ${cfg.wrapper}`}>
      <span className={`text-zinc-500 uppercase tracking-wider ${cfg.label}`}>
        {placement === 'title' ? t('sponsor.title_sponsor') : t('sponsor.powered_by')}
      </span>
      {sponsor.logo_url ? (
        <img src={sponsor.logo_url} alt={sponsor.name} className={`${cfg.logo} object-contain`} />
      ) : (
        <span className={`text-emerald-400 ${cfg.text}`}>{sponsor.name}</span>
      )}
    </div>
  )

  if (safeUrl(sponsor.website)) {
    return (
      <a
        href={safeUrl(sponsor.website)}
        target="_blank"
        rel="noopener noreferrer"
        className="block opacity-70 hover:opacity-100 transition-opacity"
      >
        {content}
      </a>
    )
  }

  return <div className="opacity-70">{content}</div>
}
