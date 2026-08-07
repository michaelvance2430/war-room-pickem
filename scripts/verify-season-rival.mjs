import assert from "node:assert/strict";
import { findSeasonRival } from "../src/lib/player-history.ts";

function player(id, name, totalPoints, opts = {}) {
  return {
    id,
    name,
    totalPoints,
    weeksPlayed: opts.weeksPlayed ?? 1,
    atsTotal: opts.atsTotal ?? 5,
    isMock: opts.isMock ?? false,
  };
}

const mike = player("mike", "Mike", 50);
const early = player("early", "Early Rival", 48);
const distant = player("distant", "Distant Player", 30);

assert.equal(
  findSeasonRival(mike, [mike, early, distant])?.userId,
  "early",
  "nearest active player should be the current rival"
);

const mikeSurges = player("mike", "Mike", 100);
const oldRivalFades = player("early", "Early Rival", 50);
const newRival = player("new", "New Rival", 98);
assert.equal(
  findSeasonRival(mikeSurges, [mikeSurges, oldRivalFades, newRival])?.userId,
  "new",
  "rival should change when the standings separate"
);

const nearBot = player("bot", "Fake Threat", 99, { isMock: true });
const inactive = player("inactive", "Has Not Played", 100, {
  weeksPlayed: 0,
  atsTotal: 0,
});
assert.equal(
  findSeasonRival(mikeSurges, [mikeSurges, nearBot, inactive, newRival])?.userId,
  "new",
  "bots and inactive players must not become rivals"
);

const alpha = player("alpha", "Alpha", 48);
const zulu = player("zulu", "Zulu", 52);
assert.equal(
  findSeasonRival(mike, [mike, zulu, alpha])?.userId,
  "alpha",
  "equal point gaps should resolve consistently by name"
);

assert.equal(
  findSeasonRival(mike, [mike, nearBot, inactive]),
  null,
  "no rivalry should be invented without a real active peer"
);

console.log("verify-season-rival: ALL PASS");
