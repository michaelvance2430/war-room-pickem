import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const art = readFileSync(join(root, "src/components/ChampionshipTrophySilhouette.tsx"), "utf8");
const renderer = readFileSync(join(root, "src/components/SportChampionshipTrophy.tsx"), "utf8");
const bracket = readFileSync(join(root, "src/app/championship/page.tsx"), "utf8");
for (const id of ["command_cup", "golden_gut", "the_receipt", "insufferable_crown", "brass_football", "last_one_standing"]) assert.match(art, new RegExp(id));
assert.match(renderer, /ChampionshipTrophySilhouette/);
assert.match(renderer, /design=\{selectedDesign\}/);
assert.match(bracket, /The object at the middle/);
assert.match(bracket, /championshipTrophyId/);
assert.doesNotMatch(art, /CFP|NCAA|Lombardi/);
console.log("Championship trophy shapes verified: six original silhouettes · selected hardware reaches bracket center");
