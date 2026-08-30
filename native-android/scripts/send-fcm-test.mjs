import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";

const credentialPath = process.env.WARROOM_FIREBASE_ADMIN_JSON;
const deviceToken = process.env.WARROOM_FCM_DEVICE_TOKEN;
if (!credentialPath) throw new Error("Set WARROOM_FIREBASE_ADMIN_JSON to the Firebase service-account JSON path.");
if (!deviceToken) throw new Error("Set WARROOM_FCM_DEVICE_TOKEN to the target device token.");

const account = JSON.parse(await readFile(credentialPath, "utf8"));
if (account.type !== "service_account" || !account.project_id || !account.client_email || !account.private_key) {
  throw new Error("The supplied file is not a Firebase service-account credential.");
}

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
  iss: account.client_email,
  scope: "https://www.googleapis.com/auth/firebase.messaging",
  aud: "https://oauth2.googleapis.com/token",
  iat: now,
  exp: now + 3600,
})}`;
const signer = createSign("RSA-SHA256");
signer.update(unsigned);
signer.end();
const assertion = `${unsigned}.${signer.sign(account.private_key).toString("base64url")}`;

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  }),
});
const tokenPayload = await tokenResponse.json();
if (!tokenResponse.ok || !tokenPayload.access_token) {
  throw new Error(`Firebase OAuth failed (${tokenResponse.status}): ${tokenPayload.error ?? "unknown error"}`);
}

const messageResponse = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${tokenPayload.access_token}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    message: {
      token: deviceToken,
      notification: {
        title: "War Room Android Test",
        body: "Firebase push delivery is configured.",
      },
      data: {
        kind: "announcement",
        destination: "announcements",
      },
      android: {
        priority: "high",
        notification: { channel_id: "war_room_live", sound: "default" },
      },
    },
  }),
});
const messagePayload = await messageResponse.json();
if (!messageResponse.ok || !messagePayload.name) {
  throw new Error(`FCM send failed (${messageResponse.status}): ${messagePayload.error?.message ?? "unknown error"}`);
}

console.log(JSON.stringify({ ok: true, project_id: account.project_id, message_accepted: true }));
