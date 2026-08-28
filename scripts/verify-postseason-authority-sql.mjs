import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/postseason-authority-v1.sql", import.meta.url), "utf8");
const closeout = readFileSync(new URL("../src/lib/season-closeout.ts", import.meta.url), "utf8");
const cloud = readFileSync(new URL("../src/lib/postseason/cloud.ts", import.meta.url), "utf8");
const autoTrophies = readFileSync(new URL("../src/lib/auto-trophies.ts", import.meta.url), "utf8");
const standings = readFileSync(new URL("../src/app/standings/page.tsx", import.meta.url), "utf8");
const homeCommand = readFileSync(new URL("../src/components/HomeSeasonCommand.tsx", import.meta.url), "utf8");
const homeCommandLogic = readFileSync(new URL("../src/lib/home-season-command.ts", import.meta.url), "utf8");
for (const fragment of [
  "league_postseason_snapshots",
  "league_postseason_participants",
  "freeze_postseason_snapshot_if_absent",
  "constraint trigger freeze_postseason_after_cut_score",
  "deferrable initially deferred",
  "not coalesce(is_bot,false)",
  "coalesce(m.total_points,0)-coalesce(m.deployment_credit,0)",
  "division_rank",
  "clear_postseason_snapshot_on_season_reset",
]) assert.ok(sql.includes(fragment), `missing postseason authority contract: ${fragment}`);

assert.match(sql, /unique \(league_id, season_key\)/);
assert.match(sql, /field in \('championship','toilet','eliminated'\)/);
assert.match(sql, /toilet_bowl_active/);
assert.match(sql, /least\(16, v_n/);
assert.match(sql, /division_rank<=4/);
assert.match(sql, /division_rank>division_count-4/);
assert.match(sql, /four-conferences-top-4-bottom-4/);
assert.match(sql, /v_conference_count<>4/);
assert.match(sql, /'toilet_cap',16/);
assert.match(sql, /Members read postseason snapshots/);
assert.match(sql, /Members read postseason participants/);
assert.doesNotMatch(sql, /grant (insert|update|delete)/i);
assert.match(closeout, /loadFrozenPostseasonSnapshot/);
assert.doesNotMatch(closeout, /seedChampionship|seedToiletBowl/);
assert.match(closeout, /Durable cut-week snapshot is missing/);
assert.match(cloud, /league_postseason_snapshots/);
assert.match(cloud, /league_postseason_participants/);
assert.match(cloud, /postseason_scorecards/);
assert.match(cloud, /listBracketScoredWeekNumbers/);
assert.match(autoTrophies, /loadFrozenPostseasonSnapshot/);
assert.match(autoTrophies, /listBracketScoredWeekNumbers/);
assert.doesNotMatch(autoTrophies, /seedChampionship|seedToiletBowl/);
assert.match(standings, /loadFrozenPostseasonSnapshot/);
assert.match(standings, /postseasonFieldById/);
assert.match(homeCommand, /loadFrozenPostseasonSnapshot/);
assert.match(homeCommandLogic, /FIELD PENDING AUTHORITY/);
assert.match(closeout, /listBracketScoredWeekNumbers/);

console.log("Postseason authority SQL contract PASS");
