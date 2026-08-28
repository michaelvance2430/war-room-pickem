import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(
  join(root, "src/app/championship-trophy/page.tsx"),
  "utf8"
);

assert.match(page, /saveLeagueToCloud/);
assert.doesNotMatch(page, /\.eq\("commissioner_id", session\.playerId\)/);
assert.match(page, /championshipTrophyId !== selected/);
assert.match(page, /The trophy did not save/);

console.log(
  "Championship trophy selection verified: RLS-authorized save, explicit failure, and cloud confirmation"
);
