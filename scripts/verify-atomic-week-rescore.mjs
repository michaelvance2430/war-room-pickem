import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/atomic-week-scoring.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const cloud = readFileSync(new URL("../src/lib/cloud.ts", import.meta.url), "utf8");

assert.match(schema, /unique \(league_id, week_number\)/, "one official result row per league week");
assert.match(sql, /pg_advisory_xact_lock/, "concurrent score taps must serialize");
assert.match(sql, /on conflict \(league_id, week_number\) do update/, "manual correction must replace the existing result");
assert.match(sql, /delete from public\.game_results where week_result_id = v_week_result_id/);
assert.match(sql, /Rebuild every derived standing from all officially scored locked slips/);
assert.match(sql, /sum\(p\.total_points\)::integer as total_points/);
assert.match(sql, /array\(\s*select coalesce\(max\(p2\.total_points\), 0\)::integer/s);
assert.match(cloud, /rpc\("score_league_week_atomic"/);
assert.doesNotMatch(
  sql,
  /set total_points\s*=\s*total_points\s*\+/i,
  "authoritative rescoring must never increment an old aggregate"
);

console.log("Atomic week scoring and correction idempotency PASS");
