import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: NotificationRecord;
  schema: string;
  old_record: null | NotificationRecord;
}

interface NotificationRecord {
  id: string;
  recipient_id: string;
  type: string;
  actor_id?: string;
  data?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// ---------------------------------------------------------------------------
// Localised notification content
// ---------------------------------------------------------------------------

type Lang = "es" | "en" | "pt";

function getNotificationContent(
  type: string,
  lang: Lang
): { title: string; body: string } {
  const content: Record<string, Record<Lang, { title: string; body: string }>> =
    {
      friend_request: {
        es: { title: "Solicitud de amistad", body: "Alguien quiere ser tu amigo en PadelZero" },
        en: { title: "Friend request", body: "Someone wants to be your friend on PadelZero" },
        pt: { title: "Solicitação de amizade", body: "Alguém quer ser seu amigo no PadelZero" },
      },
      liga_invite: {
        es: { title: "Invitación a liga", body: "Te han invitado a unirte a una liga" },
        en: { title: "League invite", body: "You have been invited to join a league" },
        pt: { title: "Convite para liga", body: "Você foi convidado para entrar em uma liga" },
      },
      match_result: {
        es: { title: "Partido registrado", body: "Se ha registrado el resultado de tu partido" },
        en: { title: "Match recorded", body: "Your match result has been recorded" },
        pt: { title: "Partida registrada", body: "O resultado da sua partida foi registrado" },
      },
      liga_match: {
        es: { title: "Nuevo partido en liga", body: "Hay un nuevo partido en tu liga" },
        en: { title: "New league match", body: "There is a new match in your league" },
        pt: { title: "Nova partida na liga", body: "Há uma nova partida na sua liga" },
      },
    };

  const fallback: Record<Lang, { title: string; body: string }> = {
    es: { title: "PadelZero", body: "Tienes una nueva notificación" },
    en: { title: "PadelZero", body: "You have a new notification" },
    pt: { title: "PadelZero", body: "Você tem uma nova notificação" },
  };

  return content[type]?.[lang] ?? fallback[lang];
}

// ---------------------------------------------------------------------------
// Base64url helpers
// ---------------------------------------------------------------------------

function base64urlToBytes(str: string): Uint8Array {
  // Convert base64url → base64 → bytes
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ---------------------------------------------------------------------------
// VAPID JWT (ES256)
// ---------------------------------------------------------------------------

async function buildVapidJWT(
  audience: string,
  subject: string,
  privateKeyBytes: Uint8Array,
  publicKeyBytes: Uint8Array
): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject,
  };

  const encode = (obj: unknown) =>
    bytesToBase64url(new TextEncoder().encode(JSON.stringify(obj)));

  const signingInput = `${encode(header)}.${encode(payload)}`;

