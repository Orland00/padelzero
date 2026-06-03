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

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    // Auth: get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { bookingId } = await req.json();
    if (!bookingId) {
      return new Response(JSON.stringify({ error: "bookingId required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabase
      .from("club_bookings")
      .select("*, courts(name, court_number, clubs(name, slug, stripe_account_id))")
      .eq("id", bookingId)
      .eq("booked_by", user.id)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!['confirmed', 'pending_payment'].includes(booking.status)) {
      return new Response(JSON.stringify({ error: "Booking is not in a valid status for payment" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Set status to pending_payment before redirecting to Stripe
    await supabase
      .from("club_bookings")
      .update({ status: "pending_payment" })
      .eq("id", bookingId)
      .eq("booked_by", user.id)
      .in("status", ["confirmed", "pending_payment"]);

    if (!booking.courts?.clubs?.stripe_account_id) {
      return new Response(JSON.stringify({ error: "This club does not accept online payments" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const clubName = booking.courts?.clubs?.name || "PadelZero Club";
    const courtName = booking.courts?.name || `Court ${booking.courts?.court_number}`;
    const clubSlug = booking.courts?.clubs?.slug || "";
    const origin = req.headers.get("Origin") || "https://padelzero.win";

    // Create Stripe Checkout session
    const stripeParams = new URLSearchParams();
    stripeParams.append("mode", "payment");
    stripeParams.append("currency", "mxn");
    stripeParams.append("locale", "es-419");
    stripeParams.append("line_items[0][price_data][currency]", "mxn");
    stripeParams.append("line_items[0][price_data][product_data][name]", `${courtName} — ${clubName}`);
    stripeParams.append("line_items[0][price_data][product_data][description]",
      `${booking.booking_date} ${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)}`);
    stripeParams.append("line_items[0][price_data][unit_amount]", String(booking.price_cents));
    stripeParams.append("line_items[0][quantity]", "1");
    stripeParams.append("payment_method_types[0]", "card");
    stripeParams.append("payment_method_types[1]", "oxxo");
    stripeParams.append("success_url", `${origin}/club/${clubSlug}?booking=success`);
    stripeParams.append("cancel_url", `${origin}/club/${clubSlug}?booking=cancelled`);
    stripeParams.append("metadata[booking_id]", bookingId);
    stripeParams.append("metadata[club_id]", String(booking.club_id));
    stripeParams.append("customer_email", user.email || "");

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: stripeParams.toString(),
    });

    const session = await stripeResponse.json();
    if (!stripeResponse.ok) {
      console.error("Stripe error:", session);
      return new Response(JSON.stringify({ error: "Payment processing failed. Please try again." }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Save checkout session ID to booking
    await supabase
      .from("club_bookings")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", bookingId)
      .eq("booked_by", user.id)
      .eq("status", "pending_payment");

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("booking-checkout error:", err);
    return new Response(JSON.stringify({ error: "An error occurred processing your booking" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
