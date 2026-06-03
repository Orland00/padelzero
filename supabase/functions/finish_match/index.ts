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
const MATCH_COLUMNS = "id, tournament_id, p1_id, p1b_id, p2_id, p2b_id, sets, finished";

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

    // Admin client (bypass RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Auth client (verify user)
    const authHeader = req.headers.get("Authorization")!;
    const supabaseAuth = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized: Invalid JWT");

    // Parse payload
    const { match_id, winner_id, p1_pts, p2_pts, scores } = await req.json();
    if (!match_id || !winner_id)
      throw new Error("match_id and winner_id are required");

    // Fetch match
    const { data: match, error: matchError } = await supabaseAdmin
      .from("matches")
      .select(MATCH_COLUMNS)
      .eq("id", match_id)
      .single();

    if (matchError || !match) throw new Error("Match not found");
    if (match.finished) throw new Error("Match already finished");

    // Verify caller is a participant or tournament admin
    const isPlayer = [match.p1_id, match.p2_id, match.p1b_id, match.p2b_id].includes(user.id);
    let isTournamentAdmin = false;
    if (match.tournament_id) {
      const { data: tournament } = await supabaseAdmin
        .from("tournaments")
        .select("created_by")
        .eq("id", match.tournament_id)
        .single();
      if (tournament?.created_by === user.id) isTournamentAdmin = true;
    }
    if (!isPlayer && !isTournamentAdmin)
      throw new Error("Unauthorized: Not a participant");

    // Determine winner team
    let winner_team: string;
    if (winner_id === match.p1_id || winner_id === match.p1b_id) {
      winner_team = "team_a";
    } else if (winner_id === match.p2_id || winner_id === match.p2b_id) {
      winner_team = "team_b";
    } else {
      throw new Error("Winner ID does not belong to this match");
    }

    // Update match state
    const { error: updateErr } = await supabaseAdmin
      .from("matches")
      .update({
        finished: true,
        winner_team,
        sets: scores || match.sets,
        live_state: { p1_points: p1_pts ?? 0, p2_points: p2_pts ?? 0 },
        updated_at: new Date().toISOString(),
      })
      .eq("id", match_id);
    if (updateErr) throw updateErr;

    // Fetch all player profiles for ELO calc
    const teamAIds = [match.p1_id, match.p1b_id].filter(Boolean);
    const teamBIds = [match.p2_id, match.p2b_id].filter(Boolean);
    const allIds = [...teamAIds, ...teamBIds];

    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from("profiles")
      .select("id, elo_rating, elo_peak, matches_played, matches_won")
      .in("id", allIds);
    if (profilesErr) throw profilesErr;

    const pMap: Record<string, any> = {};
    for (const p of profiles) pMap[p.id] = p;

    // Calculate proper ELO
    const winnerIds = winner_team === "team_a" ? teamAIds : teamBIds;
    const loserIds = winner_team === "team_a" ? teamBIds : teamAIds;

    const winTeamElo =
      winnerIds.reduce((s, id) => s + (pMap[id]?.elo_rating ?? DEFAULT_ELO), 0) /
      winnerIds.length;
    const loseTeamElo =
      loserIds.reduce((s, id) => s + (pMap[id]?.elo_rating ?? DEFAULT_ELO), 0) /
      loserIds.length;

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

    // Apply ELO updates
    for (const change of eloChanges) {
      const p = pMap[change.id];
      await supabaseAdmin
        .from("profiles")
        .update({
          elo_rating: change.newElo,
          elo_peak: Math.max(change.newElo, p?.elo_peak ?? DEFAULT_ELO),
          matches_played: (p?.matches_played ?? 0) + 1,
          matches_won: change.isWinner
            ? (p?.matches_won ?? 0) + 1
            : p?.matches_won ?? 0,
        })
        .eq("id", change.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        winner_team,
        elo_changes: eloChanges.map((c) => ({
          player_id: c.id,
          delta: c.delta,
          new_elo: c.newElo,
        })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("finish_match error:", error.message);
    const safeMessages = [
      "match_id and winner_id are required",
      "Match not found",
      "Match already finished",
      "Unauthorized: Invalid JWT",
      "Unauthorized: Not a participant",
      "Winner ID does not belong to this match",
    ];
    const clientMessage = safeMessages.includes(error.message)
      ? error.message
      : "An error occurred processing the match";
    return new Response(JSON.stringify({ error: clientMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
