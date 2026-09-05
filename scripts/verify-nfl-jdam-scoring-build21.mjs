import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/nfl-jdam-scoring-build21-REVIEW-ONLY.sql", "utf8");
const model = readFileSync("native-ios/WarRoom/NflPostseason.swift", "utf8");
const view = readFileSync("native-ios/WarRoom/NflPostseasonCommandView.swift", "utf8");
const api = readFileSync("native-ios/WarRoom/SupabaseAPI.swift", "utf8");

assert.match(sql, /select l\.sport_id='nfl' and l\.commissioner_id=v_uid[\s\S]*for update/);
assert.match(sql, /v_correct>=8 then 1\.50 else 0\.50/);
assert.match(sql, /v_adjusted:=round\(v_raw\*v_multiplier\)::integer/);
assert.match(sql, /total_points=total_points\+\(v_adjusted-v_previous\)/);
assert.match(sql, /when v_had_scorecard then weeks_played else weeks_played\+1/);
assert.match(sql, /where not exists\([\s\S]*nfl_postseason_slates/);
assert.match(sql, /Recorded NFL winners are permanent/);
assert.match(sql, /entry\.locked_at is not null/);
assert.match(sql, /Legacy NFL JDAM scorecards require explicit recalculation before Build 21/);
assert.match(sql, /alter function public\.publish_nfl_postseason_slate\(uuid,integer,jsonb\)[\s\S]*security definer/);
assert.match(sql, /revoke insert,update on public\.nfl_postseason_entries[\s\S]*from authenticated/);
assert.match(sql, /revoke insert,update on public\.nfl_postseason_results[\s\S]*from authenticated/);
assert.match(sql, /revoke all on function public\.save_nfl_postseason_results[\s\S]*from public,anon/);
assert.match(model, /static let successThreshold = 8/);
assert.match(view, /Get 8 or more correct[\s\S]*1\.5×/);
assert.match(view, /Get 7 or fewer correct[\s\S]*0\.5×/);
assert.match(view, /CORRECT[\s\S]*row\.correctPicks/);
assert.match(api, /correct_picks,raw_points,adjusted_points,total_points,used_jdam,jdam_multiplier/);

console.log("NFL JDAM Build 21 scoring PASS — 8/13 boundary, weighted adjustment, atomic standings delta, permanent receipt");
