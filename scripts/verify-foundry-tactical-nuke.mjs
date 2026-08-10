import assert from "node:assert/strict";
import fs from "node:fs";
import {
  armFoundryTacticalNuke,
  createFoundryWalkthrough,
  foundryTacticalNukesRemaining,
  simulateNextFoundryWeek,
} from "../src/lib/foundry-walkthrough.ts";

let state = createFoundryWalkthrough("cfb", 2, "player");
assert.equal(foundryTacticalNukesRemaining(state), 2);
state = armFoundryTacticalNuke(state);
assert.equal(state.tacticalNukeActive, true);
assert.deepEqual(state.games.map((game) => game.confidence).sort(), [1, 2, 3, 4, 5]);
assert.ok(state.games.every((game) => game.pick === game.away || game.pick === game.home));
assert.equal(foundryTacticalNukesRemaining(state), 1);

state = simulateNextFoundryWeek(state);
assert.equal(state.tacticalNukeActive, false);
assert.deepEqual(state.tacticalNukeWeeks, [2]);
state = armFoundryTacticalNuke(state);
assert.equal(foundryTacticalNukesRemaining(state), 0);
const spent = state;
state = simulateNextFoundryWeek(state);
assert.equal(armFoundryTacticalNuke(state).tacticalNukeWeeks.length, 2);
assert.deepEqual(spent.tacticalNukeWeeks, [2, 3]);

const previewSource = fs.readFileSync("src/app/foundry/preview/page.tsx", "utf8");
const gazetteSource = fs.readFileSync("src/components/GazettePaper.tsx", "utf8");
assert.match(previewSource, /state\.tacticalNukeWeeks\?\.includes\(active\)/);
assert.match(previewSource, /MIKE V HAS REMOVED HIMSELF FROM COMMAND/);
assert.match(gazetteSource, /if \(edition\.chaosDetonation\)/);
assert.match(gazetteSource, /Emergency extra · \{authorization\}/);
assert.match(gazetteSource, /tactical-nuclear-extra\.png/);
assert.match(gazetteSource, /hellfire-extra\.png/);
assert.match(gazetteSource, /jdam-extra\.png/);

console.log("Foundry Tactical Nuclear Button verified: 2/2 season arsenal · legal computer card · no third use · week persistence · emergency front page");
