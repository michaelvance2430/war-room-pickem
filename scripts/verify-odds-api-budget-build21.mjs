import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const clientScores = read("supabase/functions/football-scores/index.ts");
const autonomousScores = read("supabase/functions/autonomous-football-results/index.ts");
const tournamentScores = read("supabase/functions/fieldhouse-tournament-results/index.ts");
const nativeBoard = read("native-ios/WarRoom/ContentView.swift");

assert.match(clientScores, /liveWindow\) return \{ minAgeSeconds: 300, daysFrom: 1 \}/);
assert.match(autonomousScores, /liveWindow\)return \{minAgeSeconds:300,daysFrom:1\}/);
assert.match(tournamentScores, /hasLiveWindow \? 300 : 900/);

for (const source of [clientScores, autonomousScores, tournamentScores]) {
  assert.match(source, /claim_live_football_score_refresh/);
}

assert.match(nativeBoard, /Task\.sleep\(for: \.seconds\(15\)\)/);
assert.match(nativeBoard, /BOARD POSITION HELD/);

console.log("Build 21 Odds API budget PASS - provider score pulls are capped at five minutes per active sport while the native football board keeps its 15-second cache refresh");
