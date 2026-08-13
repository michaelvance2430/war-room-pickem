import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hardware = readFileSync("src/lib/profile-hardware.ts", "utf8");
const badges = readFileSync("src/lib/legacy-badge-grants.ts", "utf8");
const seed = readFileSync("src/lib/prior-season-seed.ts", "utf8");
const BEN_ID = "fdddf273-2430-42db-9127-b8fa7efc1572";

assert.match(hardware, new RegExp(`winnerUserId: "${BEN_ID}"`), "Village Nerd trophy must be pinned to Ben's UUID");
assert.match(hardware, /winnerName: "Big Balls Ben"/, "permanent plaque must use Ben's current identity");
assert.match(badges, new RegExp(`BIG_BALLS_BEN_USER_IDS[\\s\\S]*"${BEN_ID}"`), "matching Legend grant must remain UUID-bound");
assert.match(seed, /big\\s\*balls\?\\s\*ben/, "old room seeding must recognize Ball and Balls aliases");

console.log("Big Balls Ben verified: permanent Village Nerd trophy and matching Legend identity");
