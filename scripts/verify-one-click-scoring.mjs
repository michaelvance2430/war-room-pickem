import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildResultsFromScores } from "../src/lib/scores.ts";

const games = [
  {
    id: "g1", awayTeam: "Georgia Bulldogs", homeTeam: "Alabama Crimson Tide",
    spread: -3.5, favorite: "home", startTime: "", oddsEventId: "event-1",
  },
  {
    id: "g2", awayTeam: "Michigan Wolverines", homeTeam: "Ohio State Buckeyes",
    spread: -7, favorite: "home", startTime: "",
  },
];
const events = [
  {
    id: "event-1", sport_key: "americanfootball_ncaaf", commence_time: "",
    completed: true, away_team: "Georgia Bulldogs", home_team: "Alabama Crimson Tide",
    scores: [{ name: "Georgia Bulldogs", score: "24" }, { name: "Alabama Crimson Tide", score: "28" }],
  },
  {
    id: "event-2", sport_key: "americanfootball_ncaaf", commence_time: "",
    completed: false, away_team: "Michigan Wolverines", home_team: "Ohio State Buckeyes",
    scores: null,
  },
];

const built = buildResultsFromScores(games, events);
assert.equal(built.filled, 1);
assert.equal(built.pending, 1);
assert.equal(built.results.g1.winner, "home");
assert.equal(built.results.g2, undefined);
assert.equal(built.boxes.length, 1);

const ui = readFileSync(new URL("../src/app/week-ops/WeekOpsClient.tsx", import.meta.url), "utf8");
assert.match(ui, /Fetch Final Scores/);
assert.match(ui, /Manual scoring remains available below/);
assert.match(ui, /Every result remains editable before you score/);
assert.match(ui, /setFinalBoxes\(\(boxes\) => boxes\.filter/);
assert.match(ui, /finalBoxes,/);

console.log("One-click final-score retrieval + manual correction PASS");
