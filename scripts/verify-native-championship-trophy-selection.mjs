import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = readFileSync(join(root, "native-ios/WarRoom/SupabaseAPI.swift"), "utf8");
const content = readFileSync(join(root, "native-ios/WarRoom/ContentView.swift"), "utf8");
const sql = readFileSync(join(root, "supabase/select-championship-trophy-rpc.sql"), "utf8");

assert.match(api, /rest\/v1\/rpc\/select_championship_trophy/);
assert.match(api, /let saved = try JSONDecoder\(\)\.decode\(String\.self, from: data\)/);
assert.match(api, /guard saved == trophyId/);
assert.doesNotMatch(api, /championship_trophy_id"\: trophyId/);
assert.match(content, /if let trophy = pendingTrophy \{\s*Button\("LOCK THE HARDWARE"\) \{ Task \{ await save\(trophy\) \} \}/);
assert.match(content, /private func save\(_ trophy: TrophyDesign\) async/);
assert.doesNotMatch(content, /savePending\(\)/);

assert.match(sql, /security definer/i);
assert.match(sql, /l\.commissioner_id = v_uid/);
assert.match(sql, /returning championship_trophy_id into v_saved/);
assert.match(sql, /revoke all on function public\.select_championship_trophy/);
assert.match(sql, /grant execute .* authenticated/is);

console.log("Native championship trophy selection verified: authorized RPC and saved-value confirmation");
