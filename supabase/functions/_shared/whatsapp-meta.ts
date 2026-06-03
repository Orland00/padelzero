/**
 * Verify Meta webhook signature (X-Hub-Signature-256)
 */
export async function verifyMetaSignature(
  body: string,
  signature: string,
  appSecret: string
): Promise<boolean> {
  if (!signature.startsWith("sha256=")) return false;
  const expectedSig = signature.slice(7);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body)
  );
  const computedSig = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison to prevent timing attacks
  const a = new TextEncoder().encode(computedSig);
  const b = new TextEncoder().encode(expectedSig);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Send a text message via Meta WhatsApp Cloud API
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
  phoneId: string,
  token: string
): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    console.error("Meta API error:", JSON.stringify(err));
  }
}

/**
 * Extract message data from Meta webhook payload
 */
export interface WhatsAppMessage {
  senderPhone: string;
  senderName: string;
  messageText: string;
  messageId: string;
  isGroup: boolean;
  groupId: string | null;
  contextMessageId: string | null;
}

export function extractMessage(body: any): WhatsAppMessage | null {
  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages?.length) return null;

  const msg = value.messages[0];
  if (msg.type !== "text") return null;

  const contact = value.contacts?.[0];
  const groupId = msg.group_id || null;

  return {
    senderPhone: msg.from,
    senderName: contact?.profile?.name || "Unknown",
    messageText: msg.text?.body || "",
    messageId: msg.id,
    isGroup: !!groupId,
    groupId,
    contextMessageId: msg.context?.id || null,
  };
}
