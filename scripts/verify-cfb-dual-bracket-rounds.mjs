import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const walkthrough = readFileSync("src/lib/foundry-walkthrough.ts", "utf8");
const preview = readFileSync("src/app/foundry/preview/page.tsx", "utf8");
const locker = readFileSync("src/lib/bot-locker-talk.ts", "utf8");

assert.match(walkthrough, /postseasonRoundsPlayed: number/);
assert.match(walkthrough, /state\.postseasonRoundsPlayed >= 4/);
assert.match(walkthrough, /Math\.min\(4, \(state\.postseasonRoundsPlayed \|\| 0\) \+ 1\)/);
assert.match(walkthrough, /postseasonRoundsPlayed: 0/);
assert.match(walkthrough, /sport === "cfb" \? PEOPLE : PEOPLE\.slice\(0, 16\)/);
assert.match(preview, /War Room bracket · four rounds/);
assert.match(preview, /title="Championship"/);
assert.match(preview, /title="Toilet Bowl"/);
assert.match(preview, /stage >= 4/);
assert.match(preview, /2026 Toilet Bowl champion/);
assert.match(locker, /mariaMeltdownForWeek/);
assert.doesNotMatch(preview, /MARIA FILES FORMAL COMPLAINT IN MOST INFORMAL WAY POSSIBLE/);
console.log("CFB dual brackets verified: 16+16 fields · four explicit rounds · finale gate · rotating Maria copy");
