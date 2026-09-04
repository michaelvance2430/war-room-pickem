import assert from "node:assert/strict";
import { FIELDHOUSE_REGIONS, generateOfficialField, makeScaffold, ROUND_COUNTS, validateGeneratedField } from "./generate-fieldhouse-official-field.mjs";

const uneven = makeScaffold("ncaam", 2027);
const openingByRegion = Object.fromEntries(uneven.regions.map((region) => [
  region.name,
  region.slots.filter((slot) => slot.opening).length,
]));
assert.deepEqual(openingByRegion, { East: 4, West: 3, South: 3, Midwest: 2 });

const preview = generateOfficialField(uneven);
assert.equal(preview.teams.length, 76);
assert.equal(preview.games.length, 75);
for (const [round, count] of Object.entries(ROUND_COUNTS)) {
  assert.equal(preview.games.filter((game) => game.round === round).length, count);
}
for (const region of FIELDHOUSE_REGIONS) {
  assert.equal(preview.games.filter((game) => game.round === "r64" && game.region === region).length, 8);
}
assert.equal(preview.games.filter((game) => game.round === "opening" && game.region === "East").length, 4);
assert.equal(preview.games.filter((game) => game.round === "opening" && game.region === "Midwest").length, 2);
assert.equal(preview.games.at(-1).id, "national.title.1");
assert.equal(preview.games.at(-1).firstSourceGameId, "national.ff.1");
assert.equal(preview.games.at(-1).secondSourceGameId, "national.ff.2");

const skippedRound = structuredClone(preview);
skippedRound.games.find((game) => game.id === "east.r32.1").firstSourceGameId = "east.opening.11";
assert.throws(
  () => validateGeneratedField(skippedRound),
  /invalid source/,
);

assert.throws(
  () => generateOfficialField(uneven, { publishReady: true }),
  /missing 44 Opening\/First Round tip times/,
);

const ready = structuredClone(uneven);
const generatedIDs = preview.games.filter((game) => game.round === "opening" || game.round === "r64").map((game) => game.id);
for (const [index, id] of generatedIDs.entries()) ready.gameTimes[id] = new Date(Date.UTC(2027, 2, 16, 16 + index)).toISOString();
assert.equal(generateOfficialField(ready, { publishReady: true }).games.filter((game) => game.startsAt).length, 44);

const duplicate = structuredClone(uneven);
duplicate.regions[0].slots[1].team.id = duplicate.regions[0].slots[0].team.id;
assert.throws(() => generateOfficialField(duplicate), /globally unique/);

const tooFewOpening = structuredClone(uneven);
const replacement = tooFewOpening.regions[0].slots.find((slot) => slot.opening);
replacement.team = replacement.opening[0];
delete replacement.opening;
assert.throws(() => generateOfficialField(tooFewOpening), /exactly 12 Opening Round slots/);

console.log("Fieldhouse Selection Sunday generator PASS — uneven opening distribution, 76 teams, 75 connected games, publish readiness");
