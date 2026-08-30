import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";

const source = process.env.WARROOM_FIREBASE_ADMIN_JSON;
if (!source) throw new Error("Set WARROOM_FIREBASE_ADMIN_JSON to the Firebase service-account JSON path.");

const account = JSON.parse(await readFile(source, "utf8"));
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

const response = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  }),
});
const payload = await response.json();
if (!response.ok || !payload.access_token) {
  throw new Error(`Firebase OAuth verification failed (${response.status}): ${payload.error ?? "unknown error"}`);
}

console.log(JSON.stringify({
  ok: true,
  project_id: account.project_id,
  client_email: account.client_email,
  token_type: payload.token_type,
  expires_in: payload.expires_in,
}));
