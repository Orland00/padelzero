import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROD_ORIGINS = [
  "https://padelzero.win",
  "https://www.padelzero.win",
];
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
];
const ALLOWED_ORIGINS = Deno.env.get("ENVIRONMENT") === "production"
  ? PROD_ORIGINS
  : [...PROD_ORIGINS, ...DEV_ORIGINS];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

const DEFAULT_ELO = 1200;
const K_NEW = 40;
const K_STANDARD = 32;
const MATCH_THRESHOLD = 20;
const TOURNAMENT_MATCH_COLUMNS = "id, tournament_id, team1_id, team2_id, status, winner_team_id, team1_sets, team2_sets";

function getK(matchesPlayed: number) {
  return matchesPlayed < MATCH_THRESHOLD ? K_NEW : K_STANDARD;
}

function expectedScore(myRating: number, oppRating: number) {
  return 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Verify JWT
    const authHeader = req.headers.get("Authorization")!;
    const supabaseAuth = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized: Invalid JWT");

    // Parse payload
    const { match_id, winner_id, team1_sets, team2_sets, tournament_id } = await req.json();
    if (!match_id || !winner_id || !tournament_id) {
      throw new Error("match_id, winner_id, and tournament_id are required");
    }

    // Verify caller is tournament creator
    const { data: tournament, error: tournErr } = await supabaseAdmin
      .from("tournaments")
      .select("id, created_by, elo_impact")
      .eq("id", tournament_id)
      .single();
    if (tournErr || !tournament) throw new Error("Tournament not found");
    if (tournament.created_by !== user.id) {
      throw new Error("Unauthorized: Not tournament creator");
    }

    // Fetch match
    const { data: match, error: matchErr } = await supabaseAdmin
      .from("tournament_matches")
      .select(TOURNAMENT_MATCH_COLUMNS)
      .eq("id", match_id)
      .single();
    if (matchErr || !match) throw new Error("Match not found");
    if (match.tournament_id !== tournament_id) throw new Error("Match does not belong to tournament");

    if (![match.team1_id, match.team2_id].includes(winner_id)) {
      throw new Error("Winner team does not belong to this match");
    }

    // The store updates the tournament match result before invoking this function.
    // Use ELO history keyed by match_id as the idempotency guard instead of
    // match.status, so Stripe-style retries/client retries do not double-apply ELO.
    const { data: existingEloHistory, error: historyLookupErr } = await supabaseAdmin
      .from("elo_history")
      .select("id")
      .eq("source", "tournament")
      .eq("source_id", match_id)
      .limit(1);
    if (historyLookupErr) throw historyLookupErr;
    if (existingEloHistory && existingEloHistory.length > 0) {
      return new Response(
        JSON.stringify({ success: true, already_processed: true, elo_changes: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // If no ELO impact, return early
    if (!tournament.elo_impact) {
      return new Response(
        JSON.stringify({ success: true, elo_changes: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Fetch winner and loser teams from tournament_participants
    const winnerTeamId = winner_id;
    const loserTeamId = winnerTeamId === match.team1_id ? match.team2_id : match.team1_id;

    const { data: teams, error: teamsErr } = await supabaseAdmin
      .from("tournament_participants")
      .select("id, p1_id, p2_id")
      .in("id", [winnerTeamId, loserTeamId]);
    if (teamsErr || !teams || teams.length < 2) throw new Error("Teams not found");

    const winnerTeam = teams.find(t => t.id === winnerTeamId)!;
    const loserTeam = teams.find(t => t.id === loserTeamId)!;

    const winnerIds = [winnerTeam.p1_id, winnerTeam.p2_id].filter(Boolean);
    const loserIds = [loserTeam.p1_id, loserTeam.p2_id].filter(Boolean);
    const allIds = [...winnerIds, ...loserIds];

    // Fetch all player profiles
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from("profiles")
      .select("id, elo_rating, elo_peak, matches_played, matches_won")
      .in("id", allIds);
    if (profilesErr) throw profilesErr;

    const pMap: Record<string, any> = {};
    for (const p of profiles!) pMap[p.id] = p;

    // Calculate ELO
    const winTeamElo = winnerIds.reduce((s, id) => s + (pMap[id]?.elo_rating ?? DEFAULT_ELO), 0) / winnerIds.length;
    const loseTeamElo = loserIds.reduce((s, id) => s + (pMap[id]?.elo_rating ?? DEFAULT_ELO), 0) / loserIds.length;
    const expWin = expectedScore(winTeamElo, loseTeamElo);
    const expLose = 1 - expWin;

    const eloChanges: Array<{ id: string; newElo: number; delta: number; isWinner: boolean }> = [];

    for (const id of winnerIds) {
      const p = pMap[id];
      const k = getK(p?.matches_played ?? 0);
      const delta = Math.round(k * (1 - expWin));
      const newElo = (p?.elo_rating ?? DEFAULT_ELO) + delta;
      eloChanges.push({ id, newElo, delta, isWinner: true });
    }
    for (const id of loserIds) {
      const p = pMap[id];
      const k = getK(p?.matches_played ?? 0);
      const delta = Math.round(k * (0 - expLose));
      const newElo = Math.max(800, (p?.elo_rating ?? DEFAULT_ELO) + delta);
      eloChanges.push({ id, newElo, delta, isWinner: false });
    }

    // Apply all ELO updates
    for (const change of eloChanges) {
      const p = pMap[change.id];
      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .update({
          elo_rating: change.newElo,
          elo_peak: Math.max(change.newElo, p?.elo_peak ?? DEFAULT_ELO),
          matches_played: (p?.matches_played ?? 0) + 1,
          matches_won: change.isWinner ? (p?.matches_won ?? 0) + 1 : p?.matches_won ?? 0,
        })
        .eq("id", change.id);
      if (profileErr) throw new Error(`Failed to update profile ${change.id}: ${profileErr.message}`);

      const { error: historyErr } = await supabaseAdmin.from("elo_history").insert({
        player_id: change.id,
        elo_before: p?.elo_rating ?? DEFAULT_ELO,
        elo_after: change.newElo,
        delta: change.delta,
        source: "tournament",
        source_id: match_id,
      });
      if (historyErr) console.error(`elo_history insert failed for ${change.id}:`, historyErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        elo_changes: eloChanges.map(c => ({
          player_id: c.id,
          delta: c.delta,
          new_elo: c.newElo,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("finish-tournament-match error:", error.message);
    const safeMessages = [
      "match_id, winner_id, and tournament_id are required",
      "Tournament not found",
      "Unauthorized: Invalid JWT",
      "Unauthorized: Not tournament creator",
      "Match not found",
      "Match does not belong to tournament",
      "Winner team does not belong to this match",
      "Teams not found",
    ];
    const clientMessage = safeMessages.includes(error.message)
      ? error.message
      : "An error occurred processing the tournament match";
    return new Response(JSON.stringify({ error: clientMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
