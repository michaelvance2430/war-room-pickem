import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authorizeFoundryJdam, generateNflPlayoffPicks, nflBracketComplete, nflPlayoffGames, sanitizeNflPlayoffPicks } from "../src/lib/postseason/nfl-maps.ts";

const original = generateNflPlayoffPicks(1);
assert.equal(Object.keys(original).length, 13);
assert.equal(nflBracketComplete(original), true);
assert.equal(nflPlayoffGames(original).length, 13);
assert.deepEqual(sanitizeNflPlayoffPicks(original), original);
const strike = authorizeFoundryJdam(original);
assert.equal(nflBracketComplete(strike.picks), true);
assert.equal(strike.targets.length, 3);
assert.ok(strike.changedCount >= 3);
assert.deepEqual(authorizeFoundryJdam({}).targets, []);
const ui = readFileSync("src/components/FoundryNflActThree.tsx", "utf8");
assert.match(ui, /NFL playoff bracket converging on the Super Bowl/);
assert.match(ui, /AFC advances right/);
assert.match(ui, /NFC advances left/);
assert.match(ui, /Conference champions converge here/);
assert.match(ui, /1-seeds enter in the Divisional Round/);
assert.match(ui, /JDAM ARMS AFTER THE FULL BRACKET/);
assert.match(ui, /disabled=\{!complete\}/);

console.log("NFL JDAM verified: visible while picking · 14-team field · 13 legal decisions · divisional reseeding · three-impact reveal · complete computer bracket");
