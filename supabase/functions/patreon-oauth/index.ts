import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const CALLBACK_SCHEME = "warroom";
const CONNECTION_MAX_AGE_MS = 6 * 60 * 60 * 1000;

type ConnectionRecord = {
  user_id: string;
  patreon_user_id: string;
  patreon_display_name: string | null;
  patreon_avatar_url: string | null;
  membership_status: string;
  last_charge_status: string | null;
  currently_entitled_amount_cents: number;
  campaign_id: string | null;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  token_expires_at: string;
  token_scope: string | null;
  connected_at: string;
  verified_at: string;
};

type PatreonTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function redirectToApp(status: "connected" | "cancelled" | "error", message?: string) {
  const url = new URL(`${CALLBACK_SCHEME}://patreon-connected`);
  url.searchParams.set("status", status);
  if (message) url.searchParams.set("message", message);
  return Response.redirect(url.toString(), 302);
}

function requiredEnvironment() {
  const values = {
    supabaseURL: Deno.env.get("SUPABASE_URL"),
    anonKey: Deno.env.get("SUPABASE_ANON_KEY"),
    serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    clientID: Deno.env.get("PATREON_CLIENT_ID"),
    clientSecret: Deno.env.get("PATREON_CLIENT_SECRET"),
    redirectURI: Deno.env.get("PATREON_REDIRECT_URI"),
    campaignID: Deno.env.get("PATREON_CAMPAIGN_ID"),
    encryptionKey: Deno.env.get("PATREON_TOKEN_ENCRYPTION_KEY"),
  };
  if (Object.values(values).some((value) => !value)) throw new Error("Patreon connection service is not configured");
  return values as Record<keyof typeof values, string>;
}

function clients(environment: ReturnType<typeof requiredEnvironment>) {
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  return {
    anon: createClient(environment.supabaseURL, environment.anonKey, options),
    service: createClient(environment.supabaseURL, environment.serviceKey, options),
  };
}

async function authenticatedUser(anon: SupabaseClient, request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;
  const { data, error } = await anon.auth.getUser(token);
  return error ? null : data.user;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey(rawKey: string) {
  const bytes = base64ToBytes(rawKey);
  if (bytes.byteLength !== 32) throw new Error("PATREON_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(value: string, rawKey: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(rawKey);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value)));
  return `${bytesToBase64(iv)}.${bytesToBase64(ciphertext)}`;
}

async function decrypt(value: string, rawKey: string) {
  const [encodedIV, encodedCiphertext] = value.split(".");
  if (!encodedIV || !encodedCiphertext) throw new Error("Stored Patreon credential is invalid");
  const key = await encryptionKey(rawKey);
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(encodedIV) },
    key,
    base64ToBytes(encodedCiphertext),
  );
  return new TextDecoder().decode(clear);
}

async function sha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function exchangeCode(environment: ReturnType<typeof requiredEnvironment>, code: string) {
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: environment.clientID,
    client_secret: environment.clientSecret,
    redirect_uri: environment.redirectURI,
  });
  const response = await fetch("https://www.patreon.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error("Patreon rejected the authorization code");
  return await response.json() as PatreonTokens;
}

async function refreshTokens(environment: ReturnType<typeof requiredEnvironment>, refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: environment.clientID,
    client_secret: environment.clientSecret,
  });
  const response = await fetch("https://www.patreon.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error("Patreon connection needs to be renewed");
  return await response.json() as PatreonTokens;
}

async function patreonIdentity(accessToken: string, campaignID: string) {
  const url = new URL("https://www.patreon.com/api/oauth2/v2/identity");
  url.searchParams.set("include", "memberships");
  url.searchParams.set("fields[user]", "full_name,image_url");
  url.searchParams.set("fields[member]", "patron_status,last_charge_status,currently_entitled_amount_cents");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Patreon identity could not be verified");
  const payload = await response.json() as {
    data?: { id?: string; attributes?: { full_name?: string | null; image_url?: string | null } };
    included?: Array<{
      type?: string;
      attributes?: { patron_status?: string | null; last_charge_status?: string | null; currently_entitled_amount_cents?: number | null };
      relationships?: { campaign?: { data?: { id?: string } } };
    }>;
  };
  if (!payload.data?.id) throw new Error("Patreon identity was incomplete");
  const memberships = (payload.included ?? []).filter((item) => item.type === "member");
  const membership = memberships.find((item) => item.relationships?.campaign?.data?.id === campaignID) ?? memberships[0];
  const patronStatus = membership?.attributes?.patron_status ?? null;
  const entitled = Math.max(0, membership?.attributes?.currently_entitled_amount_cents ?? 0);
  const membershipStatus = patronStatus === "active_patron"
    ? (entitled > 0 ? "active_patron" : "free_member")
    : patronStatus === "declined_patron"
    ? "declined_patron"
    : patronStatus === "former_patron"
    ? "former_patron"
    : membership
    ? "free_member"
    : "not_member";
  return {
    patreonUserID: payload.data.id,
    displayName: payload.data.attributes?.full_name ?? null,
    avatarURL: payload.data.attributes?.image_url ?? null,
    membershipStatus,
    lastChargeStatus: membership?.attributes?.last_charge_status ?? null,
    currentlyEntitledAmountCents: entitled,
    campaignID: membership ? campaignID : null,
  };
}

