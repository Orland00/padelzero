import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { flushQueue, getQueueLength } from '@/lib/offlineQueue'
import { useMatchStore } from '@/stores/matchStore'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppShell from '@/components/layout/AppShell'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { I18nProvider } from '@/lib/i18n'
import { usePushStore } from '@/stores/pushStore'
import PushBanner from '@/components/PushBanner'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useUiStore } from '@/stores/uiStore'

/**
 * PadelZero Main Application Entry Point
 * 
 * Handles routing, authentication initialization, offline sync queue, 
 * and global app state. Uses lazy loading for performance optimization.
 * 
 * Updated: 2026-04-29
 */

// Critical pages loaded eagerly
import Home from '@/pages/Home'

// Dev-only pages
const DevButtons = lazy(() => import('@/pages/DevButtons'))

const Clubes = lazy(() => import('@/pages/Clubes'))
const ClubProfile = lazy(() => import('@/pages/ClubProfile'))
const AddCourt = lazy(() => import('@/pages/AddCourt'))
const ClubAdmin = lazy(() => import('@/pages/ClubAdmin'))
const ClubRegister = lazy(() => import('@/pages/ClubRegister'))
const Coaches = lazy(() => import('@/pages/Coaches'))
const CoachRegister = lazy(() => import('@/pages/CoachRegister'))
const CoachProfile = lazy(() => import('@/pages/CoachProfile'))
const CoachDashboard = lazy(() => import('@/pages/CoachDashboard'))
const CoachCRM = lazy(() => import('@/pages/CoachCRM'))

/**
 * Lazy-loaded page components to minimize initial bundle size.
 * Pages are grouped by functionality for better maintainability.
 */
const Onboarding = lazy(() => import('@/pages/Onboarding'))
const Play = lazy(() => import('@/pages/Play'))
const Ranking = lazy(() => import('@/pages/Ranking'))
const Profile = lazy(() => import('@/pages/Profile'))
const PlayerProfile = lazy(() => import('@/pages/PlayerProfile'))
const Sessions = lazy(() => import('@/pages/Sessions'))
const Session = lazy(() => import('@/pages/Session'))
const Settings = lazy(() => import('@/pages/Settings'))
const Match = lazy(() => import('@/pages/Match'))
const MatchResult = lazy(() => import('@/pages/MatchResult'))
const CreateMatch = lazy(() => import('@/pages/CreateMatch'))
const CreateSession = lazy(() => import('@/pages/CreateSession'))
const Anunciate = lazy(() => import('@/pages/Anunciate'))
const TorneoDemoClub = lazy(() => import('@/pages/TorneoDemoClub'))
const Comunidad = lazy(() => import('@/pages/Comunidad'))
const Terms = lazy(() => import('@/pages/Terms'))
const Privacy = lazy(() => import('@/pages/Privacy'))
const Liga = lazy(() => import('@/pages/Liga'))
const LigaJoin = lazy(() => import('@/pages/LigaJoin'))
const McpSetup = lazy(() => import('@/pages/McpSetup'))
const LigaDetail = lazy(() => import('@/pages/LigaDetail'))
const JornadaRouter = lazy(() => import('@/pages/JornadaRouter'))
const LigaProLeagueDetail = lazy(() => import('@/pages/LigaProLeagueDetail'))
const EloGuide = lazy(() => import('@/pages/EloGuide'))
const EloCalculator = lazy(() => import('@/pages/EloCalculator'))
const CreateTournament = lazy(() => import('@/pages/CreateTournament'))
const TournamentDetail = lazy(() => import('@/pages/TournamentDetail'))
const Torneos = lazy(() => import('@/pages/Torneos'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const AdminInterests = lazy(() => import('@/pages/AdminInterests'))
const MatchConfirm = lazy(() => import('@/pages/MatchConfirm'))
const OpenMatches = lazy(() => import('@/pages/OpenMatches'))
const ActivityFeed = lazy(() => import('@/pages/ActivityFeed'))

// Minimal loading spinner for lazy chunks
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen theme-bg">
      <div className="animate-spin w-8 h-8 border-4 border-zinc-700 border-t-emerald-500 rounded-full" />
    </div>
  )
}

/**
 * Main App Component
 * 
 * Manages global side effects like online status tracking, offline queue flushing,
 * and push notification initialization.
 */
