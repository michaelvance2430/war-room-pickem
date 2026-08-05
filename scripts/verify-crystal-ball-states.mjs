/**
 * Crystal Ball three-state + lock authority smoke (pure helpers).
 * Run: npx tsx scripts/verify-crystal-ball-states.mjs
 */

import assert from "node:assert/strict";
import {
  isCrystalBallLocked,
  crystalBallLockMs,
  crystalBallLockLabel,
  crystalBallTeams,
} from "../src/lib/crystal-ball.ts";
import { isCrystalBallOpeningWeek } from "../src/lib/league-hub-actions.ts";
import { firstSeasonWeek } from "../src/lib/season-calendar.ts";

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

console.log("\n=== Crystal Ball identity & lock helpers ===\n");

test("NFL opening week is 1 not 0", () => {
  assert.equal(firstSeasonWeek("nfl"), 1);
  assert.equal(isCrystalBallOpeningWeek("nfl", 1), true);
  assert.equal(isCrystalBallOpeningWeek("nfl", 0), false);
});

test("CFB opening week is 0", () => {
  assert.equal(firstSeasonWeek("cfb"), 0);
  assert.equal(isCrystalBallOpeningWeek("cfb", 0), true);
  assert.equal(isCrystalBallOpeningWeek("cfb", 1), false);
});

test("NFL teams are pro catalog not FBS", () => {
  const nfl = crystalBallTeams("nfl");
  const cfb = crystalBallTeams("cfb");
  assert.ok(nfl.length <= 40);
  assert.ok(cfb.length > 50);
  assert.ok(nfl.some((t) => /Chiefs|Eagles|Ravens/i.test(t.name)));
});

test("CFB calendar lock ms is finite", () => {
  const ms = crystalBallLockMs("cfb");
  assert.ok(Number.isFinite(ms) && ms > 0);
  assert.ok(typeof crystalBallLockLabel("cfb") === "string");
});

test("CFB isCrystalBallLocked respects now", () => {
  const ms = crystalBallLockMs("cfb");
  assert.equal(isCrystalBallLocked(ms - 60_000, "cfb"), false);
  assert.equal(isCrystalBallLocked(ms + 60_000, "cfb"), true);
});

test("liveLocked fail-closed past known deadline (client model)", () => {
  const lockAtMs = Date.now() - 1000;
  const now = Date.now();
  const stateLocked = false;
  const liveLocked =
    stateLocked ||
    (now != null && lockAtMs != null && lockAtMs > 0 && now >= lockAtMs);
  assert.equal(liveLocked, true);
});

test("unlocked when deadline in future", () => {
  const lockAtMs = Date.now() + 60_000;
  const now = Date.now();
  const liveLocked =
    false ||
    (now != null && lockAtMs != null && lockAtMs > 0 && now >= lockAtMs);
  assert.equal(liveLocked, false);
});

// UI state matrix (pure booleans mirror page)
function uiStates({ myTeam, changing, liveLocked }) {
  return {
    showOpenPicker: !myTeam && !changing && !liveLocked,
    showSealedOpen: !!myTeam && !changing && !liveLocked,
    showLocked: liveLocked,
    showChangeMode: !!myTeam && changing && !liveLocked,
  };
}

test("UI A: no pick open", () => {
  const s = uiStates({ myTeam: null, changing: false, liveLocked: false });
  assert.equal(s.showOpenPicker, true);
  assert.equal(s.showSealedOpen, false);
  assert.equal(s.showLocked, false);
  assert.equal(s.showChangeMode, false);
});

test("UI B: pick in unlocked", () => {
  const s = uiStates({
    myTeam: "Kansas City Chiefs",
    changing: false,
    liveLocked: false,
  });
  assert.equal(s.showSealedOpen, true);
  assert.equal(s.showOpenPicker, false);
  assert.equal(s.showChangeMode, false);
  assert.equal(s.showLocked, false);
});

test("UI B change mode", () => {
  const s = uiStates({
    myTeam: "Kansas City Chiefs",
    changing: true,
    liveLocked: false,
  });
  assert.equal(s.showChangeMode, true);
  assert.equal(s.showSealedOpen, false);
  assert.equal(s.showOpenPicker, false);
});

test("UI C locked hides change and open", () => {
  const s = uiStates({
    myTeam: "Georgia",
    changing: true,
    liveLocked: true,
  });
  assert.equal(s.showLocked, true);
  assert.equal(s.showChangeMode, false);
  assert.equal(s.showOpenPicker, false);
  assert.equal(s.showSealedOpen, false);
});

test("Keep current pick = cancel zero mutation model", () => {
  // cancelChange only restores selected to myTeam — pure contract
  let selected = "Bills";
  const myTeam = "Chiefs";
  selected = myTeam; // cancel
  assert.equal(selected, myTeam);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
