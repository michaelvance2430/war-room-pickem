import assert from "node:assert/strict";
import {
  CFB_BOWL_BOARD,
  buildCfbBowlBoard,
  cfbSickoGameIds,
  validateCfbBowlAllocation,
} from "../src/lib/postseason/cfb-act-three.ts";

const candidates = [
  ...Array.from({ length: 18 }, (_, index) => ({
    id: `marquee-${index + 1}`,
    name: `Marquee Bowl ${index + 1}`,
    tier: "marquee",
    rank: index + 1,
    hostsCfpGame: index === 1 || index === 4,
  })),
  ...Array.from({ length: 12 }, (_, index) => ({
    id: `sicko-${index + 1}`,
    name: `Sicko Bowl ${index + 1}`,
    tier: "sicko",
    rank: index + 1,
    hostsCfpGame: index === 0,
  })),
];

const board = buildCfbBowlBoard(candidates);
assert.equal(board.games.length, 25);
assert.equal(board.marquee.length, 15);
assert.equal(board.sicko.length, 10);
assert.equal(board.games.some((game) => ["marquee-2", "marquee-5", "sicko-1"].includes(game.id)), false);
assert.equal(board.marquee.at(-1)?.id, "marquee-17", "CFP hosts must be replaced by next-ranked bowls");
assert.equal(board.sicko.at(-1)?.id, "sicko-11");
assert.equal(cfbSickoGameIds(board).length, 10);

const allocation = Object.fromEntries(board.games.map((game) => [game.id, 4]));
assert.equal(Object.values(allocation).reduce((sum, wager) => sum + wager, 0), CFB_BOWL_BOARD.bankroll);
assert.deepEqual(validateCfbBowlAllocation(board, allocation), []);
assert.ok(validateCfbBowlAllocation(board, { ...allocation, [board.games[0].id]: 3 }).some((error) => error.includes("exactly 100")));
assert.ok(validateCfbBowlAllocation(board, { ...allocation, [board.games[0].id]: 0 }).some((error) => error.includes("positive whole-number")));
assert.ok(validateCfbBowlAllocation(board, { ...allocation, fake: 1 }).some((error) => error.includes("Unknown")));

assert.equal(CFB_BOWL_BOARD.cfpTeams2026, 12);
assert.equal(CFB_BOWL_BOARD.cfpGames2026, 11);
assert.equal(CFB_BOWL_BOARD.cfpReseeding, false);

console.log("CFB Act III verified: 15 Marquee + 10 Sicko non-CFP bowls · exact 100-point bankroll · separate 12-team CFP");
