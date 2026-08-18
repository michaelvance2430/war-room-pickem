import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/reset-season.sql", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/lib/cloud.ts", import.meta.url), "utf8");

for (const table of [
  "postseason_scorecards",
  "cfb_postseason_results",
  "cfb_postseason_entries",
  "cfb_postseason_slates",
  "league_season_closeouts",
  "league_postseason_snapshots",
]) assert.match(sql, new RegExp(`delete from public\\.${table}`));

assert.match(sql, /v_season_key int := case/);
assert.match(sql, /deployment_credit = 0/);
assert.match(sql, /deployment_credit_breakdown = '\[\]'::jsonb/);
assert.match(sql, /eligible_from_week = 0/);
assert.match(sql, /'postseasonDeleted', v_postseason/);
assert.match(sql, /season_key = v_season_key::text/);
assert.doesNotMatch(sql, /delete from public\.league_trophies/, "reset must preserve engraved history");
assert.match(client, /postseasonDeleted\?: number/);

console.log("Season reset v2 clears active competition and preserves historical trophies PASS");
