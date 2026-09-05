import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/multi-sport-season-closeout-build21-REVIEW-ONLY.sql", import.meta.url),
  "utf8"
);
const client = readFileSync(new URL("../src/lib/season-closeout.ts", import.meta.url), "utf8");

for (const sport of ["cfb", "nfl", "ncaam", "ncaaw"]) {
  assert.match(sql, new RegExp(`'${sport}'`), `missing ${sport} closeout support`);
}
assert.match(sql, /create or replace function public\.record_season_closeout/);
assert.match(sql, /Official competitive-season receipt is missing/);
assert.match(sql, /jsonb_object_length\(result\.winners\)=13/);
assert.match(sql, /fieldhouse_postseason_awards/);
assert.match(sql, /league_champion_ids uuid\[\]/);
assert.match(sql, /toilet_bowl_champion_ids uuid\[\]/);
assert.match(sql, /on conflict\(league_id,season_key,competition_type\) do nothing/);
assert.match(sql, /Selected championship trophy does not match the league sport/);
assert.match(sql, /create or replace function public\.record_cfb_season_closeout/);
assert.match(sql, /grant execute on function public\.record_season_closeout/);
assert.doesNotMatch(sql, /grant (insert|update|delete|all) on public\.league_season_closeouts/i);
assert.match(client, /rpc\(\s*"record_season_closeout"/);
assert.match(client, /p_competition_type: "league"/);

console.log("Build 21 multi-sport season closeout contract PASS");
