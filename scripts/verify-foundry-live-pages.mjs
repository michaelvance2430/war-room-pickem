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
console.log("Foundry live pages verified: real routes, local adapter, founder bar, cloud-write boundary");
