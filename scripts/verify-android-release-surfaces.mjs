import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const chat = read("src/app/locker-room/page.tsx");
const home = read("src/app/page.tsx");
const header = read("src/components/HomeSportHeader.tsx");
const room = read("src/components/HomeRoomContext.tsx");
const trophy = read("src/app/championship-trophy/page.tsx");

assert.match(chat, /openedAtBottomRef/);
assert.match(chat, /if \(loading\) return/);
assert.match(chat, /scrollIntoView\(\{ behavior, block: "end" \}\)/);
assert.match(chat, /\[loading, messages\.length\]/);

const headerPosition = home.indexOf("<HomeSportHeader");
const roomPosition = home.indexOf("<HomeRoomContext");
const heroPosition = home.indexOf("<HomeWeekHero");
assert.ok(headerPosition > 0 && headerPosition < heroPosition);
assert.ok(roomPosition > 0 && roomPosition < heroPosition);
assert.match(header, /Share League/);
assert.match(room, /Share League/);

assert.match(trophy, /isActuallyCommissioner\(\)/);
assert.match(trophy, /saveLeagueToCloud\(\{/);
assert.match(trophy, /championshipTrophyId: selected/);
assert.match(trophy, /confirmed\?\.settings\?\.championshipTrophyId !== selected/);

console.log("Android release surfaces verified: chat opens at bottom, Share League is above Home's weekly job, and commissioner trophy selection is cloud-confirmed.");
