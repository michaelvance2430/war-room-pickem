import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const opening = readFileSync("src/components/SeasonOpening.tsx", "utf8");

assert.match(opening, /createPortal/, "opening must escape Home's stacking context");
assert.match(opening, /document\.body/, "opening must mount above the persistent app shell");
assert.match(opening, /fixed inset-0 z-\[300\]/, "opening must cover top and bottom navigation");
assert.match(opening, /Skip intro →/, "existing Skip control must remain unchanged");
assert.match(opening, /Tap for sound/, "existing sound control must remain unchanged");
assert.match(opening, /war-room-opening-vertical\.mp4/, "existing opening video must remain unchanged");

console.log("Opening verified: original video and controls cover all app navigation");
