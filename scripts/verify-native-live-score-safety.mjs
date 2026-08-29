import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const content = read("native-ios/WarRoom/ContentView.swift");
const api = read("native-ios/WarRoom/SupabaseAPI.swift");
const scores = read("supabase/functions/football-scores/index.ts");

assert.match(
  content,
  /CommissionerCommandCenterView\(membership: membership, standings: standings, submittedUserIds: visibleSubmittedUserIds\)/,
  "the commissioner home control must open Commissioner Command"
);
assert.match(content, /SYNC LIVE \/ FINAL SCORES/);
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
assert.match(scores, /Commissioner or deputy required/);
assert.match(scores, /membership\?\.role === "commissioner"/);
assert.match(scores, /membership\?\.is_deputy === true/);
assert.doesNotMatch(scores, /score_league_week_atomic|process_foundry_week/);

console.log("Native live-score safety PASS — authenticated sync, manual review, and explicit certification enforced");
