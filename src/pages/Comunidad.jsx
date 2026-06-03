import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import GlassButton from '@/components/ui/GlassButton'
import Feed from './Feed'
import RivalFinder from './RivalFinder'
import Anunciate from './Anunciate'

export default function Comunidad() {
  const [activeTab, setActiveTab] = useState('feed')
  const { user } = useAuthStore()
  const [hasPending, setHasPending] = useState(false)

  useEffect(() => {
    if (!user) return
    const checkPending = async () => {
      const { count } = await supabase
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('addressee_id', user.id)
        .eq('status', 'pending')
      setHasPending(count > 0)
    }
    checkPending()

    const sub = supabase.channel('friend-requests')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `addressee_id=eq.${user.id}`
      }, () => checkPending())
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [user])

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient">
      {/* Tab Switcher */}
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 px-4 pt-6">
        <h1 className="text-2xl font-black text-white italic tracking-tighter mb-4">
          {activeTab === 'feed' ? 'COMUNIDAD' : activeTab === 'busqueda' ? 'BUSCAR AMIGOS' : 'ANUNCIOS'}
        </h1>

        <div className="flex gap-2 mb-4">
            {[
              { id: 'feed', label: 'ACTIVIDAD', icon: '🗞️', color: 'emerald' },
              { id: 'busqueda', label: 'BUSCAR', icon: '🔍', dot: hasPending, color: 'cyan' },
              { id: 'anuncios', label: 'PROMO', icon: '🎯', color: 'purple' },
            ].map(tab => (
              <div key={tab.id} className="relative flex-1">
                <GlassButton
                  pill
                  pillColor={activeTab === tab.id ? tab.color : undefined}
                  variant={activeTab === tab.id ? 'primary' : 'ghost'}
                  onClick={() => setActiveTab(tab.id)}
                  fullWidth
                  className="text-[10px] font-black tracking-widest"
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </GlassButton>
                {tab.dot && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-zinc-900 rounded-full animate-bounce z-10"></span>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Render Active Component */}
      <div className="mt-0">
        {activeTab === 'feed' && <Feed hideHeader />}
        {activeTab === 'busqueda' && <RivalFinder hideHeader />}
        {activeTab === 'anuncios' && <Anunciate hideHeader />}
      </div>
    </div>
  )
}
