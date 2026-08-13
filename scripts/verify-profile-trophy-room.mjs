import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const trophyRoom = readFileSync("src/components/ProfileTrophyCase.tsx", "utf8");

assert.doesNotMatch(trophyRoom, /function EmptySlot/, "unwon trophy placeholders must not exist");
assert.doesNotMatch(trophyRoom, /function EmptyDivConfSlot/, "unwon division and conference placeholders must not exist");
assert.doesNotMatch(trophyRoom, /Open shelf/, "the trophy room must not render future-hardware filler");
assert.match(trophyRoom, /bigGame\.length > 0/, "big-game section must require won hardware");
assert.match(trophyRoom, /division\.length > 0/, "division section must require won hardware");
assert.match(trophyRoom, /No brass has breached the perimeter\. Get back out there and fix that\./, "zero-trophy profiles need the War Room empty-state roast");

console.log("Profile Trophy Room verified: won hardware only with zero-trophy roast");
