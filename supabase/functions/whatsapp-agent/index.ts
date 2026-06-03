// supabase/functions/whatsapp-agent/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppMessage } from "../_shared/whatsapp-meta.ts";
import { TOOL_DEFINITIONS, executeTool } from "../_shared/whatsapp-tools.ts";
import { linkGroupToLiga, linkGroupToClub } from "../_shared/whatsapp-users.ts";

interface AgentPayload {
  senderPhone: string;
  senderName: string;
  profileId: string | null;
  isLinked: boolean;
  isGroup: boolean;
  groupId: string | null;
  messageText: string;
  ligaId: string | null;
  clubId: number | null;
  waUserId: string;
}

const SYSTEM_PROMPT = `Eres PadelBot, el asistente AI de PadelZero para WhatsApp. Ayudas a jugadores de padel a consultar disponibilidad de canchas, reservar, registrar partidos y ver rankings.

Reglas:
- Responde siempre en espanol (a menos que el usuario escriba en ingles)
- Solo usa los tools proporcionados — nunca inventes datos
- Respuestas cortas (2-3 lineas maximo para consultas simples)
- Tono casual y amigable (tuteo)
- Si no puedes hacer algo, dilo claramente
- Para nombres ambiguos de jugadores, pide que aclaren
- Para acciones que necesitan cuenta vinculada, explica como vincular
- Nunca compartas info personal de otros usuarios en grupos
- Si el usuario dice "vincular liga [CODIGO]" o "vincular club [NOMBRE]", responde que lo estas procesando (el webhook maneja esto)
- Cuando muestres disponibilidad, incluye los IDs de cancha para facilitar la reserva
- Si el usuario quiere reservar, usa el court_id de la disponibilidad previa`;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY not set; refusing WhatsApp agent request");
    return new Response("Server misconfiguration", { status: 500 });
  }
  if (req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload: AgentPayload = await req.json();
  const phoneId = Deno.env.get("META_WHATSAPP_PHONE_ID")!;
  const waToken = Deno.env.get("META_WHATSAPP_TOKEN")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceRoleKey
  );

  try {
    // ─── Handle linking commands directly (no Claude needed) ───
    const lower = payload.messageText.toLowerCase().trim();

    if (payload.isGroup && payload.groupId && payload.isLinked) {
      // "vincular liga ABC123"
      const ligaMatch = lower.match(/vincular\s+liga\s+(\S+)/);
      if (ligaMatch) {
        const result = await linkGroupToLiga(supabase, payload.groupId, ligaMatch[1], payload.profileId!);
        const reply = result.success
          ? `Liga "${result.ligaName}" vinculada a este grupo. Ahora pueden usar: ranking, registrar partido, etc.`
          : `No pude vincular: ${result.error}`;
        await sendWhatsAppMessage(payload.senderPhone, reply, phoneId, waToken);
        await logOutbound(supabase, payload.waUserId, payload.groupId, reply, "link_liga");
        return new Response("OK");
      }

      // "vincular club Demo Brand"
      const clubMatch = lower.match(/vincular\s+club\s+(.+)/);
      if (clubMatch) {
        const result = await linkGroupToClub(supabase, payload.groupId, clubMatch[1], payload.profileId!);
        const reply = result.success
          ? `Club "${result.clubName}" vinculado a este grupo. Ahora pueden preguntar disponibilidad sin especificar club.`
          : `No pude vincular: ${result.error}`;
        await sendWhatsAppMessage(payload.senderPhone, reply, phoneId, waToken);
        await logOutbound(supabase, payload.waUserId, payload.groupId, reply, "link_club");
        return new Response("OK");
      }
    }

    // ─── Build context for Claude ───
    const contextParts: string[] = [];
    if (payload.isLinked) {
      contextParts.push(`Usuario vinculado: ${payload.senderName} (profile_id: ${payload.profileId})`);
    } else {
      contextParts.push("Usuario NO vinculado a PadelZero (solo puede consultar info publica)");
    }
    if (payload.isGroup) {
      contextParts.push("Contexto: mensaje en grupo de WhatsApp");
      if (payload.ligaId) contextParts.push(`Liga vinculada al grupo: ${payload.ligaId}`);
      if (payload.clubId) contextParts.push(`Club vinculado al grupo: ${payload.clubId}`);
    } else {
      contextParts.push("Contexto: mensaje directo (DM)");
    }

    const userMessage = `[${contextParts.join(" | ")}]\n\n${payload.messageText}`;

    // ─── Call Claude API ───
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      console.error("Claude API error:", err);
      await sendWhatsAppMessage(
        payload.senderPhone,
        "Estoy teniendo problemas. Intenta de nuevo en un momento.",
        phoneId,
        waToken
      );
      return new Response("Claude error", { status: 200 });
    }

    let claudeResponse = await claudeRes.json();
    let toolUsed: string | null = null;

    // ─── Tool use loop (Claude may call multiple tools) ───
    const messages: any[] = [{ role: "user", content: userMessage }];
    let iterations = 0;
    const maxIterations = 3;

    while (claudeResponse.stop_reason === "tool_use" && iterations < maxIterations) {
      iterations++;
      const assistantContent = claudeResponse.content;
      messages.push({ role: "assistant", content: assistantContent });

      const toolResults: any[] = [];
      for (const block of assistantContent) {
        if (block.type === "tool_use") {
          toolUsed = block.name;
          const result = await executeTool(block.name, block.input, supabase, {
            profileId: payload.profileId,
            isLinked: payload.isLinked,
            isGroup: payload.isGroup,
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });

      // Call Claude again with tool results
      const nextRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: TOOL_DEFINITIONS,
          messages,
        }),
      });

      claudeResponse = await nextRes.json();
    }

    // ─── Extract final text response ───
    const textBlocks = claudeResponse.content?.filter((b: any) => b.type === "text") || [];
    const reply = textBlocks.map((b: any) => b.text).join("\n") || "No pude procesar tu mensaje.";

    // ─── Send reply via WhatsApp ───
    await sendWhatsAppMessage(payload.senderPhone, reply, phoneId, waToken);

    // ─── Log outbound ───
    await logOutbound(supabase, payload.waUserId, payload.groupId, reply, toolUsed);

    return new Response(JSON.stringify({ status: "sent" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Agent error:", err);
    // Try to send error message
    try {
      await sendWhatsAppMessage(
        payload.senderPhone,
        "Algo salio mal. Intenta de nuevo.",
        phoneId,
        waToken
      );
    } catch {}
    return new Response("Error", { status: 200 });
  }
});

async function logOutbound(
  supabase: any,
  waUserId: string,
  groupId: string | null,
  text: string,
  toolUsed: string | null
) {
  await supabase.from("whatsapp_messages").insert({
    wa_user_id: waUserId,
    group_id: groupId,
    direction: "outbound",
    message_text: text.substring(0, 2000),
    tool_used: toolUsed,
  });
}
