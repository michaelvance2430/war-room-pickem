import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const card = readFileSync("src/components/RoomDiscoveryCard.tsx", "utf8");
const lobby = readFileSync("src/app/open-room/page.tsx", "utf8");
const memberships = readFileSync("src/components/LeagueMembershipCard.tsx", "utf8");
const join = readFileSync("src/app/join/page.tsx", "utf8");

assert.match(lobby, /<RoomDiscoveryCard/, "open lobby must use intelligence-rich room cards");
assert.match(card, /pack\.rulesOneLiner/, "room cards must explain the format");
assert.match(card, /seatsLeft/, "room cards must show remaining capacity");
assert.match(card, /Private invite code stays hidden/, "public discovery must preserve code privacy");
assert.match(memberships, /pack\.rulesOneLiner/, "member league cards must retain format context");
assert.match(join, /Private War Room invitation/, "deep links need a persuasive invitation landing state");
assert.match(join, /Your seat is waiting/, "deep links must lead with the intended room action");
assert.match(join, /No ads/, "invite value proposition must preserve the free-first promise");
assert.match(join, /deepLinkCode \? "Claim your seat"/, "ordinary code entry and texted invites must remain distinct");

console.log("Room discovery verified: rich cards, private codes, persuasive deep-link landing");