  // Import VAPID private key as JWK (raw format not supported for private keys)
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: bytesToBase64url(publicKeyBytes.slice(1, 33)),
      y: bytesToBase64url(publicKeyBytes.slice(33, 65)),
      d: bytesToBase64url(privateKeyBytes),
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${bytesToBase64url(new Uint8Array(sig))}`;
}

// ---------------------------------------------------------------------------
// Web Push payload encryption (RFC 8291 / aes128gcm)
// ---------------------------------------------------------------------------

async function encryptPayload(
  plaintext: Uint8Array,
  p256dhB64url: string,
  authB64url: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  // Recipient public key (browser's p256dh)
  const receiverPublicKeyBytes = base64urlToBytes(p256dhB64url);
  // Auth secret
  const authSecret = base64urlToBytes(authB64url);

  // Generate ephemeral sender key pair (P-256)
  const senderKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  // Export sender public key in uncompressed form (65 bytes)
  const senderPublicKeyExported = await crypto.subtle.exportKey(
    "raw",
    senderKeyPair.publicKey
  );
  const senderPublicKey = new Uint8Array(senderPublicKeyExported);

  // Import receiver's public key
  const receiverPublicKey = await crypto.subtle.importKey(
    "raw",
    receiverPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH: derive shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: receiverPublicKey },
    senderKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // RFC 8291 key derivation using proper HKDF via crypto.subtle

  // Step 1: HKDF-Extract + Expand to get IKM from shared secret + auth secret
  // info = "WebPush: info\x00" || receiver_public || sender_public
  const ikmInfo = concat(
    new TextEncoder().encode("WebPush: info\x00"),
    receiverPublicKeyBytes,
    senderPublicKey
  );

  const sharedSecretKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveBits"]
  );

  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: authSecret, info: ikmInfo },
      sharedSecretKey,
      256
    )
  );

  // Step 2: Derive CEK (16 bytes) from IKM + salt
  const ikmKey = await crypto.subtle.importKey(
    "raw",
    ikm,
    "HKDF",
    false,
    ["deriveBits"]
  );

  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\x00");
  const cekBytes = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
      ikmKey,
      128
    )
  );

  // Step 3: Derive nonce (12 bytes) from IKM + salt
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\x00");
  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
      ikmKey,
      96
    )
  );

  // Import CEK for AES-128-GCM
  const cek = await crypto.subtle.importKey(
    "raw",
    cekBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Encrypt: plaintext + padding delimiter byte (0x02) + no padding
  const paddedPlaintext = concat(plaintext, new Uint8Array([2]));
  const ciphertextWithTag = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    cek,
    paddedPlaintext
  );

  return {
    ciphertext: new Uint8Array(ciphertextWithTag),
    salt,
    serverPublicKey: senderPublicKey,
  };
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// Build the aes128gcm encrypted content body per RFC 8188
function buildEncryptedBody(
  ciphertext: Uint8Array,
  salt: Uint8Array,
  serverPublicKey: Uint8Array,
  recordSize = 4096
): Uint8Array {
  // Header: salt (16) + rs (4 big-endian uint32) + idlen (1) + keyid (65)
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKey.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = serverPublicKey.length;
  header.set(serverPublicKey, 21);
  return concat(header, ciphertext);
}

// ---------------------------------------------------------------------------
// Send a single Web Push message
// ---------------------------------------------------------------------------

async function sendWebPush(
  subscription: PushSubscription,
  payload: Record<string, unknown>,
  vapidPublicKeyBytes: Uint8Array,
  vapidPrivateKeyBytes: Uint8Array,
  vapidSubject: string
): Promise<{ status: number }> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const jwt = await buildVapidJWT(audience, vapidSubject, vapidPrivateKeyBytes, vapidPublicKeyBytes);
  const vapidPublicB64url = bytesToBase64url(vapidPublicKeyBytes);

  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const { ciphertext, salt, serverPublicKey } = await encryptPayload(
    plaintext,
    subscription.p256dh,
    subscription.auth
  );
  const body = buildEncryptedBody(ciphertext, salt, serverPublicKey);

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Authorization": `vapid t=${jwt},k=${vapidPublicB64url}`,
      "TTL": "86400",
    },
    body,
  });

  return { status: response.status };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  try {
    // Only accept POST (DB webhooks are POST)
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Shared-secret authentication (P0-3 / Ana §6).
    // Source: notify_push_on_insert trigger pulls from Supabase Vault
    // (secret name: push_webhook_secret) and forwards as X-Push-Webhook-Secret.
    // FAIL-CLOSED: if PUSH_WEBHOOK_SECRET env var is unset, we cannot
    // authenticate incoming calls, so we refuse. This closes audit finding
    // F4 HIGH (02_security_pentest.md): previous fail-open behaviour let any
    // caller trigger push-spam when the env var was missing.
    const expectedSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
    if (!expectedSecret || expectedSecret.length === 0) {
      console.error("send-push: PUSH_WEBHOOK_SECRET env var is not configured; refusing to serve");
      return new Response("Server misconfiguration", { status: 500 });
    }
    const headerSecret = req.headers.get("X-Push-Webhook-Secret");
    if (!headerSecret || headerSecret !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKeyRaw = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKeyRaw = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@padelzero.win";

    if (!supabaseUrl || !supabaseServiceKey || !vapidPublicKeyRaw || !vapidPrivateKeyRaw) {
      console.error("send-push: missing required environment variables");
      return new Response("Internal configuration error", { status: 500 });
    }

    // Parse webhook payload (called by internal DB trigger via pg_net)
    const body: WebhookPayload = await req.json();

    // Validate payload structure to prevent arbitrary trigger abuse
    if (body.type !== "INSERT") {
      return new Response("Ignored: not an INSERT", { status: 200 });
    }
    if (body.table !== "notifications") {
      return new Response("Ignored: not the notifications table", { status: 200 });
    }

    const notification = body.record;
    // Validate recipient_id is present and looks like a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!notification?.recipient_id || !uuidRegex.test(notification.recipient_id)) {
      return new Response("Ignored: missing or invalid recipient_id", { status: 200 });
    }

    // Admin Supabase client (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Fetch push subscriptions for this recipient
    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .eq("user_id", notification.recipient_id);

    if (subsError) {
      console.error("send-push: error fetching subscriptions:", subsError.message);
      return new Response("DB error", { status: 500 });
    }

    if (!subs || subs.length === 0) {
      // No subscriptions — nothing to do
      return new Response("No subscriptions", { status: 200 });
    }

    // Fetch preferred language from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_language")
      .eq("id", notification.recipient_id)
      .single();

    const lang: Lang = (["es", "en", "pt"].includes(profile?.preferred_language)
      ? profile!.preferred_language
      : "es") as Lang;

    const { title, body: notifBody } = getNotificationContent(notification.type, lang);

    const pushPayload = {
      title,
      body: notifBody,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: {
        url: "/",
        notification_id: notification.id,
        type: notification.type,
      },
    };

    // Decode VAPID keys (base64url encoded P-256 raw bytes)
    const vapidPublicKeyBytes = base64urlToBytes(vapidPublicKeyRaw);
    const vapidPrivateKeyBytes = base64urlToBytes(vapidPrivateKeyRaw);

    // Send to all subscriptions, collect expired ones to clean up
    const expiredIds: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub: PushSubscription) => {
        try {
          const { status } = await sendWebPush(
            sub,
            pushPayload,
            vapidPublicKeyBytes,
            vapidPrivateKeyBytes,
            vapidSubject
          );

          if (status === 410 || status === 404) {
            // Subscription has expired or is invalid — mark for removal
            expiredIds.push(sub.id);
          } else if (status >= 400) {
            console.warn(`send-push: push to ${sub.endpoint} returned ${status}`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`send-push: failed to push to ${sub.endpoint}:`, msg);
        }
      })
    );

    // Clean up expired subscriptions
    if (expiredIds.length > 0) {
      const { error: deleteErr } = await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds);
      if (deleteErr) {
        console.warn("send-push: failed to delete expired subscriptions:", deleteErr.message);
      } else {
        console.log(`send-push: removed ${expiredIds.length} expired subscription(s)`);
      }
    }

    return new Response(
      JSON.stringify({ sent: subs.length - expiredIds.length, expired: expiredIds.length }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-push: unhandled error:", msg);
    return new Response("Internal server error", { status: 500 });
  }
});
