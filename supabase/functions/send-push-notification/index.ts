import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to convert base64url to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/') + padding;
  const binString = atob(base64);
  return Uint8Array.from(binString, (c) => c.charCodeAt(0));
}

// Helper to convert Uint8Array to base64url
function uint8ArrayToBase64Url(array: Uint8Array): string {
  const binString = Array.from(array, (byte) => String.fromCharCode(byte)).join('');
  const base64 = btoa(binString);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Helper to convert ArrayBuffer to base64url
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  return uint8ArrayToBase64Url(new Uint8Array(buffer));
}

// Generate VAPID JWT token using JWK format for private key import
async function generateVapidJwt(audience: string, vapidPrivateKey: string, vapidPublicKey: string, subject: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // For ECDSA P-256, the private key is 32 bytes (d parameter)
  // The public key is 65 bytes (uncompressed: 0x04 + 32 bytes x + 32 bytes y)
  const privateKeyBytes = base64UrlToUint8Array(vapidPrivateKey);
  const publicKeyBytes = base64UrlToUint8Array(vapidPublicKey);
  
  // Extract x and y coordinates from uncompressed public key (skip 0x04 prefix)
  const x = publicKeyBytes.slice(1, 33);
  const y = publicKeyBytes.slice(33, 65);
  
  // Build JWK for ECDSA P-256 private key
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: uint8ArrayToBase64Url(x),
    y: uint8ArrayToBase64Url(y),
    d: uint8ArrayToBase64Url(privateKeyBytes),
  };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = arrayBufferToBase64Url(signature);
  return `${unsignedToken}.${signatureB64}`;
}

// Encrypt payload using Web Push encryption
async function encryptPayload(payload: string, p256dhKey: string, authSecret: string): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPublicKeyBuffer = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPublicKeyBuffer);

  const clientPublicKeyBytes = base64UrlToUint8Array(p256dhKey);
  const clientPublicKey = await crypto.subtle.importKey('raw', clientPublicKeyBytes.buffer as ArrayBuffer, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

  const sharedSecretBuffer = await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPublicKey }, localKeyPair.privateKey, 256);
  const sharedSecret = new Uint8Array(sharedSecretBuffer);
  const authSecretBytes = base64UrlToUint8Array(authSecret);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
  const keyInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');

  const ikm = await crypto.subtle.importKey('raw', sharedSecret.buffer as ArrayBuffer, 'HKDF', false, ['deriveBits']);
  const ikmBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: authSecretBytes.buffer as ArrayBuffer, info: authInfo }, ikm, 256);
  const cekKey = await crypto.subtle.importKey('raw', new Uint8Array(ikmBits), 'HKDF', false, ['deriveBits']);
  const cekBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt.buffer as ArrayBuffer, info: keyInfo }, cekKey, 128);

  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
  const nonceBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt.buffer as ArrayBuffer, info: nonceInfo }, cekKey, 96);

  const aesKey = await crypto.subtle.importKey('raw', new Uint8Array(cekBits), 'AES-GCM', false, ['encrypt']);

  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 2);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2;

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: new Uint8Array(nonceBits) }, aesKey, paddedPayload);
  return { ciphertext: new Uint8Array(ciphertext), salt, localPublicKey };
}

function buildEncryptedBody(ciphertext: Uint8Array, salt: Uint8Array, localPublicKey: Uint8Array, recordSize = 4096): Uint8Array {
  const header = new Uint8Array(86);
  header.set(salt, 0);
  header[16] = (recordSize >> 24) & 0xff;
  header[17] = (recordSize >> 16) & 0xff;
  header[18] = (recordSize >> 8) & 0xff;
  header[19] = recordSize & 0xff;
  header[20] = localPublicKey.length;
  header.set(localPublicKey, 21);

  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header);
  body.set(ciphertext, header.length);
  return body;
}

