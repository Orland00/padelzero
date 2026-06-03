import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useLigaStore } from '@/stores/ligaStore'
import { useUiStore } from '@/stores/uiStore'
import GlassButton from '@/components/ui/GlassButton'

export default function LigaJoin() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { joinLiga } = useLigaStore()
  const { showToast } = useUiStore()
  const [status, setStatus] = useState('loading') // loading | joining | done | error | login
  const [liga, setLiga] = useState(null)

  useEffect(() => {
    if (!code) { setStatus('error'); return }

    if (!user) {
      setStatus('login')
      return
    }

    const join = async () => {
      try {
        // Find liga by join_code
        const { data, error } = await supabase
          .from('ligas')
          .select('id, name')
          .eq('join_code', code.toLowerCase())
          .single()

        if (error || !data) {
          setStatus('error')
          return
        }

        setLiga(data)
        setStatus('joining')

        // Check if already a member
        const { data: existing } = await supabase
          .from('liga_members')
          .select('id')
          .eq('liga_id', data.id)
          .eq('player_id', user.id)
          .maybeSingle()

        if (existing) {
          showToast({ type: 'info', message: 'Ya eres miembro de esta liga' })
          navigate(`/liga/${data.id}`, { replace: true })
          return
        }

        // Join the liga
        await joinLiga(data.id)
        showToast({ type: 'success', message: `¡Te uniste a ${data.name}!` })
        setStatus('done')
        navigate(`/liga/${data.id}`, { replace: true })
      } catch (err) {
        setStatus('error')
      }
    }

    join()
  }, [code, user])

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="glass-card p-8 text-center max-w-sm w-full">
        {status === 'loading' && (
          <>
            <div className="animate-spin w-10 h-10 border-4 border-zinc-700 border-t-emerald-500 rounded-full mx-auto mb-4" />
            <p className="text-zinc-400">Buscando liga...</p>
          </>
        )}

        {status === 'joining' && (
          <>
            <div className="animate-spin w-10 h-10 border-4 border-zinc-700 border-t-emerald-500 rounded-full mx-auto mb-4" />
            <p className="text-white font-bold mb-1">Uniéndote a {liga?.name}</p>
            <p className="text-zinc-400 text-sm">Un momento...</p>
          </>
        )}

        {status === 'login' && (
          <>
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔒</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Inicia sesión primero</h2>
            <p className="text-sm text-zinc-400 mb-6">
              Necesitas una cuenta para unirte a esta liga.
            </p>
            <GlassButton
              variant="primary"
              onClick={() => navigate('/', { replace: true })}
              fullWidth
            >
              Iniciar sesión
            </GlassButton>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">❌</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Código no válido</h2>
            <p className="text-sm text-zinc-400 mb-6">
              El enlace de invitación no es válido o ha expirado.
            </p>
            <GlassButton
              variant="secondary"
              onClick={() => navigate('/play', { replace: true })}
              fullWidth
            >
              Ir al inicio
            </GlassButton>
          </>
        )}
      </div>
    </div>
  )
}
