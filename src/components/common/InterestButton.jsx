import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import { ADMIN_USER_ID } from '@/lib/constants'

export default function InterestButton({ featureKey }) {
  const { user, profile } = useAuthStore()
  const { lang } = useI18n()
  const es = lang === 'es'
  const [interested, setInterested] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('feature_interests')
      .select('id')
      .eq('feature_key', featureKey)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setInterested(!!data))
  }, [user, featureKey])

  const handleClick = async () => {
    if (!user || interested || loading) return
    setLoading(true)
    const { error } = await supabase
      .from('feature_interests')
      .insert({ feature_key: featureKey, user_id: user.id })
    if (!error) {
      setInterested(true)
      // Notify admin
      if (ADMIN_USER_ID && ADMIN_USER_ID !== user.id) {
        const userName = profile?.display_name || user.email || 'Alguien'
        supabase.from('notifications').insert({
          recipient_id: ADMIN_USER_ID,
          sender_id: user.id,
          type: 'general',
          title: `Me interesa: ${featureKey.replace(/_/g, ' ')}`,
          message: `${userName} quiere ${featureKey.replace(/_/g, ' ')}`,
          data: { feature_key: featureKey, user_name: userName },
        }).then(() => {})
      }
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={interested || loading || !user}
      className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition ${
        interested
          ? 'bg-emerald-500/10 text-emerald-400 cursor-default'
          : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
      }`}
    >
      {interested ? (es ? '✓ Te interesa' : '✓ Interested') : (es ? 'Me interesa' : "I'm interested")}
    </button>
  )
}
