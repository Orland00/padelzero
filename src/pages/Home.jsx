import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/lib/i18n'
import GlassButton from '@/components/ui/GlassButton'
import { PASSWORD_MIN_LENGTH } from '@/lib/authPolicy'

export default function Home() {
  const navigate = useNavigate()
  const { user, profile, ready, profileLoading, profileError, authLoading, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuthStore()
  const { showToast } = useUiStore()
  const { t, lang, toggleLang } = useI18n()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const passwordRef = useRef(null)
  const loggedSessionRef = useRef(null)

  // Redirect if already logged in
  useEffect(() => {
    // 🛡️ REDIRECT DEFENSIVO: No actuar hasta que el sistema esté listo
    if (!ready || !user || profileLoading || profileError) return

    // Log telemétrico una sola vez por sesión (evita spam en cada re-render)
    if (loggedSessionRef.current !== user.id) {
      loggedSessionRef.current = user.id
      const { logDebug } = useAuthStore.getState()
      logDebug('info', 'navigation', 'Home mounted with active session', {
        hasProfile: !!profile,
        hasDisplayName: !!profile?.display_name,
        userId: user.id
      })
    }

    if (!profile?.display_name) {
      // Si el perfil existe pero no tiene nombre, va a onboarding
      navigate('/onboarding', { replace: true })
    } else {
      // Usuario completo va a jugar
      navigate('/play', { replace: true })
    }
  }, [ready, user, profile, profileLoading, profileError, navigate])

  if (user && profileLoading) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center px-6 glass-ambient">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-zinc-700 border-t-emerald-500 rounded-full mx-auto mb-4" />
          <p className="text-zinc-400 text-sm font-bold">Cargando tu perfil...</p>
        </div>
      </div>
    )
  }

  if (user && profileError && !profile) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center px-6 glass-ambient">
        <div className="glass-card p-6 rounded-[2rem] max-w-sm text-center">
          <h1 className="text-xl font-black text-white mb-2">No se pudo cargar tu perfil</h1>
          <p className="text-sm text-zinc-400 mb-5">Recarga para intentar de nuevo.</p>
          <GlassButton variant="primary" size="lg" fullWidth onClick={() => window.location.reload()}>
            Recargar
          </GlassButton>
        </div>
      </div>
    )
  }

  const handleGoogleLogin = async () => {
    const { error } = await signInWithGoogle()
    if (error) showToast({ type: 'error', message: t('auth.error_login'), duration: 4000 })
  }

  const handleEmailAuth = async () => {
    if (!email || !password) {
      showToast({ type: 'warning', message: t('auth.email_password_required') })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast({ type: 'warning', message: t('auth.invalid_email') })
      return
    }
    if (isRegistering && password.length < PASSWORD_MIN_LENGTH) {
      showToast({ type: 'warning', message: t('auth.min_password') })
      return
    }

    if (isRegistering) {
      const { data, error } = await signUpWithEmail(email, password)
      if (error) {
        const msg = error.message.includes('already registered')
          ? t('auth.already_registered')
          : error.message.includes('valid email')
          ? t('auth.invalid_email_format')
          : error.message.startsWith('password_breached')
          ? t('auth.password_breached')
          : error.message
        showToast({ type: 'error', message: msg, duration: 5000 })
      } else if (data?.user?.identities?.length === 0) {
        showToast({ type: 'warning', message: t('auth.already_registered') })
        setIsRegistering(false)
      } else if (data?.session?.user) {
        // auto-confirmed, the state updates and useEffect handles redirect
      } else {
        showToast({ type: 'success', message: t('auth.account_created'), duration: 6000 })
      }
    } else {
      const { error } = await signInWithEmail(email, password)
      if (error) {
        const msg = error.message.includes('Invalid login')
          ? t('auth.wrong_credentials')
          : error.message.includes('Email not confirmed')
          ? t('auth.confirm_email')
          : error.message
        showToast({ type: 'error', message: msg })
      } else {
        // login successful, state handles redirect
      }
    }
  }

  return (
    <div className="min-h-screen hero-gradient flex flex-col items-center justify-center px-6 py-8 glass-ambient">
      <div className="max-w-sm w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
        {/* Logo */}
        <div className="space-y-4">
          <h1 className="text-6xl font-black text-white tracking-tighter">padel<span className="text-emerald-500">zero</span></h1>
          <div className="flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-zinc-800"></span>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Mexico City · 2026</p>
            <span className="h-px w-8 bg-zinc-800"></span>
          </div>
        </div>

        {/* Auth Card */}
        <div className="glass-card p-6 rounded-[2rem] space-y-6 w-full">
          <form
            onSubmit={(e) => { e.preventDefault(); handleEmailAuth() }}
            className="space-y-3 w-full"
            autoComplete="on"
          >
            <input
              type="email"
              inputMode="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); passwordRef.current?.focus() } }}
              placeholder="correo@ejemplo.com"
              autoComplete="email"
              className="glass-input w-full px-5 py-4 rounded-2xl text-white placeholder-zinc-700 text-center text-sm transition-all"
            />
            <input
              ref={passwordRef}
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="tu contraseña"
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              className="glass-input w-full px-5 py-4 rounded-2xl text-white placeholder-zinc-700 text-center text-sm transition-all"
            />
            <GlassButton
              variant="primary"
              size="lg"
              fullWidth
              type="submit"
              disabled={authLoading}
            >
              {authLoading ? t('auth.processing') : isRegistering ? `${t('auth.create_account')} ✨` : `${t('auth.login')} ⚡️`}
            </GlassButton>
          </form>

          <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
            <span>{isRegistering ? t('auth.have_account') : t('auth.new_user')}</span>
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-emerald-500 hover:text-emerald-400 underline decoration-2 underline-offset-4"
            >
              {isRegistering ? t('auth.sign_in') : t('auth.sign_up')}
            </button>
          </div>

          {!isRegistering && (
            <button
              onClick={async () => {
                if (!email.trim()) {
                  showToast({ type: 'error', message: lang === 'es' ? 'Escribe tu correo primero' : 'Enter your email first' })
                  return
                }
                const { error } = await resetPassword(email.trim())
                if (error) {
                  showToast({ type: 'error', message: error.message })
                } else {
                  showToast({ type: 'success', message: lang === 'es' ? 'Revisa tu correo para recuperar tu contraseña' : 'Check your email to reset your password', duration: 5000 })
                }
              }}
              className="text-xs text-zinc-500 hover:text-zinc-400 underline underline-offset-4"
            >
              {lang === 'es' ? '¿Olvidaste tu contraseña?' : 'Forgot password?'}
            </button>
          )}

          <div className="relative flex items-center">
            <div className="flex-grow border-t border-zinc-800"></div>
            <span className="flex-shrink mx-4 text-[10px] text-zinc-600 font-bold tracking-widest uppercase text-nowrap">{t('auth.or_continue')}</span>
            <div className="flex-grow border-t border-zinc-800"></div>
          </div>

          <GlassButton
            variant="secondary"
            size="lg"
            fullWidth
            onClick={handleGoogleLogin}
            disabled={authLoading}
            className="!bg-white hover:!bg-zinc-100 !text-zinc-950"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </GlassButton>
        </div>

        <div className="space-y-3">
          <GlassButton
            variant="ghost"
            size="md"
            fullWidth
            onClick={() => navigate('/ranking')}
          >
            📊 {t('auth.view_rankings')}
          </GlassButton>
          <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-[0.2em]">Zero Friction · High Performance</p>
        </div>

        {/* Language Toggle */}
        <button
          onClick={toggleLang}
          className="text-[10px] text-zinc-600 hover:text-zinc-400 font-bold uppercase tracking-widest transition"
          aria-label="Toggle language"
        >
          {lang === 'es' ? '🇺🇸 English' : '🇪🇸 Español'}
        </button>
      </div>
    </div>
  )
}
