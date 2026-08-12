import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const foundryLayout = read("src/app/foundry/layout.tsx");
assert.doesNotMatch(foundryLayout, /redirect\("\/"\)/, "browser-stored auth must not be rejected by a cookie-only layout");

const foundryPage = read("src/app/foundry/page.tsx");
assert.match(foundryPage, /auth\.getSession\(\)/, "Foundry must read the authenticated Supabase session");
assert.match(foundryPage, /isAppCreator\(uid\)/, "Foundry must require the creator UUID before rendering");
assert.doesNotMatch(foundryPage, /getSession\(\)\?\.playerId/, "local league identity must never authorize Foundry");

const founderPage = read("src/app/founder/page.tsx");
assert.match(founderPage, /redirect\("\/foundry"\)/, "retired founder route must converge on the protected Foundry");

const owner = read("src/lib/foundry-owner.server.ts");
assert.match(owner, /import "server-only"/, "owner authorization must never become client code");
assert.doesNotMatch(owner, /NEXT_PUBLIC_/, "owner authorization must not trust public environment variables");
assert.doesNotMatch(owner, /userId === "1"/, "local demo identities must not authorize the workshop");

const commissioner = read("src/app/commissioner/ManageLeagueClient.tsx") + read("src/app/week-ops/WeekOpsClient.tsx");
assert.doesNotMatch(commissioner, /Foundry|showCommishLabTools|generateDemoSlate|autoFinishRemainingWeeks/, "production commissioner routes must contain no workshop or simulation controls");

const arsenal = read("src/components/ProfileArsenal.tsx");
assert.doesNotMatch(arsenal, />Foundry is rehearsal/, "public profile copy must not expose the workshop name");

const api = read("src/app/api/founder/odds-usage/route.ts");
assert.match(api, /isFoundryOwnerUserId\(data\.user\.id\)/, "privileged API must require the exact owner UUID");

console.log("Foundry owner perimeter verified.");
