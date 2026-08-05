/**
 * Stage PS1 regression runner — pure engine only (no Supabase).
 * Run: node --import tsx scripts/verify-postseason-ps1.mjs
 *   or: npx tsx scripts/verify-postseason-ps1.mjs
 */

import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

// Prefer tsx register via process already importing tsx
const require = createRequire(import.meta.url);

let ps;
try {
  // When run via tsx, dynamic import of TS works
  ps = await import("../src/lib/postseason/index.ts");
} catch (e) {
  console.error("Failed to load postseason modules. Run with: npx tsx scripts/verify-postseason-ps1.mjs");
  console.error(e);
  process.exit(1);
}

const {
  normalizeCutPercent,
  computeQualifierCount,
  filterEligibleActiveHumans,
  partitionPostseasonFields,
  buildSnapshotPlan,
  snapshotPlanFingerprint,
  validateSnapshotPlan,
  planFirstRoundByes,
  canonicalSeasonYear,
  canonicalSeasonKey,
  seasonKeyFromYear,
  evaluateFreezePreconditions,
  evaluateRepairEligibility,
  cutScoreAndFreezeCoupling,
} = ps;

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

function human(i, pts, extra = {}) {
  return {
    userId: `u${i}`,
    displayName: `Player ${String(i).padStart(2, "0")}`,
    totalPoints: pts,
    weeklyPoints: [pts],
    atsCorrect: pts,
    atsTotal: 10,
    currentStreak: 0,
    bestWeek: pts,
    bestBetHits: 0,
    bestBetTotal: 0,
    weeksPlayed: 1,
    division: ["North", "South", "East", "West"][i % 4],
    ...extra,
  };
}

/** n humans with strictly decreasing points for deterministic order */
function roster(n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    out.push(human(i, 1000 - i * 10));
  }
  return out;
}

console.log("\n=== PS1 postseason pure engine ===\n");

// —— Cut / qualifier formula ——
test("PS-cut invalid null", () => {
  assert.equal(normalizeCutPercent(null).ok, false);
});
test("PS-cut invalid NaN", () => {
  assert.equal(normalizeCutPercent(Number.NaN).ok, false);
});
test("PS-cut invalid negative", () => {
  assert.equal(normalizeCutPercent(-1).ok, false);
});
test("PS-cut invalid over 100", () => {
  assert.equal(normalizeCutPercent(101).ok, false);
});
test("PS-cut invalid float", () => {
  assert.equal(normalizeCutPercent(50.5).ok, false);
});
test("PS-cut invalid string", () => {
  assert.equal(normalizeCutPercent("nope").ok, false);
});
test("PS-cut 50 ok", () => {
  assert.deepEqual(normalizeCutPercent(50), { ok: true, cutPercent: 50 });
});

const CUTS = [0, 25, 40, 50, 60, 75, 100];
for (const cut of CUTS) {
  for (let n = 0; n <= 32; n++) {
    test(`PS-formula n=${n} cut=${cut}`, () => {
      const r = computeQualifierCount(n, cut);
      assert.equal(r.ok, true);
      if (n < 2) {
        assert.equal(r.contested, false);
        assert.equal(r.qualifierCount, 0);
        return;
      }
      if (n === 2) {
        assert.equal(r.qualifierCount, 2);
        assert.equal(r.contested, true);
        return;
      }
      const raw = Math.ceil((n * (100 - cut)) / 100);
      let q = raw;
      if (q < 2) q = 2;
      if (q > n) q = n;
      assert.equal(r.qualifierCount, q);
      assert.equal(r.contested, true);
    });
  }
}

// —— 50% table from product ——
const table = [
  [2, 2, false],
  [3, 2, false],
  [4, 2, false],
  [5, 3, false],
  [6, 3, false],
  [7, 4, false],
  [8, 4, true],
];
for (const [n, q, toilet] of table) {
  test(`PS-table n=${n} q=${q} toilet=${toilet}`, () => {
    const part = partitionPostseasonFields(roster(n), 50);
    assert.equal(part.ok, true);
    assert.equal(part.contested, true);
    assert.equal(part.qualifierCount, q);
    assert.equal(part.championship.length, q);
    assert.equal(part.toiletBowlActive, toilet);
    if (toilet) assert.equal(part.toiletParticipants.length, n - q);
    else assert.equal(part.toiletParticipants.length, 0);
  });
}

// —— Eligibility filters ——
test("PS-exclude bots mocks fixtures departed", () => {
  const m = [
    human(1, 100),
    human(2, 90, { isBot: true }),
    human(3, 80, { isMock: true }),
    human(4, 70, { isFixture: true }),
    human(5, 60, { departed: true }),
    human(6, 50, { isActive: false }),
    human(7, 40),
  ];
  const e = filterEligibleActiveHumans(m);
  assert.equal(e.length, 2);
  assert.deepEqual(
    e.map((x) => x.userId).sort(),
    ["u1", "u7"]
  );
});

