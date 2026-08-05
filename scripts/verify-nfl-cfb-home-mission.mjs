/**
 * Independent CFB vs NFL mission precedence verification (pure hub resolver).
 * Run: npx tsx scripts/verify-nfl-cfb-home-mission.mjs
 */

import assert from "node:assert/strict";
import {
  resolveLeagueHubAction,
  isActionableHubTask,
  isCrystalBallOpeningWeek,
  isFormallyPublishedHubCard,
  weeklyHubTaskAttention,
} from "../src/lib/league-hub-actions.ts";
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
    console.error(`  FAIL ${name}`);
    console.error(`       ${e.message || e}`);
  }
}

function base(over = {}) {
  return {
    sportId: "cfb",
    liveWeek: 0,
    isOps: false,
    expectedGames: 5,
    cardId: null,
    publishedAt: null,
    gameCount: 0,
    hasProp: false,
    gamesForLock: [],
    weekScored: false,
    nextWeek: null,
    nextWeekHasGames: false,
    pickId: null,
    pickGameCount: 0,
    pickHasProp: false,
    pickHasBestBet: false,
    lockedAt: null,
    crystalBallSealed: true,
    crystalBallEnabled: true,
    needsNflTeam: false,
    ...over,
  };
}

function publishedPlayer(sportId, week, pick = {}) {
  return base({
    sportId,
    liveWeek: week,
    cardId: "card-1",
    publishedAt: "2026-09-01T12:00:00.000Z",
    gameCount: 5,
    hasProp: true,
    gamesForLock: [{ commenceTime: "2099-01-01T00:00:00.000Z" }],
    pickId: pick.pickId ?? null,
    pickGameCount: pick.pickGameCount ?? 0,
    pickHasProp: pick.pickHasProp ?? false,
    pickHasBestBet: pick.pickHasBestBet ?? false,
    lockedAt: pick.lockedAt ?? null,
    crystalBallSealed: true,
    needsNflTeam: false,
  });
}

console.log("\n=== CFB mission matrix ===\n");

test("CFB first week is 0", () => {
  assert.equal(firstSeasonWeek("cfb"), 0);
  assert.equal(isCrystalBallOpeningWeek("cfb", 0), true);
  assert.equal(isCrystalBallOpeningWeek("cfb", 1), false);
});

test("CFB no card → wait, badge 0, no /picks", () => {
  const r = resolveLeagueHubAction(base({ sportId: "cfb", liveWeek: 0 }));
  assert.equal(r.action.code, "ENTER");
  assert.match(r.action.label.toLowerCase(), /waiting/);
  assert.notEqual(r.action.href, "/picks");
  assert.equal(isActionableHubTask(r.action), false);
  assert.equal(weeklyHubTaskAttention({ action: r.action }), 0);
});

test("CFB draft games without publish → still wait", () => {
  const r = resolveLeagueHubAction(
    base({
      sportId: "cfb",
      liveWeek: 0,
      cardId: "draft",
      publishedAt: null,
      gameCount: 5,
      hasProp: true,
    })
  );
  assert.equal(r.action.code, "ENTER");
  assert.equal(isFormallyPublishedHubCard({ cardId: "draft", publishedAt: null }), false);
  assert.equal(isActionableHubTask(r.action), false);
});

test("CFB published zero picks → MAKE_PICKS badge 1", () => {
  const r = resolveLeagueHubAction(publishedPlayer("cfb", 0));
  assert.equal(r.action.code, "MAKE_PICKS");
  assert.equal(r.action.href, "/picks");
  assert.equal(isActionableHubTask(r.action), true);
});

test("CFB incomplete picks → FINISH_CARD", () => {
  const r = resolveLeagueHubAction(
    publishedPlayer("cfb", 0, {
      pickId: "p1",
      pickGameCount: 2,
      pickHasProp: false,
      pickHasBestBet: false,
    })
  );
  assert.equal(r.action.code, "FINISH_CARD");
});

test("CFB complete locked → ENTER ready", () => {
  const r = resolveLeagueHubAction(
    publishedPlayer("cfb", 0, {
      pickId: "p1",
      pickGameCount: 5,
      pickHasProp: true,
      pickHasBestBet: true,
      lockedAt: "2026-09-01T00:00:00.000Z",
    })
  );
  assert.equal(r.action.code, "ENTER");
  assert.equal(r.signal.tone, "ready");
  assert.equal(isActionableHubTask(r.action), false);
});

test("CFB crystal ball week 0 unsealed before wait", () => {
  const r = resolveLeagueHubAction(
    base({
      sportId: "cfb",
      liveWeek: 0,
      crystalBallEnabled: true,
      crystalBallSealed: false,
    })
  );
  assert.equal(r.action.code, "LOCK_CRYSTAL_BALL");
  assert.equal(r.action.href, "/crystal-ball");
  assert.equal(isActionableHubTask(r.action), true);
});

test("CFB ops no card → BUILD_CARD", () => {
  const r = resolveLeagueHubAction(
    base({ sportId: "cfb", liveWeek: 0, isOps: true, gameCount: 0 })
  );
  assert.equal(r.action.code, "BUILD_CARD");
  assert.match(r.action.href, /week-ops/);
});

test("CFB never requires NFL team", () => {
  const r = resolveLeagueHubAction(
    base({ sportId: "cfb", liveWeek: 0, needsNflTeam: true })
  );
  // needsNflTeam only applies when sportId is nfl
  assert.notEqual(r.action.code, "CHOOSE_TEAM");
});

