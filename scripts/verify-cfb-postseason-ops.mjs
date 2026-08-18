import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/app/postseason-ops/page.tsx", import.meta.url), "utf8");
const cloud = readFileSync(new URL("../src/lib/postseason/cfb-cloud.ts", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/cfb-postseason-ops-hardening-v1.sql", import.meta.url), "utf8");

assert.match(page, /Commissioner only/);
assert.match(page, /25 Bowl Games/);
assert.match(page, /12-Team CFP Seeds/);
assert.match(page, /Recorded winners cannot be changed/);
assert.match(page, /window\.confirm/);
assert.doesNotMatch(page, /localStorage|sessionStorage/);
assert.match(cloud, /publish_cfb_postseason_slate/);
assert.match(cloud, /cfb_postseason_results/);
assert.match(cloud, /onConflict: "league_id,season_key"/);
assert.match(sql, /first player entry or result/);
assert.match(sql, /new\.league_id is distinct from old\.league_id/);
assert.match(sql, /lower\(trim\(value#>>'\{\}'\)\)/);
assert.match(sql, /revoke all on function public\.validate_cfb_postseason_slate\(\) from public, anon, authenticated/);

console.log("CFB postseason commissioner operations PASS");
