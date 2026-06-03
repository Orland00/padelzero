import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/useTheme'
import GlassButton from '@/components/ui/GlassButton'
import { LIGA_PROLEAGUE_ID } from '@/lib/constants'

export default function Header() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { t, lang } = useI18n()
  const {
    notifications, unreadCount, initialize, cleanup,
    markAsRead, acceptFriendRequest, rejectFriendRequest,
    acceptLigaInvite, rejectLigaInvite
  } = useNotificationStore()

  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const { isDark } = useTheme()
  const es = lang === 'es'

  // Fetch notifications on mount and setup real-time
  useEffect(() => {
    if (user?.id) {
      initialize()
    } else {
      cleanup()
    }
  }, [user?.id, initialize, cleanup])

  const handleNotificationClick = async (notification) => {
    // If it's a request, clicking the body shouldn't immediately mark read
    if (notification.type === 'friend_request') {
      navigate('/profile')
    } else if (notification.type === 'liga_invite') {
      const ligaId = notification.data?.liga_id
      if (ligaId === LIGA_PROLEAGUE_ID) {
        navigate('/liga-proleague')
      } else if (ligaId) {
        navigate(`/liga/${ligaId}`)
      }
    } else {
      await markAsRead(notification.id)
    }
    setShowNotifications(false)
  }

  const handleAction = async (e, actionFn, notification) => {
    e.stopPropagation()
    await actionFn(notification)
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'friend_request':
        return '👋'
      case 'match_result':
        return '🎾'
      case 'achievement':
        return '🏆'
      case 'liga_invite':
        return '📬'
      case 'liga_event':
        return '⚡'
      default:
        return '📬'
    }
  }

  return (
    <header
      className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between h-16"
      style={isDark ? {
        background: 'linear-gradient(170deg, rgba(28,28,38,0.88) 0%, rgba(18,18,26,0.94) 100%)',
        backdropFilter: 'blur(40px) saturate(1.6) brightness(1.08)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.6) brightness(1.08)',
        borderBottom: '1.5px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 -1px 0 rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.08)',
      } : {
        background: 'linear-gradient(170deg, rgba(255,255,255,0.92) 0%, rgba(250,250,250,0.96) 100%)',
        backdropFilter: 'blur(40px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-center gap-3">
        <h1 onClick={() => navigate('/play')} className="text-xl font-black tracking-tighter text-white cursor-pointer active:scale-95 transition">padel<span className="text-emerald-500">zero</span></h1>
        <GlassButton variant="ghost" size="xs" onClick={() => navigate('/mcp')} className="!text-[10px] !font-black !uppercase !tracking-widest">MCP</GlassButton>
      </div>
      <div className="flex items-center gap-4">
        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="text-zinc-400 hover:text-zinc-200 relative transition"
            style={{ fontSize: '18px' }}
            aria-label="Notifications"
          >
            {'\u{1F514}'}
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Panel */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="glass-card absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto z-50"
              >
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-zinc-400">
                    <p className="text-sm">{t('header.no_notifications')}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`w-full text-left p-3 transition ${
                          !notification.is_read ? 'bg-white/[0.03]' : ''
                        }`}
                      >
                        <div
                          className="flex items-start gap-3 cursor-pointer"
                          onClick={() => handleNotificationClick(notification)}
                        >
                          {/* Sender avatar takes priority over emoji when we know who it's from */}
                          {notification.sender?.avatar_url ? (
                            <img
                              src={notification.sender.avatar_url}
                              alt=""
                              loading="lazy"
                              width={28}
                              height={28}
                              className="w-7 h-7 rounded-full object-cover mt-0.5 flex-shrink-0"
                            />
                          ) : notification.sender?.display_name ? (
                            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center justify-center mt-0.5 flex-shrink-0">
                              {notification.sender.display_name.charAt(0).toUpperCase()}
                            </div>
                          ) : (
                            <span className="text-lg mt-1">{getNotificationIcon(notification.type)}</span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white text-sm">{notification.title}</p>
                            {notification.sender?.display_name && (
                              <p className="text-[11px] text-emerald-400 mt-0.5">
                                {es ? 'de' : 'from'} {notification.sender.display_name}
                              </p>
                            )}
                            {notification.message && (
                              <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{notification.message}</p>
                            )}
                            <p className="text-[10px] text-zinc-500 mt-1">
                              {new Date(notification.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX')}
                            </p>
                          </div>
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
                          )}
                        </div>

                        {/* Interactive Buttons */}
                        {notification.type === 'friend_request' && !notification.is_read && (
                          <div className="flex gap-2 mt-3 pl-9">
                            <GlassButton
                              variant="primary"
                              size="xs"
                              onClick={(e) => handleAction(e, acceptFriendRequest, notification)}
                            >
                              {t('header.accept')}
                            </GlassButton>
                            <GlassButton
                              variant="secondary"
                              size="xs"
                              onClick={(e) => handleAction(e, rejectFriendRequest, notification)}
                            >
                              {t('header.reject')}
                            </GlassButton>
                          </div>
                        )}

                        {notification.type === 'liga_invite' && !notification.is_read && (
                          <div className="flex gap-2 mt-3 pl-9">
                            <GlassButton
                              variant="primary"
                              size="xs"
                              onClick={(e) => handleAction(e, acceptLigaInvite, notification)}
                            >
                              {t('header.join_liga')}
                            </GlassButton>
                            <GlassButton
                              variant="secondary"
                              size="xs"
                              onClick={(e) => handleAction(e, rejectLigaInvite, notification)}
                            >
                              {t('common.cancel')}
                            </GlassButton>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-emerald-400 transition"
            style={isDark ? {
              background: 'linear-gradient(170deg, rgba(39,39,42,0.9) 0%, rgba(24,24,27,0.95) 100%)',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              borderLeft: '1px solid rgba(255,255,255,0.05)',
              borderRight: '1px solid rgba(255,255,255,0.03)',
              borderBottom: '1px solid rgba(255,255,255,0.02)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.3)',
            } : {
              background: 'linear-gradient(170deg, rgba(244,244,245,0.95) 0%, rgba(228,228,231,0.9) 100%)',
              border: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}
            aria-label="Profile menu"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              profile?.display_name?.charAt(0).toUpperCase() || 'G'
            )}
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="glass-card absolute right-0 top-full mt-2 w-48 z-50 py-1"
                >
                  {[
                    { label: es ? 'Mi Perfil' : 'My Profile', path: '/profile', icon: '👤' },
                    { label: 'Ranking', path: '/ranking', icon: '🏆' },
                    { label: es ? 'Ajustes' : 'Settings', path: '/settings', icon: '⚙️' },
                  ].map(item => (
                    <button
                      key={item.path}
                      onClick={() => { navigate(item.path); setShowProfileMenu(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-white/[0.05] transition flex items-center gap-3"
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
