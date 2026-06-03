import { useI18n } from '@/lib/i18n'

export default function PushBanner({ onEnable, onDismiss }) {
  const { t } = useI18n()

  return (
    <div className="mx-4 mt-2 p-3 rounded-lg bg-emerald-900/30 border border-emerald-700/50 flex items-center justify-between gap-3">
      <p className="text-sm text-emerald-200 flex-1">{t('push.banner_text')}</p>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onDismiss}
          className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1"
        >
          {t('push.dismiss')}
        </button>
        <button
          onClick={onEnable}
          className="text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-900/50 rounded px-3 py-1"
        >
          {t('push.enable')}
        </button>
      </div>
    </div>
  )
}
