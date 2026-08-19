/**
 * Focused pure checks: NFL crystal-ball calendar removal + countdown format.
 * Does not touch production picks.
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(resolve(root, "src/lib/crystal-ball.ts"), "utf8");
const dates = readFileSync(resolve(root, "src/lib/dates.ts"), "utf8");
const page = readFileSync(resolve(root, "src/app/crystal-ball/page.tsx"), "utf8");
const favoriteCard = readFileSync(
  resolve(root, "src/components/CrystalBallFavoriteTeamCard.tsx"),
  "utf8"
);

let fails = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL", msg);
    fails += 1;
  } else {
    console.log("PASS", msg);
  }
}

// NFL must not use hardcoded Sep 10 noon deadline
assert(
  !src.includes("2026-09-10T12:00:00-04:00"),
  "NFL hardcoded noon deadline removed from crystal-ball.ts"
);
assert(
  src.includes("POSITIVE_INFINITY") || src.includes("Number.POSITIVE_INFINITY"),
  "NFL calendar path does not invent a finite noon lock"
);
assert(
  src.includes("firstKickoffOnCardMs"),
  "NFL lock uses firstKickoffOnCardMs from Week 1 games"
);
assert(
  src.includes('const openWeek = sport === "cfb" ? 0 : 1'),
  "NFL opening week is Week 1"
);
assert(
  src.includes("Locks at Week 1's first kickoff"),
  "No-slate copy present in lib"
);
assert(
  src.includes("Locked at kickoff."),
  "Locked copy present in lib"
);
assert(
  page.includes("Your pick is in."),
  "Confirmation copy in page"
);
assert(
  page.includes("Change My Pick"),
  "Change My Pick button in page"
);
assert(
  page.includes("Keep Current Pick"),
  "Cancel / Keep Current Pick path"
);
assert(
  page.includes("formatCountdownToDeadline"),
  "Page uses shared countdown formatter"
);
assert(
  dates.includes("export function formatCountdownToDeadline"),
  "formatCountdownToDeadline exported from dates.ts"
);
assert(
  page.includes("CrystalBallFavoriteTeamCard") &&
    favoriteCard.includes("setMyFavoriteTeam") &&
    favoriteCard.includes('sportId={sportId}'),
  "Crystal Ball offers a separate, sport-scoped favorite-team choice"
);
assert(
  favoriteCard.includes('nfl ? "Super Bowl" : "national champion"'),
  "Favorite-team copy stays distinct for NFL and CFB"
);
assert(
  src.includes("2026-08-29T12:00:00-04:00"),
  "CFB calendar noon deadline preserved"
);

// Pure countdown math (inline mirror of dates pad logic for smoke)
function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}
function headline(lockAt, now) {
  const ms = lockAt - now;
  if (ms <= 0) return "LOCKED";
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days >= 1) return `${days}d ${pad2(hours)}h ${pad2(mins)}m`;
  return `${pad2(hours)}h ${pad2(mins)}m`;
}
const now = Date.parse("2026-09-01T12:00:00Z");
const kick = Date.parse("2026-09-10T00:20:00Z");
const h = headline(kick, now);
assert(/^\d+d \d{2}h \d{2}m$/.test(h), `countdown format sample: ${h}`);
assert(headline(kick, kick + 1000) === "LOCKED", "past kickoff → locked");

console.log(fails === 0 ? "\nRESULT PASS" : `\nRESULT FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
