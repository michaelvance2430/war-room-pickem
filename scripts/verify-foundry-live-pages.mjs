import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const room = readFileSync("src/components/FoundryRoomSimulator.tsx", "utf8");
const chrome = readFileSync("src/components/FoundrySessionChrome.tsx", "utf8");
const cloud = readFileSync("src/lib/cloud.ts", "utf8");
const adapter = readFileSync("src/lib/foundry-live-adapter.ts", "utf8");

assert.match(room, /router\.push\("\/"\)/, "Foundry must enter the real Home route");
assert.doesNotMatch(room, /router\.push\("\/foundry\/preview"\)/, "Foundry must not enter the cloned preview");
for (const route of ["/", "/picks", "/standings", "/board", "/locker-room", "/dispatch"]) {
  assert.ok(chrome.includes(`href: "${route}"`), `missing founder hop: ${route}`);
}
for (const loader of ["loadLeagueActiveWeek", "loadWeekCard", "loadMyPicks", "listScoredWeekNumbers", "loadLeaguePlayers", "loadLeagueRoster"]) {
  assert.ok(cloud.includes(`function ${loader}`), `missing production loader: ${loader}`);
}
assert.match(cloud, /isFoundryLivePagesActive\(\)[\s\S]{0,220}saveFoundryLivePicks/, "Foundry save must stop before cloud write");
assert.match(adapter, /localStorage\.getItem\(ACTIVE_KEY\)/);
assert.match(adapter, /saveFoundryWalkthrough/);
assert.match(adapter, /foundryLiveWeekResults/, "Foundry must expose simulated ATS results to real pages");
assert.match(adapter, /game\.status === "final"/, "only final Foundry games may score");
assert.match(adapter, /stateForWeek\(weekNumber\)/, "Board must retain current and archived Foundry cards");
assert.match(adapter, /foundryLiveWeekBoard/, "real Board must receive simulated bot slips");
assert.match(adapter, /foundryLivePickSubmissionStatus/, "real commissioner view must receive bot lock status");
assert.match(adapter, /foundryLiveNoLockNames/, "real Dispatch must receive simulated no-lock truth");
assert.match(adapter, /gazetteWeeks/, "scored-week history must survive after the simulator opens the next card");
assert.match(cloud, /isFoundryLivePagesActive\(\)\) return foundryLiveWeekResults\(weekNumber\)/, "Board results loader must stop before cloud reads in Foundry");
assert.match(chrome, /onPointerDown=\{startDrag\}/, "founder controls must be draggable");
assert.match(chrome, /touch-none cursor-grab/, "drag handle must work on touch screens");
const walkthrough = readFileSync("src/lib/foundry-walkthrough.ts", "utf8");
assert.match(walkthrough, /for \(const player of players\) player\.locked = true/, "simulated members need locked cards");
assert.doesNotMatch(walkthrough, /pick: opening \? undefined/, "opening Foundry card cannot be empty");
assert.match(walkthrough, /pick: game\.pick \|\|/, "saved empty Foundry rooms must self-repair");
console.log("Foundry live pages verified: real routes, local adapter, founder bar, cloud-write boundary");
