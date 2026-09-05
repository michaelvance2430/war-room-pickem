import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/fieldhouse-postseason-build21-REVIEW-ONLY.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/fieldhouse-build21-schema-REVIEW-ONLY.sql", import.meta.url), "utf8");
const liveStandings = readFileSync(new URL("../supabase/fieldhouse-live-standings-build21-REVIEW-ONLY.sql", import.meta.url), "utf8");
const competitive = readFileSync(new URL("../supabase/competitive-league-qualification-build21-REVIEW-ONLY.sql", import.meta.url), "utf8");
const closeout = readFileSync(new URL("../supabase/multi-sport-season-closeout-build21-REVIEW-ONLY.sql", import.meta.url), "utf8");
const worker = readFileSync(new URL("../supabase/functions/fieldhouse-tournament-results/index.ts", import.meta.url), "utf8");
const weeklyWorker = readFileSync(new URL("../supabase/functions/autonomous-football-results/index.ts", import.meta.url), "utf8");
const fieldhouseOdds = readFileSync(new URL("../supabase/functions/fieldhouse-odds/index.ts", import.meta.url), "utf8");
const atomicPickSave = readFileSync(new URL("../supabase/atomic-pick-save.sql", import.meta.url), "utf8");
const atomicScoring = readFileSync(new URL("../supabase/atomic-week-scoring.sql", import.meta.url), "utf8");
const api = readFileSync(new URL("../native-ios/WarRoom/SupabaseAPI.swift", import.meta.url), "utf8");
const client = readFileSync(new URL("../native-ios/WarRoom/FieldhouseExperience.swift", import.meta.url), "utf8");
const bracketPicker = readFileSync(new URL("../native-ios/WarRoom/FieldhouseBracketPicker.swift", import.meta.url), "utf8");
const content = readFileSync(new URL("../native-ios/WarRoom/ContentView.swift", import.meta.url), "utf8");

function assertHardenedDefiners(source, label) {
  const definers = source.match(/security definer/gi) ?? [];
  const hardened = source.match(/security definer\s+set search_path\s*=\s*''/gi) ?? [];
  assert.equal(hardened.length, definers.length, `${label} must pin every SECURITY DEFINER function to an empty search_path`);
  assert.doesNotMatch(source, /set search_path\s*=\s*(?:'public'|public(?:\s*,\s*pg_temp)?)/i);
}

assertHardenedDefiners(sql, "Fieldhouse postseason SQL");
assertHardenedDefiners(schema, "Fieldhouse weekly schema SQL");
assertHardenedDefiners(liveStandings, "Fieldhouse live standings SQL");

function classifyRegionalField(scores, brassSize = Math.min(4, Math.floor(scores.length / 2))) {
  if (brassSize === 0) return scores.map(() => "no_brass");
  const descending = [...scores].sort((a, b) => b - a);
  const ascending = [...scores].sort((a, b) => a - b);
  const topCutoff = descending[brassSize - 1];
  const bottomCutoff = ascending[brassSize - 1];
  return scores.map((score) => score >= topCutoff ? "championship" : score <= bottomCutoff ? "toilet_bowl" : "no_brass");
}

function finalWinners(rows) {
  const bestPostseason = Math.max(...rows.map((row) => row.postseason));
  const postseasonLeaders = rows.filter((row) => row.postseason === bestPostseason);
  const bestRegular = Math.max(...postseasonLeaders.map((row) => row.regular));
  return postseasonLeaders.filter((row) => row.regular === bestRegular).map((row) => row.id);
}