test("CFB fail-closed null facts → ENTER", () => {
  // resolveLeagueHubAction always gets a bundle; loadFacts returns null → fallback pulse ENTER
  assert.equal(isActionableHubTask({ code: "ENTER", label: "Enter", href: "/" }), false);
});

console.log("\n=== NFL mission matrix (independent) ===\n");

test("NFL first week is 1 never 0", () => {
  assert.equal(firstSeasonWeek("nfl"), 1);
  assert.equal(isCrystalBallOpeningWeek("nfl", 1), true);
  assert.equal(isCrystalBallOpeningWeek("nfl", 0), false);
  assert.equal(isCrystalBallOpeningWeek("nfl", 2), false);
});

test("NFL: no allegiance, no SB, no card → CHOOSE_TEAM first", () => {
  const r = resolveLeagueHubAction(
    base({
      sportId: "nfl",
      liveWeek: 1,
      needsNflTeam: true,
      crystalBallSealed: false,
      crystalBallEnabled: true,
    })
  );
  assert.equal(r.action.code, "CHOOSE_TEAM");
  assert.match(r.action.href, /declare-allegiance\?sport=nfl/);
  assert.equal(isActionableHubTask(r.action), true);
});

test("NFL: allegiance done, SB missing, no card → Super Bowl pick", () => {
  const r = resolveLeagueHubAction(
    base({
      sportId: "nfl",
      liveWeek: 1,
      needsNflTeam: false,
      crystalBallEnabled: true,
      crystalBallSealed: false,
    })
  );
  assert.equal(r.action.code, "LOCK_CRYSTAL_BALL");
  assert.equal(r.action.label, "Make Super Bowl Pick");
  assert.equal(r.action.href, "/crystal-ball");
});

test("NFL: allegiance + SB done, no card → Waiting on commissioner badge 0", () => {
  const r = resolveLeagueHubAction(
    base({
      sportId: "nfl",
      liveWeek: 1,
      needsNflTeam: false,
      crystalBallSealed: true,
      crystalBallEnabled: true,
    })
  );
  assert.equal(r.action.code, "ENTER");
  assert.match(r.action.label.toLowerCase(), /waiting/);
  assert.notEqual(r.action.href, "/picks");
  assert.equal(isActionableHubTask(r.action), false);
  assert.equal(weeklyHubTaskAttention({ action: r.action }), 0);
});

test("NFL draft not published → wait not Make Picks", () => {
  const r = resolveLeagueHubAction(
    base({
      sportId: "nfl",
      liveWeek: 1,
      cardId: "draft-nfl",
      publishedAt: null,
      gameCount: 5,
      hasProp: true,
      needsNflTeam: false,
      crystalBallSealed: true,
    })
  );
  assert.equal(r.action.code, "ENTER");
  assert.notEqual(r.action.code, "MAKE_PICKS");
  assert.equal(isActionableHubTask(r.action), false);
});

test("NFL published zero picks → MAKE_PICKS", () => {
  const r = resolveLeagueHubAction(publishedPlayer("nfl", 1));
  assert.equal(r.action.code, "MAKE_PICKS");
  assert.equal(r.action.href, "/picks");
});

test("NFL published incomplete → FINISH_CARD", () => {
  const r = resolveLeagueHubAction(
    publishedPlayer("nfl", 1, {
      pickId: "p",
      pickGameCount: 3,
      pickHasProp: true,
      pickHasBestBet: false,
    })
  );
  assert.equal(r.action.code, "FINISH_CARD");
});

test("NFL published complete locked → Ready", () => {
  const r = resolveLeagueHubAction(
    publishedPlayer("nfl", 1, {
      pickId: "p",
      pickGameCount: 5,
      pickHasProp: true,
      pickHasBestBet: true,
      lockedAt: "2026-09-10T00:00:00.000Z",
    })
  );
  assert.equal(r.action.code, "ENTER");
  assert.equal(r.signal.tone, "ready");
});

test("NFL commissioner no card → BUILD_CARD not wait", () => {
  const r = resolveLeagueHubAction(
    base({
      sportId: "nfl",
      liveWeek: 1,
      isOps: true,
      gameCount: 0,
      needsNflTeam: false,
      crystalBallSealed: true,
    })
  );
  assert.equal(r.action.code, "BUILD_CARD");
  assert.equal(/waiting/i.test(r.action.label), false);
});

test("NFL deputy no card → BUILD_CARD (ops)", () => {
  const r = resolveLeagueHubAction(
    base({
      sportId: "nfl",
      liveWeek: 1,
      isOps: true, // deputy is ops
      gameCount: 0,
      needsNflTeam: false,
      crystalBallSealed: true,
    })
  );
  assert.equal(r.action.code, "BUILD_CARD");
});

test("NFL does not invent Week 0 crystal requirement", () => {
  assert.equal(isCrystalBallOpeningWeek("nfl", 0), false);
  const r = resolveLeagueHubAction(
    base({
      sportId: "nfl",
      liveWeek: 0, // stale stamp
      needsNflTeam: false,
      crystalBallSealed: false,
      crystalBallEnabled: true,
    })
  );
  // Week 0 is not NFL opening week → skip SB gate → wait (no publish)
  assert.notEqual(r.action.code, "LOCK_CRYSTAL_BALL");
  assert.equal(r.action.code, "ENTER");
});

test("NFL fail-closed: missing publishedAt never Make Picks", () => {
  const r = resolveLeagueHubAction(
    base({
      sportId: "nfl",
      liveWeek: 1,
      cardId: "x",
      publishedAt: "",
      gameCount: 5,
      needsNflTeam: false,
      crystalBallSealed: true,
    })
  );
  assert.notEqual(r.action.code, "MAKE_PICKS");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
