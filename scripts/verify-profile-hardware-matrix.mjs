/**
 * Profile hardware matrix: CFB vs NFL desks, empty season, ID binding.
 * Run: npx tsx scripts/verify-profile-hardware-matrix.mjs
 */

import assert from "node:assert/strict";
import { getProfileHardware } from "../src/lib/profile-hardware.ts";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MIKE = "09544d2b-6eca-4131-a321-c000586c9029";
const MARIA = "131b404e-db8e-4adf-86f4-f78aacf2a5bc";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL ${name}\n       ${e.message || e}`);
  }
}

function titles(playerId, playerName, sportId, leagueTrophies = []) {
  return getProfileHardware({
    playerId,
    playerName,
    leagueTrophies,
    sportId,
    activeLeagueName: sportId === "nfl" ? "Test 2" : "CFB Room",
  }).map((i) => i.title);
}

console.log("\n=== Profile hardware matrix ===\n");

test("1 CFB desk Mike: NFC absent (sport gate)", () => {
  const t = titles(MIKE, "Mike Vance", "cfb");
  assert.equal(t.includes("NFC Championship"), false);
});

test("2 NFL desk Mike: NFC present with zero league trophies", () => {
  const t = titles(MIKE, "Totally Different Nick", "nfl");
  assert.ok(t.includes("NFC Championship"));
});

test("3 NFL wrong UUID named Mike: no NFC", () => {
  const t = titles("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "Mike Vance", "nfl");
  assert.equal(t.includes("NFC Championship"), false);
});

test("4 NFL Maria: AFC present; CFB Maria: AFC absent", () => {
  assert.ok(titles(MARIA, "Renamed", "nfl").includes("AFC Championship"));
  assert.equal(
    titles(MARIA, "Maria", "cfb").includes("AFC Championship"),
    false
  );
});

test("5 IDs do not cross-receive conference hardware", () => {
  const tMike = titles(MIKE, "Maria", "nfl");
  const tMaria = titles(MARIA, "Mike Vance", "nfl");
  assert.ok(tMike.includes("NFC Championship"));
  assert.equal(tMike.includes("AFC Championship"), false);
  assert.ok(tMaria.includes("AFC Championship"));
  assert.equal(tMaria.includes("NFC Championship"), false);
});

test("6 Profile route uses viewed id for hardware (ProfileHeavyDetails)", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const heavy = readFileSync(
    join(root, "src/components/ProfileHeavyDetails.tsx"),
    "utf8"
  );
  assert.match(heavy, /getProfileHardware\(\{[\s\S]*playerId:\s*seed\.id/);
  assert.match(heavy, /<ProfileTrophyCase[\s\S]*items=\{hardware\}/);
  // Trophy case is not gated on storyStarted
  const trophyBeforeSeason = heavy.indexOf("<ProfileTrophyCase");
  const seasonPlot = heavy.indexOf("<ProfileSeasonPlot");
  assert.ok(trophyBeforeSeason > 0 && seasonPlot > trophyBeforeSeason);
  assert.doesNotMatch(
    heavy.slice(trophyBeforeSeason, trophyBeforeSeason + 200),
    /storyStarted/
  );
});

test("7 Profile page resolves route params.id as viewed profile UUID", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const page = readFileSync(
    join(root, "src/app/profile/[id]/page.tsx"),
    "utf8"
  );
  assert.match(page, /const id = typeof params\.id === "string" \? params\.id/);
  assert.match(page, /isSelf = !!\(me && me === id\)/);
});

test("8 Profile empty season has no /picks mission CTA", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const plot = readFileSync(
    join(root, "src/components/ProfileSeasonPlot.tsx"),
    "utf8"
  );
  assert.match(plot, /Your story starts here/);
  assert.match(plot, /This section comes alive after your first scored week/);
  assert.match(plot, /No scored weeks yet\. Your next assignment is waiting on Home/);
  assert.match(plot, /href="\/"/);
  assert.match(plot, /Back to Home/);
  assert.doesNotMatch(plot, /href="\/picks"/);
  assert.doesNotMatch(plot, /Go make your picks/);
  assert.doesNotMatch(plot, /first great Saturday/);
  assert.doesNotMatch(plot, /first great Sunday/);
  assert.doesNotMatch(plot, /Make Picks|Finish Card|Lock Picks/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
