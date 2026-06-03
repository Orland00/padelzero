import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function ProtectedRoute({ children }) {
  const { user, profile, ready, profileLoading, profileError } = useAuthStore()

  if (!ready || profileLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="animate-spin w-10 h-10 border-4 border-zinc-700 border-t-emerald-500 rounded-full" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

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

  if (!profile?.display_name) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