async function persistConnection(
  service: SupabaseClient,
  environment: ReturnType<typeof requiredEnvironment>,
  userID: string,
  tokens: PatreonTokens,
) {
  const identity = await patreonIdentity(tokens.access_token, environment.campaignID);
  const now = new Date();
  const row = {
    user_id: userID,
    patreon_user_id: identity.patreonUserID,
    patreon_display_name: identity.displayName,
    patreon_avatar_url: identity.avatarURL,
    membership_status: identity.membershipStatus,
    last_charge_status: identity.lastChargeStatus,
    currently_entitled_amount_cents: identity.currentlyEntitledAmountCents,
    campaign_id: identity.campaignID,
    access_token_ciphertext: await encrypt(tokens.access_token, environment.encryptionKey),
    refresh_token_ciphertext: await encrypt(tokens.refresh_token, environment.encryptionKey),
    token_expires_at: new Date(now.getTime() + Math.max(60, tokens.expires_in) * 1000).toISOString(),
    token_scope: tokens.scope ?? null,
    verified_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  const { error } = await service.schema("private").from("patreon_connections").upsert(row, { onConflict: "user_id" });
  if (error) {
    if (error.code === "23505") throw new Error("That Patreon account is already linked to another War Room account");
    throw error;
  }
  return { ...identity, verifiedAt: row.verified_at };
}

async function publicConnectionWithRecognition(service: SupabaseClient, connection: ConnectionRecord) {
  const { data: founder, error } = await service
    .schema("private")
    .from("patreon_founding_supporters")
    .select("supporter_number")
    .eq("patreon_user_id", connection.patreon_user_id)
    .maybeSingle<{ supporter_number: number }>();
  if (error) throw error;
  return {
    connected: true,
    patreon_user_id: connection.patreon_user_id,
    display_name: connection.patreon_display_name,
    avatar_url: connection.patreon_avatar_url,
    membership_status: connection.membership_status,
    currently_entitled_amount_cents: connection.currently_entitled_amount_cents,
    connected_at: connection.connected_at,
    verified_at: connection.verified_at,
    founding_supporter_number: founder?.supporter_number ?? null,
  };
}

Deno.serve(async (request: Request) => {
  let environment: ReturnType<typeof requiredEnvironment>;
  try {
    environment = requiredEnvironment();
  } catch {
    return json({ error: "Patreon connection service is not configured" }, 503);
  }
  const { anon, service } = clients(environment);
  const requestURL = new URL(request.url);
  const action = requestURL.searchParams.get("action") ?? "status";

  if (action === "callback") {
    const providerError = requestURL.searchParams.get("error");
    if (providerError) return redirectToApp("cancelled");
    const code = requestURL.searchParams.get("code");
    const state = requestURL.searchParams.get("state");
    if (!code || !state) return redirectToApp("error", "Patreon did not return a complete authorization");
    try {
      const stateHash = await sha256(state);
      const { data: consumed, error } = await service
        .schema("private")
        .from("patreon_oauth_states")
        .delete()
        .eq("state_hash", stateHash)
        .gt("expires_at", new Date().toISOString())
        .select("user_id")
        .maybeSingle();
      if (error || !consumed?.user_id) return redirectToApp("error", "This Patreon link expired. Start again in War Room");
      const tokens = await exchangeCode(environment, code);
      await persistConnection(service, environment, consumed.user_id, tokens);
      return redirectToApp("connected");
    } catch (error) {
      console.error("Patreon callback failed", error instanceof Error ? error.message : "unknown");
      return redirectToApp("error", error instanceof Error ? error.message : "Patreon could not be linked");
    }
  }

  const user = await authenticatedUser(anon, request);
  if (!user?.id) return json({ error: "Authentication required" }, 401);

  if (action === "start" && request.method === "POST") {
    const stateBytes = crypto.getRandomValues(new Uint8Array(32));
    const state = bytesToBase64(stateBytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    const stateHash = await sha256(state);
    await service.schema("private").from("patreon_oauth_states").delete().lt("expires_at", new Date().toISOString());
    const { error } = await service.schema("private").from("patreon_oauth_states").insert({
      state_hash: stateHash,
      user_id: user.id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) return json({ error: "Could not start Patreon authorization" }, 500);
    const authorizationURL = new URL("https://www.patreon.com/oauth2/authorize");
    authorizationURL.searchParams.set("response_type", "code");
    authorizationURL.searchParams.set("client_id", environment.clientID);
    authorizationURL.searchParams.set("redirect_uri", environment.redirectURI);
    authorizationURL.searchParams.set("scope", "identity");
    authorizationURL.searchParams.set("state", state);
    return json({ authorization_url: authorizationURL.toString() });
  }

  if (action === "disconnect" && request.method === "POST") {
    const { error } = await service.schema("private").from("patreon_connections").delete().eq("user_id", user.id);
    if (error) return json({ error: "Patreon could not be disconnected" }, 500);
    return json({ connected: false });
  }

  if (action !== "status" || request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const { data, error } = await service
    .schema("private")
    .from("patreon_connections")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<ConnectionRecord>();
  if (error) return json({ error: "Patreon status is unavailable" }, 500);
  if (!data) return json({ connected: false });

  const verifiedAt = new Date(data.verified_at).getTime();
  if (Date.now() - verifiedAt > CONNECTION_MAX_AGE_MS) {
    try {
      const refreshToken = await decrypt(data.refresh_token_ciphertext, environment.encryptionKey);
      const tokens = await refreshTokens(environment, refreshToken);
      await persistConnection(service, environment, user.id, tokens);
      const { data: refreshed } = await service.schema("private").from("patreon_connections").select("*").eq("user_id", user.id).single<ConnectionRecord>();
      if (refreshed) return json(await publicConnectionWithRecognition(service, refreshed));
    } catch (refreshError) {
      console.error("Patreon refresh failed", refreshError instanceof Error ? refreshError.message : "unknown");
      return json({ ...await publicConnectionWithRecognition(service, data), needs_reauthorization: true });
    }
  }
  return json(await publicConnectionWithRecognition(service, data));
});
