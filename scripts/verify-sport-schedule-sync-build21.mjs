import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  earliestEligibleEvent,
  eligibleEventsForWindow,
  isEligibleScheduleEvent,
  isFbsTeam,
  providerSportKey,
} from "../supabase/functions/_shared/sport-schedule.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const worker = read("supabase/functions/sport-schedule-sync/index.ts");
const footballOdds = read("supabase/functions/football-odds/index.ts");
const fieldhouseOdds = read("supabase/functions/fieldhouse-odds/index.ts");
const schema = read("supabase/sport-season-windows-build21-REVIEW-ONLY.sql");
const seeds = read("supabase/sport-season-window-seeds-build21-REVIEW-ONLY.sql");
const auth = read("supabase/sport-schedule-worker-auth-build21-REVIEW-ONLY.sql");
const cron = read("supabase/sport-schedule-sync-cron-build21-REVIEW-ONLY.sql");
const usageAction = read("supabase/sport-schedule-usage-action-build21-REVIEW-ONLY.sql");
const postverify = read("supabase/sport-schedule-sync-postverify-build21-SELECT-ONLY.sql");

assert.equal(isFbsTeam("Houston Cougars"), true);
assert.equal(isFbsTeam("Houston Baptist Huskies"), false);
assert.equal(isFbsTeam("Michigan Wolverines"), true);
assert.equal(isFbsTeam("North Dakota State Bison"), false);
assert.equal(isEligibleScheduleEvent("cfb", "Houston Baptist Huskies", "Rice Owls"), false);
assert.equal(isEligibleScheduleEvent("ncaam", "Any Division I Team", "Another Team"), true);
assert.equal(providerSportKey("nfl"), "americanfootball_nfl");
assert.equal(providerSportKey("ncaam"), "basketball_ncaab");
assert.equal(providerSportKey("ncaaw"), "basketball_wncaab");

const boundaryEvents = [
  { id: "before", commence_time: "2026-11-01T23:59:59Z", away_team: "A", home_team: "B" },
  { id: "start", commence_time: "2026-11-02T00:00:00Z", away_team: "A", home_team: "B" },
  { id: "middle", commence_time: "2026-11-04T18:00:00Z", away_team: "A", home_team: "B" },
  { id: "end", commence_time: "2026-11-09T00:00:00Z", away_team: "A", home_team: "B" },
];
assert.deepEqual(
  eligibleEventsForWindow("ncaam", boundaryEvents, "2026-11-02T00:00:00Z", "2026-11-09T00:00:00Z").map((event) => event.id),
  ["start", "middle"],
);
assert.equal(
  earliestEligibleEvent("ncaam", boundaryEvents, "2026-11-02T00:00:00Z", "2026-11-09T00:00:00Z")?.id,
  "start",
);
assert.deepEqual(
  eligibleEventsForWindow("cfb", [
    { id: "fcs", commence_time: "2026-09-05T16:00:00Z", away_team: "Houston Baptist Huskies", home_team: "Rice Owls" },
    { id: "fbs", commence_time: "2026-09-05T19:30:00Z", away_team: "Michigan Wolverines", home_team: "Ohio State Buckeyes" },
  ], "2026-09-03T04:00:00Z", "2026-09-08T04:00:00Z").map((event) => event.id),
  ["fbs"],
);

assert.match(worker, /\/events`/);
assert.doesNotMatch(worker, /searchParams\.set\("markets"/);
assert.match(worker, /endpointCostCredits:\s*0/);
assert.match(worker, /estimated_credit_cost:\s*0/);
assert.match(worker, /authorize_sport_schedule_worker/);
assert.match(worker, /query\.append\("window_starts_at", `gt\./);
assert.match(worker, /query\.append\("window_starts_at", `lte\./);
assert.match(worker, /provider_event_count/);
assert.match(worker, /timing_status = "official"/);
assert.match(worker, /eligibleEventsForWindow/);
assert.match(worker, /Schedule usage audit returned/);

for (const oddsWorker of [footballOdds, fieldhouseOdds]) {
  assert.match(oddsWorker, /sport_card_windows/);
  assert.match(oddsWorker, /first_game_at/);
  assert.match(oddsWorker, /window_starts_at/);
  assert.match(oddsWorker, /window_ends_at/);
  assert.match(oddsWorker, /Date\.parse\(range\.first_game_at\)|Date\.parse\(cardWindow\.first_game_at\)/);
  assert.match(oddsWorker, /windowStartsAt:/);
  assert.match(oddsWorker, /windowEndsAt:/);
}
assert.doesNotMatch(footballOdds, /function dateWindow/);
assert.doesNotMatch(fieldhouseOdds, /FIELDHOUSE_OPENING_DATE/);

assert.match(schema, /window_starts_at timestamptz not null/);
assert.match(schema, /window_ends_at timestamptz not null/);
assert.match(schema, /first_game_at >= window_starts_at and first_game_at < window_ends_at/);
assert.match(schema, /provider_event_count integer not null default 0/);
assert.match(schema, /grant select, insert, update, delete on table public\.sport_card_windows to service_role/);

for (const sport of ["cfb", "nfl", "ncaam", "ncaaw"]) {
  assert.match(seeds, new RegExp(`'${sport}'`));
}
assert.match(seeds, /2026-09-10 00:20:00\+00/);
assert.match(seeds, /generate_series\(1, 19\)/);
assert.match(seeds, /generate_series\(0, 14\)/);
assert.match(seeds, /last_ingested_at is not null/);

assert.match(auth, /war_room_sport_schedule_cron_secret/);
assert.match(auth, /security definer/);
assert.match(auth, /set search_path = ''/);
assert.match(auth, /revoke all on function public\.authorize_sport_schedule_worker\(text\)/);
assert.match(auth, /grant execute on function public\.authorize_sport_schedule_worker\(text\)\s+to service_role/);
assert.match(cron, /war-room-sport-schedule-sync/);
assert.match(cron, /'15 10 \* \* \*'/);
assert.match(cron, /war_room_sport_schedule_cron_secret/);
assert.match(usageAction, /'schedule_sync'/);
assert.match(usageAction, /drop constraint if exists platform_odds_api_usage_action_check/);
assert.match(postverify, /schedule columns exist/);
assert.match(postverify, /card windows remain internally valid/);
assert.match(postverify, /one daily schedule job is active/);

console.log("Build 21 sport schedule authority PASS — zero-credit provider events, FBS filter, server gates, current/next scaffolds, and guarded daily worker");
