import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hardware = readFileSync("src/lib/profile-hardware.ts", "utf8");
const standings = readFileSync("src/app/standings/page.tsx", "utf8");

assert.match(hardware, /standingsHardwareFlair\(playerName: string, playerId = ""\)/, "standings flair must accept stable player identity");
assert.match(hardware, /getProfileHardware\(\{[\s\S]*playerId,[\s\S]*playerName/, "standings flair must resolve permanent ID-bound hardware");
assert.equal(
  [...standings.matchAll(/standingsHardwareFlair\(player\.name, player\.id\)/g)].length,
  2,
  "both standings layouts must pass player ID",
);
assert.match(hardware, /kind: "crystal_ball"[\s\S]*winnerUserId: "fdddf273-2430-42db-9127-b8fa7efc1572"/, "Big Balls Ben's Nerd award must remain permanent hardware");

console.log("Standings hardware verified: permanent ID-bound trophies appear beside player names");