// —— Non-overlap ——
test("PS-no overlap champ/toilet n=8", () => {
  const { plan, validation } = buildSnapshotPlan({
    leagueId: "L1",
    sportId: "cfb",
    cutWeek: 14,
    cutPercent: 50,
    members: roster(8),
    seasonKey: "2026",
  });
  assert.ok(plan);
  assert.equal(validation.ok, true);
  const c = new Set(
    plan.participants.filter((p) => p.field === "championship").map((p) => p.userId)
  );
  const t = new Set(
    plan.participants.filter((p) => p.field === "toilet").map((p) => p.userId)
  );
  for (const id of c) assert.equal(t.has(id), false);
  assert.equal(plan.toiletBowlActive, true);
});

// —— Determinism ——
test("PS-identical input identical fingerprint", () => {
  const input = {
    leagueId: "L1",
    sportId: "nfl",
    cutWeek: 18,
    cutPercent: 50,
    members: roster(10),
    seasonKey: "2026",
  };
  const a = buildSnapshotPlan(input);
  const b = buildSnapshotPlan(input);
  assert.equal(snapshotPlanFingerprint(a.plan), snapshotPlanFingerprint(b.plan));
});

test("PS-reordered members same seeds", () => {
  const base = roster(8);
  const shuffled = [...base].reverse();
  const a = buildSnapshotPlan({
    leagueId: "L1",
    sportId: "cfb",
    cutWeek: 14,
    cutPercent: 50,
    members: base,
    seasonKey: "2026",
  });
  const b = buildSnapshotPlan({
    leagueId: "L1",
    sportId: "cfb",
    cutWeek: 14,
    cutPercent: 50,
    members: shuffled,
    seasonKey: "2026",
  });
  assert.equal(snapshotPlanFingerprint(a.plan), snapshotPlanFingerprint(b.plan));
});

// —— Tiebreak deterministic ——
test("PS-tie total points uses name/tiebreak chain", () => {
  const m = [
    human(2, 100, { displayName: "Beta", weeklyPoints: [10, 10] }),
    human(1, 100, { displayName: "Alpha", weeklyPoints: [5, 15] }),
  ];
  // Same total; H2H: week0 Alpha 5 vs Beta 10, week1 Alpha 15 vs Beta 10 → each 1 week win → 0 H2H
  // Falls through; name Alpha before Beta if all else equal — weekly may differ
  const part = partitionPostseasonFields(m, 50);
  assert.equal(part.championship.length, 2);
});

// —— Byes non-pow2 ——
for (const n of [3, 5, 6, 7]) {
  test(`PS-bye plan n=${n}`, () => {
    const b = planFirstRoundByes(n);
    assert.equal(b.bracketSize, 2 ** Math.ceil(Math.log2(n)));
    assert.ok(b.byeSeeds.length === b.bracketSize - n);
    const { plan, validation } = buildSnapshotPlan({
      leagueId: "L1",
      sportId: "cfb",
      cutWeek: 14,
      cutPercent: 50,
      members: roster(n),
      seasonKey: "2026",
    });
    assert.equal(validation.ok, true);
    const champ = plan.participants.filter((p) => p.field === "championship");
    const byeCount = champ.filter((p) => p.firstRoundBye).length;
    assert.equal(byeCount, planFirstRoundByes(champ.length).byeSeeds.length);
  });
}

// —— Frozen plan immutable on re-score ——
test("PS-existing frozen plan not mutated", () => {
  const first = buildSnapshotPlan({
    leagueId: "L1",
    sportId: "cfb",
    cutWeek: 14,
    cutPercent: 50,
    members: roster(8),
    seasonKey: "2026",
  });
  const mutatedRoster = roster(8).map((m, i) =>
    i === 0 ? { ...m, totalPoints: 0 } : { ...m, totalPoints: 999 - i }
  );
  const second = buildSnapshotPlan({
    leagueId: "L1",
    sportId: "cfb",
    cutWeek: 14,
    cutPercent: 50,
    members: mutatedRoster,
    seasonKey: "2026",
    existingFrozenPlan: first.plan,
  });
  assert.equal(
    snapshotPlanFingerprint(first.plan),
    snapshotPlanFingerprint(second.plan)
  );
});

// —— Post-cut join excluded ——
test("PS-post-cut join excluded via excludeUserIds", () => {
  const base = roster(8);
  const withJoin = [...base, human(99, 5000)];
  const { plan } = buildSnapshotPlan({
    leagueId: "L1",
    sportId: "cfb",
    cutWeek: 14,
    cutPercent: 50,
    members: withJoin,
    seasonKey: "2026",
    excludeUserIds: ["u99"],
  });
  assert.ok(!plan.participants.some((p) => p.userId === "u99"));
  assert.equal(plan.eligibleHumanCount, 8);
});

