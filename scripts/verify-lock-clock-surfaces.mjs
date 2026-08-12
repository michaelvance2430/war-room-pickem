import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("src/app/page.tsx", "utf8");
const picks = readFileSync("src/app/picks/PicksClient.tsx", "utf8");
const homeClock = readFileSync("src/components/HomeLockMissionClock.tsx", "utf8");
const picksClock = readFileSync("src/components/LeagueLockTimer.tsx", "utf8");

assert.match(home, /<HomeLockMissionClock \/>/, "Home must always mount the league lock clock");
assert.match(picks, /<LeagueLockTimer[\s\S]*?games=\{games\}/, "Picks must mount its lock clock");
assert.doesNotMatch(
  picks,
  /hidden=\{practiceMode \|\| isPastOrOtherWeek \|\| !weekEditable\}/,
  "Picks clock must not disappear because the player's card is unlocked or read-only"
);
assert.match(homeClock, /firstKickoffOnCardMs\(clock\.games\)/, "Home deadline must use the earliest kickoff on the published card");
assert.match(picksClock, /firstKickoffOnCardMs\(games\)/, "Picks deadline must use the earliest kickoff on the published card");
assert.match(homeClock, /card\?\.publishedAt/, "Home clock must use commissioner-published card truth");

console.log("Lock clock verified: Home + Picks · commissioner card's earliest kickoff · independent of player lock state");
