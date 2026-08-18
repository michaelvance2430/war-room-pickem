import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CFB_CFP_GAME_ORDER,
  cfpMatchups,
  sanitizeCfpPicks,
} from "../src/lib/postseason/cfb-cloud.ts";

const seeds = Array.from({ length: 12 }, (_, index) => `Team ${index + 1}`);
let picks = {};
for (const id of CFB_CFP_GAME_ORDER) {
  const games = cfpMatchups(seeds, picks);
  picks = sanitizeCfpPicks(seeds, { ...picks, [id]: games[id][1] });
}
assert.equal(Object.keys(picks).length, 11);
assert.equal(picks.final, picks.s2);

picks = sanitizeCfpPicks(seeds, {
  ...picks,
  s1: picks.q1,
  final: picks.q1,
});

const changed = sanitizeCfpPicks(seeds, { ...picks, r1a: seeds[4] });
assert.equal(changed.r1a, seeds[4]);
assert.equal(changed.q1, undefined, "changing R1 must invalidate an illegal QF path");
assert.equal(changed.s1, undefined, "changing R1 must invalidate downstream semifinal");
assert.equal(changed.final, undefined, "changing R1 must invalidate downstream champion");

const screen = readFileSync(new URL("../src/app/postseason/page.tsx", import.meta.url), "utf8");
const cloud = readFileSync(new URL("../src/lib/postseason/cfb-cloud.ts", import.meta.url), "utf8");
assert.match(screen, /Save Draft/);
assert.match(screen, /label="Bowl Board"/);
assert.match(screen, /label="CFP Bracket"/);
assert.match(screen, /Lock \{label\}/);
assert.doesNotMatch(screen, /localStorage|sessionStorage/);
assert.match(cloud, /cfb_postseason_slates/);
assert.match(cloud, /cfb_postseason_entries/);
assert.match(cloud, /bowl_locked_at/);
assert.match(cloud, /cfp_locked_at/);

console.log("Cloud CFB postseason player flow PASS");
