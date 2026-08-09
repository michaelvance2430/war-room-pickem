/**
 * Static + pure verification for Auto Balance UI refresh contract.
 * Run: node scripts/verify-auto-balance-ui.mjs
 * No production mutation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cloud = readFileSync(join(root, "src/lib/cloud.ts"), "utf8");
const players = readFileSync(join(root, "src/app/players/page.tsx"), "utf8");
const divisions = readFileSync(join(root, "src/lib/divisions.ts"), "utf8");

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

console.log("\n=== Auto Balance UI refresh contract ===\n");

test("Mutation returns verified roster on success", () => {
  assert.match(cloud, /roster\?:\s*LeagueRosterMember\[\]/);
  assert.match(cloud, /roster:\s*verified/);
  assert.match(cloud, /seedRosterCache\(leagueId,\s*verified\)/);
  assert.match(cloud, /emitRosterDivisionsUpdated\(leagueId,\s*verified\)/);
});

test("Roster cache generation guards stale inflight cacheSet", () => {
  assert.match(cloud, /const rosterGeneration = new Map/);
  assert.match(cloud, /const genAtStart = rosterGeneration\.get\(leagueId\)/);
  assert.match(cloud, /commitRoster/);
  assert.match(
    cloud,
    /rosterGeneration\.get\(leagueId\) \|\| 0\) === genAtStart/
  );
});

test("Force load bypasses loadLeagueRoster inflight join", () => {
  assert.match(
    cloud,
    /export async function loadLeagueRosterFreshForced[\s\S]*loadLeagueRosterFresh\(leagueId\)/
  );
  // Must not simply return loadLeagueRoster() after invalidate (stale race)
  const forced = cloud.slice(
    cloud.indexOf("export async function loadLeagueRosterFreshForced")
  );
  const body = forced.slice(0, forced.indexOf("export async function isDivisionAutoBalanceLocked"));
  assert.doesNotMatch(body, /return loadLeagueRoster\(\)/);
});

test("savedButRefreshFailed path exists", () => {
  assert.match(cloud, /savedButRefreshFailed/);
  assert.match(players, /result\.savedButRefreshFailed/);
  assert.match(players, /Retry Refresh/);
  assert.match(players, /retryRosterRefresh/);
});

test("Players page applies authoritative roster immediately", () => {
  assert.match(players, /applyAuthoritativeRoster\(result\.roster\)/);
  assert.match(players, /function applyAuthoritativeRoster/);
  assert.match(players, /setPlayers\(roster\)/);
  assert.match(players, /balancing/);
  assert.match(players, /busy \|\|\s*balancing/);
  assert.doesNotMatch(players, /window\.location\.reload/);
  assert.doesNotMatch(players, /router\.refresh/);
});

test("Double-submit blocked while balancing", () => {
  assert.match(players, /if \(!canManageDivs \|\| busy \|\| balancing\) return/);
  assert.match(players, /disabled=\{\s*busy \|\|\s*balancing/);
  assert.match(players, /\{balancing \? "Checking…" : "Preview Auto-Balance"\}/);
  assert.match(players, /\{balancing \? "Applying…" : "Apply moves"\}/);
});

test("Minimum-move planner still owns Auto Balance", () => {
  assert.match(cloud, /planMinMoveBalance\(/);
  assert.match(divisions, /export function planMinMoveBalance/);
  assert.doesNotMatch(
    cloud.slice(cloud.indexOf("export async function autoBalanceDivisions")),
    /Math\.random|shuffle|planAutoBalance/
  );
});

test("EVENT_ROSTER_DIVISIONS_UPDATED exported and listened", () => {
  assert.match(cloud, /EVENT_ROSTER_DIVISIONS_UPDATED/);
  assert.match(players, /EVENT_ROSTER_DIVISIONS_UPDATED/);
  assert.match(players, /addEventListener\(EVENT_ROSTER_DIVISIONS_UPDATED/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
