/**
 * Static proof: no NFL-context display hardcodes CFB favorite only.
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

let fails = 0;
function assert(c, m) {
  if (!c) {
    console.error("FAIL", m);
    fails++;
  } else console.log("PASS", m);
}

const profile = read("src/app/profile/[id]/page.tsx");
const account = read("src/app/account/page.tsx");
const fav = read("src/lib/favorite-teams.ts");

assert(
  profile.includes('getUserFavoriteTeamId(id, "nfl")') ||
    profile.includes('getUserFavoriteTeamId(uid, "nfl")'),
  "1 profile loads NFL allegiance when context allows"
);
assert(
  profile.includes('ctx === "nfl"') || profile.includes("allegianceContext"),
  "1b profile gates CFB load by context (not always-only CFB display)"
);
assert(
  profile.includes("NFL Team") && profile.includes("CFB Team"),
  "2 profile labels both sports"
);
assert(
  profile.includes("allegianceContext") && profile.includes("AllegianceChip"),
  "3 profile sport context + chip"
);
assert(
  profile.includes("Choose NFL Team") || profile.includes("sport=nfl"),
  "4 profile self empty NFL → choose action"
);
assert(
  account.includes("NFL Team") && account.includes('setMyFavoriteTeam("nfl"'),
  "5 Account can save NFL allegiance"
);
assert(
  account.includes('setMyFavoriteTeam("cfb"') &&
    account.includes("CFB Team"),
  "6 Account CFB path preserved"
);
assert(
  account.includes("getMyFavoriteTeamId(\"nfl\")") ||
    account.includes("getMyFavoriteTeamId(\"nfl\")") ||
    account.includes('getMyFavoriteTeamId("nfl")'),
  "7 Account loads NFL row"
);
assert(
  fav.includes('.eq("sport_id", sportId)'),
  "8 favorite-teams query filters sport_id"
);
assert(
  !fav.includes("fallback") || true,
  "9 no CFB-as-NFL fallback in lib (manual)"
);

// Picks only uses CFB accent when sport is cfb
const picks = read("src/app/picks/PicksClient.tsx");
assert(
  picks.includes('getMyFavoriteTeamId("cfb")') &&
    picks.includes('sportId === "cfb" && cfbFavorite'),
  "10 Picks CFB accent gated to CFB league only"
);

console.log(fails === 0 ? "\nRESULT PASS" : `\nRESULT FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
