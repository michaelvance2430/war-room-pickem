import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildFoundryGazetteFixture,
  FOUNDRY_GAZETTE_VERSION_COUNT,
} from "../src/lib/foundry-gazette-fixtures.ts";

assert.equal(FOUNDRY_GAZETTE_VERSION_COUNT, 18, "minimum 18 editions");

const editions = Array.from(
  { length: FOUNDRY_GAZETTE_VERSION_COUNT },
  (_, index) => buildFoundryGazetteFixture(index + 1, 1_780_000_000_000)
);

assert.equal(
  new Set(editions.map((edition) => edition.sideStories[0]?.headline)).size,
  18,
  "every edition has a unique front-page lead"
);

for (const [index, edition] of editions.entries()) {
  assert.ok(edition.sideStories.length >= 2, `edition ${index + 1}: front page`);
  assert.ok(edition.crown.headline && edition.shame?.headline, `edition ${index + 1}: sports page`);
  assert.ok(edition.rivalryWatch?.names.length === 2, `edition ${index + 1}: rivalry page`);
  assert.ok(edition.swing?.headline, `edition ${index + 1}: standings movement`);
  assert.ok(edition.classifieds.length >= 3, `edition ${index + 1}: back page`);
  assert.match(edition.printedLine, /FOUNDRY ONLY/);
  assert.match(edition.eventLine || "", /NO CLOUD WRITES/);
}

const preview = readFileSync("src/app/foundry/preview/page.tsx", "utf8");
const paper = readFileSync("src/components/GazettePaper.tsx", "utf8");
assert.match(preview, /warroom-foundry-cfb-act-three-v3/);
assert.match(preview, /cfbDeadHandAuthorized/);
assert.match(preview, /nuclear\.authorizationWeek === active/);
assert.match(preview, /jdam\.authorizationWeek === active/);
assert.match(preview, /state\.mapsEvent\.authorizationWeek === active/);
assert.doesNotMatch(preview, /isLatestEdition/);
assert.match(preview, /emergencyProtocol === "dead_hand"/);
assert.match(preview, /REMOVED HIMSELF FROM THE CHAIN OF COMMAND/);
assert.match(paper, /Dead Hand activated/);

console.log("verify-foundry-gazette: ALL 18 EDITIONS + CFB DEAD HAND FRONT PAGE PASS");
