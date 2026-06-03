import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import UnifiedSessionView from '@/components/Tournament/UnifiedSessionView'
import { THEMES } from '@/lib/themes'

export default function TorneoDemoClub() {
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function findOfficialSession() {
      // Find the most recent session named like 'Manada'
      const { data } = await supabase
        .from('sessions')
        .select('id')
        .ilike('name', '%Manada%')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (data) setSessionId(data.id)
      setLoading(false)
    }
    findOfficialSession()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="animate-spin w-12 h-12 border-4 border-zinc-700 border-t-white rounded-full" />
      </div>
    )
  }

  // If no session found yet, show Coming Soon themed banner
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-black pb-24 text-white">
        <div className="bg-white text-black text-[10px] font-black uppercase tracking-[0.3em] py-2 text-center animate-pulse">
          🐾 Próximamente · La Manada te espera 🐺
        </div>
        <div className="px-4 pt-12 text-center space-y-4">
           <div className="text-6xl">🐺</div>
           <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">LA DemoClub</h1>
           <p className="text-zinc-500 text-sm">Buscamos al grupo más fuerte de Mexico City. El bracket se activará pronto.</p>
        </div>
      </div>
    )
  }

  return <UnifiedSessionView sessionId={sessionId} forcedTheme={THEMES.manada} />
}
