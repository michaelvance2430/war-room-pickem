import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type PushJob = {
  id: string;
  league_id: string;
  kind: string;
  title: string;
  body: string;
  destination: "picks" | "announcements" | "results";
  week_number: number | null;
};

const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
  .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

async function providerToken() {
  const pem = required("APNS_P8_KEY").replaceAll("\\n", "\n");
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const encoder = new TextEncoder();
  const header = base64url(encoder.encode(JSON.stringify({ alg: "ES256", kid: required("APNS_KEY_ID") })));
  const claims = base64url(encoder.encode(JSON.stringify({ iss: required("APNS_TEAM_ID"), iat: Math.floor(Date.now() / 1000) })));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(`${header}.${claims}`)));
  return `${header}.${claims}.${base64url(signature)}`;
}

async function fcmAccessToken() {
  const encoder = new TextEncoder();
  const pem = required("FCM_PRIVATE_KEY").replaceAll("\\n", "\n");
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = base64url(encoder.encode(JSON.stringify({
    iss: required("FCM_CLIENT_EMAIL"),
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(`${header}.${claim}`)));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claim}.${base64url(signature)}` }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error(`FCM OAuth failed: ${JSON.stringify(payload)}`);
  return payload.access_token as string;
}

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const supabase = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: jobs, error: claimError } = await supabase.rpc("claim_push_notification_batch", { p_limit: 20 });
    if (claimError) return Response.json({ error: claimError.message }, { status: 500 });
    const apnsJwt = await providerToken();
    const androidConfigured = Boolean(Deno.env.get("FCM_PROJECT_ID") && Deno.env.get("FCM_CLIENT_EMAIL") && Deno.env.get("FCM_PRIVATE_KEY"));
    const fcmToken = androidConfigured ? await fcmAccessToken() : null;
    let sent = 0;

    for (const job of (jobs ?? []) as PushJob[]) {
    const { data: members, error: memberError } = await supabase
      .from("memberships").select("user_id").eq("league_id", job.league_id).eq("is_bot", false);
    if (memberError) {
      await supabase.rpc("complete_push_notification", { p_id: job.id, p_error: memberError.message });
      continue;
    }
    const userIds = (members ?? []).map((member) => member.user_id);
    const { data: devices, error: deviceError } = userIds.length
      ? await supabase.from("push_device_tokens").select("device_token,environment,platform").in("user_id", userIds)
      : { data: [], error: null };
    if (deviceError) {
      await supabase.rpc("complete_push_notification", { p_id: job.id, p_error: deviceError.message });
      continue;
    }

    const failures: string[] = [];
    for (const device of devices ?? []) {
      if (device.platform === "android") {
        if (!fcmToken) {
          failures.push("android:FCM_NOT_CONFIGURED");
          continue;
        }
        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${required("FCM_PROJECT_ID")}/messages:send`, {
          method: "POST",
          headers: { authorization: `Bearer ${fcmToken}`, "content-type": "application/json" },
          body: JSON.stringify({ message: {
            token: device.device_token,
            notification: { title: job.title, body: job.body },
            data: { kind: job.kind, league_id: job.league_id, destination: job.destination, week: String(job.week_number ?? "") },
            android: { priority: "high", notification: { channel_id: "war_room_live", sound: "default" } },
          } }),
        });
        if (response.ok) sent += 1;
        else {
          const reason = await response.text();
          failures.push(`android:${response.status}:${reason}`);
          if (response.status === 404) await supabase.from("push_device_tokens").delete().eq("device_token", device.device_token);
        }
        continue;
      }
      const host = device.environment === "development" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
      const response = await fetch(`https://${host}/3/device/${device.device_token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${apnsJwt}`,
          "apns-topic": "com.warroompicks.WarRoom",
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          aps: { alert: { title: job.title, body: job.body }, sound: "default", "thread-id": `league.${job.league_id}` },
          kind: job.kind,
          league_id: job.league_id,
          destination: job.destination,
          week: job.week_number,
        }),
      });
      if (response.ok) sent += 1;
      else {
        const reason = await response.text();
        failures.push(`${response.status}:${reason}`);
        if (response.status === 410) await supabase.from("push_device_tokens").delete().eq("device_token", device.device_token);
      }
    }
    await supabase.rpc("complete_push_notification", {
      p_id: job.id,
      p_error: failures.length ? failures.join("; ").slice(0, 1000) : null,
    });
    }
    return Response.json({ jobs: jobs?.length ?? 0, sent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown push sender error";
    console.error("push-notifications failed", message);
    return Response.json({ error: message }, { status: 500 });
  }
});
