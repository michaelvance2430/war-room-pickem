#!/usr/bin/env node
/**
 * Entry-path smoke: founder-one-click + host bot pad gates.
 * Run: npx tsx scripts/smoke-foundry-isolation-entry.mjs
 *
 * Does not require authenticated Supabase for the LAB-block proof.
 * Downstream cloud failures without auth are OK; LAB boundary on production is required.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const envPath = join(ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.localStorage = localStorage;
globalThis.window = {
  localStorage,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { href: "http://localhost/founder", pathname: "/founder" },
};
globalThis.document = { createElement: () => ({}) };

const CREATOR = "09544d2b-6eca-4131-a321-c000586c9029";
const PROD = {
  id: "a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4",
  name: "Saturday Situation Room",
  settings: {},
};
const LAB = {
  id: "f1f1f1f1-2222-3333-4444-555555555555",
  name: "[LAB] Disposable Isolation Smoke",
  settings: { isTest: true, mode: "foundry" },
};

function seed(lg, playerId = CREATOR) {
  localStorage.setItem(
    "warroom-session",
    JSON.stringify({
      playerId,
      leagueId: lg.id,
      isCommissioner: true,
    })
  );
  localStorage.setItem("warroom-league", JSON.stringify(lg));
}

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`  ok  ${name}${detail ? " — " + detail : ""}`);
  else {
    failed++;
    console.error(`  FAIL ${name}${detail ? " — " + detail : ""}`);
  }
}

console.log("\n=== Foundry isolation · entry-path smoke ===\n");

const one = await import("../src/lib/founder-one-click.ts");
const iso = await import("../src/lib/foundry-isolation.ts");
const cloud = await import("../src/lib/cloud.ts");
const league = await import("../src/lib/league.ts");

// Confirm session/league readable
seed(PROD);
const sess = league.getSession?.();
const lg = league.getLeague?.();
console.log("  session/league probe:", {
  sessPlayer: sess?.playerId?.slice?.(0, 8),
  sessLeague: sess?.leagueId?.slice?.(0, 8),
  lgId: lg?.id?.slice?.(0, 8),
  lgName: lg?.name,
});

// --- S3 production hard-block ---
localStorage.removeItem("warroom-foundry-lab-league-ids-v1");
seed(PROD);
const r1 = await one.founderPostAndScoreWeek(1);
ok(
  "S3 real league Foundry post+score hard-blocks",
  r1.ok === false && /LAB boundary|marked test leagues/i.test(r1.message || ""),
  r1.message?.slice(0, 160)
);

const r1b = await one.founderScoreWeek(1);
ok(
  "S3 founderScoreWeek hard-blocks",
  r1b.ok === false && /LAB boundary|marked test leagues/i.test(r1b.message || ""),
  r1b.message?.slice(0, 120)
);

const r1c = await one.founderPostWeek(1);
ok(
  "S3 founderPostWeek hard-blocks",
  r1c.ok === false && /LAB boundary|marked test leagues/i.test(r1c.message || ""),
  r1c.message?.slice(0, 120)
);

// --- S4 LAB allow past boundary (downstream may fail without auth) ---
seed(LAB);
iso.markLeagueAsFoundryLab(LAB.id);
// Re-seed after mark (mark may update settings on active league)
seed({
  ...LAB,
  settings: { ...LAB.settings, isTest: true, mode: "foundry" },
});
const r2 = await one.founderEnsureFullBotRoster({ targetTotal: 2 });
const labBlocked = /LAB boundary|marked test leagues/i.test(r2.message || "");
ok(
  "S4 marked LAB room does NOT LAB-boundary block",
  !labBlocked,
  r2.ok
    ? "ok ran"
    : `downstream: ${(r2.message || "").slice(0, 140)} (auth/cloud expected without session)`
);

// Also assert gate alone allows
const gateLab = iso.assertFoundryMutationAllowed("entry-lab", {
  ...LAB,
  settings: { isTest: true, mode: "foundry" },
});
ok("S4 assertFoundryMutationAllowed allows LAB", gateLab.ok === true);

// --- S5 host bot pad not LAB-hard ---
localStorage.removeItem("warroom-foundry-lab-league-ids-v1");
seed(PROD);
let r3 = { ok: false, error: "" };
try {
  r3 = await cloud.seedBotPicksForWeekInCloud(1);
} catch (e) {
  r3 = { ok: false, error: e instanceof Error ? e.message : String(e) };
}
const botLabBlock = /LAB boundary|marked test leagues/i.test(r3.error || "");
ok(
  "S5 production seedBotPicks is NOT LAB-boundary blocked",
  !botLabBlock,
  r3.ok
    ? "ok"
    : `expected host/auth error: ${(r3.error || "").slice(0, 140)}`
);

// Chaos remains LAB-hard
let r4 = { ok: false, error: "" };
try {
  r4 = await cloud.applyRandomBotChaosForWeek(1, { chance: 22 });
} catch (e) {
  r4 = { ok: false, error: e instanceof Error ? e.message : String(e) };
}
const chaosLab =
  r4.ok === false && /LAB boundary|marked test leagues/i.test(r4.error || "");
ok(
  "S5b chaos on production IS LAB-blocked (sim spice)",
  chaosLab,
  r4.error?.slice(0, 120)
);

// Self sim LAB-hard
let r5 = { ok: false, error: "" };
try {
  r5 = await cloud.seedSelfSimPicksIfEmpty(1);
} catch (e) {
  r5 = { ok: false, error: e instanceof Error ? e.message : String(e) };
}
const selfLab =
  r5.ok === false && /LAB boundary|marked test leagues/i.test(r5.error || "");
ok(
  "S5c self-sim on production IS LAB-blocked",
  selfLab,
  r5.error?.slice(0, 120)
);

// --- S6 no writes claim ---
ok(
  "S6 entry smoke: Foundry score/post refused before cloud score path",
  r1.ok === false && r1b.ok === false && r1c.ok === false
);

console.log(`\n${failed ? "FAILED" : "PASSED"} — ${failed} failure(s)\n`);
process.exit(failed ? 1 : 0);
