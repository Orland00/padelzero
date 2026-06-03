// supabase/functions/_shared/whatsapp-tools.ts

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Claude tool definitions for the WhatsApp agent
 */
export const TOOL_DEFINITIONS = [
  {
    name: "check_availability",
    description: "Check court availability at a padel club for a specific date. Returns available time slots with prices.",
    input_schema: {
      type: "object" as const,
      properties: {
        club_name: { type: "string", description: "Name or partial name of the club" },
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
      },
      required: ["club_name", "date"],
    },
  },
  {
    name: "create_booking",
    description: "Book a court at a specific time. Requires a linked PadelZero account.",
    input_schema: {
      type: "object" as const,
      properties: {
        court_id: { type: "string", description: "UUID of the court" },
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        start_time: { type: "string", description: "Start time in HH:MM format" },
        end_time: { type: "string", description: "End time in HH:MM format" },
        price_cents: { type: "number", description: "Price in centavos MXN" },
      },
      required: ["court_id", "date", "start_time", "end_time", "price_cents"],
    },
  },
  {
    name: "cancel_booking",
    description: "Cancel an upcoming booking. Only works in DMs for privacy.",
    input_schema: {
      type: "object" as const,
      properties: {
        booking_id: { type: "string", description: "UUID of the booking to cancel" },
      },
      required: ["booking_id"],
    },
  },
  {
    name: "my_bookings",
    description: "List the user's upcoming court bookings. Only works in DMs for privacy.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "record_match",
    description: "Record a 2v2 padel match result in a liga. Requires a linked liga in the group.",
    input_schema: {
      type: "object" as const,
      properties: {
        liga_id: { type: "string", description: "UUID of the liga" },
        team_a_player1: { type: "string", description: "Name of team A player 1" },
        team_a_player2: { type: "string", description: "Name of team A player 2" },
        team_b_player1: { type: "string", description: "Name of team B player 1" },
        team_b_player2: { type: "string", description: "Name of team B player 2" },
        score_a: { type: "number", description: "Score of team A" },
        score_b: { type: "number", description: "Score of team B" },
      },
      required: ["liga_id", "team_a_player1", "team_a_player2", "team_b_player1", "team_b_player2", "score_a", "score_b"],
    },
  },
  {
    name: "get_rankings",
    description: "Get liga standings/rankings. Shows top players by points and ELO.",
    input_schema: {
      type: "object" as const,
      properties: {
        liga_id: { type: "string", description: "UUID of the liga" },
      },
      required: ["liga_id"],
    },
  },
  {
    name: "my_elo",
    description: "Get the user's current ELO rating, matches played, and win rate.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

/**
 * Execute a tool by name with given input against Supabase
 */
export async function executeTool(
  toolName: string,
  input: any,
  supabase: SupabaseClient,
  context: { profileId: string | null; isLinked: boolean; isGroup: boolean }
): Promise<string> {
  try {
    switch (toolName) {
      case "check_availability":
        return await toolCheckAvailability(supabase, input.club_name, input.date);
      case "create_booking":
        if (!context.isLinked) return "Error: Necesitas vincular tu cuenta PadelZero. Agrega tu telefono en la app (Configuracion) o crea cuenta en padelzero.win";
        return await toolCreateBooking(supabase, input, context.profileId!);
      case "cancel_booking":
        if (!context.isLinked) return "Error: Necesitas vincular tu cuenta PadelZero.";
        if (context.isGroup) return "Error: Por privacidad, cancelaciones solo por DM. Mandame mensaje directo.";
        return await toolCancelBooking(supabase, input.booking_id, context.profileId!);
      case "my_bookings":
        if (!context.isLinked) return "Error: Necesitas vincular tu cuenta PadelZero.";
        if (context.isGroup) return "Error: Por privacidad, tus reservas solo por DM. Mandame mensaje directo.";
        return await toolMyBookings(supabase, context.profileId!);
      case "record_match":
        if (!context.isLinked) return "Error: Necesitas vincular tu cuenta PadelZero.";
        return await toolRecordMatch(supabase, input, context.profileId!);
      case "get_rankings":
        return await toolGetRankings(supabase, input.liga_id);
      case "my_elo":
        if (!context.isLinked) return "Error: Necesitas vincular tu cuenta PadelZero.";
        return await toolMyElo(supabase, context.profileId!);
      default:
        return `Error: Tool "${toolName}" no reconocido.`;
    }
  } catch (err: any) {
    console.error(`Tool ${toolName} error:`, err);
    return `Error: ${err.message || "Algo salio mal"}`;
  }
}

// ─── TOOL IMPLEMENTATIONS ──────────────────────────────────

async function toolCheckAvailability(
  supabase: SupabaseClient,
  clubName: string,
  date: string
): Promise<string> {
  // Find club by name
  const safe = clubName.replace(/[%_\\,.()"']/g, "");
  const { data: clubs } = await supabase
    .from("clubs")
    .select("id, name, courts(id, name, court_number, active)")
    .eq("active", true)
    .ilike("name", `%${safe}%`)
    .limit(5);

  if (!clubs?.length) {
    const { data: allClubs } = await supabase
      .from("clubs")
      .select("name")
      .eq("active", true)
      .limit(5);
    const names = allClubs?.map((c) => c.name).join(", ") || "ninguno";
    return `No encontre club "${clubName}". Clubes disponibles: ${names}`;
  }

  if (clubs.length > 1) {
    const names = clubs.map((c) => c.name).join(", ");
    return `Varios clubes encontrados: ${names}. Se mas especifico.`;
  }

  const club = clubs[0];
  const activeCourts = club.courts?.filter((c: any) => c.active) || [];
  if (!activeCourts.length) return `${club.name} no tiene canchas activas.`;

  // Get slots for each court
  const results: string[] = [];
  for (const court of activeCourts) {
    const { data: slots } = await supabase.rpc("get_available_slots", {
      p_court_id: court.id,
      p_date: date,
    });

    const available = slots?.filter((s: any) => s.is_available) || [];
    if (available.length) {
      const courtName = court.name || `Cancha ${court.court_number}`;
      const times = available
        .map((s: any) => {
          const t = s.start_time.substring(0, 5);
          const price = `$${(s.price_cents / 100).toFixed(0)}`;
          const peak = s.is_peak ? " (peak)" : "";
          return `${t} ${price}${peak}`;
        })
        .join(", ");
      results.push(`${courtName} [${court.id}]: ${times}`);
    }
  }

  if (!results.length) return `No hay canchas disponibles en ${club.name} el ${date}.`;
  return `${club.name} — ${date}:\n${results.join("\n")}`;
}

async function toolCreateBooking(
  supabase: SupabaseClient,
  input: any,
  profileId: string
): Promise<string> {
  // Use service role to call RPC on behalf of user
  const { data, error } = await supabase.rpc("create_booking_for_user", {
    p_user_id: profileId,
    p_court_id: input.court_id,
    p_date: input.date,
    p_start_time: input.start_time,
    p_end_time: input.end_time,
    p_price_cents: input.price_cents,
  });

  if (error) {
    if (error.message.includes("exclusion")) return "Ese horario ya fue reservado. Prueba otro.";
    if (error.message.includes("Rate limit")) return "Demasiadas reservas. Intenta en una hora.";
    if (error.message.includes("past")) return "No puedes reservar en el pasado.";
    if (error.message.includes("14 days")) return "Solo puedes reservar hasta 14 dias adelante.";
    return `Error al reservar: ${error.message}`;
  }

  return `Reserva confirmada (ID: ${data}). ${input.date} ${input.start_time}-${input.end_time}. $${(input.price_cents / 100).toFixed(0)} MXN.`;
}

async function toolCancelBooking(
  supabase: SupabaseClient,
  bookingId: string,
  profileId: string
): Promise<string> {
  const { error } = await supabase
    .from("club_bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("booked_by", profileId);

  if (error) return `Error al cancelar: ${error.message}`;
  return "Reserva cancelada. El horario queda libre.";
}

async function toolMyBookings(
  supabase: SupabaseClient,
  profileId: string
): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const { data: bookings } = await supabase
    .from("club_bookings")
    .select("id, booking_date, start_time, end_time, price_cents, status, courts(name, court_number, clubs(name))")
    .eq("booked_by", profileId)
    .gte("booking_date", today)
    .neq("status", "cancelled")
    .order("booking_date")
    .order("start_time")
    .limit(10);

  if (!bookings?.length) return "No tienes reservas proximas.";

  const lines = bookings.map((b: any) => {
    const club = b.courts?.clubs?.name || "Club";
    const court = b.courts?.name || `Cancha ${b.courts?.court_number}`;
    const time = `${b.start_time.substring(0, 5)}-${b.end_time.substring(0, 5)}`;
    const price = `$${(b.price_cents / 100).toFixed(0)}`;
    const status = b.status === "pending_payment" ? " (pago pendiente)" : "";
    return `• ${b.booking_date} ${time} — ${court} @ ${club} ${price}${status} [ID: ${b.id}]`;
  });

  return `Tus reservas:\n${lines.join("\n")}`;
}

async function toolRecordMatch(
  supabase: SupabaseClient,
  input: any,
  profileId: string
): Promise<string> {
  // Resolve player names to UUIDs from liga members
  const { data: members } = await supabase
    .from("liga_members")
    .select("profile_id, profiles!inner(display_name)")
    .eq("liga_id", input.liga_id)
    .eq("status", "active");

  if (!members?.length) return "No hay miembros activos en esta liga.";

  const resolvePlayer = (name: string): { id: string; name: string } | null => {
    const lower = name.toLowerCase().trim();
    const matches = members.filter((m: any) =>
      m.profiles.display_name?.toLowerCase().includes(lower)
    );
    if (matches.length === 1) return { id: matches[0].profile_id, name: matches[0].profiles.display_name };
    return null;
  };

  const players = [
    { key: "team_a_player1", input: input.team_a_player1 },
    { key: "team_a_player2", input: input.team_a_player2 },
    { key: "team_b_player1", input: input.team_b_player1 },
    { key: "team_b_player2", input: input.team_b_player2 },
  ];

  const resolved: Record<string, string> = {};
  for (const p of players) {
    const match = resolvePlayer(p.input);
    if (!match) {
      const lower = p.input.toLowerCase().trim();
      const similar = members
        .filter((m: any) => m.profiles.display_name?.toLowerCase().includes(lower.substring(0, 3)))
        .map((m: any) => m.profiles.display_name);
      if (similar.length) {
        return `No encontre "${p.input}" exacto. Quisiste decir: ${similar.join(", ")}?`;
      }
      return `No encontre a "${p.input}" en la liga. Verifica el nombre.`;
    }
    resolved[p.key] = match.id;
  }

  // Call the RPC
  const { data, error } = await supabase.rpc("record_liga_match", {
    p_liga_id: input.liga_id,
    p_team_a_player1: resolved.team_a_player1,
    p_team_a_player2: resolved.team_a_player2,
    p_team_b_player1: resolved.team_b_player1,
    p_team_b_player2: resolved.team_b_player2,
    p_score_team_a: input.score_a,
    p_score_team_b: input.score_b,
  });

  if (error) return `Error al registrar: ${error.message}`;

  // Format ELO changes from response
  const result = data as any;
  if (result?.elo_changes) {
    const changes = result.elo_changes
      .map((c: any) => `${c.name}: ${c.new_elo} (${c.delta >= 0 ? "+" : ""}${c.delta})`)
      .join(", ");
    return `Partido registrado! ${input.team_a_player1}/${input.team_a_player2} ${input.score_a}-${input.score_b} ${input.team_b_player1}/${input.team_b_player2}. ELO: ${changes}`;
  }

  return `Partido registrado! ${input.score_a}-${input.score_b}`;
}

async function toolGetRankings(
  supabase: SupabaseClient,
  ligaId: string
): Promise<string> {
  const { data: liga } = await supabase
    .from("ligas")
    .select("name")
    .eq("id", ligaId)
    .single();

  const { data: standings } = await supabase
    .from("liga_standings")
    .select("total_points, elo_rating, matches_played, matches_won, profiles!inner(display_name)")
    .eq("liga_id", ligaId)
    .order("total_points", { ascending: false })
    .order("elo_rating", { ascending: false })
    .limit(10);

  if (!standings?.length) return "No hay standings en esta liga aun.";

  const ligaName = liga?.name || "Liga";
  const lines = standings.map((s: any, i: number) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
    return `${medal} ${s.profiles.display_name} — ${s.total_points}pts · ${s.elo_rating} ELO · ${s.matches_won}W/${s.matches_played}P`;
  });

  return `🏆 ${ligaName}:\n${lines.join("\n")}`;
}

async function toolMyElo(
  supabase: SupabaseClient,
  profileId: string
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, elo_rating, elo_peak, matches_played, matches_won")
    .eq("id", profileId)
    .single();

  if (!profile) return "No encontre tu perfil.";

  const winRate = profile.matches_played > 0
    ? Math.round((profile.matches_won / profile.matches_played) * 100)
    : 0;

  return `${profile.display_name}: ELO ${profile.elo_rating} (peak: ${profile.elo_peak}). ${profile.matches_played} partidos, ${profile.matches_won} ganados (${winRate}%).`;
}
