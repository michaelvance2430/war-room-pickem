import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/fieldhouse-postseason-build21-REVIEW-ONLY.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/fieldhouse-build21-schema-REVIEW-ONLY.sql", import.meta.url), "utf8");
const liveStandings = readFileSync(new URL("../supabase/fieldhouse-live-standings-build21-REVIEW-ONLY.sql", import.meta.url), "utf8");
const worker = readFileSync(new URL("../supabase/functions/fieldhouse-tournament-results/index.ts", import.meta.url), "utf8");
const weeklyWorker = readFileSync(new URL("../supabase/functions/autonomous-football-results/index.ts", import.meta.url), "utf8");
const fieldhouseOdds = readFileSync(new URL("../supabase/functions/fieldhouse-odds/index.ts", import.meta.url), "utf8");
const atomicScoring = readFileSync(new URL("../supabase/atomic-week-scoring.sql", import.meta.url), "utf8");
const api = readFileSync(new URL("../native-ios/WarRoom/SupabaseAPI.swift", import.meta.url), "utf8");
const client = readFileSync(new URL("../native-ios/WarRoom/FieldhouseExperience.swift", import.meta.url), "utf8");
const bracketPicker = readFileSync(new URL("../native-ios/WarRoom/FieldhouseBracketPicker.swift", import.meta.url), "utf8");
const content = readFileSync(new URL("../native-ios/WarRoom/ContentView.swift", import.meta.url), "utf8");

