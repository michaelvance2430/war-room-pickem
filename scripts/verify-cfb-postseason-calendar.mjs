import assert from "node:assert/strict";
import {
  bracketWeeksForSport,
  listSeasonWeekNumbers,
  seasonMaxWeek,
  seasonPhase,
  weekDateWindow,
  weekTitle,
} from "../src/lib/season-calendar.ts";
import { CFP_BRACKET_WEEKS, cfpWeekForRound } from "../src/lib/brackets.ts";

assert.equal(seasonMaxWeek("cfb"), 20);
assert.deepEqual(listSeasonWeekNumbers("cfb"), Array.from({ length: 21 }, (_, i) => i));
assert.deepEqual([...bracketWeeksForSport("cfb")], [17, 18, 19, 20]);
assert.deepEqual([...CFP_BRACKET_WEEKS], [17, 18, 19, 20]);

const expected = [
  [14, "conf_championship", "Conf. Champ"],
  [15, "bowl_selection", "Bowl Selection"],
  [16, "bowl_opening", "Bowl Opening"],
  [17, "cfp_r1", "CFP R1"],
  [18, "cfp_qf", "CFP QF"],
  [19, "cfp_sf", "CFP SF"],
  [20, "cfp_final", "CFP Final"],
];
for (const [week, phase, title] of expected) {
  assert.equal(seasonPhase(week), phase);
  assert.equal(weekTitle(week, "cfb"), title);
  assert.ok(weekDateWindow(week, "cfb"), `missing Week ${week} date window`);
}

assert.equal(cfpWeekForRound(0, 4, "cfb"), 17);
assert.equal(cfpWeekForRound(1, 4, "cfb"), 18);
assert.equal(cfpWeekForRound(2, 4, "cfb"), 19);
assert.equal(cfpWeekForRound(3, 4, "cfb"), 20);
assert.equal(cfpWeekForRound(0, 2, "cfb"), 19);
assert.equal(cfpWeekForRound(1, 2, "cfb"), 20);

console.log("CFB Weeks 15–20 postseason calendar PASS");
