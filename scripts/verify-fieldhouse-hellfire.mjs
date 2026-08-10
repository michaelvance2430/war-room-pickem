import assert from "node:assert/strict";
import fs from "node:fs";
import { createFoundryWalkthrough, launchFoundryHellfire } from "../src/lib/foundry-walkthrough.ts";
import { generateNcaaPicks, ncaaPickCount } from "../src/lib/ncaa-bracket.ts";

let state = createFoundryWalkthrough("cbb", 19, "player");
assert.equal(launchFoundryHellfire(state), state, "incomplete bracket must not fire");
state = { ...state, ncaaPicks: generateNcaaPicks(777) };
const original = { ...state.ncaaPicks };
state = launchFoundryHellfire(state);
assert.equal(state.ncaaBracketLocked, true);
assert.equal(ncaaPickCount(state.ncaaPicks), 67);
assert.equal(state.mapsEvent?.protocol, "hellfire");
assert.deepEqual(state.mapsEvent?.originalPicks, original);
assert.equal(state.mapsEvent?.targetIds.length, 4);
assert.ok((state.mapsEvent?.changedCount || 0) >= 4);
assert.equal(launchFoundryHellfire(state), state, "M.A.P.'s cannot reroll");

const previewSource = fs.readFileSync("src/app/foundry/preview/page.tsx", "utf8");
assert.match(previewSource, /HELLFIRE ARMS AFTER THE FULL BRACKET/);
assert.match(previewSource, /disabled=\{count !== 67\}/);

console.log("Fieldhouse Hellfire verified: visible while picking · complete bracket required · original preserved · four-strike reveal · locked computer bracket · no reroll");
