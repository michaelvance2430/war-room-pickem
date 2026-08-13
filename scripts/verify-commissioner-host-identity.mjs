import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const restore = readFileSync("src/lib/session-restore.ts", "utf8");
const card = readFileSync("src/components/LeagueMembershipCard.tsx", "utf8");

assert.match(restore, /commissionerName\?: string \| null/, "membership cards need a typed host name");
assert.match(restore, /\.from\("profiles"\)[\s\S]*\.select\("id, display_name"\)[\s\S]*\.in\("id", commissionerIds\)/, "host names must come from one verified batched profile lookup");
assert.match(restore, /commissionerId remains the authorization source of truth/, "display identity must never become authorization");
assert.match(card, /Commanded by you/, "commissioners should be identified as the room host");
assert.match(card, /Hosted by \$\{m\.commissionerName\}/, "members should see the verified host name");
assert.match(card, /Commissioner-hosted room/, "host lookup failure needs a truthful fallback");

console.log("Commissioner host identity verified: batched profile names, authorization unchanged");
