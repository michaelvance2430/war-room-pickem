import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  advanceBracketFromCfpWeeks,
  buildBracket,
} from "../src/lib/brackets.ts";
import { inCfpFinalWindow } from "../src/lib/cfb-championship-result.ts";

function player(index, completedRounds = 0) {
  const weeklyPoints = Array(21).fill(0);
  for (const week of [17, 18, 19, 20].slice(0, completedRounds)) weeklyPoints[week] = 100 - index;
  return {
    id: `p${index}`,
    name: `Player ${String(index).padStart(2, "0")}`,
    division: ["North", "South", "East", "West"][index % 4],
    totalPoints: 1000 - index,
    weeklyPoints,
    atsCorrect: 10,
    atsTotal: 20,
    currentStreak: 0,
    bestWeek: 100 - index,
    worstWeek: 0,
    perfectWeeks: 0,
    bestBetHits: 0,
    bestBetTotal: 0,
    propHits: 0,
    propTotal: 0,
    weeksPlayed: 15,
  };
}

const players = Array.from({ length: 16 }, (_, index) => player(index + 1));
const base = buildBracket("championship", players);

const preBracket = advanceBracketFromCfpWeeks(base, [15, 16], "cfb");
assert.equal(preBracket.rounds[0].some((match) => match.winnerId), false, "Weeks 15–16 must not advance the bracket");

for (let completedRounds = 1; completedRounds <= 4; completedRounds++) {
  const scored = [17, 18, 19, 20].slice(0, completedRounds);
  const stagePlayers = Array.from({ length: 16 }, (_, index) => player(index + 1, completedRounds));
  const bracket = advanceBracketFromCfpWeeks(buildBracket("championship", stagePlayers), scored, "cfb");
  for (let round = 0; round < completedRounds; round++) {
    assert.ok(bracket.rounds[round].every((match) => match.winnerId), `round ${round + 1} should be complete`);
  }
  if (completedRounds < 4) {
    assert.ok(bracket.rounds[completedRounds].every((match) => !match.winnerId), `round ${completedRounds + 1} advanced early`);
  }
}

const completePlayers = Array.from({ length: 16 }, (_, index) => player(index + 1, 4));
const complete = advanceBracketFromCfpWeeks(buildBracket("championship", completePlayers), [17, 18, 19, 20], "cfb");
assert.ok(complete.rounds[3][0].winnerId, "Week 20 must decide the champion");
assert.deepEqual(
  advanceBracketFromCfpWeeks(complete, [17, 18, 19, 20, 20], "cfb"),
  complete,
  "rescoring the same certified week must be idempotent"
);

assert.equal(inCfpFinalWindow("2027-01-25T20:00:00Z"), true);
assert.equal(inCfpFinalWindow("2026-12-31T20:00:00Z"), false, "quarterfinal cannot be mistaken for championship");
assert.equal(inCfpFinalWindow("2027-01-15T20:00:00Z"), false, "semifinal cannot be mistaken for championship");

const cloud = readFileSync(new URL("../src/lib/postseason/cloud.ts", import.meta.url), "utf8");
const closeout = readFileSync(new URL("../src/lib/season-closeout.ts", import.meta.url), "utf8");
assert.match(cloud, /postseason_scorecards/);
assert.match(cloud, /\.sort\(\(a, b\) => a - b\)/);
assert.match(closeout, /seasonMaxWeek/);
assert.match(closeout, /scored\.includes\(maxW\)/);
assert.match(closeout, /Final league week \(Week \$\{maxW\}\) has not been scored yet/);

console.log("CFB Weeks 15–20 progression and championship timing PASS");
