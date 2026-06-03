import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useUiStore } from '@/stores/uiStore';
// Updated: 2026-05-08
import { generateBalancedBracket } from '@/utils/bracketEngine'
import { eloToLevel } from '@/utils/eloEngine'
import {
  TOURNAMENT_PARTICIPANT_PROFILE_SELECT,
  recordTournamentMatchResult,
} from '@/lib/tournamentService'

/**
 * Tournament Detail State Management Store
 * 
 * Manages complex state for individual tournaments, including participant registration,
 * bracket generation (single elimination), match recording, and waitlist promotion.
 * 
 * Updated: 2026-04-29
 */
export const useTournamentDetailStore = create((set, get) => ({
  tournament: null,
  participants: [],
  matches: [],
  standings: [],
  loading: false,
  error: null,

  /**
   * Fetches all data related to a specific tournament.
   * Aggregates tournament info, participants with profiles, matches, and standings in parallel.
   * 
   * Updated: 2026-04-29
   */
  fetchTournament: async (id) => {
    set({ loading: true, error: null });
    try {
      const [tournamentRes, participantsRes, matchesRes, standingsRes] = await Promise.all([
        supabase.from('tournaments').select('id, name, format, max_players, liga_id, description, elo_impact, entry_fee, deadline, created_by, status, join_code, created_at, updated_at').eq('id', id).single(),
        supabase
          .from('tournament_participants')
          .select(TOURNAMENT_PARTICIPANT_PROFILE_SELECT)
          .eq('tournament_id', id),
        supabase.from('tournament_matches').select('id, tournament_id, team1_id, team2_id, next_match_id, round, bracket_slot, status, match_number, stage, winner_team_id, team1_sets, team2_sets, created_at, updated_at').eq('tournament_id', id).order('round', { ascending: false }).order('bracket_slot'),
        supabase.from('tournament_standings').select('id, tournament_id, participant_id, position, points, wins, losses, sets_won, sets_lost, games_won, games_lost, seed, team_name, created_at, updated_at').eq('tournament_id', id),
      ]);

      if (tournamentRes.error) throw tournamentRes.error;
      if (participantsRes.error) throw participantsRes.error;
      if (matchesRes.error) throw matchesRes.error;
      if (standingsRes.error) throw standingsRes.error;

      set({
        tournament: tournamentRes.data,
        participants: participantsRes.data || [],
        matches: matchesRes.data || [],
        standings: standingsRes.data || [],
        loading: false,
      });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  /**
   * Creates a new tournament entry.
   * Resticted to authenticated users. Initializes in 'setup' status.
   * 
   * Updated: 2026-04-29
   */
  createTournament: async ({ name, format, maxPlayers, ligaId, description, eloImpact, entryFee, deadline }) => {
    set({ loading: true, error: null });
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          name,
          format: format || 'single_elimination',
          max_players: maxPlayers || 16,
          liga_id: ligaId || null,
          description: description || null,
          elo_impact: eloImpact ?? true,
          entry_fee: entryFee || 0,
          deadline: deadline || null,
          created_by: user.id,
          status: 'setup',
        })
        .select('id, name, format, max_players, liga_id, description, elo_impact, entry_fee, deadline, created_by, status, join_code, created_at, updated_at')
        .single();

      if (error) throw error;
      set({ tournament: data, loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      return null;
    }
  },

  /**
   * Manually adds a team to the tournament (Admin operation).
   * Generates a default team name if none is provided.
   * 
   * Updated: 2026-04-29
   */
  addTeam: async (tournamentId, p1Id, p2Id, teamName) => {
    set({ loading: true, error: null });
    try {
      const participants = get().participants;
      const generatedName = teamName || `Equipo ${participants.length + 1}`;

      const { data, error } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournamentId,
          p1_id: p1Id,
          p2_id: p2Id,
          team_name: generatedName,
          status: 'registered',
        })
        .select(TOURNAMENT_PARTICIPANT_PROFILE_SELECT)
        .single();

      if (error) throw error;
      set({ participants: [...participants, data], loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      return null;
    }
  },

  removeTeam: async (participantId) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('tournament_participants')
        .delete()
        .eq('id', participantId);

      if (error) throw error;
      set({
        participants: get().participants.filter((p) => p.id !== participantId),
        loading: false,
      });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  /**
   * Generates a single-elimination bracket for the tournament.
   * Sizes the bracket to the nearest power of 2 and handles BYE advances
   * automatically if teams are missing in first-round slots.
   * 
   * Updated: 2026-04-29
   */
  generateBracket: async (tournamentId) => {
    set({ loading: true, error: null });
    try {
      // Fetch participants
      const { data: participants, error: fetchErr } = await supabase
        .from('tournament_participants')
        .select('id, tournament_id, p1_id, p2_id, team_name, status, seed, registered_at, checked_in_at, created_at, updated_at')
        .eq('tournament_id', tournamentId);

      if (fetchErr) throw fetchErr;
      if (!participants || participants.length < 2) throw new Error('Se necesitan al menos 2 equipos');

      // Sort by seed or shuffle randomly
      const sorted = [...participants].sort((a, b) => {
        if (a.seed && b.seed) return a.seed - b.seed;
        if (a.seed) return -1;
        if (b.seed) return 1;
        return Math.random() - 0.5;
      });

      // Pad to nearest power of 2
      let bracketSize = 2;
      while (bracketSize < sorted.length) bracketSize *= 2;

      const seeded = new Array(bracketSize).fill(null);

      // Standard seeding placement: 1v(N), 2v(N-1), etc.
      for (let i = 0; i < sorted.length; i++) {
        seeded[i] = sorted[i];
      }

      // Build matchups with standard seeding: 1v(N), 2v(N-1)
      const firstRoundMatchups = [];
      for (let i = 0; i < bracketSize / 2; i++) {
        const topSeed = seeded[i];
        const bottomSeed = seeded[bracketSize - 1 - i];
        firstRoundMatchups.push({ team1: topSeed, team2: bottomSeed });
      }

      // Calculate total rounds
      const totalRounds = Math.log2(bracketSize);

      // Build all rounds of matches
      // Round numbering: final = round 1, semis = round 2, quarters = round 4, etc.
      // We use round = (bracketSize / 2^(roundIndex)) where roundIndex starts at 0 for first round
      const allMatches = [];
      const matchesByRound = {};

      // Create first round matches
      const firstRoundValue = bracketSize / 2; // e.g., 4 for 8 teams (quarterfinals)
      matchesByRound[0] = [];
      for (let i = 0; i < firstRoundMatchups.length; i++) {
        const { team1, team2 } = firstRoundMatchups[i];
        allMatches.push({
          tournament_id: tournamentId,
          team1_id: team1 ? team1.id : null,
          team2_id: team2 ? team2.id : null,
          round: firstRoundValue,
          bracket_slot: i + 1,
          status: 'pending',
          match_number: i + 1,
          stage: 'bracket',
        });
        matchesByRound[0].push(allMatches.length - 1);
      }

      // Create subsequent rounds
      let matchNumber = firstRoundMatchups.length + 1;
      for (let r = 1; r < totalRounds; r++) {
        const numMatches = firstRoundMatchups.length / Math.pow(2, r);
        const roundValue = firstRoundValue / Math.pow(2, r);
        matchesByRound[r] = [];
        for (let i = 0; i < numMatches; i++) {
          allMatches.push({
            tournament_id: tournamentId,
            team1_id: null,
            team2_id: null,
            round: roundValue,
            bracket_slot: i + 1,
            status: 'pending',
            match_number: matchNumber++,
            stage: 'bracket',
          });
          matchesByRound[r].push(allMatches.length - 1);
        }
      }

      // Insert all matches
      const { data: insertedMatches, error: insertErr } = await supabase
        .from('tournament_matches')
        .insert(allMatches)
        .select('id, tournament_id, team1_id, team2_id, next_match_id, round, bracket_slot, status, match_number, stage, winner_team_id, team1_sets, team2_sets, created_at, updated_at');

      if (insertErr) throw insertErr;

      // Link next_match_id: every pair of matches in round r feeds into one match in round r+1
      const updates = [];
      for (let r = 0; r < totalRounds - 1; r++) {
        const currentRoundIdxs = matchesByRound[r];
        const nextRoundIdxs = matchesByRound[r + 1];
        for (let i = 0; i < currentRoundIdxs.length; i++) {
          const currentMatch = insertedMatches[currentRoundIdxs[i]];
          const nextMatch = insertedMatches[nextRoundIdxs[Math.floor(i / 2)]];
          updates.push(
            supabase
              .from('tournament_matches')
              .update({ next_match_id: nextMatch.id })
              .eq('id', currentMatch.id)
          );
        }
      }

      if (updates.length > 0) {
        const results = await Promise.all(updates);
        for (const res of results) {
          if (res.error) throw res.error;
        }
      }

      // Auto-advance BYE matches (where one team is null)
      const byeAdvances = [];
      for (const idx of matchesByRound[0]) {
        const match = insertedMatches[idx];
        const hasBye = !match.team1_id || !match.team2_id;
        const hasTeam = match.team1_id || match.team2_id;
        if (hasBye && hasTeam) {
          const winnerId = match.team1_id || match.team2_id;
          byeAdvances.push(
            supabase
              .from('tournament_matches')
              .update({
                winner_team_id: winnerId,
                team1_sets: match.team1_id ? 1 : 0,
                team2_sets: match.team2_id ? 1 : 0,
                status: 'finished',
              })
              .eq('id', match.id)
          );

          // Also fill winner into next match if exists
          // Find the next match for this match
          const nextRoundIdxs = matchesByRound[1];
          if (nextRoundIdxs) {
            const firstRoundIdx = matchesByRound[0].indexOf(idx);
            const nextMatchData = insertedMatches[nextRoundIdxs[Math.floor(firstRoundIdx / 2)]];
            if (nextMatchData) {
              const isFirstFeeder = firstRoundIdx % 2 === 0;
              const updateField = isFirstFeeder ? 'team1_id' : 'team2_id';
              byeAdvances.push(
                supabase
                  .from('tournament_matches')
                  .update({ [updateField]: winnerId })
                  .eq('id', nextMatchData.id)
              );
            }
          }
        }
      }

      if (byeAdvances.length > 0) {
        const results = await Promise.all(byeAdvances);
        for (const res of results) {
          if (res.error) throw res.error;
        }
      }

      // Update tournament status to in_progress
      await supabase
        .from('tournaments')
        .update({ status: 'in_progress' })
        .eq('id', tournamentId);

      // Refresh data
      await get().fetchTournament(tournamentId);
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  /**
   * Records the result of a tournament match.
   * Updates the match record and automatically advances the winner to the 
   * next bracket slot. Also triggers ELO updates via Edge Function.
   * 
   * Updated: 2026-04-29
   */
  recordMatchResult: async (matchId, team1Sets, team2Sets) => {
    set({ loading: true, error: null });
    try {
      const match = get().matches.find((m) => m.id === matchId);
      const { eloError } = await recordTournamentMatchResult({
        match,
        matches: get().matches,
        tournament: get().tournament,
        team1Sets,
        team2Sets,
      });

      if (eloError) {
        console.error('Tournament ELO update failed:', eloError);
        useUiStore.getState().showToast({ type: 'warning', message: 'Resultado guardado, pero el cálculo de ELO falló. Contacta a un admin.', duration: 5000 });
      }

      // Refresh data
      await get().fetchTournament(match.tournament_id);
    } catch (error) {
      set({ error: error.message, loading: false });
      useUiStore.getState().showToast({ type: 'error', message: error.message || 'Error al registrar resultado', duration: 4000 });
      throw error;
    }
  },

  updateTournamentStatus: async (id, status) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      set((state) => ({
        tournament: state.tournament ? { ...state.tournament, status } : null,
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  startRegistration: async (tournamentId) => {
    await get().updateTournamentStatus(tournamentId, 'registration');
  },

  // ── Self-registration (non-admin) ──

  /**
   * Handles user-driven team registration.
   * Includes duplicate registration guards and handles automatic waitlisting
   * if the tournament has reached its maximum capacity.
   * 
   * Updated: 2026-04-29
   */
  registerTeam: async (tournamentId, p1Id, p2Id, teamName) => {
    set({ loading: true, error: null });
    try {
      const tournament = get().tournament;

      // Guard: tournament must be in registration state
      if (tournament?.status && tournament.status !== 'registration' && tournament.status !== 'draft') {
        throw new Error('Las inscripciones ya cerraron para este torneo');
      }

      // Guard: prevent duplicate registration (either player already registered)
      const { data: existing, error: existErr } = await supabase
        .from('tournament_participants')
        .select('id, p1_id, p2_id')
        .eq('tournament_id', tournamentId)
        .neq('status', 'cancelled')
        .or(`p1_id.eq.${p1Id},p2_id.eq.${p1Id},p1_id.eq.${p2Id},p2_id.eq.${p2Id}`);
      if (existErr) throw existErr;
      if (existing && existing.length > 0) {
        throw new Error('Uno de los jugadores ya está inscrito en este torneo');
      }

      // Fresh count from DB (avoid stale client state race)
      const { count, error: countErr } = await supabase
        .from('tournament_participants')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)
        .eq('status', 'registered');
      if (countErr) throw countErr;
      const isFull = tournament?.max_players && (count || 0) >= tournament.max_players;
      const status = isFull ? 'waitlisted' : 'registered';

      const { data, error } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournamentId,
          p1_id: p1Id,
          p2_id: p2Id,
          team_name: teamName || `Equipo ${get().participants.length + 1}`,
          status,
        })
        .select(TOURNAMENT_PARTICIPANT_PROFILE_SELECT)
        .single();

      if (error) throw error;
      set({ participants: [...get().participants, data], loading: false });
      if (isFull) {
        useUiStore.getState().showToast({ type: 'info', message: 'Torneo lleno — añadido a lista de espera', duration: 3500 });
      } else {
        useUiStore.getState().showToast({ type: 'success', message: '¡Inscripción registrada!', duration: 2500 });
      }
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      useUiStore.getState().showToast({ type: 'error', message: error.message || 'Error al inscribir', duration: 4000 });
      return null;
    }
  },

  /**
   * Cancels a team's registration.
   * If a waitlist exists, automatically promotes the next eligible team to 'registered'.
   * 
   * Updated: 2026-04-29
   */
  cancelRegistration: async (participantId, tournamentId) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('tournament_participants')
        .update({ status: 'cancelled' })
        .eq('id', participantId);

      if (error) throw error;

      // Auto-promote first waitlisted team
      const waitlisted = get()
        .participants.filter(p => p.status === 'waitlisted')
        .sort((a, b) => new Date(a.registered_at) - new Date(b.registered_at));

      if (waitlisted.length > 0) {
        const { error: promoteErr } = await supabase
          .from('tournament_participants')
          .update({ status: 'registered' })
          .eq('id', waitlisted[0].id);
        if (promoteErr) {
          console.error('Waitlist auto-promote failed:', promoteErr);
          useUiStore.getState().showToast({ type: 'warning', message: 'Cancelación OK, pero no se pudo promover lista de espera. Contacta a un admin.', duration: 5000 });
        } else {
          useUiStore.getState().showToast({ type: 'info', message: 'Siguiente equipo en lista de espera promovido', duration: 3000 });
        }
      }

      // Refresh data
      await get().fetchTournament(tournamentId);
    } catch (error) {
      set({ error: error.message, loading: false });
      useUiStore.getState().showToast({ type: 'error', message: error.message || 'Error al cancelar registro', duration: 3000 });
      throw error;
    }
  },

  getUserRegistration: (userId) => {
    return get().participants.find(
      p => (p.p1_id === userId || p.p2_id === userId) && p.status !== 'cancelled'
    );
  },

  /**
   * Generate a level-balanced bracket for the current tournament.
   * Fetches participant profiles (with level), runs snake-draft,
   * and returns pairs and byes for the organizer to review.
   *
   * Updated: 2026-05-08
   */
  generateLevelBracket: async (tournamentId) => {
    const { data: participants, error } = await supabase
      .from('tournament_participants')
      .select('p1_id, p1:profiles!tournament_participants_p1_id_fkey(id, display_name, level, elo_rating)')
      .eq('tournament_id', tournamentId)
      .eq('status', 'registered')

    if (error || !participants) return { error: error?.message || 'No participants', pairs: [], byes: [] }

    const players = participants
      .filter(p => p.p1)
      .map(p => ({
        id: p.p1_id,
        display_name: p.p1.display_name,
        level: p.p1.level ?? eloToLevel(p.p1.elo_rating ?? 1200),
      }))

    if (players.length < 2) return { error: 'Need at least 2 participants', pairs: [], byes: [] }

    try {
      const { pairs, byes } = generateBalancedBracket(players)
      return { pairs, byes, error: null }
    } catch (err) {
      return { error: err.message, pairs: [], byes: [] }
    }
  },
}));