for (const table of [
  "fieldhouse_tournaments",
  "fieldhouse_tournament_teams",
  "fieldhouse_tournament_games",
  "fieldhouse_bracket_entries",
  "fieldhouse_round_entries",
  "fieldhouse_postseason_totals",
  "fieldhouse_postseason_qualifiers",
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
assert.match(sql, /four regions with at least 16 teams each/);
assert.match(sql, /Every Opening Round game must feed exactly one First Round slot/);
assert.match(sql, /one First Round slot for seeds 1 through 16/);
assert.match(sql, /Every official team must occupy exactly one bracket entry path/);
assert.match(sql, /where prior\.tournament_id=g\.tournament_id and prior\.game_id=g\.first_source_game_id and prior\.round_order=g\.round_order-1/);
assert.match(sql, /Every bracket game must feed exactly one game in the next round/);
assert.match(sql, /Regional bracket paths cannot cross before the Final Four/);
assert.match(sql, /Published field requires every Opening and First Round tip time/);
assert.match(sql, /when s\.correct_picks::numeric\/75>=0\.60 then round\(s\.raw_points\*1\.5\)::integer/);
assert.match(sql, /else round\(s\.raw_points\*0\.5\)::integer/);
assert.match(sql, /fieldhouse_round_entries.*one point per correct official winner/is);
assert.match(sql, /create or replace function public\.record_fieldhouse_tournament_result/);
assert.match(sql, /first_score=p_first_score,second_score=p_second_score/);
assert.match(sql, /Winner does not match the official final score/);
assert.match(sql, /Completed time cannot precede the official tip/);
assert.match(sql, /raise exception 'Tournament result is already final'/);
assert.match(sql, /'alreadyRecorded',true/);
assert.match(sql, /create or replace function public\.finalize_fieldhouse_postseason_awards/);
assert.match(sql, /total_points integer generated always as \(bracket_adjusted_points \+ round_points\) stored/);
assert.match(sql, /League members read Fieldhouse postseason totals/);
assert.match(sql, /insert into public\.fieldhouse_postseason_totals/);
assert.match(sql, /row_number\(\) over\(partition by league_id,fieldhouse_region order by total_points desc,regular_points desc,user_id\)/);
assert.match(sql, /insert into public\.league_trophies\(/);
assert.match(sql, /create or replace function public\.freeze_fieldhouse_postseason_qualifiers/);
assert.match(sql, /when regular_rank<=brass_size then 'championship'/);
assert.match(sql, /when regular_rank>region_count-brass_size then 'toilet_bowl'/);
assert.match(sql, /else 'no_brass'/);
assert.match(sql, /where p\.tournament_id=p_tournament_id and q\.path='championship'/);
assert.match(sql, /where p\.tournament_id=p_tournament_id and q\.path='toilet_bowl'/);
assert.match(sql, /a\.award_key='toilet_champion'/);
assert.match(sql, /with players as \(\s*select tournament_id,league_id,user_id\s*from public\.fieldhouse_postseason_qualifiers/);
assert.match(sql, /'fieldhouse_region_'\|\|lower\(a\.player_region\)/);
assert.match(sql, /a\.awarded_at,a\.trophy_id/);
assert.match(schema, /'fieldhouse_region_east','fieldhouse_region_west'/);
assert.match(schema, /'fieldhouse_region_south','fieldhouse_region_midwest'/);
assert.match(sql, /create or replace function private\.queue_fieldhouse_round_notifications/);
assert.match(sql, /fieldhouse-round-open:/);
assert.match(sql, /fieldhouse-round-lock-1h:/);
assert.match(sql, /v_first_tip is null or v_missing_tips<>0/);
assert.match(sql, /on conflict \(event_key\) do nothing/);
assert.match(sql, /perform private\.queue_fieldhouse_round_notifications\(v_tournament_id,'opening'\)/);
assert.match(sql, /perform private\.queue_fieldhouse_round_notifications\(p_tournament_id,v_next_round\)/);
assert.match(sql, /create or replace function public\.sync_fieldhouse_official_schedule/);
assert.match(sql, /Schedule sync requires the complete 75-game file/);
assert.match(sql, /A started or completed game time cannot be changed/);
assert.match(sql, /perform private\.queue_fieldhouse_round_notifications\(v_tournament_id,v_active_round\)/);
assert.match(client, /The bracket graph and every player's permanent picks remain untouched/);
assert.match(schema, /add column if not exists fieldhouse_region text/);
assert.match(schema, /'East','West','South','Midwest'/);
assert.match(schema, /create trigger assign_fieldhouse_region_before_insert/);
assert.match(schema, /greatest\(1, coalesce\(l\.games_per_week, 5\)\)/);
assert.match(schema, /sport in \('cfb','nfl','ncaam','ncaaw'\)/);
assert.match(schema, /'tournament_score_sync'/);
assert.match(worker, /claim_live_football_score_refresh/);
assert.match(worker, /record_fieldhouse_tournament_result/);
assert.match(worker, /game\.odds_event_id.*row\.id/);
assert.match(worker, /firstScore > secondScore \? firstID : secondID/);
assert.match(worker, /p_first_score: firstScore, p_second_score: secondScore/);
assert.match(worker, /if \(!pollingGames\.length\) continue/);
assert.match(worker, /tip <= now \+ 2 \* 60_000/);
assert.match(worker, /tip >= now - 24 \* 60 \* 60_000/);
assert.match(worker, /hasLiveWindow \? 50 : 900/);
assert.match(worker, /official-tip-missing/);
assert.match(liveStandings, /create or replace function public\.get_fieldhouse_live_board/);
assert.match(liveStandings, /not in \('cbb', 'ncaam', 'ncaaw'\)/);
assert.match(liveStandings, /nullif\(cg\.start_time, ''\)::timestamptz <= now\(\)/);
assert.match(liveStandings, /coalesce\(p\.is_chaos, false\) as is_hellfire/);
assert.match(liveStandings, /grant execute on function public\.get_fieldhouse_live_board\(uuid, integer\) to authenticated/);
assert.match(api, /static func fieldhouseLiveBoard/);
assert.match(api, /static func fieldhousePostseasonQualifier/);
assert.match(client, /FieldhouseLiveStandingsEngine\.projectedTotals/);
assert.match(client, /if state\.officialPostseasonField != nil \{\s*clearLiveProjection\(\)\s*refreshLifecycle\(at: Date\(\)\)\s*return\s*\}/);
assert.match(client, /LIVE PROJECTION/);
assert.match(client, /liveProjectionWeek != state\.scoringWindow/);
assert.match(client, /resetLiveProjectionIfWeekChanged\(\)/);
for (const phrase of [
  "any team score 90 or more",
  "any game finish within 3 points",
  "any underdog win outright",
  "any game reach 150 combined points",
  "any team score 100 or more",
  "both teams score 75 or more in any game",
  "any game finish with a 20 point margin",
  "at least three underdogs win outright",
  "at least six favorites cover the spread",
  "every game reach 130 combined points",
]) assert.match(weeklyWorker, new RegExp(phrase));
assert.match(fieldhouseOdds, /isHalfPointSpread/);
assert.match(fieldhouseOdds, /do not invent a hook or silently alter the market/);
assert.match(client, /FieldhouseSpreadRule\.isHalfPoint/);
assert.match(weeklyWorker, /away_score:game\.awayScore,home_score:game\.homeScore/);
assert.match(atomicScoring, /add column if not exists away_score integer/);
assert.match(atomicScoring, /x\.away_score,\s*x\.home_score,\s*case when x\.away_score is not null then 'odds_api'/);
assert.match(client, /TOURNAMENT SCORECARD · LIVE/);
assert.match(client, /ROUND-BY-ROUND LEDGER/);
assert.match(api, /winner_team_id,first_score,second_score/);
assert.match(client, /CERTIFIED ROUND RECEIPT/);
assert.match(client, /ORIGINAL BRACKET/);
assert.match(client, /FRESH ROUND/);
assert.match(client, /func postseasonRoundIsLocked\(_ roundKey: String/);
assert.match(client, /locked: state\.postseasonRoundIsLocked\(round\)/);
assert.match(bracketPicker, /LIVE ROUND BOARD/);
assert.match(client, /POINTS \+ CHEEVOS · NO BRASS/);
assert.match(client, /postseasonRoundReceipt\(for:/);
assert.match(client, /case "title": 32/);
assert.match(client, /state\.postseasonPoints\(for: standing\.userId\)/);
assert.match(client, /activeStandings\.map\(\\\.totalPoints\)/);
assert.match(client, /detail: "\\\(activeStandings\.count\) active/);
assert.doesNotMatch(client, /demoScores|25 active/);
assert.match(client, /if let liveContext \{\s*LockerRoomView\(leagueOverride: liveContext\.membership/);
assert.match(client, /authenticatedStandings\.isEmpty && state\.isAuthenticatedSession/);
assert.match(client, /state\.isAuthenticatedSession && liveRegionalStandings\.isEmpty/);
assert.match(client, /Highest cumulative postseason score through the title game earns this trophy/);
assert.match(client, /if auth\.user != nil && auth\.token != nil \{\s*YouView\(onBack:/);
assert.match(content, /else if identity\.isFieldhouse \{ FieldhouseBackdrop\(leagueOverride:/);
assert.match(content, /NCAAW FIELDHOUSE LIVE WIRE/);
assert.match(content, /case "m-iron-rim": return "FieldhouseMTheIronRim"/);
assert.match(content, /case "w-pure-game": return "FieldhouseWThePureGame"/);
assert.match(content, /case "fieldhouse-regional-east", "fieldhouse_region_east": return "FieldhouseRegionalEast"/);
assert.match(content, /FieldhouseTrophyCatalog\.options\(for: league\)\.map/);
assert.ok(content.includes(`return "FIELDHOUSE · \\(identity.isNCAAW ? "NCAAW" : "NCAAM") HARDWARE"`));
assert.match(client, /guard !state\.isAuthenticatedSession else \{ return \}/);
assert.match(content, /FieldhouseAuthenticatedContainer\(notificationDestination: \$fieldhouseNotificationDestination\)/);
assert.match(content, /fieldhouseNotificationDestination = route/);
assert.doesNotMatch(sql, /grant (insert|update|delete).*authenticated/i);
assert.doesNotMatch(sql, /drop table|truncate/i);

console.log("Fieldhouse Build 21 postseason authority PASS — owner field, 75-path validation, one scoreboard total, live client parity, final awards");
