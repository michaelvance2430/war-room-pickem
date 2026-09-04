import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/fieldhouse-postseason-build21-REVIEW-ONLY.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/fieldhouse-build21-schema-REVIEW-ONLY.sql", import.meta.url), "utf8");
const worker = readFileSync(new URL("../supabase/functions/fieldhouse-tournament-results/index.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../native-ios/WarRoom/FieldhouseExperience.swift", import.meta.url), "utf8");

for (const table of [
  "fieldhouse_tournaments",
  "fieldhouse_tournament_teams",
  "fieldhouse_tournament_games",
  "fieldhouse_bracket_entries",
  "fieldhouse_round_entries",
  "fieldhouse_postseason_totals",
  "fieldhouse_postseason_awards",
]) assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));

assert.match(sql, /team_count integer not null default 76 check \(team_count = 76\)/);
assert.match(sql, /decision_count integer not null default 75 check \(decision_count = 75\)/);
assert.match(sql, /when 'opening' then 1 when 'r64' then 1 when 'r32' then 2/);
assert.match(sql, /when 's16' then 4 when 'e8' then 8 when 'ff' then 16 when 'title' then 32/);
assert.match(sql, /jsonb_object_length\(p_picks\) <> 75/);
assert.match(sql, /v_choice not in \(v_first, v_second\)/);
assert.match(sql, /v_uid <> '09544d2b-6eca-4131-a321-c000586c9029'::uuid/);
assert.match(sql, /A field with player receipts cannot be replaced/);
assert.match(sql, /Each official region requires 19 teams/);
assert.match(sql, /where prior\.tournament_id=g\.tournament_id and prior\.game_id=g\.first_source_game_id and prior\.round_order<g\.round_order/);
assert.match(sql, /when s\.correct_picks::numeric\/75>=0\.60 then round\(s\.raw_points\*1\.5\)::integer/);
assert.match(sql, /else round\(s\.raw_points\*0\.5\)::integer/);
assert.match(sql, /fieldhouse_round_entries.*one point per correct official winner/is);
assert.match(sql, /create or replace function public\.record_fieldhouse_tournament_result/);
assert.match(sql, /create or replace function public\.finalize_fieldhouse_postseason_awards/);
assert.match(sql, /total_points integer generated always as \(bracket_adjusted_points \+ round_points\) stored/);
assert.match(sql, /League members read Fieldhouse postseason totals/);
assert.match(sql, /insert into public\.fieldhouse_postseason_totals/);
assert.match(sql, /row_number\(\) over\(partition by league_id,fieldhouse_region order by total_points desc,regular_points desc,user_id\)/);
assert.match(schema, /add column if not exists fieldhouse_region text/);
assert.match(schema, /'East','West','South','Midwest'/);
assert.match(schema, /create trigger assign_fieldhouse_region_before_insert/);
assert.match(worker, /claim_live_football_score_refresh/);
assert.match(worker, /record_fieldhouse_tournament_result/);
assert.match(worker, /game\.odds_event_id.*row\.id/);
assert.match(worker, /firstScore > secondScore \? firstID : secondID/);
assert.match(client, /TOURNAMENT SCORECARD · LIVE/);
assert.match(client, /state\.postseasonPoints\(for: standing\.userId\)/);
assert.doesNotMatch(sql, /grant (insert|update|delete).*authenticated/i);
assert.doesNotMatch(sql, /drop table|truncate/i);

console.log("Fieldhouse Build 21 postseason authority PASS — owner field, 75-path validation, one scoreboard total, live client parity, final awards");
