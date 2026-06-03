import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ADMIN_USER_ID } from '@/lib/constants'

export default function AdminInterests() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  usePageTitle('Admin — Feature Interests')

  const [interests, setInterests] = useState([])
  const [loading, setLoading] = useState(true)

  // Guard: only admin can access this page
  useEffect(() => {
    if (user && user.id !== ADMIN_USER_ID) {
      navigate('/play', { replace: true })
    }
  }, [user, navigate])

  useEffect(() => {
    if (!user || user.id !== ADMIN_USER_ID) return
    const load = async () => {
      // Fetch all interests grouped by feature_key
      const { data } = await supabase
        .from('feature_interests')
        .select('feature_key, user_id, created_at, profiles:user_id(display_name)')
        .order('created_at', { ascending: false })

      // Group by feature_key
      const grouped = {}
      for (const item of (data || [])) {
        if (!grouped[item.feature_key]) grouped[item.feature_key] = []
        grouped[item.feature_key].push(item)
      }

      // Convert to sorted array
      const sorted = Object.entries(grouped)
        .map(([key, items]) => ({ key, count: items.length, users: items }))
        .sort((a, b) => b.count - a.count)

      setInterests(sorted)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient">
      <div className="px-4 pt-6 space-y-4">
        <h1 className="text-xl font-black text-white">Feature Interests</h1>
        <p className="text-xs text-zinc-500">Demand tracking — who clicked "Me interesa"</p>

        {loading ? (
          <div className="text-center py-8"><div className="glass-spinner mx-auto" /></div>
        ) : interests.length === 0 ? (
          <p className="text-center text-zinc-500 py-8">No interests yet</p>
        ) : (
          <div className="space-y-3">
            {interests.map(f => (
              <div key={f.key} className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-white">{f.key}</h3>
                  <span className="text-lg font-black text-emerald-400">{f.count}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {f.users.map(u => (
                    <span key={u.user_id} className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
                      {u.profiles?.display_name || 'Anon'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
