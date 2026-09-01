import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const content = readFileSync("native-ios/WarRoom/ContentView.swift", "utf8");
const atomic = readFileSync("supabase/atomic-pick-save.sql", "utf8");
const service = readFileSync("supabase/weapon-service-record.sql", "utf8");

assert.match(content, /pick\?\.isChaos != true,[\s\S]*?\["cfb", "nfl", "cbb"\]/);
assert.match(content, /remaining: max\(0, 2 - tacticalNukesUsed\)/);
assert.match(content, /guard tacticalNukesUsed < 2, pick\?\.isChaos != true/);
assert.match(content, /HELLFIRE CATCH-UP PACKAGE/);
assert.match(content, /This cannot be undone\. No edits\. No rerolls\./);

assert.doesNotMatch(atomic, /if v_pick_id is not null then\s+raise exception 'Authorize a catch-up weapon/);
assert.match(atomic, /lower\(v_league\.sport_id\) not in \('cfb','nfl','cbb'\)/);
assert.match(atomic, /when lower\(v_league\.sport_id\)='cbb' then 'hellfire'/);
assert.match(atomic, /if coalesce\(v_existing_is_chaos, false\) then[\s\S]*?sealed and cannot be edited/);
assert.match(service, /weapon_type = 'hellfire' and sport_id = 'cbb' and phase in \('regular_season','postseason'\)/);

console.log("Weapon reopen rule PASS — Nuclear, JDAM, and Hellfire remain available before lock and reseal replacements");
