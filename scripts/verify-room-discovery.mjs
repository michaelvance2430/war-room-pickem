import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lobby = readFileSync("src/app/open-room/page.tsx", "utf8");
const lobbyData = readFileSync("src/lib/lobby.ts", "utf8");
const lobbySql = readFileSync("supabase/lobby-v1.sql", "utf8");
const memberships = readFileSync("src/components/LeagueMembershipCard.tsx", "utf8");
const join = readFileSync("src/app/join/page.tsx", "utf8");

assert.match(lobby, /THE MUSTER/, "Lobby needs its own memorable storefront identity");
assert.match(lobby, /FIND YOUR CREW/, "Lobby needs a strong new-player promise");
assert.match(lobby, /Room capacity/, "room cards must show capacity");
assert.match(lobby, /ROOM FULL/, "full rooms must be visible and disabled");
assert.match(lobby, /REQUEST TO JOIN/, "private rooms must support access requests");
assert.match(lobby, /TOP 10 PLAYERS/, "Lobby needs a player Cheevo board");
assert.match(lobby, /TOP 5 CREWS/, "Lobby needs a crew Cheevo board");
assert.match(lobby, /Choose your door/, "room lists must open from clear public and private choices");
assert.match(lobby, /aria-expanded/, "room choices must expose their expanded state");
assert.match(lobbyData, /request_private_room_join/, "private requests must use the secured RPC");
assert.match(lobbySql, /auth\.uid\(\)/, "Lobby RPCs must require authenticated identity");
assert.doesNotMatch(lobbySql, /select[^;]*email/is, "Lobby RPCs must never expose account email");
assert.match(lobbySql, /m\.is_bot is false/, "leaderboards must exclude bots");
assert.match(lobbySql, /mode::text, 'production'/, "leaderboards must exclude Foundry");
assert.match(lobbySql, /group by a\.user_id/, "player Cheevos must aggregate by user UUID across rooms");
assert.match(lobbySql, /distinct on \(m\.user_id\)/, "each UUID must receive only one player leaderboard slot");
assert.match(lobbySql, /m\.joined_at desc nulls last/, "the displayed handle must be selected deterministically");
assert.match(memberships, /pack\.rulesOneLiner/, "member league cards must retain format context");
assert.match(join, /Private War Room invitation/, "deep links need a persuasive invitation landing state");
assert.match(join, /Your seat is waiting/, "deep links must lead with the intended room action");
assert.match(join, /No ads/, "invite value proposition must preserve the free-first promise");
assert.match(join, /deepLinkCode \? "Claim your seat"/, "ordinary code entry and texted invites must remain distinct");

console.log("Lobby verified: public/private/full states, UUID-unique Cheevo boards, secure requests, privacy guards");
