/**
 * Pure unit checks for league display name resolution.
 * node scripts/verify-league-display-name.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Mirror display-name.ts (avoid TS import)
function validateDisplayNameInput(raw) {
  if (raw == null) return { ok: true, value: null };
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { ok: true, value: null };
  if (name.length < 2) return { ok: false, error: "Name needs at least 2 characters." };
  if (name.length > 40) return { ok: false, error: "Keep it under 40 characters." };
  return { ok: true, value: name };
}

function resolveLeagueDisplayName(opts) {
  const override = (opts.membershipOverride || "").trim();
  if (override) return override;
  const account = (opts.profileDisplayName || "").trim();
  if (account) return account;
  return opts.fallback || "Player";
}

function normalizeOverrideForStorage(alias, accountDisplayName) {
  const v = validateDisplayNameInput(alias);
  if (!v.ok) return null;
  if (v.value == null) return null;
  const account = (accountDisplayName || "").trim();
  if (account && v.value.toLowerCase() === account.toLowerCase()) return null;
  return v.value;
}

assert.equal(
  resolveLeagueDisplayName({ membershipOverride: null, profileDisplayName: "Mike" }),
  "Mike"
);
assert.equal(
  resolveLeagueDisplayName({
    membershipOverride: "The Commish",
    profileDisplayName: "Mike",
  }),
  "The Commish"
);
assert.equal(
  resolveLeagueDisplayName({
    membershipOverride: "  ",
    profileDisplayName: "Mike",
  }),
  "Mike"
);
assert.equal(normalizeOverrideForStorage("Mike", "Mike"), null);
assert.equal(normalizeOverrideForStorage("The Commish", "Mike"), "The Commish");
assert.equal(validateDisplayNameInput("").ok, true);
assert.equal(validateDisplayNameInput("").value, null);
assert.equal(validateDisplayNameInput("A").ok, false);

// Create/join must not write profiles.display_name with nick
const join = fs.readFileSync(path.join(root, "src/app/join/page.tsx"), "utf8");
assert.ok(!/display_name:\s*nick/.test(join), "join still writes nick to profiles");
assert.ok(
  join.includes("setMyLeagueDisplayName"),
  "join should set league alias via RPC"
);
assert.ok(
  join.includes("ensureProfileRowExists"),
  "join should ensure profile without overwrite"
);

const openRoom = fs.readFileSync(path.join(root, "src/lib/open-room.ts"), "utf8");
assert.ok(
  !/display_name:\s*displayName\.trim/.test(openRoom),
  "open-room must not upsert profile from displayName"
);

const sql = fs.readFileSync(
  path.join(root, "supabase/membership-display-name-override.sql"),
  "utf8"
);
assert.match(sql, /display_name_override/);
assert.match(sql, /set_my_league_display_name/);
assert.match(sql, /revoke all[\s\S]*from anon/i);
assert.match(sql, /begin;/i);
assert.match(sql, /commit;/i);

const gen = fs.readFileSync(
  path.join(root, "src/lib/museum/generator-stub.ts"),
  "utf8"
);
assert.match(gen, /MUSEUM_EVENT_GENERATION_ENABLED = false/);

console.log("verify-league-display-name: ALL PASS");
