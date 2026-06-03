import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.warn("RESEND_API_KEY not set — skipping email");
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { bookingId } = await req.json();
    if (!bookingId) {
      return new Response(JSON.stringify({ error: "bookingId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch booking with relations
    const { data: booking, error } = await supabase
      .from("club_bookings")
      .select("*, courts(name, court_number, clubs(name)), profiles!booked_by(display_name)")
      .eq("id", bookingId)
      .single();

    if (error || !booking) {
      console.error("Booking not found:", error);
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get user email from auth
    const { data: { user } } = await supabase.auth.admin.getUserById(booking.booked_by);
    const email = user?.email;
    if (!email) {
      console.warn("No email for user", booking.booked_by);
      return new Response(JSON.stringify({ skipped: true, reason: "no_email" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const clubName = booking.courts?.clubs?.name || "PadelZero Club";
    const courtName = booking.courts?.name || `Cancha ${booking.courts?.court_number}`;
    const playerName = booking.profiles?.display_name || "Jugador";
    const date = booking.booking_date;
    const startTime = booking.start_time?.substring(0, 5);
    const endTime = booking.end_time?.substring(0, 5);
    const price = `$${(booking.price_cents / 100).toFixed(0)} MXN`;

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0f; color: #fff; padding: 32px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="font-size: 20px; margin: 0; color: #34d399;">Reserva Confirmada</h1>
          <p style="color: #71717a; font-size: 12px; margin-top: 4px;">PadelZero</p>
        </div>
        <div style="background: #18181b; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
          <p style="color: #a1a1aa; font-size: 12px; margin: 0 0 4px;">Club</p>
          <p style="font-weight: bold; margin: 0 0 12px;">${clubName}</p>
          <p style="color: #a1a1aa; font-size: 12px; margin: 0 0 4px;">Cancha</p>
          <p style="font-weight: bold; margin: 0 0 12px;">${courtName}</p>
          <p style="color: #a1a1aa; font-size: 12px; margin: 0 0 4px;">Fecha</p>
          <p style="font-weight: bold; margin: 0 0 12px;">${date}</p>
          <p style="color: #a1a1aa; font-size: 12px; margin: 0 0 4px;">Horario</p>
          <p style="font-weight: bold; margin: 0 0 12px;">${startTime} - ${endTime}</p>
          <p style="color: #a1a1aa; font-size: 12px; margin: 0 0 4px;">Precio</p>
          <p style="font-weight: bold; color: #34d399; margin: 0;">${price}</p>
        </div>
        <p style="color: #71717a; font-size: 11px; text-align: center;">
          Nos vemos en la cancha, ${playerName} 🏸
        </p>
      </div>
    `;

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PadelZero <noreply@padelzero.win>",
        to: [email],
        subject: `Reserva confirmada — ${courtName} · ${date} ${startTime}`,
        html: htmlBody,
      }),
    });

    const resendResult = await resendRes.json();
    if (!resendRes.ok) {
      console.error("Resend error:", resendResult);
      return new Response(JSON.stringify({ error: "Email send failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true, id: resendResult.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Email function error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
