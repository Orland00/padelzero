import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '@/stores/sessionStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/lib/i18n'
import GlassButton from '@/components/ui/GlassButton'

export default function Sessions() {
  const navigate = useNavigate()
  const { fetchSessions, joinSession, sessions, loading } = useSessionStore()
  const { showToast } = useUiStore()
  const { t } = useI18n()
  const [filter, setFilter] = useState('active')

  useEffect(() => {
    const loadSessions = async () => {
      const { data, error } = await fetchSessions({ status: filter })
      if (error) {
        showToast({ type: 'error', message: 'Error al cargar sesiones', duration: 3000 })
      }
    }

    loadSessions()
  }, [filter, fetchSessions, showToast])

  const handleJoinSession = async (sessionId) => {
    const { data, error } = await joinSession(sessionId)
    if (error) {
      showToast({ type: 'error', message: 'Error al unirse a sesión', duration: 3000 })
    } else {
      showToast({ type: 'success', message: '¡Te uniste a la sesión!', duration: 2000 })
      navigate(`/session/${sessionId}`)
    }
  }

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full mx-auto mb-4"></div>
          <p className="text-zinc-400">{t('sessions.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Back button */}
      <div className="px-4 pt-4">
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={() => navigate('/play')}
        >
          ← {t('common.back')}
        </GlassButton>
      </div>

      {/* Filters */}
      <div className="px-4 flex gap-2">
        {['active', 'finished'].map((f) => (
          <GlassButton
            key={f}
            pill
            pillColor={filter === f ? 'emerald' : undefined}
            variant={filter === f ? 'primary' : 'ghost'}
            onClick={() => setFilter(f)}
          >
            {f === 'active' ? t('sessions.active') : t('sessions.finished')}
          </GlassButton>
        ))}
      </div>

      {/* Sessions List */}
      <div className="px-4 space-y-2">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-zinc-400">{t('sessions.empty')}</div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="glass-card p-4 space-y-2"
            >
              {/* Session Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-semibold">{session.name || 'Sesión sin nombre'}</p>
                  <p className="text-xs text-zinc-400">{session.formato || 'Round Robin'}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  session.status === 'active' ? 'bg-green-500 text-white' : 'bg-zinc-700 text-zinc-300'
                }`}>
                  {session.status === 'active' ? t('sessions.active') : t('sessions.finished')}
                </span>
              </div>

              {/* Session Info */}
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                <div>
                  <p>{t('sessions.club')}</p>
                  <p className="text-white font-medium">{session.club_name || t('sessions.not_specified')}</p>
                </div>
                <div>
                  <p>{t('sessions.matches_label')}</p>
                  <p className="text-white font-medium">
                    {session.matches ? session.matches.length : 0}
                  </p>
                </div>
              </div>

              {/* Join Button */}
              {session.status === 'active' && (
                <GlassButton
                  variant="primary"
                  fullWidth
                  onClick={() => handleJoinSession(session.id)}
                  className="mt-2"
                >
                  {t('sessions.join')}
                </GlassButton>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
