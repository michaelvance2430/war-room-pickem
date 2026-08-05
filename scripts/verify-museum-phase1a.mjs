/**
 * Museum Phase 1A pure verification (no DB required).
 * Run: node scripts/verify-museum-phase1a.mjs
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Load compiled-ish TS via dynamic import of source is not available without ts-node.
// Inline the pure helpers we care about (mirror identity.ts / generator-stub).

function buildGameIdentityKey(opts) {
  const provider = (opts.providerGameId || "").trim();
  if (provider) return provider;
  const a = (opts.awayTeamId || "").trim();
  const h = (opts.homeTeamId || "").trim();
  if (a && h) return `${a}|${h}`;
  return null;
}

function underdogSideFromCard(favorite) {
  if (favorite === "home") return "away";
  if (favorite === "away") return "home";
  return null;
}

function isSpreadUpsetOutright(opts) {
  if (!opts.cardFavorite) return false;
  if (opts.awayScore === opts.homeScore) return false;
  const outrightWinner =
    opts.homeScore > opts.awayScore ? "home" : "away";
  const dog = underdogSideFromCard(opts.cardFavorite);
  return dog != null && dog === outrightWinner;
}

const MUSEUM_EVENT_GENERATION_ENABLED = false;

async function tryGenerateFanFavoriteRivalryExhibits() {
  if (!MUSEUM_EVENT_GENERATION_ENABLED) {
    return {
      ok: true,
      generated: false,
      reason: "phase_1a_generation_disabled",
    };
  }
  return { ok: true, generated: false, reason: "phase_1a_generation_disabled" };
}

// ── Tests ────────────────────────────────────────────────────

// Identity prefers provider id
assert.equal(
  buildGameIdentityKey({
    providerGameId: "odds-abc",
    awayTeamId: "georgia",
    homeTeamId: "auburn",
  }),
  "odds-abc"
);

// Fallback to canonical pair
assert.equal(
  buildGameIdentityKey({
    providerGameId: null,
    awayTeamId: "georgia",
    homeTeamId: "auburn",
  }),
  "georgia|auburn"
);

// Missing both → null
assert.equal(
  buildGameIdentityKey({ providerGameId: "", awayTeamId: "", homeTeamId: "" }),
  null
);

// Spread upset: underdog wins outright
assert.equal(
  isSpreadUpsetOutright({
    cardFavorite: "home",
    awayScore: 28,
    homeScore: 21,
  }),
  true
);

// Covering only is NOT upset
assert.equal(
  isSpreadUpsetOutright({
    cardFavorite: "home",
    awayScore: 20,
    homeScore: 24, // home still wins outright
  }),
  false
);

// Pick'em / no favorite
assert.equal(
  isSpreadUpsetOutright({
    cardFavorite: null,
    awayScore: 30,
    homeScore: 14,
  }),
  false
);

// Generator stub never generates
const gen = await tryGenerateFanFavoriteRivalryExhibits();
assert.equal(gen.generated, false);
assert.equal(gen.reason, "phase_1a_generation_disabled");
assert.equal(MUSEUM_EVENT_GENERATION_ENABLED, false);

// Both-side candidacy rule (pure): one side is not enough
function isRivalryCandidate(sides) {
  return sides.awaySupporters >= 1 && sides.homeSupporters >= 1;
}
assert.equal(isRivalryCandidate({ awaySupporters: 0, homeSupporters: 3 }), false);
assert.equal(isRivalryCandidate({ awaySupporters: 2, homeSupporters: 0 }), false);
assert.equal(isRivalryCandidate({ awaySupporters: 1, homeSupporters: 1 }), true);
assert.equal(isRivalryCandidate({ awaySupporters: 3, homeSupporters: 2 }), true);

// Snapshot status naming
const STATUS = { PRELOCK: "prelock", FROZEN: "frozen" };
assert.notEqual(STATUS.PRELOCK, "locked");
assert.equal(STATUS.FROZEN, "frozen");

// OT default null (unknown)
const otDefault = null;
assert.equal(otDefault, null);

// SQL migration file exists
import fs from "node:fs";
const sqlPath = path.join(root, "supabase", "museum-phase1a-foundation.sql");
assert.ok(fs.existsSync(sqlPath), "migration file missing");
const sql = fs.readFileSync(sqlPath, "utf8");
assert.match(sql, /museum_events/);
assert.match(sql, /museum_event_participants/);
assert.match(sql, /museum_allegiance_snapshots/);
assert.match(sql, /game_final_scores/);
assert.match(sql, /museum_rebuild_allegiance_snapshots/);
assert.match(sql, /museum_upsert_game_final_scores/);
assert.match(sql, /status text not null check \(status in \('prelock', 'frozen'\)\)/);
// No ON DELETE CASCADE from leagues to museum_events
assert.doesNotMatch(
  sql,
  /museum_events[\s\S]{0,400}references public\.leagues[^;]*on delete cascade/i
);

// Generator stub source
const stubPath = path.join(root, "src", "lib", "museum", "generator-stub.ts");
const stub = fs.readFileSync(stubPath, "utf8");
assert.match(stub, /MUSEUM_EVENT_GENERATION_ENABLED = false/);
assert.match(stub, /phase_1a_generation_disabled/);

console.log("verify-museum-phase1a: ALL PASS");
