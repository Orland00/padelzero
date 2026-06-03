import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const LIGA_STANDING_COLUMNS = 'id, liga_id, player_id, total_points, matches_played, jornadas_attended, has_crown'

interface FinalizeRequest {
  jornadaId: string
  ligaId: string
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // --- AUTH CHECK ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create a client with the user's JWT to verify identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { jornadaId, ligaId } = await req.json() as FinalizeRequest

    if (!jornadaId || !ligaId) {
      return new Response(JSON.stringify({ error: 'jornadaId and ligaId are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Use service role client for privileged operations
    const client = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is admin of this liga
    const { data: membership, error: memberErr } = await client
      .from('liga_members')
      .select('role')
      .eq('liga_id', ligaId)
      .eq('player_id', user.id)
      .single()

    if (memberErr || !membership || membership.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only liga admins can finalize jornadas' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verify the jornada belongs to the stated liga (prevents cross-liga manipulation)
    const { data: jornada, error: jornadaErr } = await client
      .from('jornadas')
      .select('liga_id')
      .eq('id', jornadaId)
      .single();
    if (jornadaErr || !jornada || jornada.liga_id !== ligaId) {
      throw new Error("Jornada does not belong to this liga");
    }

    // Get all rounds for this jornada first, then fetch matches
    const { data: rounds, error: roundsErr } = await client
      .from('americano_rounds')
      .select('id')
      .eq('jornada_id', jornadaId)

    if (roundsErr) throw roundsErr

    const roundIds = rounds?.map(r => r.id) || []

    let matches: any[] = []
    if (roundIds.length > 0) {
      const { data: matchData, error: matchesErr } = await client
        .from('americano_matches')
        .select(`
          id,
          score_team_a,
          score_team_b,
          team_a_player1,
          team_a_player2,
          team_b_player1,
          team_b_player2,
          bye_player
        `)
        .in('round_id', roundIds)

      if (matchesErr) throw matchesErr
      matches = matchData || []
    }

    // Calculate points by player
    const playerPoints: { [key: string]: number } = {}

    matches.forEach(match => {
      // Team A
      if (match.score_team_a !== null && match.score_team_b !== null) {
        playerPoints[match.team_a_player1] = (playerPoints[match.team_a_player1] || 0) + match.score_team_a
        playerPoints[match.team_a_player2] = (playerPoints[match.team_a_player2] || 0) + match.score_team_a
        // Team B
        playerPoints[match.team_b_player1] = (playerPoints[match.team_b_player1] || 0) + match.score_team_b
        playerPoints[match.team_b_player2] = (playerPoints[match.team_b_player2] || 0) + match.score_team_b
      }

      // Bye player gets average
      if (match.bye_player) {
        const allScores = [match.score_team_a, match.score_team_b].filter(s => s !== null)
        const average = allScores.length > 0 ? Math.round(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length) : 0
        playerPoints[match.bye_player] = (playerPoints[match.bye_player] || 0) + average
      }
    })

    // Get existing standings so we can INCREMENT (not replace)
    const { data: existingStandings } = await client
      .from('liga_standings')
      .select(LIGA_STANDING_COLUMNS)
      .eq('liga_id', ligaId)

    const existingMap: { [key: string]: any } = {}
    existingStandings?.forEach(s => { existingMap[s.player_id] = s })

    // Get all liga members to initialize standings if needed
    const { data: members } = await client
      .from('liga_members')
      .select('player_id')
      .eq('liga_id', ligaId)

    // Upsert standings — INCREMENT points and jornadas, don't replace
    const standingsUpdates = members?.map(m => {
      const existing = existingMap[m.player_id]
      const newPoints = playerPoints[m.player_id] || 0
      const participated = newPoints > 0

      return {
        liga_id: ligaId,
        player_id: m.player_id,
        total_points: (existing?.total_points || 0) + newPoints,
        matches_played: existing?.matches_played || 0,
        jornadas_attended: (existing?.jornadas_attended || 0) + (participated ? 1 : 0),
      }
    }) || []

    if (standingsUpdates.length > 0) {
      const { error: standErr } = await client
        .from('liga_standings')
        .upsert(standingsUpdates, { onConflict: 'liga_id,player_id' })

      if (standErr) throw standErr
    }

    // Get current standings to determine crown
    const { data: standings, error: standingsErr } = await client
      .from('liga_standings')
      .select(LIGA_STANDING_COLUMNS)
      .eq('liga_id', ligaId)
      .order('total_points', { ascending: false })

    if (standingsErr) throw standingsErr

    // Find previous crown holder
    const { data: previousCrown } = await client
      .from('liga_standings')
      .select('player_id')
      .eq('liga_id', ligaId)
      .eq('has_crown', true)
      .maybeSingle()

    const newCrownPlayer = standings?.[0]?.player_id

    // Update crown
    if (standings && standings.length > 0) {
      // Reset all crowns
      await client
        .from('liga_standings')
        .update({ has_crown: false })
        .eq('liga_id', ligaId)

      // Set new crown
      await client
        .from('liga_standings')
        .update({ has_crown: true })
        .eq('id', standings[0].id)

      // Record crown transfer in history
      if (newCrownPlayer !== previousCrown?.player_id) {
        await client
          .from('crown_history')
          .insert({
            liga_id: ligaId,
            player_id: newCrownPlayer,
            dethroned_id: previousCrown?.player_id || null,
            jornada_id: jornadaId,
          })
      }
    }

    // Mark jornada as completed
    const { error: finalizeErr } = await client
      .from('jornadas')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', jornadaId)

    if (finalizeErr) throw finalizeErr

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Jornada finalized',
        playersUpdated: standingsUpdates.length,
        newCrownHolder: newCrownPlayer,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('finalize_jornada error:', error)
    const safeMessages = [
      'Missing authorization header',
      'Invalid or expired token',
      'jornadaId and ligaId are required',
      'Only liga admins can finalize jornadas',
      'Jornada does not belong to this liga',
    ]
    const msg = error instanceof Error ? error.message : ''
    const clientMessage = safeMessages.includes(msg) ? msg : 'An error occurred finalizing the jornada'
    return new Response(
      JSON.stringify({ error: clientMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
