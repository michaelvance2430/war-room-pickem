import assert from "node:assert/strict";
import {
  ACT_THREE_CHAPTERS,
  canActivateActThree,
  validateActThreeChapter,
} from "../src/lib/postseason/act-three.ts";

const chapters = Object.values(ACT_THREE_CHAPTERS);
assert.deepEqual(chapters.map((chapter) => chapter.sportId).sort(), ["cbb", "cfb", "nfl"]);

for (const chapter of chapters) {
  assert.deepEqual(validateActThreeChapter(chapter), [], `${chapter.sportId} contract must be valid`);
  assert.equal(chapter.nativeRequired, true);
  assert.equal(chapter.shared.databaseLockAuthority, true);
  assert.equal(chapter.shared.foundryProofRequired, true);
  assert.equal(chapter.prediction.preseasonReceiptVisible, true);
}

assert.equal(ACT_THREE_CHAPTERS.cbb.status, "reference_implemented");
assert.match(ACT_THREE_CHAPTERS.cbb.game.signature, /67 decisions/);
assert.match(ACT_THREE_CHAPTERS.cfb.game.signature, /Marquee 15 \+ Sicko 10/);
assert.match(ACT_THREE_CHAPTERS.cfb.game.strategy, /100-point bowl bankroll/);
assert.match(ACT_THREE_CHAPTERS.cfb.foundryProof.join(" "), /Certified Sicko/);
assert.match(ACT_THREE_CHAPTERS.nfl.game.strategy, /limited consumable confidence arsenal/);
assert.match(ACT_THREE_CHAPTERS.nfl.prediction.payoff, /remains visible/);

// No chapter may silently borrow another sport's identity or phase map.
assert.equal(new Set(chapters.map((chapter) => chapter.name)).size, chapters.length);
assert.equal(new Set(chapters.map((chapter) => chapter.game.signature)).size, chapters.length);
assert.equal(new Set(chapters.map((chapter) => chapter.phases.map((phase) => phase.id).join("|"))).size, chapters.length);

// Fieldhouse is proven but not publicly enabled; CFB/NFL tuning is deliberately
// incomplete. None can activate merely because a UI route exists.
assert.equal(chapters.every((chapter) => !canActivateActThree(chapter)), true);

console.log("Act III contract verified: shared native foundation · sport-native CBB/CFB/NFL chapters · activation blocked until proven");
