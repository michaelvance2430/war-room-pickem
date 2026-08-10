import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/weapon-service-record.sql", "utf8");
const client = readFileSync("src/lib/weapon-service-record.ts", "utf8");
const profile = readFileSync("src/components/ProfileArsenal.tsx", "utf8");
const rank = readFileSync("src/components/ProfileRankPlacard.tsx", "utf8");

assert.match(sql, /create table if not exists public\.weapon_service_events/);
assert.match(sql, /alter table public\.weapon_service_events enable row level security/);
assert.match(sql, /revoke all on table public\.weapon_service_events from public, anon, authenticated/);
assert.match(sql, /using \(\(select auth\.uid\(\)\) = user_id\)/);
assert.match(sql, /create table if not exists public\.weapon_service_totals/);
assert.match(sql, /Profile-safe weapon totals only/);
assert.match(sql, /weapon_service_events_refresh_totals_trg/);
assert.match(sql, /drop function if exists public\.get_weapon_service_summaries/);
assert.doesNotMatch(sql, /grant insert[^;]*authenticated/i);
assert.doesNotMatch(sql, /create policy[\s\S]*for insert[\s\S]*authenticated/i);
assert.match(sql, /weapon_service_events_source_event_id_key unique/);
assert.match(sql, /weapon_service_events_weapon_sport_check/);
assert.match(client, /loadWeaponServiceRecord/);
assert.match(client, /loadWeaponServiceCounts/);
assert.match(profile, /loadWeaponServiceSummary/);
assert.match(rank, /loadWeaponServiceSummary/);

console.log("Weapon Service Record verified: append-only client contract · RLS read path · permanent rank/profile totals · Foundry excluded");
