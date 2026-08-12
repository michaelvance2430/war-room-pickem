import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("src/app/page.tsx", "utf8");
const homeHero = readFileSync("src/components/HomeWeekHero.tsx", "utf8");
const picks = readFileSync("src/app/picks/PicksClient.tsx", "utf8");
const homeClock = readFileSync("src/components/HomeLockMissionClock.tsx", "utf8");
const picksClock = readFileSync("src/components/LeagueLockTimer.tsx", "utf8");
const foundry = readFileSync("src/app/foundry/preview/page.tsx", "utf8");
const foundryState = readFileSync("src/lib/foundry-walkthrough.ts", "utf8");

assert.match(homeHero, /<LeagueLockTimer games=\{state\.games\}/, "Home must render from its already-verified published card");
assert.match(picks, /<LeagueLockTimer[\s\S]*?games=\{games\}/, "Picks must mount its lock clock");
assert.doesNotMatch(
  picks,
  /hidden=\{practiceMode \|\| isPastOrOtherWeek/,
  "Picks clock must not disappear because the player's card is unlocked or read-only"
);
assert.match(homeHero, /games,/, "Home hero must retain the commissioner-published games");
assert.match(picksClock, /firstKickoffOnCardMs\(games\)/, "Picks deadline must use the earliest kickoff on the published card");
assert.match(homeClock, /card\?\.publishedAt/, "Home clock must use commissioner-published card truth");
assert.equal(foundry.match(/<FoundryLockClock state=\{state\}/g)?.length, 2, "Sandbox Home and Picks both need the clock");
assert.match(foundryState, /kickoffAt: string/, "Sandbox commissioner cards need explicit kickoff times");
assert.match(foundry, /Math\.min\(\.\.\.state\.games/, "Sandbox lock must use the earliest selected kickoff");

console.log("Lock clock verified: Home + Picks · commissioner card's earliest kickoff · independent of player lock state");
