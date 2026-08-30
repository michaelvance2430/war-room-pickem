import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const content = read("native-ios/WarRoom/ContentView.swift");
const api = read("native-ios/WarRoom/SupabaseAPI.swift");
const scores = read("supabase/functions/football-scores/index.ts");
const cacheSchema = read("supabase/live-football-score-cache.sql");
const auth = read("native-ios/WarRoom/AuthStore.swift");
const notifications = read("native-ios/WarRoom/WarRoomNotifications.swift");
const foundry = read("native-ios/WarRoom/FoundryView.swift");

assert.match(
  content,
  /CommissionerCommandCenterView\(membership: membership, standings: standings, submittedUserIds: visibleSubmittedUserIds\)/,
  "the commissioner home control must open Commissioner Command"
);
assert.match(content, /SYNC LIVE \/ FINAL SCORES/);
assert.match(content, /HomeLivePlayerScorecard/);
assert.match(content, /YOUR LIVE SCORECARD/);
assert.match(content, /OPEN BOARD \+ SCORES/);
assert.match(content, /BoardGamePanel\(game: game, picks: picks, score: scores\[game\.id\]/);
assert.match(content, /SupabaseAPI\.footballScores\(token: token, leagueId: league\.leagueId, sportId: league\.leagues\.sportId\)/);
assert.ok(content.includes('WEEKLY PROP · \\(card.propPoints) POINTS'));
assert.match(content, /LIVE · PROJECTED STANDINGS/);
assert.match(content, /SEASON SCORECARDS/);
assert.match(content, /RegularSeasonScorecardView/);
assert.match(content, /try\? await Task\.sleep\(for: \.seconds\(30\)\)/);
assert.match(content, /liveProjectionByUser/);
assert.match(content, /ATS \+ BEST BET INCLUDED · PROP POSTS WHEN THE WEEK IS CERTIFIED/);
assert.match(content, /SCORE FEED STALE · RETRYING/);
assert.ok(content.includes('Live Week \\(membership.leagues.currentWeek) scoreboard. Open the Board.'));
assert.match(content, /while !Task\.isCancelled[\s\S]*homeScorePollingNeeded[\s\S]*refreshHomeScores\(\)/);
assert.match(content, /takePendingDestination\(\)/);
assert.match(content, /handleNotificationDestination\(destination\)/);
assert.match(content, /CERTIFY OFFICIAL RESULTS/);
assert.match(content, /Review every cover and the prop before certifying/);
assert.match(content, /guard complete, let token = auth\.token, let propResult else \{ return \}/);
assert.match(content, /if !manuallySetResults\.contains\(game\.id\)/);
assert.doesNotMatch(content, /Human roster detected/);
assert.doesNotMatch(content, /SCORING LOCKED · FOUNDRY SIMULATION REQUIRED/);

assert.match(api, /functions\/v1\/football-scores/);
assert.ok(api.includes('request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")'));
assert.match(api, /foundryMode \? "process_foundry_week" : "score_league_week_atomic"/);

assert.match(scores, /if \(!authorization\.startsWith\("Bearer "\)\)/);
assert.match(scores, /League membership required/);
assert.match(scores, /if \(!membership \|\| !user\?\.id\)/);
assert.match(scores, /claim_live_football_score_refresh/);
assert.match(scores, /platform_odds_api_usage/);
assert.match(scores, /cacheHit: true/);
assert.doesNotMatch(scores, /score_league_week_atomic|process_foundry_week/);
assert.doesNotMatch(scores, /memberships[^\n]*(PATCH|DELETE)|week_results[^\n]*(POST|PATCH|DELETE)/);

assert.match(cacheSchema, /enable row level security/);
assert.match(cacheSchema, /revoke all on public\.live_football_score_cache from anon, authenticated/);
assert.match(cacheSchema, /grant execute on function public\.claim_live_football_score_refresh\(text, int\) to service_role/);
assert.doesNotMatch(cacheSchema, /drop table|truncate|delete from|update public\.memberships/);

assert.match(auth, /validAccessToken\(minimumValidity:/);
assert.match(auth, /maintainSession\(\)/);
assert.match(auth, /refreshCredentialIsInvalid/);
assert.match(notifications, /launchOptions\?\[\.remoteNotification\]/);
assert.match(notifications, /savePendingDestination\(destination\)/);
assert.match(notifications, /takePendingDestination\(\)/);
assert.doesNotMatch(foundry, /"[^"]*(?:bot lab|bot card|bot roster|bot league|bot slips)[^"]*"/i);

const scorecardFunction = api.match(/static func regularSeasonScorecards[\s\S]*?\n    \}/)?.[0] ?? "";
assert.match(scorecardFunction, /async let cards: \[WeekCard\]/);
assert.doesNotMatch(scorecardFunction, /weekCard\(token:/);

console.log("Native live-score safety PASS — authenticated sync, manual review, and explicit certification enforced");
