import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/foundry-cfb-certification-v2.sql", import.meta.url), "utf8");
const scoring = readFileSync(new URL("../supabase/foundry-postseason-week-index-v1.sql", import.meta.url), "utf8");
assert.match(sql, /mode <> 'foundry'/);
assert.match(sql, /Human roster detected/);
assert.match(sql, /foundryOnly.*true.*botsIncluded.*true/s);
assert.match(sql, /greatest\(0, coalesce\(m\.total_points, 0\) - coalesce\(m\.deployment_credit, 0\)\)/);
assert.match(sql, /delete from public\.week_cards[\s\S]*regular_season_weeks \+ 1/);
assert.match(sql, /set current_week = regular_season_weeks \+ 2/);
assert.match(sql, /public\.rebuild_foundry_postseason_snapshot/);
assert.match(sql, /public\.seed_foundry_cfb_postseason/);
assert.match(sql, /revoke all on function public\.rebuild_foundry_postseason_snapshot.*authenticated/);
assert.match(scoring, /v_league\.current_week-coalesce\(array_length\(weekly_points,1\),0\)/);
assert.match(scoring, /array\[v_delta\]/);
assert.doesNotMatch(scoring, /weekly_points=array_append\(weekly_points,v_delta\)/);
assert.match(scoring, /when v_phase='championship' then 'season_complete'/);
console.log("Foundry CFB certification transition PASS");