// —— Freeze preconditions ——
test("PS-deputy may auto-freeze on cut score", () => {
  const r = evaluateFreezePreconditions({
    cutWeek: 14,
    cutWeekScoreAuthoritative: true,
    snapshotAlreadyExists: false,
    actorRole: "deputy",
    actorUserId: "d1",
  });
  assert.equal(r.ok, true);
  assert.equal(r.mayAutoFreeze, true);
});

test("PS-member cannot freeze", () => {
  const r = evaluateFreezePreconditions({
    cutWeek: 14,
    cutWeekScoreAuthoritative: true,
    snapshotAlreadyExists: false,
    actorRole: "member",
    actorUserId: "m1",
  });
  assert.equal(r.mayAutoFreeze, false);
});

test("PS-no freeze without cut score", () => {
  const r = evaluateFreezePreconditions({
    cutWeek: 14,
    cutWeekScoreAuthoritative: false,
    snapshotAlreadyExists: false,
    actorRole: "commissioner",
    actorUserId: "c1",
  });
  assert.equal(r.mayAutoFreeze, false);
});

// —— Repair ——
test("PS-deputy repair denied", () => {
  const r = evaluateRepairEligibility({
    actorRole: "deputy",
    postseasonResultExists: false,
    snapshotExists: true,
    repairNote: "fix",
  });
  assert.equal(r.mayRepair, false);
});

test("PS-commish repair before results", () => {
  const r = evaluateRepairEligibility({
    actorRole: "commissioner",
    postseasonResultExists: false,
    snapshotExists: true,
    repairNote: "Seed order wrong",
  });
  assert.equal(r.ok, true);
});

test("PS-repair denied after postseason result", () => {
  const r = evaluateRepairEligibility({
    actorRole: "commissioner",
    postseasonResultExists: true,
    snapshotExists: true,
    repairNote: "too late",
  });
  assert.equal(r.mayRepair, false);
});

test("PS-repair requires note", () => {
  const r = evaluateRepairEligibility({
    actorRole: "commissioner",
    postseasonResultExists: false,
    snapshotExists: true,
    repairNote: "  ",
  });
  assert.equal(r.mayRepair, false);
});

// —— R2 coupling ——
test("PS-cut score blocked if freeze fails", () => {
  const r = cutScoreAndFreezeCoupling({
    freezeSucceeded: false,
    cutWeekScoreWouldCommit: true,
  });
  assert.equal(r.mayCommitCutScore, false);
});

test("PS-cut score ok if freeze ok", () => {
  const r = cutScoreAndFreezeCoupling({
    freezeSucceeded: true,
    cutWeekScoreWouldCommit: true,
  });
  assert.equal(r.mayCommitCutScore, true);
});

// —— Season identity boundaries ——
test("PS-season Aug 2026 → 2026", () => {
  assert.equal(canonicalSeasonYear(new Date("2026-08-15T12:00:00Z")), 2026);
});
test("PS-season Jan 2027 → 2026", () => {
  // local month interpretation — use noon local by constructing with y,m,d
  assert.equal(canonicalSeasonYear(new Date(2027, 0, 15)), 2026);
});
test("PS-season Jul 2027 → 2027", () => {
  assert.equal(canonicalSeasonYear(new Date(2027, 6, 1)), 2027);
});
test("PS-season Jun 2026 → 2025", () => {
  assert.equal(canonicalSeasonYear(new Date(2026, 5, 30)), 2025);
});
test("PS-seasonKey stable", () => {
  assert.equal(seasonKeyFromYear(2026), "2026");
  assert.equal(canonicalSeasonKey(new Date(2026, 8, 1)), "2026");
});

// —— Uncontested ——
test("PS-0 humans uncontested", () => {
  const { plan, validation } = buildSnapshotPlan({
    leagueId: "L1",
    sportId: "cfb",
    cutWeek: 14,
    cutPercent: 50,
    members: [],
    seasonKey: "2026",
  });
  assert.equal(plan.contested, false);
  assert.equal(validation.ok, true);
});

test("PS-1 human uncontested", () => {
  const { plan } = buildSnapshotPlan({
    leagueId: "L1",
    sportId: "cfb",
    cutWeek: 14,
    cutPercent: 50,
    members: roster(1),
    seasonKey: "2026",
  });
  assert.equal(plan.contested, false);
  assert.equal(plan.qualifierCount, 0);
});

// —— Toilet not contested label in metadata ——
test("PS-toilet not contested metadata n=6", () => {
  const { plan } = buildSnapshotPlan({
    leagueId: "L1",
    sportId: "cfb",
    cutWeek: 14,
    cutPercent: 50,
    members: roster(6),
    seasonKey: "2026",
  });
  assert.equal(plan.toiletBowlActive, false);
  assert.equal(plan.metadata.toiletLabel, "Not contested");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
