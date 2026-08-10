import assert from "node:assert/strict";
import fs from "node:fs";
import { createFoundryWalkthrough, launchFoundryHellfire, simulateFoundryRegularSeason } from "../src/lib/foundry-walkthrough.ts";
import { generateNcaaPicks, ncaaPickCount } from "../src/lib/ncaa-bracket.ts";

let state = createFoundryWalkthrough("cbb", 19, "player");
state = launchFoundryHellfire(state);
assert.equal(state.ncaaBracketLocked, true, "Hellfire must fire before any human picks");
assert.equal(ncaaPickCount(state.ncaaPicks), 67);
assert.equal(state.mapsEvent?.changedCount, 67);
assert.deepEqual(state.mapsEvent?.originalPicks, {});
state = createFoundryWalkthrough("cbb", 19, "player");
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
assert.match(previewSource, /Computer assumes command/);
assert.match(previewSource, /onHellfire/);
assert.match(previewSource, /state\.sport === "cbb"[\s\S]*Season status" value="PHASE III"[\s\S]*NcaaBracketPicker/);
const dirtyPreview = launchFoundryHellfire(createFoundryWalkthrough("cbb", 19, "player"));
const cleanActThree = simulateFoundryRegularSeason(dirtyPreview);
assert.equal(ncaaPickCount(cleanActThree.ncaaPicks), 0);
assert.equal(cleanActThree.ncaaBracketLocked, false);
assert.equal(cleanActThree.mapsEvent, null);

console.log("Fieldhouse Hellfire verified: available at bracket entry · partial picks preserved · four-strike reveal · locked 67-pick computer bracket · no reroll");
