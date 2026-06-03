import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/useTheme'
import { usePushStore } from '@/stores/pushStore'
import GlassButton from '@/components/ui/GlassButton'
import { supabase } from '@/lib/supabase'

export default function Settings() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuthStore()
  const { showToast } = useUiStore()
  const { t, lang, setLang } = useI18n()
  const { mode, setMode, isDark } = useTheme()
  const { pushEnabled, subscribe, unsubscribe } = usePushStore()

  // Sync language to profile (for push notification localization)
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('profiles')
      .update({ preferred_language: lang })
      .eq('id', user.id)
      .then(({ error }) => {
        if (error) console.error('Failed to sync preferred_language:', error.message)
      })
  }, [lang, user?.id])

  const handleLogout = async () => {
    const { error } = await signOut()
    if (error) {
      showToast({ type: 'error', message: 'Error', duration: 3000 })
    } else {
      showToast({ type: 'success', message: t('settings.logout_success'), duration: 2000 })
      navigate('/')
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="px-4 pt-6">
        <h1 className="text-2xl font-bold text-white mb-4">{t('settings.title')}</h1>

        {/* Language Selector */}
        <div className="glass-card rounded-lg p-4 space-y-3 mb-6">
          <p className="text-xs text-zinc-400 mb-2 font-bold uppercase tracking-widest">{t('common.language')}</p>
          <div className="flex gap-2">
            <GlassButton
              variant={lang === 'es' ? 'primary' : 'secondary'}
              onClick={() => setLang('es')}
              className="flex-1"
            >
              🇲🇽 Español
            </GlassButton>
            <GlassButton
              variant={lang === 'en' ? 'primary' : 'secondary'}
              onClick={() => setLang('en')}
              className="flex-1"
            >
              🇺🇸 English
            </GlassButton>
            <GlassButton
              variant={lang === 'pt' ? 'primary' : 'secondary'}
              onClick={() => setLang('pt')}
              className="flex-1"
            >
              🇧🇷 Português
            </GlassButton>
          </div>
        </div>

        {/* Push Notifications */}
        {'PushManager' in window && (
          <div className="glass-card rounded-lg p-4 space-y-3 mb-6">
            <p className="text-xs text-zinc-400 mb-2 font-bold uppercase tracking-widest">{t('settings.push_notifications')}</p>
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">
                {pushEnabled ? t('settings.push_enabled') : t('settings.push_disabled')}
              </span>
              <button
                onClick={() => pushEnabled ? unsubscribe(user?.id) : subscribe(user?.id)}
                className={`px-4 py-2 rounded text-sm font-bold ${
                  pushEnabled
                    ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
              >
                {pushEnabled ? t('settings.push_turn_off') : t('settings.push_turn_on')}
              </button>
            </div>
          </div>
        )}

        {/* Theme / Appearance */}
        <div className="glass-card rounded-lg p-4 space-y-3 mb-6">
          <p className="text-xs text-zinc-400 mb-2 font-bold uppercase tracking-widest">{t('settings.theme')}</p>
          <div className="flex gap-2">
            <GlassButton
              variant={mode === 'dark' ? 'primary' : 'secondary'}
              onClick={() => setMode('dark')}
              className="flex-1"
            >
              <span className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                {t('settings.dark_mode')}
              </span>
            </GlassButton>
            <GlassButton
              variant={mode === 'light' ? 'primary' : 'secondary'}
              onClick={() => setMode('light')}
              className="flex-1"
            >
              <span className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                {t('settings.light_mode')}
              </span>
            </GlassButton>
          </div>
          <GlassButton
            variant={mode === 'system' ? 'primary' : 'ghost'}
            onClick={() => setMode('system')}
            fullWidth
            className="!min-h-[40px]"
          >
            <span className="flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              {t('settings.system_theme')}
            </span>
          </GlassButton>
        </div>

        {/* Account Info */}
        <div className="glass-card rounded-lg p-4 space-y-3 mb-6">
          <div>
            <p className="text-xs text-zinc-400 mb-1">{t('settings.name')}</p>
            <p className="text-white font-semibold">{profile?.display_name || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-1">{t('settings.email')}</p>
            <p className="text-white font-semibold text-sm break-all">{user?.email || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-1">{t('settings.elo')}</p>
            <p className="text-white font-semibold">{Math.round(profile?.elo_rating || 1200)}</p>
          </div>
        </div>

        {/* Account Type */}
        <div className="glass-card rounded-lg p-4 space-y-3 mb-6">
          <div>
            <p className="text-xs text-zinc-400 mb-3">{t('settings.account_type')}</p>
            {user?.app_metadata?.provider === 'google' || user?.app_metadata?.providers?.includes('google') || user?.user_metadata?.iss?.includes('google') ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <p className="text-sm text-white">{t('settings.google_connected')}</p>
              </div>
            ) : user?.email ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <p className="text-sm text-white">{lang === 'es' ? 'Cuenta con correo' : 'Email account'}: {user.email}</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Legal */}
        <div className="glass-card rounded-lg p-4 space-y-2 mb-6">
          <p className="text-xs text-zinc-400 mb-2">Legal</p>
          <GlassButton variant="ghost" fullWidth onClick={() => navigate('/privacy')}>
            <span className="flex items-center justify-between w-full">
              <span>{t('settings.privacy_policy')}</span>
              <span className="text-zinc-600">›</span>
            </span>
          </GlassButton>
          <GlassButton variant="ghost" fullWidth onClick={() => navigate('/terms')}>
            <span className="flex items-center justify-between w-full">
              <span>{t('settings.terms')}</span>
              <span className="text-zinc-600">›</span>
            </span>
          </GlassButton>
        </div>

        {/* Danger Zone */}
        <div className="space-y-2">
          <h2 className="text-xs text-red-400 font-semibold uppercase">{t('settings.danger_zone')}</h2>
          <GlassButton variant="danger" fullWidth onClick={handleLogout}>
            {t('settings.logout')}
          </GlassButton>
        </div>
      </div>
    </div>
  )
}