async function sendPushWithVapid(endpoint: string, p256dh: string, auth: string, payload: object, vapidPrivateKey: string, vapidPublicKey: string): Promise<{ success: boolean; status: number; message: string }> {
  try {
    console.log(`[VAPID] Starting push to endpoint: ${endpoint.substring(0, 60)}...`);
    
    const endpointUrl = new URL(endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
    console.log(`[VAPID] Audience: ${audience}`);
    
    console.log(`[VAPID] Generating JWT...`);
    const jwt = await generateVapidJwt(audience, vapidPrivateKey, vapidPublicKey, 'mailto:contato@franklinsilvah.com');
    console.log(`[VAPID] JWT generated (${jwt.length} chars)`);
    
    const payloadString = JSON.stringify(payload);
    console.log(`[VAPID] Payload size: ${payloadString.length} bytes`);
    
    console.log(`[VAPID] Encrypting payload with p256dh (${p256dh.length} chars) and auth (${auth.length} chars)...`);
    const { ciphertext, salt, localPublicKey } = await encryptPayload(payloadString, p256dh, auth);
    console.log(`[VAPID] Encryption complete - ciphertext: ${ciphertext.length} bytes, salt: ${salt.length} bytes, localPubKey: ${localPublicKey.length} bytes`);
    
    const body = buildEncryptedBody(ciphertext, salt, localPublicKey);
    console.log(`[VAPID] Final body size: ${body.length} bytes`);

    console.log(`[VAPID] Sending POST request...`);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
        'Urgency': 'normal',
      },
      body: body.buffer as ArrayBuffer,
    });

    const responseText = response.ok ? 'OK' : await response.text();
    console.log(`[VAPID] Response: ${response.status} ${response.statusText} - ${responseText.substring(0, 100)}`);
    
    return { success: response.ok || response.status === 201, status: response.status, message: response.ok ? 'Sent' : responseText };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error(`[VAPID] Error: ${errorMsg}`);
    console.error(`[VAPID] Stack: ${errorStack}`);
    return { success: false, status: 0, message: errorMsg };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");

    if (!vapidPrivateKey || !vapidPublicKey) {
      console.error("VAPID keys not configured");
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { notificationId } = await req.json();

    if (!notificationId) return new Response(JSON.stringify({ error: "notificationId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    console.log(`Processing notification: ${notificationId}`);

    const { data: notification, error: notificationError } = await supabase.from("push_notifications").select("*").eq("id", notificationId).single();
    if (notificationError || !notification) return new Response(JSON.stringify({ error: "Notification not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    console.log(`Notification found: ${notification.title}, audience: ${notification.target_audience}`);

    const { data: subscriptions, error: subscriptionsError } = await supabase.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth, is_active, device_id").eq("is_active", true);
    if (subscriptionsError) return new Response(JSON.stringify({ error: "Error fetching subscriptions" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    console.log(`Found ${subscriptions?.length || 0} active subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
      await supabase.from("push_notifications").update({ sent_at: new Date().toISOString(), sent_count: 0 }).eq("id", notificationId);
      return new Response(JSON.stringify({ success: true, message: "No active subscriptions found", sent: 0, failed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const loggedInSubscriptions = subscriptions.filter(s => s.user_id !== null);
    const anonymousSubscriptions = subscriptions.filter(s => s.user_id === null);
    const loggedInUserIds = loggedInSubscriptions.map(s => s.user_id).filter(Boolean) as string[];

    let profilesMap = new Map<string, { plan: string; notifications_enabled: boolean }>();
    if (loggedInUserIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, plan, notifications_enabled").in("id", loggedInUserIds);
      if (profiles) profilesMap = new Map(profiles.map(p => [p.id, { plan: p.plan, notifications_enabled: p.notifications_enabled ?? true }]));
    }

    const eligibleLoggedInSubs = loggedInSubscriptions.filter(sub => profilesMap.get(sub.user_id!)?.notifications_enabled !== false);
    let filteredSubscriptions: typeof subscriptions = [];

    if (notification.target_audience === "all") filteredSubscriptions = [...eligibleLoggedInSubs, ...anonymousSubscriptions];
    else if (notification.target_audience === "anonymous") filteredSubscriptions = anonymousSubscriptions;
    else if (notification.target_audience === "logged_in") filteredSubscriptions = eligibleLoggedInSubs;
    else if (notification.target_audience === "group" && notification.target_group_id) {
      const { data: groupMembers } = await supabase.from("notification_group_members").select("user_id").eq("group_id", notification.target_group_id);
      const groupUserIds = new Set(groupMembers?.map(m => m.user_id) || []);
      filteredSubscriptions = eligibleLoggedInSubs.filter(sub => groupUserIds.has(sub.user_id!));
    } else {
      filteredSubscriptions = eligibleLoggedInSubs.filter(sub => {
        const profile = profilesMap.get(sub.user_id!);
        if (!profile) return false;
        if (notification.target_audience === "free") return profile.plan === "FREE";
        if (notification.target_audience === "paid") return profile.plan !== "FREE";
        if (notification.target_audience === "specific_plan") return profile.plan === notification.target_plan;
        return true;
      });
    }

    console.log(`Filtered to ${filteredSubscriptions.length} subscriptions`);

    let sentCount = 0, failedCount = 0;
    const expiredSubscriptions: string[] = [];
    const notificationPayload = { title: notification.title, body: notification.message, icon: notification.icon || "/logo.webp", badge: "/logo.webp", data: { url: notification.url || "/", notificationId: notification.id } };

    for (const subscription of filteredSubscriptions) {
      const result = await sendPushWithVapid(subscription.endpoint, subscription.p256dh, subscription.auth, notificationPayload, vapidPrivateKey, vapidPublicKey);
      if (result.success) { sentCount++; console.log(`Push sent to ${subscription.id}`); }
      else if (result.status === 410 || result.status === 404) { expiredSubscriptions.push(subscription.id); failedCount++; }
      else { failedCount++; console.error(`Failed ${subscription.id}: ${result.status} - ${result.message}`); }
    }

    if (expiredSubscriptions.length > 0) await supabase.from("push_subscriptions").update({ is_active: false }).in("id", expiredSubscriptions);
    await supabase.from("push_notifications").update({ sent_at: new Date().toISOString(), sent_count: (notification.sent_count || 0) + sentCount }).eq("id", notificationId);

    console.log(`Notification sent: ${sentCount} success, ${failedCount} failed`);
    return new Response(JSON.stringify({ success: true, sent: sentCount, failed: failedCount, total: filteredSubscriptions.length, expiredRemoved: expiredSubscriptions.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in send-push-notification:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
