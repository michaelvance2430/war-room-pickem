import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const screen = readFileSync(join(root, "src/components/PostseasonBracketScreen.tsx"), "utf8");

assert.equal(existsSync(join(root, "src/app/championship/page.tsx")), true);
assert.equal(existsSync(join(root, "src/app/toilet-bowl/page.tsx")), true);
assert.match(screen, /loadFrozenPostseasonSnapshot/);
assert.match(screen, /advanceBracketFromCfpWeeks/);
assert.doesNotMatch(screen, /localStorage|sessionStorage/);
assert.doesNotMatch(screen, /seedChampionship|seedToiletBowl/);

console.log("Authoritative cloud-backed postseason routes PASS");
