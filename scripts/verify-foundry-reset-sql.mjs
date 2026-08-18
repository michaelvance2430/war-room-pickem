import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(join(root, "supabase/foundry-reset-certification-v1.sql"), "utf8");

for (const table of [
  "gazette_editions",
  "postseason_scorecards",
  "cfb_postseason_results",
  "cfb_postseason_entries",
  "cfb_postseason_slates",
  "week_results",
  "picks",
  "locker_messages",
]) assert.match(sql, new RegExp(`delete from public\\.${table}`));

assert.match(sql, /mode = 'foundry'/);
assert.match(sql, /Human roster detected/);
assert.match(sql, /run_number = public\.foundry_season_lifecycle\.run_number \+ 1/);
assert.match(sql, /stage = 'season_opening'/);
assert.match(sql, /week_number = 0/);
assert.match(sql, /seed_bot_picks_for_week\(p_league_id, 0\)/);

console.log("Foundry reset contract verified: isolation, full cleanup, opening lifecycle, Week 0 reseed.");
