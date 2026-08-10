/**
 * Fieldhouse v1 lifecycle ship gate.
 *
 * Proves the isolated Foundry reference journey from regular season through
 * Selection Sunday, both War Room brackets, the national bracket, preseason
 * prophecy receipts, and the Ring Ceremony without mutating production data.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createFoundryWalkthrough,
  foundryFinalWeek,
  foundryPostseasonRounds,
  foundryPostseasonStartWeek,
  isFoundrySeasonFinal,
  simulateFoundryRegularSeason,
  simulateFoundrySeason,
  simulateNextFoundryWeek,
} from "../src/lib/foundry-walkthrough.ts";
import {
  generateNcaaPicks,
  ncaaPickCount,
} from "../src/lib/ncaa-bracket.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const preview = readFileSync(join(root, "src/app/foundry/preview/page.tsx"), "utf8");

const initial = createFoundryWalkthrough("cbb", 1, "commissioner");
const mikeBracket = generateNcaaPicks(2430);
assert.equal(ncaaPickCount(mikeBracket), 67, "Mike's bracket must contain all 67 decisions");

const withPicks = {
  ...initial,
  ncaaPicks: mikeBracket,
  ncaaBracketLocked: true,
};
const postseason = simulateFoundryRegularSeason(withPicks);
assert.equal(postseason.week, foundryPostseasonStartWeek("cbb"));
assert.equal(postseason.postseasonFields?.championship.length, 8);
assert.equal(postseason.postseasonFields?.toilet.length, 8);
assert.equal(new Set([
  ...(postseason.postseasonFields?.championship || []),
  ...(postseason.postseasonFields?.toilet || []),
]).size, 16, "Championship and Toilet Bowl fields may not overlap");
assert.equal(postseason.ncaaBracketLocked, false, "Selection Sunday must open the national bracket");

let state = { ...postseason, ncaaPicks: mikeBracket, ncaaBracketLocked: true };
state = simulateNextFoundryWeek(state);
assert.equal(foundryPostseasonRounds(state, "championship").regionalWinners.length, 4);
assert.equal(foundryPostseasonRounds(state, "toilet").regionalWinners.length, 4);
state = simulateNextFoundryWeek(state);
assert.equal(foundryPostseasonRounds(state, "championship").semifinalWinners.length, 2);
assert.equal(foundryPostseasonRounds(state, "toilet").semifinalWinners.length, 2);
state = simulateNextFoundryWeek(state);

const championship = foundryPostseasonRounds(state, "championship");
const toilet = foundryPostseasonRounds(state, "toilet");
assert.ok(championship.champion, "Fieldhouse Champion must be decided");
assert.ok(toilet.champion, "Toilet Bowl Champion must be decided");
assert.equal(state.week, foundryFinalWeek("cbb"));
assert.equal(isFoundrySeasonFinal(state), true);
assert.strictEqual(simulateNextFoundryWeek(state), state, "The simulator may not invent a Window 23");

const fastForwarded = simulateFoundrySeason(withPicks);
assert.equal(isFoundrySeasonFinal(fastForwarded), true);
assert.equal(fastForwarded.gazetteWeeks.length, foundryFinalWeek("cbb"));
const nationalChampion = fastForwarded.ncaaResults["national:championship"];
assert.ok(nationalChampion, "National champion must resolve");
assert.ok(
  Object.values(fastForwarded.preseasonChampionPicks).includes(nationalChampion),
  "At least one preseason prophecy must survive for the Village Nerd payoff"
);

// Desktop/phone interaction contract: guided bracket controls and ceremony
// actions remain comfortably tappable without changing the stable presenter.
assert.match(preview, /aria-label="Foundry Ring Ceremony"/);
assert.match(preview, /seasonFinal \? "Ring Ceremony" : "Sim Week"/);
assert.match(preview, /seasonFinal \? "Replay Rings" : "Sim Entire Season"/);
assert.match(preview, /min-h-12 w-full[^>]*>\{completed \? "Continue Bracket" : "Begin Bracket"\}/);
assert.match(preview, /min-h-11 w-full/);
assert.match(preview, /Choose a winner\. The bracket advances automatically\./);

console.log("Fieldhouse v1 verified: regular season → Selection Sunday → 67 picks → dual brackets → Village Nerd → Ring Ceremony");
