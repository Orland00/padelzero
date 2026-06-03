import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMetaSignature, extractMessage } from "../_shared/whatsapp-meta.ts";
import { resolveWaUser, isRateLimited, getGroupLinks } from "../_shared/whatsapp-users.ts";

const BOT_TRIGGERS = ["bot", "padelbot"];

function shouldRespond(
  messageText: string,
  isGroup: boolean,
  contextMessageId: string | null
): boolean {
  // Always respond in DMs
  if (!isGroup) return true;
  // In groups: respond if bot is mentioned or message is a reply to bot
  const lower = messageText.toLowerCase();
  if (BOT_TRIGGERS.some((t) => lower.includes(t))) return true;
  if (contextMessageId) return true; // reply to a message (we check if it's bot's later)
  return false;
}

Deno.serve(async (req) => {
  // ─── GET: Meta webhook verification ───
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
    if (mode === "subscribe" && token === verifyToken) {
      console.log("Webhook verified");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ─── POST: Incoming message ───
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.text();

    // Verify Meta signature
    const appSecret = Deno.env.get("META_APP_SECRET");
    if (!appSecret) {
      console.error("META_APP_SECRET not set; refusing unsigned WhatsApp webhook");
      return new Response("Server misconfiguration", { status: 500 });
    }
    const signature = req.headers.get("X-Hub-Signature-256") || "";
    const valid = await verifyMetaSignature(body, signature, appSecret);
    if (!valid) {
      console.error("Invalid Meta signature");
      return new Response("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(body);
    const message = extractMessage(payload);

    // Not a text message or not a message event → ack and ignore
    if (!message) {
      return new Response(JSON.stringify({ status: "ignored" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if bot should respond
    if (!shouldRespond(message.messageText, message.isGroup, message.contextMessageId)) {
      return new Response(JSON.stringify({ status: "not_mentioned" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Init Supabase with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve WhatsApp user → PadelZero profile
    const waUser = await resolveWaUser(supabase, message.senderPhone, message.senderName);

    // Rate limit check
    if (await isRateLimited(supabase, waUser.id)) {
      // Respond quickly, don't invoke agent
      return new Response(JSON.stringify({ status: "rate_limited" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get group links if in a group
    let groupLinks = { ligaId: null as string | null, clubId: null as number | null };
    if (message.isGroup && message.groupId) {
      groupLinks = await getGroupLinks(supabase, message.groupId);
    }

    // Log inbound message
    await supabase.from("whatsapp_messages").insert({
      wa_user_id: waUser.id,
      group_id: message.groupId,
      direction: "inbound",
      message_text: message.messageText,
    });

    // Invoke agent function (fire-and-forget for speed, but await for reliability)
    const agentPayload = {
      senderPhone: message.senderPhone,
      senderName: waUser.waName || message.senderName,
      profileId: waUser.profileId,
      isLinked: waUser.isLinked,
      isGroup: message.isGroup,
      groupId: message.groupId,
      messageText: message.messageText,
      ligaId: groupLinks.ligaId,
      clubId: groupLinks.clubId,
      waUserId: waUser.id,
    };

    // Call agent function
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(agentPayload),
    });

    return new Response(JSON.stringify({ status: "processing" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    // Always return 200 to Meta (avoid retries)
    return new Response(JSON.stringify({ status: "error" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
