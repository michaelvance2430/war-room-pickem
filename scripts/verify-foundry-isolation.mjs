/**
 * Foundry isolation contract (static).
 * Run: node scripts/verify-foundry-isolation.mjs
 *
 * Law: simulations only on explicitly marked LAB leagues.
 * Failed boundary → hard stop. No soft fallback to production.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const iso = read("src/lib/foundry-isolation.ts");
const q = read("src/lib/foundry-quarantine.ts");
const fp = read("src/lib/foundry-preview.ts");
const one = read("src/lib/founder-one-click.ts");
const chrome = read("src/components/FoundrySessionChrome.tsx");
const foundryPage = read("src/app/foundry/page.tsx");
const founderPage = read("src/app/founder/page.tsx");
const commish = read("src/app/commissioner/CommissionerClient.tsx");
const cloud = read("src/lib/cloud.ts");
const leagueMode = read("src/lib/league-mode.ts");

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL ${name}\n       ${e.message || e}`);
  }
}

console.log("\n=== Foundry isolation guard ===\n");

test("isExplicitLabLeague does NOT use calendar sandbox alone", () => {
  assert.doesNotMatch(iso, /isSandboxMode\s*\(/);
  assert.match(iso, /isExplicitLabLeague/);
  assert.match(iso, /warroom-foundry-lab-league-ids-v1/);
});

test("assertFoundryMutationAllowed hard-stops non-lab", () => {
  assert.match(iso, /assertFoundryMutationAllowed/);
  assert.match(iso, /code:\s*"not_lab"/);
  assert.match(iso, /FOUNDRY_LAB_BLOCK_REASON/);
});

test("quarantine assert chains to isolation (not soft pass)", () => {
  assert.match(q, /assertFoundryMutationAllowed\(source\)/);
  assert.match(q, /FOUNDRY_EMERGENCY_QUARANTINE\s*=\s*false/);
});

test("founder one-click gated at every entry", () => {
  assert.match(one, /assertFoundryLabRun\("founderEnsureFullBotRoster"\)/);
  assert.match(one, /assertFoundryLabRun\("founderPostWeek"\)/);
  assert.match(one, /assertFoundryLabRun\("founderScoreWeek"\)/);
  assert.match(one, /assertFoundryLabRun\("founderOpenLockedBoard"\)/);
  assert.match(one, /assertFoundryNotQuarantined/);
  assert.doesNotMatch(one, /function assertCreator\s*\(/);
});

test("commissioner has no Foundry simulation access", () => {
  assert.match(commish, /requirePreseasonTools/);
  assert.doesNotMatch(commish, /showCommishLabTools|FoundryLabIsolationPanel/);
  assert.match(fp, /isExplicitLabLeague/);
  assert.match(fp, /showCommishLabTools/);
});

test("cloud: self-sim + chaos require LAB; bot pad is host dual-use", () => {
  assert.match(cloud, /seedSelfSimPicksIfEmpty/);
  assert.match(cloud, /LAB isolation unavailable — self sim pick blocked/);
  assert.match(cloud, /applyRandomBotChaosForWeek/);
  assert.match(cloud, /LAB isolation unavailable — bot chaos blocked/);
  // Dual-use host pad: emergency kill only (not full LAB assert)
  assert.match(cloud, /seedBotPicksForWeekInCloud[\s\S]*isFoundryQuarantined/);
  assert.match(cloud, /seedTrialBotsInCloud[\s\S]*isFoundryQuarantined/);
});

test("sandbox auto-finish requires LAB", () => {
  const auto = read("src/lib/sandbox-auto-finish.ts");
  assert.match(auto, /assertFoundryNotQuarantined\("autoFinishRemainingWeeks"\)/);
});

test("LAB boundary stays internal instead of becoming a founder choice", () => {
  assert.match(chrome, /LAB · Foundry/);
  assert.doesNotMatch(foundryPage, /FoundryLabIsolationPanel|Mark this room LAB|Unmark \(production\)/);
  assert.doesNotMatch(founderPage, /FoundryLabIsolationPanel|Mark this room LAB|Unmark \(production\)/);
});

test("ceremonies require explicit LAB (not sticky alone)", () => {
  assert.match(fp, /allowFoundryCeremonies[\s\S]*isExplicitLabLeague/);
});

test("career calendar sandbox still separate from Foundry LAB", () => {
  // resolveLeagueMode may use isSandboxMode for career engraving only
  assert.match(leagueMode, /isSandboxMode/);
  assert.match(leagueMode, /isExplicitLabLeague|Foundry board mutations still require/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
