import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/cfb-season-closeout-v1.sql", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/lib/season-closeout.ts", import.meta.url), "utf8");

for (const fragment of [
  "league_season_closeouts",
  "record_cfb_season_closeout",
  "postseason_scorecards",
  "phase='championship'",
  "Championship trophy is missing or mismatched",
  "Toilet Bowl trophy is missing or mismatched",
  "unique (league_id, season_key)",
  "Members read season closeouts",
]) {
  assert.ok(sql.includes(fragment), `missing durable closeout contract: ${fragment}`);
}
assert.match(sql, /revoke all on function public\.record_cfb_season_closeout[\s\S]*from public,anon/i);
assert.match(client, /league_season_closeouts/);
assert.match(client, /record_cfb_season_closeout/);
assert.match(client, /listBracketScoredWeekNumbers/);
assert.doesNotMatch(client, /const existing = readClosed/);
assert.match(client, /if \(!championshipAward\.ok\)/);
assert.match(client, /if \(!toiletAward\.ok\)/);

console.log("Durable CFB season closeout PASS");
