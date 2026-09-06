import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const guide = read("docs/BUILD-21-DATABASE-RELEASE-ORDER.md");
const preflight = read("supabase/build21-production-preflight-SELECT-ONLY.sql");

const ordered = [
  "fieldhouse-build21-schema-REVIEW-ONLY.sql",
  "competitive-league-qualification-build21-REVIEW-ONLY.sql",
  "fieldhouse-postseason-build21-REVIEW-ONLY.sql",
  "nfl-jdam-scoring-build21-REVIEW-ONLY.sql",
  "nfl-postseason-awards-foundation-build21-REVIEW-ONLY.sql",
  "multi-sport-season-closeout-build21-REVIEW-ONLY.sql",
  "nfl-postseason-closeout-build21-REVIEW-ONLY.sql",
  "fieldhouse-live-standings-build21-REVIEW-ONLY.sql",
  "sport-season-windows-build21-REVIEW-ONLY.sql",
  "sport-season-window-seeds-build21-REVIEW-ONLY.sql",
  "sport-schedule-usage-action-build21-REVIEW-ONLY.sql",
  "sport-schedule-worker-auth-build21-REVIEW-ONLY.sql",
  "sport-schedule-sync-cron-build21-REVIEW-ONLY.sql",
  "sport-schedule-sync-postverify-build21-SELECT-ONLY.sql",
];

let cursor = -1;
for (const file of ordered) {
  const next = guide.indexOf(file);
  assert.ok(next > cursor, `${file} is missing or out of order`);
  cursor = next;
}

assert.match(guide, /tournament cron is deliberately excluded/i);
assert.match(guide, /sport-schedule authority extension/i);
assert.match(guide, /not applied to production/i);
assert.match(guide, /one provider[\s\S]*`\/events` request per active sport, not per[\s\S]*league/i);
assert.match(guide, /invoke it once manually/i);
assert.match(guide, /nonmember and anonymous user cannot/i);
assert.match(guide, /seven qualifying humans remains Demo; a room with eight becomes Official/i);
assert.match(guide, /Bots never count/);
assert.doesNotMatch(preflight, /\b(insert|update|delete|alter|create|drop|truncate|grant|revoke)\b/i);
assert.match(preflight, /required baseline tables exist/);
assert.match(preflight, /legacy NFL JDAM receipts are absent/);
assert.match(preflight, /live league sport values fit Build 21/);
assert.match(preflight, /lower\(coalesce\(sport_id,''\)\)='cbb'/);
assert.match(preflight, /coalesce\(mode::text,'production'\)='foundry'/);
assert.match(preflight, /legacy cbb is permitted only in Foundry/);
assert.match(preflight, /league trophies have supported types/);

console.log("Build 21 database release order PASS — prerequisites, ordered schemas, SELECT-only preflight, and cron hold are explicit");
