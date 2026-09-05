import fs from "node:fs";

const edge = fs.readFileSync("supabase/functions/patreon-oauth/index.ts", "utf8");
const schema = fs.readFileSync("supabase/patreon-account-linking-REVIEW-ONLY.sql", "utf8");
const client = fs.readFileSync("native-ios/WarRoom/PatreonConnectionView.swift", "utf8");
const api = fs.readFileSync("native-ios/WarRoom/SupabaseAPI.swift", "utf8");

const assertions = [
  [client.includes("static let isEnabled = false"), "production feature gate must remain off"],
  [!client.includes("PATREON_CLIENT_SECRET"), "the iOS client must not contain the Patreon secret"],
  [!api.includes("PATREON_CLIENT_SECRET"), "the iOS API client must not contain the Patreon secret"],
  [edge.includes('authorizationURL.searchParams.set("scope", "identity")'), "OAuth must request only the minimal identity scope"],
  [edge.includes('crypto.subtle.encrypt({ name: "AES-GCM"'), "Patreon tokens must be encrypted at rest"],
  [edge.includes('.from("patreon_oauth_states")\n        .delete()'), "OAuth state must be consumed once"],
  [edge.includes("anon.auth.getUser(token)"), "app actions must authenticate the War Room user"],
  [schema.includes("private.patreon_connections"), "connections must live outside the exposed public schema"],
  [schema.includes("patreon_user_id text not null unique"), "one Patreon identity must not link to multiple War Room accounts"],
  [schema.includes("references auth.users(id) on delete cascade"), "account deletion must remove Patreon connection data"],
  [!schema.includes("revoke all on all tables in schema private"), "the migration must not alter unrelated private tables"],
];

const failure = assertions.find(([passed]) => !passed);
if (failure) {
  console.error(`Patreon account linking verification failed: ${failure[1]}`);
  process.exit(1);
}

console.log("Patreon account linking PASS — gated UI, minimal OAuth, encrypted tokens, single-use state, isolated private tables");
