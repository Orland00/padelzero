import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import LigaJornada from './LigaJornada'
import LigaJornadaDetail from './LigaJornadaDetail'

/**
 * Smart router that determines whether to show the live jornada editor
 * or the completed jornada detail view based on jornada status
 */
export default function JornadaRouter() {
  const { jornadaId } = useParams()
  const [jornada, setJornada] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (jornadaId) {
      fetchJornada()
    }
  }, [jornadaId])

  const fetchJornada = async () => {
    try {
      const { data, error } = await supabase
        .from('jornadas')
        .select('status')
        .eq('id', jornadaId)
        .single()

      if (error) throw error
      setJornada(data)
    } catch (err) {
      // Default to detail view if error
      setJornada({ status: 'completed' })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-zinc-950">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  // Show detail view for completed jornadas
  if (jornada?.status === 'completed') {
    return <LigaJornadaDetail />
  }

  // Show live editor for in-progress and upcoming jornadas
  return <LigaJornada />
}
