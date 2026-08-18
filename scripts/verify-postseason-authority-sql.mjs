import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/postseason-authority-v1.sql", import.meta.url), "utf8");
const closeout = readFileSync(new URL("../src/lib/season-closeout.ts", import.meta.url), "utf8");
const cloud = readFileSync(new URL("../src/lib/postseason/cloud.ts", import.meta.url), "utf8");
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
assert.match(sql, /Members read postseason snapshots/);
assert.match(sql, /Members read postseason participants/);
assert.doesNotMatch(sql, /grant (insert|update|delete)/i);
assert.match(closeout, /loadFrozenPostseasonSnapshot/);
assert.doesNotMatch(closeout, /seedChampionship|seedToiletBowl/);
assert.match(closeout, /Durable cut-week snapshot is missing/);
assert.match(cloud, /league_postseason_snapshots/);
assert.match(cloud, /league_postseason_participants/);

console.log("Postseason authority SQL contract PASS");
