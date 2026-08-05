/**
 * League sport integrity regression (app + migration SQL).
 * No Supabase mutations. No production changes.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

let fails = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL", msg);
    fails += 1;
  } else {
    console.log("PASS", msg);
  }
}

const theme = read("src/lib/sports/sport-theme.ts");
const session = read("src/lib/session-restore.ts");
const sync = read("src/lib/league-sync.ts");
const join = read("src/app/join/page.tsx");
const pool = read("src/lib/sport-pool.ts");
const mig = read("supabase/league-sport-immutable.sql");
const scan = read("scripts/sql/incident-league-sport-scan.sql");

// --- reassert gone ---
assert(
  !theme.includes("reassertLeagueSportToCloud"),
  "1 reassertLeagueSportToCloud removed from sport-theme"
);
assert(
  !session.includes("reassertLeagueSportToCloud") &&
    !sync.includes("reassertLeagueSportToCloud") &&
    !join.includes("reassertLeagueSportToCloud"),
  "2 no reassert callers in app"
);

// --- create INSERT has sport ---
assert(
  /insert\(withSport\)|insert\(insertRow\)/i.test(join) ||
    join.includes(".insert(withSport)"),
  "3 join create inserts withSport including sport_id"
);
assert(
  join.includes("sport_id: selectedSportId"),
  "4 join INSERT payload includes selectedSportId"
);
assert(
  !join.includes("force sport_id update") &&
    !/update\(\s*\{\s*sport_id:\s*selectedSportId/.test(join) &&
    !/update\(\s*\{\s*sport_id:\s*createdSportId/.test(join) &&
    !/update\(\s*\{\s*sport_id:\s*[\"']nfl[\"']/.test(join),
  "5 join has no post-create sport_id UPDATE"
);
assert(
  pool.includes("sport_id: sportId") && pool.includes(".insert(insertRow)"),
  "6 sport-pool INSERT includes sport_id"
);
assert(
  !/from\(\"leagues\"\)[\s\S]{0,80}\.update\(\{[\s\S]{0,120}sport_id/.test(pool),
  "7 sport-pool has no leagues sport_id UPDATE"
);

// --- settings whitelist omits sport ---
assert(
  sync.includes("delete patch.sport_id"),
  "8 saveLeagueToCloud strips sport_id"
);
assert(
  sync.includes("delete patch.commissioner_id") &&
    sync.includes("delete patch.current_week"),
  "9 saveLeagueToCloud strips identity/week fields"
);
assert(
  !sync.includes("reassert") && !sync.includes("sport_id: league.sportId"),
  "10 league-sync never writes sport from local"
);

// --- cloud wins + observability ---
assert(
  theme.includes("logSportMismatch") &&
    theme.includes("cloud_wins_no_write"),
  "11 mismatch observability present"
);
assert(
  theme.includes("always wins") || theme.includes("Cloud present"),
  "12 cloud-authoritative resolve"
);

// --- migration ---
assert(
  mig.includes("leagues_sport_id_immutable") &&
    mig.includes("before update on public.leagues") &&
    mig.includes("new.sport_id is distinct from old.sport_id") &&
    mig.includes("League sport is immutable after creation."),
  "13 DB trigger rejects sport_id changes"
);
assert(
  mig.includes("DO NOT apply automatically") ||
    mig.includes("APPLY ONLY after"),
  "14 migration marked review-only"
);

// --- incident scan read-only ---
const scanNoComments = scan
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n")
  .toLowerCase();
assert(
  scan.includes("READ-ONLY") &&
    !scanNoComments.includes("update ") &&
    !scanNoComments.includes("insert ") &&
    !scanNoComments.includes("delete "),
  "15 incident scan is read-only"
);
assert(
  scan.includes("nfl_with_current_week_0") &&
    scan.includes("76730ee3-d440-4a91-9616-a768ffc03189"),
  "16 incident scan covers SSR + NFL week0 pattern"
);

// Pure cloud-wins model
function cloudWins(cloud, local) {
  const c = cloud && String(cloud).trim() ? String(cloud).trim() : null;
  if (c) return c;
  return local || "cfb";
}
assert(cloudWins("cfb", "nfl") === "cfb", "17 restore CFB + stale NFL stamp → cfb");
assert(cloudWins("nfl", "cfb") === "nfl", "18 restore NFL + stale CFB stamp → nfl");
assert(cloudWins("cfb", "cfb") === "cfb", "19 matching stamps");
assert(cloudWins(null, "nfl") === "nfl", "20 missing cloud → local presentation only");

// SSR fixture expectation
const SSR = "76730ee3-d440-4a91-9616-a768ffc03189";
assert(scan.includes(SSR), "21 Saturday Situation Room id in scan");

console.log(fails === 0 ? "\nRESULT PASS" : `\nRESULT FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
