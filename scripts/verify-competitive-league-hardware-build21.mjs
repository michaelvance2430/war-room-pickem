import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const sql = read("supabase/competitive-league-qualification-build21-REVIEW-ONLY.sql");
const api = read("native-ios/WarRoom/SupabaseAPI.swift");
const copy = read("native-ios/WarRoom/PromotionPoints.swift");
const content = read("native-ios/WarRoom/ContentView.swift");
const fieldhouse = read("native-ios/WarRoom/FieldhouseExperience.swift");
const lobby = read("native-ios/WarRoom/LobbyView.swift");
const tests = read("native-ios/WarRoomTests/WarRoomTests.swift");

assert.match(sql, /minimum_active_players integer not null default 8 check \(minimum_active_players = 8\)/);
assert.match(sql, /required_participation_percent integer not null default 75 check \(required_participation_percent = 75\)/);
assert.match(sql, /minimum_locked_cards integer not null default 4 check \(minimum_locked_cards = 4\)/);
assert.match(sql, /coalesce\(m\.is_bot,false\) = false/);
assert.match(sql, /a\.locked_cards >= 4/);
assert.match(sql, /\(a\.eligible_cards \* 3 \+ 3\) \/ 4/);
assert.match(sql, /m\.league_id = p_league_id and m\.user_id = \(select auth\.uid\(\)\)/);
assert.match(sql, /revoke all on function public\.league_competitive_status\(uuid\) from public,anon/);
assert.match(sql, /grant execute on function public\.league_competitive_status\(uuid\) to authenticated/);
assert.match(sql, /before insert or update of winner_user_id on public\.league_trophies/);
assert.match(sql, /Demo league: eight active players at 75 percent participation are required for permanent hardware/);

assert.match(api, /rest\/v1\/rpc\/league_competitive_status/);
assert.match(copy, /DEMO TRACK · NEED \\\(needed\) MORE ACTIVE/);
assert.match(copy, /PROFILE HARDWARE ENABLED/);
assert.match(copy, /status\.maximumEligibleCards < status\.minimumLockedCards/);
assert.match(content, /struct CompetitiveLeagueStatusBanner: View/);
assert.ok((content.match(/CompetitiveLeagueStatusBanner\(/g) ?? []).length >= 2);
assert.ok((fieldhouse.match(/CompetitiveLeagueStatusBanner\(/g) ?? []).length >= 2);
assert.match(lobby, /PERMANENT HARDWARE RULE/);
assert.match(lobby, /Smaller or inactive rooms remain playable as Demo leagues/);
assert.match(tests, /competitiveLeagueBannerNeverConfusesMembersWithActivePlayers/);
assert.match(tests, /competitiveLeagueBannerOnlyPromisesHardwareAfterTheThreshold/);

console.log("Build 21 competitive hardware gate PASS — 8 active humans, 75 percent, four-card floor, member-only status, and all-sport UI coverage");