export default function App() {
  const { ready, initialize, user } = useAuthStore()
  const { createMatch } = useMatchStore()
  const { confirm } = useUiStore()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [queueCount, setQueueCount] = useState(0)

  // PWA Update Logic — §0.4 Requirement
  const swRegRef = useRef(null)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      swRegRef.current = r || null
    },
  })

  // Poll for SW updates every 15 minutes; cleanup on unmount
  useEffect(() => {
    const id = setInterval(() => {
      swRegRef.current?.update()
    }, 15 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (needRefresh) {
      confirm({
        title: 'Nueva versión disponible 🚀',
        message: 'Actualiza para obtener las últimas mejoras y correcciones.',
        confirmText: 'Actualizar ahora',
        cancelText: 'Más tarde'
      }).then((ok) => {
        if (ok) {
          updateServiceWorker(true)
        } else {
          setNeedRefresh(false)
        }
      })
    }
  }, [needRefresh, updateServiceWorker, confirm, setNeedRefresh])

  useEffect(() => {
    initialize()
  }, [initialize])

  // Track offline queue count
  useEffect(() => {
    if (!isOnline) {
      const interval = setInterval(async () => {
        try { setQueueCount(await getQueueLength()) } catch {}
      }, 2000)
      getQueueLength().then(setQueueCount).catch(() => {})
      return () => clearInterval(interval)
    } else {
      setQueueCount(0)
    }
  }, [isOnline])

  /**
   * Effect hook to handle connectivity changes.
   * Flushes the offline match queue when the device goes back online.
   */
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      if (!user?.id) return
      await flushQueue(async (matchData) => {
        return await createMatch(
          matchData.p1Id, matchData.p1bId, matchData.p2Id, matchData.p2bId,
          matchData.setsToWin, matchData.tipo, matchData.clubId, matchData.courtNumber
        )
      }, user.id)
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [createMatch, user?.id])

  const { showBanner, subscribe, dismissBanner, initialize: initPush } = usePushStore()

  useEffect(() => {
    if (user?.id) initPush(user.id)
  }, [user?.id, initPush])

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full mx-auto mb-4"></div>
          <p className="text-zinc-400">Cargando...</p>
        </div>
      </div>
    )
  }

  /**
   * Router Configuration
   * 
   * Defines public and protected routes. Protected routes are wrapped in a layout
   * that provides the navigation shell.
   */
  return (
    <ErrorBoundary>
    <I18nProvider>
        {showBanner && <PushBanner onEnable={() => subscribe(user?.id)} onDismiss={dismissBanner} />}
    <BrowserRouter>
      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed bottom-16 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="bg-zinc-800 border border-zinc-600 text-zinc-200 text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <span>📵</span>
            <span>Sin conexión{queueCount > 0 ? ` — ${queueCount} partido${queueCount > 1 ? 's' : ''} pendiente${queueCount > 1 ? 's' : ''}` : ' — los cambios se sincronizarán'}</span>
          </div>
        </div>
      )}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route path="/elo-guide" element={<EloGuide />} />
          <Route path="/torneo-manada" element={<TorneoDemoClub />} />
          <Route path="/liga/join/:code" element={<LigaJoin />} />
          {/* /mcp was publicly reachable in prod (A5 UX landmine) — gate to DEV builds only */}
          {import.meta.env.DEV && <Route path="/mcp" element={<McpSetup />} />}
          {import.meta.env.DEV && <Route path="/dev/buttons" element={<DevButtons />} />}
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          {/* Protected routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/liga-proleague" element={<LigaProLeagueDetail />} />
            <Route path="/torneo-proleague" element={<LigaProLeagueDetail />} />
            <Route path="/liga" element={<Liga />} />
            <Route path="/liga/:id" element={<LigaDetail />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="/play" element={<Play />} />
            <Route path="/social" element={<Comunidad />} />
            <Route path="/feed" element={<Navigate to="/social" replace />} />
            <Route path="/rival-finder" element={<Navigate to="/social" replace />} />
            <Route path="/create-match" element={<CreateMatch />} />
            <Route path="/create-session" element={<CreateSession />} />
            <Route path="/torneos" element={<Torneos />} />
            <Route path="/create-tournament" element={<CreateTournament />} />
            <Route path="/torneo/:id" element={<TournamentDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/player/:id" element={<PlayerProfile />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/session/:id" element={<Session />} />
            <Route path="/match/:id" element={<Match />} />
            <Route path="/match/:id/result" element={<MatchResult />} />
            <Route path="/match/:id/confirm" element={<MatchConfirm />} />
            <Route path="/partidos-abiertos" element={<OpenMatches />} />
            <Route path="/actividad" element={<ActivityFeed />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/clubes" element={<Clubes />} />
            <Route path="/clubes/agregar" element={<AddCourt />} />
            <Route path="/club/register" element={<ClubRegister />} />
            <Route path="/club/:slug" element={<ClubProfile />} />
            <Route path="/club/:slug/admin" element={<ClubAdmin />} />
            <Route path="/coaches" element={<Coaches />} />
            <Route path="/coach/register" element={<CoachRegister />} />
            <Route path="/coach/dashboard" element={<CoachDashboard />} />
            <Route path="/coach/crm/:playerId" element={<CoachCRM />} />
            <Route path="/coach/:id" element={<CoachProfile />} />
            <Route path="/anunciate" element={<Anunciate />} />
            <Route path="/liga/:ligaId/jornada/:jornadaId" element={<JornadaRouter />} />
            <Route path="/admin/interests" element={<AdminInterests />} />
            <Route path="/calculator" element={<EloCalculator />} />
          </Route>

          {/* Catch all — 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
    </I18nProvider>
    </ErrorBoundary>
  )
}

/**
 * OnboardingRoute Wrapper
 * 
 * Ensures that users who have already completed onboarding are redirected to the 
 * main app, while new users are guided through the initial setup.
 */
function OnboardingRoute() {
  const navigate = useNavigate()
  const { user, profile, ready, profileLoading, profileError } = useAuthStore()

  // When profile loads and user already has display_name → skip onboarding
  useEffect(() => {
    if (ready && user && !profileLoading && profile?.display_name) {
      navigate('/play', { replace: true })
    }
  }, [ready, user, profile, profileLoading, navigate])

  if (!ready || profileLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-10 h-10 border-4 border-zinc-700 border-t-emerald-500 rounded-full" />
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/" replace />

  if (profileError && !profile) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 px-6">
        <div className="text-center max-w-sm">
          <p className="text-white font-black mb-2">No se pudo cargar tu perfil</p>
          <p className="text-sm text-zinc-400 mb-4">Recarga para intentar de nuevo.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-zinc-950 text-sm font-black"
          >
            Recargar
          </button>
        </div>
      </div>
    )
  }

  if (profile?.display_name) return null

  return <Onboarding />
}
