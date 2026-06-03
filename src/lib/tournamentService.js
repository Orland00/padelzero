import { supabase } from '@/lib/supabase'

export const TOURNAMENT_PARTICIPANT_PROFILE_SELECT =
  'id, tournament_id, p1_id, p2_id, team_name, status, seed, registered_at, checked_in_at, created_at, updated_at, p1_profile:profiles!tournament_participants_p1_id_fkey(id, display_name, username, avatar_url, level, elo_rating), p2_profile:profiles!tournament_participants_p2_id_fkey(id, display_name, username, avatar_url, level, elo_rating)'

export async function recordTournamentMatchResult({ match, matches, tournament, team1Sets, team2Sets }) {
  if (!match) throw new Error('Partido no encontrado')

  const winnerId = team1Sets > team2Sets ? match.team1_id : match.team2_id

  const { error: updateErr } = await supabase
    .from('tournament_matches')
    .update({
      team1_sets: team1Sets,
      team2_sets: team2Sets,
      winner_team_id: winnerId,
      status: 'finished',
    })
    .eq('id', match.id)

  if (updateErr) throw updateErr

  if (match.next_match_id) {
    const nextMatch = matches.find((m) => m.id === match.next_match_id)
    if (nextMatch) {
      const feeders = matches
        .filter((m) => m.next_match_id === match.next_match_id)
        .sort((a, b) => a.bracket_slot - b.bracket_slot)

      const feederIndex = feeders.findIndex((m) => m.id === match.id)
      const updateField = feederIndex === 0 ? 'team1_id' : 'team2_id'

      const { error: advanceErr } = await supabase
        .from('tournament_matches')
        .update({ [updateField]: winnerId })
        .eq('id', match.next_match_id)

      if (advanceErr) throw advanceErr
    }
  } else {
    const { error: statusErr } = await supabase
      .from('tournaments')
      .update({ status: 'finished' })
      .eq('id', match.tournament_id)

    if (statusErr) throw statusErr
  }

  let eloError = null
  if (tournament?.elo_impact) {
    const { error } = await supabase.functions.invoke('finish-tournament-match', {
      body: {
        match_id: match.id,
        winner_id: winnerId,
        team1_sets: team1Sets,
        team2_sets: team2Sets,
        tournament_id: match.tournament_id,
      },
    })
    eloError = error || null
  }

  return { winnerId, eloError }
}
