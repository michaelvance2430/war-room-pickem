/**
 * Focused regression: cloud sport_id is authoritative; no write-on-read.
 * Static + pure resolution checks (no Supabase mutations).
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  theme: readFileSync(resolve(root, "src/lib/sports/sport-theme.ts"), "utf8"),
  session: readFileSync(resolve(root, "src/lib/session-restore.ts"), "utf8"),
  sync: readFileSync(resolve(root, "src/lib/league-sync.ts"), "utf8"),
  join: readFileSync(resolve(root, "src/app/join/page.tsx"), "utf8"),
};

let fails = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL", msg);
    fails += 1;
  } else {
    console.log("PASS", msg);
  }
}

// reassert must be no-op body (no .update)
const reassertBlock = files.theme.slice(
  files.theme.indexOf("export async function reassertLeagueSportToCloud"),
  files.theme.indexOf("export function pinLeagueSport")
);
assert(
  reassertBlock.includes("return;") &&
    !reassertBlock.includes('.from("leagues")') &&
    !reassertBlock.includes("sport_id:"),
  "reassertLeagueSportToCloud is a no-op (no leagues UPDATE)"
);

assert(
  !files.session.includes("reassertLeagueSportToCloud"),
  "session-restore does not call reassertLeagueSportToCloud"
);
assert(
  !files.sync.includes("reassertLeagueSportToCloud"),
  "league-sync does not call reassertLeagueSportToCloud"
);
assert(
  !files.sync.includes("patch.sport_id") &&
    !files.sync.includes("sport_id: league.sportId"),
  "saveLeagueToCloud does not re-assert sport_id"
);

// Cloud wins comment / code path present
assert(
  files.theme.includes("Cloud present") ||
    files.theme.includes("cloud present") ||
    files.theme.includes("always wins"),
  "resolveLeagueSportId documents cloud-wins"
);

// Create still writes sport on join
assert(
  files.join.includes("sport_id: createdSportId") ||
    files.join.includes("sport_id: selectedSportId"),
  "join create path still writes sport_id"
);

// Pure resolution model (mirrors new product law)
function normalizeSportId(s) {
  const t = String(s || "").toLowerCase().trim();
  if (t === "nfl") return "nfl";
  if (t === "soccer_wwc") return "soccer_wwc";
  return "cfb";
}
function resolveCloudWins(opts) {
  const cloudRaw =
    typeof opts.cloudSportId === "string" ? opts.cloudSportId.trim() : "";
  const cloud = cloudRaw ? normalizeSportId(cloudRaw) : null;
  if (cloud) return cloud;
  if (opts.stamp) return normalizeSportId(opts.stamp);
  if (opts.localSportId) return normalizeSportId(opts.localSportId);
  return "cfb";
}

assert(
  resolveCloudWins({ cloudSportId: "cfb", stamp: "nfl" }) === "cfb",
  "1 cloud CFB + local NFL stamp → CFB"
);
assert(
  resolveCloudWins({ cloudSportId: "nfl", stamp: "cfb" }) === "nfl",
  "2 cloud NFL + local CFB stamp → NFL"
);
assert(
  resolveCloudWins({ cloudSportId: "nfl", stamp: "nfl" }) === "nfl",
  "3 matching NFL stamp → NFL"
);
assert(
  resolveCloudWins({ cloudSportId: "cfb" }) === "cfb",
  "4 no stamp → cloud CFB"
);
assert(
  resolveCloudWins({ cloudSportId: null, stamp: "nfl" }) === "nfl",
  "5 missing cloud → presentation stamp only (no write)"
);
assert(
  resolveCloudWins({ cloudSportId: "", localSportId: "cfb" }) === "cfb",
  "6 empty cloud → local presentation"
);

console.log(fails === 0 ? "\nRESULT PASS" : `\nRESULT FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
