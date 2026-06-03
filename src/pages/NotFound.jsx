import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/lib/i18n'

export default function NotFound() {
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-8xl font-black text-zinc-800 mb-4">404</p>
      <h1 className="text-2xl font-black text-white mb-2">
        {t('notfound.title')}
      </h1>
      <p className="text-zinc-400 text-sm mb-8">
        {t('notfound.desc')}
      </p>
      <button
        onClick={() => navigate('/')}
        className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-2xl transition uppercase tracking-widest text-sm"
      >
        {t('notfound.go_home')}
      </button>
    </div>
  )
}
