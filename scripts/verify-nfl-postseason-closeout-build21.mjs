import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const foundation = readFileSync("supabase/nfl-postseason-awards-foundation-build21-REVIEW-ONLY.sql", "utf8");
const closeout = readFileSync("supabase/nfl-postseason-closeout-build21-REVIEW-ONLY.sql", "utf8");
const sharedCloseout = readFileSync("supabase/multi-sport-season-closeout-build21-REVIEW-ONLY.sql", "utf8");
const model = readFileSync("native-ios/WarRoom/NflPostseason.swift", "utf8");
const view = readFileSync("native-ios/WarRoom/NflPostseasonCommandView.swift", "utf8");
const api = readFileSync("native-ios/WarRoom/SupabaseAPI.swift", "utf8");

assert.match(foundation, /create table if not exists public\.nfl_postseason_awards/);
assert.match(foundation, /unique \(league_id,season_key,award_key,user_id\)/);
assert.match(foundation, /Members read NFL postseason awards/);
assert.doesNotMatch(foundation, /grant (?:insert|update|delete|all) on public\.nfl_postseason_awards/i);

assert.match(closeout, /private\.freeze_nfl_postseason_field_if_absent/);
assert.match(closeout, /v_competitive:=private\.certify_league_competitive_season/);
assert.match(closeout, /v_competitive\.status='official'/);
assert.match(closeout, /result\.week_number=v_league\.regular_season_weeks/);
assert.doesNotMatch(closeout, /v_league\.current_week\s*<=\s*v_league\.regular_season_weeks/);
assert.match(closeout, /least\(4,division_count\/2\)/);
assert.match(closeout, /participant\.field='championship'/);
assert.match(closeout, /participant\.field='toilet'/);
assert.match(closeout, /coalesce\(scorecard\.adjusted_points,0\)/);
assert.match(closeout, /order by postseason_points desc,regular_points desc/);
assert.match(closeout, /dense_rank\(\)/);
assert.match(closeout, /commissioner_selected_recipients',false/);
assert.match(closeout, /create constraint trigger finalize_nfl_postseason_after_results/);
assert.match(closeout, /deferrable initially deferred/);
assert.match(closeout, /create or replace view public\.nfl_postseason_field_status/);
assert.match(closeout, /create or replace view public\.nfl_profile_trophies/);
assert.doesNotMatch(closeout, /set search_path\s*=\s*(?:'public'|public(?:\s*,\s*pg_temp)?)/i);

assert.match(sharedCloseout, /NFL Championship recipients must match the authoritative Final Thirteen awards/);
assert.match(sharedCloseout, /NFL Toilet Bowl recipients must match the authoritative Final Thirteen awards/);
assert.match(sharedCloseout, /if v_sport_id='cfb' then/);

assert.match(model, /enum NflPostseasonFieldPolicy/);
assert.match(model, /min\(maximumBerthsPerDivision, max\(0, count\) \/ 2\)/);
assert.match(model, /postseasonLeaders[\s\S]*regularSeasonPoints/);
assert.match(view, /CHAMPIONSHIP FIELD/);
assert.match(view, /TOILET BOWL FIELD/);
assert.match(view, /Final Thirteen points decide the trophy/);
assert.match(api, /rest\/v1\/nfl_postseason_field_status/);
assert.match(api, /resource: "nfl_profile_trophies"/);

const berths = (count) => Math.min(4, Math.floor(Math.max(0, count) / 2));
const field = (rank, count) => {
  const places = berths(count);
  if (!places || rank < 1 || rank > count) return "eliminated";
  if (rank <= places) return "championship";
  if (rank > count - places) return "toilet";
  return "eliminated";
};

for (let count = 0; count <= 100; count += 1) {
  const paths = Array.from({ length: count }, (_, index) => field(index + 1, count));
  assert.equal(paths.filter((path) => path === "championship").length, berths(count));
  assert.equal(paths.filter((path) => path === "toilet").length, berths(count));
  assert.equal(paths.length, count);
}

console.log("NFL postseason closeout Build 21 PASS — division fields, active-season gate, Final Thirteen winners, co-champions, and client receipts");