assert.deepEqual(
  classifyRegionalField([100, 90, 80, 70, 70, 60, 50, 40, 30, 30]),
  ["championship", "championship", "championship", "championship", "championship", "no_brass", "toilet_bowl", "toilet_bowl", "toilet_bowl", "toilet_bowl"],
  "a tie at the top-four boundary must expand the Championship field",
);
assert.deepEqual(
  classifyRegionalField([100, 90, 80, 70, 60, 50, 40, 40, 40, 30, 20]),
  ["championship", "championship", "championship", "championship", "no_brass", "no_brass", "toilet_bowl", "toilet_bowl", "toilet_bowl", "toilet_bowl", "toilet_bowl"],
  "a tie at the bottom-four boundary must expand the Toilet Bowl field",
);
assert.deepEqual(
  classifyRegionalField([50, 50]),
  ["championship", "championship"],
  "a tiny all-tied region must never place one player in both paths",
);
assert.deepEqual(
  finalWinners([
    { id: "first", postseason: 120, regular: 80 },
    { id: "second", postseason: 120, regular: 80 },
    { id: "third", postseason: 120, regular: 79 },
  ]),
  ["first", "second"],
  "postseason points then regular-season points must preserve exact co-champions",
);

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
assert.match(sql, /Official team names must be globally unique/);
assert.match(sql, /Published field cannot contain placeholder teams/);
assert.match(sql, /where prior\.tournament_id=g\.tournament_id and prior\.game_id=g\.first_source_game_id and prior\.round_order=g\.round_order-1/);
assert.match(sql, /Every bracket game must feed exactly one game in the next round/);
assert.match(sql, /Regional bracket paths cannot cross before the Final Four/);
assert.match(sql, /Published field requires every Opening and First Round tip time/);
assert.match(sql, /when s\.correct_picks::numeric\/75>=0\.60 then round\(s\.raw_points\*1\.5\)::integer/);
assert.match(sql, /else round\(s\.raw_points\*0\.5\)::integer/);
assert.match(sql, /fieldhouse_round_entries.*one point per correct official winner/is);
assert.match(sql, /create or replace function public\.record_fieldhouse_tournament_result/);
assert.match(sql, /create or replace function public\.claim_fieldhouse_tournament_odds_refresh/);
assert.match(sql, /greatest\(43200,p_min_age_seconds\)/);
assert.match(sql, /first_moneyline integer/);
assert.match(sql, /second_moneyline integer/);
assert.match(sql, /odds_bookmaker text/);
assert.match(sql, /first_score=p_first_score,second_score=p_second_score/);
assert.match(sql, /Winner does not match the official final score/);
assert.match(sql, /Completed time cannot precede the official tip/);
assert.match(sql, /Every official round tip time must be ready/);
assert.match(sql, /raise exception 'Tournament result is already final'/);
assert.match(sql, /'alreadyRecorded',true/);
assert.match(sql, /create or replace function public\.finalize_fieldhouse_postseason_awards/);
assert.match(sql, /perform private\.certify_league_competitive_season\(v_league_id,v_season_key,v_sport_id\)/);
assert.match(sql, /cs\.sport_id=v_sport_id and cs\.status='official'/);
assert.match(competitive, /create table if not exists public\.league_competitive_seasons/);
assert.match(competitive, /minimum_active_players integer not null default 8/);
assert.match(competitive, /required_participation_percent integer not null default 75/);
assert.match(competitive, /minimum_locked_cards integer not null default 4/);
assert.match(competitive, /\(\(a\.eligible_cards \* 3 \+ 3\) \/ 4\)::integer/);
assert.match(competitive, /coalesce\(m\.is_bot,false\) = false/);
assert.match(competitive, /exists \(\s*select 1 from public\.week_results wr/);
assert.match(competitive, /create trigger league_trophies_require_official_season/);
assert.match(competitive, /Demo league: eight active players at 75 percent participation are required for permanent hardware/);
assert.match(competitive, /perform private\.certify_league_competitive_season\(\s*new\.league_id,\s*new\.season_year,/);
assert.match(competitive, /Competitive-season sport does not match the league/);
assert.match(competitive, /grant select on public\.league_competitive_seasons to authenticated/);
assert.match(competitive, /create table if not exists public\.career_champion_milestones/);
assert.match(competitive, /threshold integer not null check \(threshold in \(3,5,10\)\)/);
assert.match(competitive, /create trigger league_trophies_award_repeat_champion_milestones/);
assert.match(competitive, /career_championship_receipts/);
assert.match(competitive, /refresh_repeat_champion_milestones/);
assert.match(competitive, /Missing evidence is never guessed/);
assert.match(sql, /Permanent Fieldhouse championship receipt cannot be reassigned/);
assert.match(closeout, /create or replace function public\.record_season_closeout/);
assert.match(closeout, /Official competitive-season receipt is missing/);
assert.match(closeout, /fieldhouse_postseason_awards/);
assert.match(competitive, /competitive\.status = 'official'/);
assert.match(competitive, /coalesce\(league\.mode::text,'production'\) = 'production'/);
assert.match(competitive, /case v_threshold when 3 then 'three_ring_circus' when 5 then 'five_star_dynasty' else 'ten_room_terror' end/);
assert.match(competitive, /grant select on public\.career_champion_milestones to authenticated/);
assert.match(api, /careerChampionMilestones\(token: token, userId: userId\)/);
assert.match(api, /rest\/v1\/career_champion_milestones/);
assert.match(sql, /total_points integer generated always as \(bracket_adjusted_points \+ round_points\) stored/);
assert.match(sql, /League members read Fieldhouse postseason totals/);
assert.match(sql, /insert into public\.fieldhouse_postseason_totals/);
assert.match(sql, /rank\(\) over\(\s*partition by m\.fieldhouse_region order by m\.total_points desc\s*\)/);
assert.match(sql, /total_points>=top_cutoff then 'championship'/);
assert.match(sql, /total_points<=bottom_cutoff then 'toilet_bowl'/);
assert.match(sql, /dense_rank\(\) over\(partition by league_id,fieldhouse_region order by total_points desc,regular_points desc\)/);
assert.match(sql, /dense_rank\(\) over\(partition by league_id order by total_points desc,regular_points desc\)/);
assert.doesNotMatch(sql, /order by total_points desc,regular_points desc,user_id/);
assert.match(sql, /create or replace view public\.fieldhouse_profile_trophies/);
assert.match(sql, /with \(security_invoker=true\)/);
assert.match(sql, /fieldhouse_award_recipient_idx/);
assert.match(api, /fieldhouse_profile_trophies/);
assert.match(sql, /create or replace function public\.freeze_fieldhouse_postseason_qualifiers/);
assert.match(sql, /Every published Fieldhouse card must be certified before Selection Sunday/);
assert.match(sql, /from public\.week_cards card[\s\S]*from public\.week_results result/);
assert.match(sql, /card\.card_kind='conference_championship'/);
assert.match(sql, /card\.week_number=league_row\.regular_season_weeks\+1/);
assert.match(sql, /card\.prop_question is null/);
assert.match(sql, /from public\.week_results result\s*where result\.league_id=league\.id/);
assert.match(sql, /else 'no_brass'/);
assert.match(sql, /where p\.tournament_id=p_tournament_id and q\.path='championship'/);
assert.match(sql, /where p\.tournament_id=p_tournament_id and q\.path='toilet_bowl'/);
assert.match(sql, /when 'league_champion' then 'championship'/);
assert.match(sql, /else 'toilet_bowl'/);
assert.match(sql, /with players as \(\s*select tournament_id,league_id,user_id\s*from public\.fieldhouse_postseason_qualifiers/);
assert.match(sql, /'fieldhouse_region_'\|\|lower\(a\.player_region\)/);
assert.match(sql, /a\.awarded_at,[\s\S]*a\.trophy_id as trophy_design_id/);
assert.match(schema, /'fieldhouse_region_east','fieldhouse_region_west'/);
assert.match(schema, /'fieldhouse_region_south','fieldhouse_region_midwest'/);
assert.match(sql, /create or replace function private\.queue_fieldhouse_round_notifications/);
assert.match(sql, /fieldhouse-round-open:/);
assert.match(sql, /fieldhouse-round-lock-1h:/);
assert.match(sql, /fieldhouse_selection_sunday/);
assert.match(sql, /fill your 76-team bracket and make all 12 Opening Round picks/);
assert.match(sql, /v_first_tip is null or v_missing_tips<>0/);
assert.match(sql, /on conflict \(event_key\) do nothing/);
assert.match(sql, /perform private\.queue_fieldhouse_round_notifications\(v_tournament_id,'opening'\)/);
assert.match(sql, /perform private\.queue_fieldhouse_round_notifications\(p_tournament_id,v_next_round\)/);
assert.match(sql, /create or replace function public\.sync_fieldhouse_official_schedule/);
assert.match(sql, /Schedule sync requires the complete 75-game file/);
assert.match(sql, /A started or completed game time cannot be changed/);
assert.match(sql, /perform private\.queue_fieldhouse_round_notifications\(v_tournament_id,v_active_round\)/);
assert.match(sql, /v_first_tip is null or v_missing_tips<>0 then return 0/);
assert.match(sql, /if not exists\([\s\S]*pending\.round_key=g\.round_key[\s\S]*v_next_round:=case g\.round_key/);
assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(p_tournament_id::text,0\)\)/);
assert.match(client, /The bracket graph and every player's permanent picks remain untouched/);
assert.match(schema, /add column if not exists fieldhouse_region text/);
assert.match(schema, /add column if not exists card_kind text not null default 'weekly'/);
assert.match(schema, /check \(card_kind in \('weekly','conference_championship'\)\)/);
assert.match(schema, /add column if not exists fieldhouse_conference text/);
assert.match(schema, /create or replace function public\.publish_fieldhouse_championship_card/);
assert.match(schema, /jsonb_array_length\(p_games\) <> 4/);
for (const conference of ["acc", "big12", "big10", "sec"]) {
  assert.match(schema, new RegExp(`'${conference}'`));
}
assert.match(schema, /p_week_number <> v_regular_weeks \+ 1/);
assert.match(schema, /grant execute on function public\.publish_fieldhouse_championship_card\(uuid,integer,jsonb\) to authenticated/);
assert.match(schema, /'East','West','South','Midwest'/);
assert.match(schema, /create trigger assign_fieldhouse_region_before_insert/);
assert.match(schema, /greatest\(1, coalesce\(l\.games_per_week, 5\)\)/);
assert.match(schema, /sport in \('cfb','nfl','ncaam','ncaaw'\)/);
assert.match(schema, /'tournament_score_sync'/);
assert.match(schema, /'tournament_odds_sync'/);
assert.match(worker, /claim_live_football_score_refresh/);
assert.match(worker, /claim_fieldhouse_tournament_odds_refresh/);
assert.match(worker, /p_min_age_seconds: 43_200/);
assert.match(worker, /tip > now && tip <= now \+ 8 \* 24 \* 60 \* 60_000/);
assert.match(worker, /oddsURL\.searchParams\.set\("markets", "h2h"\)/);
assert.match(worker, /action: "tournament_odds_sync"/);
assert.match(worker, /first_moneyline: Math\.round\(firstPrice\)/);
assert.match(worker, /\.gt\("starts_at", new Date\(\)\.toISOString\(\)\)/);
assert.match(worker, /record_fieldhouse_tournament_result/);
assert.match(worker, /game\.odds_event_id.*row\.id/);
assert.match(worker, /firstScore > secondScore \? firstID : secondID/);
assert.match(worker, /p_first_score: firstScore, p_second_score: secondScore/);
assert.match(worker, /if \(!pollingGames\.length\) continue/);
assert.match(worker, /tip <= now \+ 2 \* 60_000/);
assert.match(worker, /tip >= now - 24 \* 60 \* 60_000/);
assert.match(worker, /hasLiveWindow \? 300 : 900/);
assert.match(worker, /official-tip-missing/);
assert.match(liveStandings, /create or replace function public\.get_fieldhouse_live_board/);
assert.match(liveStandings, /not in \('cbb', 'ncaam', 'ncaaw'\)/);
assert.match(liveStandings, /nullif\(cg\.start_time, ''\)::timestamptz <= now\(\)/);
assert.match(liveStandings, /coalesce\(p\.is_chaos, false\) as is_hellfire/);
assert.match(liveStandings, /grant execute on function public\.get_fieldhouse_live_board\(uuid, integer\) to authenticated/);
assert.match(api, /static func fieldhouseLiveBoard/);
assert.match(api, /static func fieldhousePostseasonQualifier/);
assert.match(client, /FieldhouseLiveStandingsEngine\.projectedTotals/);
assert.match(client, /FieldhouseRoomPickEngine\.counts\(board: board, games: state\.scoringGames\)/);
assert.match(client, /private func persist\(_ event: FieldhousePersistenceEvent\)[\s\S]*let token = try await auth\.validAccessToken\(\)/);
assert.match(client, /FieldhouseStateReconciler\.bracketDraftIsDirty/);
assert.match(client, /FieldhouseStateReconciler\.roundDraftIsDirty/);
assert.match(client, /lastVerifiedState = hydrated/);
assert.match(client, /ROOM PICK COUNTS REFRESHING/);
assert.doesNotMatch(client, /14 \+ index|11 \+ index/);
assert.match(client, /Never allow Foundry preview scores or picks to leak/);
assert.doesNotMatch(client, /postseasonFreshRoundPoints = snapshot\.roundEntries\.reduce/);
assert.match(client, /The generated postseason total is the only score authority used/);
assert.match(client, /else if let scoringCard = snapshot\.scoringCard/);
assert.match(
  client,
  /if auth\.user != nil && auth\.token != nil && !ProcessInfo\.processInfo\.arguments\.contains\("--fieldhouse-preview"\) \{\s*YouView\(onBack:/,
);
assert.match(client, /else \{\s*NavigationStack \{\s*ScrollView \{\s*FieldhouseProfilePage\(state: \$state\)/);
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
assert.match(fieldhouseOdds, /action: "pull_odds"/);
assert.doesNotMatch(fieldhouseOdds, /action: "odds_pull"/);
assert.match(client, /FieldhouseSpreadRule\.isHalfPoint/);
assert.match(client, /"bookmaker": game\.bookmaker \?\? "Fieldhouse"/);
assert.match(weeklyWorker, /away_score:game\.awayScore,home_score:game\.homeScore/);
assert.match(weeklyWorker, /week_number,card_kind,prop_question,prop_option_a,prop_option_b,published_at/);
assert.match(weeklyWorker, /const championship=card\.card_kind==="conference_championship"/);
assert.match(weeklyWorker, /winner:championship\?\(game\.homeScore>game\.awayScore\?"home":"away"\):game\.ats/);
assert.match(weeklyWorker, /p_prop_result:championship\?null/);
assert.match(atomicPickSave, /v_expected_count := case\s+when v_card\.card_kind = 'conference_championship' then 4/);
assert.match(atomicPickSave, /Championship Week does not use a prop/);
assert.match(atomicPickSave, /Hellfire is not available during Championship Week/);
assert.match(atomicScoring, /add column if not exists away_score integer/);
assert.match(atomicScoring, /Championship Week does not use a prop result/);
assert.match(atomicScoring, /x\.away_score,\s*x\.home_score,\s*case when x\.away_score is not null then 'odds_api'/);
assert.ok(client.includes(`TOURNAMENT SCORECARD · \\(state.postseasonScoreFreshnessLabel)`));
assert.match(client, /SERVER UPDATED/);
assert.match(client, /ROUND-BY-ROUND LEDGER/);
assert.match(api, /winner_team_id,first_score,second_score/);
assert.match(api, /first_moneyline,second_moneyline,odds_bookmaker,odds_updated_at/);
assert.match(bracketPicker, /ODDS FOR CONTEXT · PICKS SCORE STRAIGHT-UP/);
assert.match(client, /CERTIFIED ROUND RECEIPT/);
assert.match(client, /ORIGINAL BRACKET/);
assert.match(client, /FRESH ROUND/);
assert.match(client, /func postseasonRoundIsLocked\(_ roundKey: String/);
assert.match(client, /func postseasonRoundScheduleIsReady\(_ roundKey: String/);
assert.match(client, /var postseasonIsActive: Bool \{ officialPostseasonField != nil \}/);
assert.match(client, /func postseasonBracketIsLocked\(at now: Date = Date\(\)\)/);
assert.match(client, /func outstandingPickTaskCount\(at date: Date\) -> Int/);
assert.match(client, /outstandingPickTaskCount: state\.outstandingPickTaskCount\(at: context\.date\)/);
assert.match(client, /if state\.postseasonIsActive \{\s*FieldhouseBracketsPage\(/);
assert.match(client, /\(reviewBracket \|\| reviewRound \|\| reviewChampionship\) \? \.picks/);
assert.match(client, /case "picks":[\s\S]*desk = \.picks/);
assert.match(client, /locked: state\.postseasonRoundIsLocked\(round\)/);
assert.match(client, /locked: state\.postseasonBracketIsLocked\(\)/);
assert.match(bracketPicker, /LIVE ROUND BOARD/);
assert.match(client, /POINTS \+ CHEEVOS · NO BRASS/);
assert.match(client, /A fresh winner card opens and scores every round/);
assert.doesNotMatch(client, /A fresh spread card opens and scores every round/);
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
assert.match(
  client,
  /if auth\.user != nil && auth\.token != nil && !ProcessInfo\.processInfo\.arguments\.contains\("--fieldhouse-preview"\) \{\s*YouView\(onBack:/,
);
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
assert.match(content, /handleNotificationDestination\(_ route: WarRoomNotificationRoute\)[\s\S]*try\? await auth\.validAccessToken\(\)/);
assert.match(client, /!route\.routesToFieldhousePostseasonOverview/);
assert.match(client, /enum FieldhouseCardKind/);
assert.match(client, /case conferenceChampionship = "conference_championship"/);
assert.match(client, /Set\(conferences\) == Set\(FieldhouseChampionshipConference\.allCases\)/);
assert.match(client, /PICK THE CHAMPION · STRAIGHT UP/);
assert.match(client, /Pick each conference champion straight up, assign confidence 4–3–2–1, and mark one Best Bet/);
assert.match(client, /guard cardKind\.allowsHellfire/);
assert.match(client, /if cardKind == \.conferenceChampionship \{\s*window = regularSeasonWeeks \+ 1/);
assert.doesNotMatch(sql, /grant (insert|update|delete).*authenticated/i);
assert.doesNotMatch(sql, /drop table|truncate/i);

console.log("Fieldhouse Build 21 postseason authority PASS — owner field, 75-path validation, one scoreboard total, live client parity, final awards");
