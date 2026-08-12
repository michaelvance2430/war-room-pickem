import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveHostOpsMission } from "../src/lib/host-ops-mission.ts";
import { firstSeasonWeek } from "../src/lib/season-calendar.ts";

const weekOps = readFileSync("src/app/week-ops/WeekOpsClient.tsx", "utf8");
const manage = readFileSync("src/app/commissioner/ManageLeagueClient.tsx", "utf8");

assert.equal(firstSeasonWeek("cfb"), 0, "CFB commissioner journey starts at Week 0");
assert.equal(firstSeasonWeek("nfl"), 1, "NFL commissioner journey starts at Week 1");
assert.match(weekOps, /defaultPropPreset\(sportId\)/, "new cards must use sport-native prop defaults");
assert.match(manage, /\/week-ops\?step=score/, "legacy result links must enter the real score step");
assert.doesNotMatch(manage, /\/week-ops\?score=1/, "dead score query must not return");

for (const [sportId, week] of [["cfb", 0], ["nfl", 1]]) {
  const build = resolveHostOpsMission({
    sportId, week, weekScored: false, gameCount: 0, hasProp: false,
    gamesForLock: [], nextWeek: null, nextWeekHasGames: false,
  });
  assert.equal(build?.href, `/week-ops?week=${week}&step=1`, `${sportId} must open Build Card`);

  const score = resolveHostOpsMission({
    sportId, week, weekScored: false, gameCount: 5, hasProp: true,
    gamesForLock: [{ commenceTime: "2026-01-01T00:00:00.000Z" }],
    nextWeek: null, nextWeekHasGames: false,
  }, Date.parse("2026-01-02T00:00:00.000Z"));
  assert.equal(score?.href, `/week-ops?week=${week}&step=score`, `${sportId} must open Score Week after kickoff`);

  const next = resolveHostOpsMission({
    sportId, week, weekScored: true, gameCount: 5, hasProp: true,
    gamesForLock: [], nextWeek: week + 1, nextWeekHasGames: false,
  });
  assert.equal(next?.href, `/week-ops?week=${week + 1}&step=1`, `${sportId} must build the next card after scoring`);
}

console.log("Commissioner journey verified: CFB Week 0 + NFL Week 1 · Build → Score → Next Card");
