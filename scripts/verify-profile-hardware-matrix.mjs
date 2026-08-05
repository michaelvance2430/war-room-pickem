/**
 * Profile hardware matrix: global career Trophy Room + empty season.
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

function list(playerId, playerName, sportId, leagueTrophies = [], extra = {}) {
  return getProfileHardware({
    playerId,
    playerName,
    leagueTrophies,
    sportId,
    activeLeagueName: sportId === "nfl" ? "Test 2" : "CFB Room",
    ...extra,
  });
}

function titles(...args) {
  return list(...args).map((i) => i.title);
}

console.log("\n=== Profile hardware matrix (global career) ===\n");

test("1 CFB desk Mike: NFC 2026 visible · NFL identity retained", () => {
  const rows = list(MIKE, "Mike Vance", "cfb");
  const nfc = rows.find((i) => i.title === "NFC Championship");
  assert.ok(nfc);
  assert.equal(nfc.seasonYear, 2026);
  assert.equal(nfc.sportId, "nfl");
});

test("2 NFL desk Mike: NFC 2026 visible with zero league trophies", () => {
  const rows = list(MIKE, "Totally Different Nick", "nfl");
  const nfc = rows.find((i) => i.title === "NFC Championship");
  assert.ok(nfc);
  assert.equal(nfc.seasonYear, 2026);
  assert.equal(nfc.sportId, "nfl");
});

test("3 NFL wrong UUID named Mike: no NFC", () => {
  assert.equal(
    titles("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "Mike Vance", "nfl").includes(
      "NFC Championship"
    ),
    false
  );
});

test("4 Maria AFC 2026 on CFB and NFL desks", () => {
  for (const sport of ["cfb", "nfl"]) {
    const afc = list(MARIA, "Renamed", sport).find(
      (i) => i.title === "AFC Championship"
    );
    assert.ok(afc, `AFC missing on ${sport}`);
    assert.equal(afc.seasonYear, 2026);
    assert.equal(afc.sportId, "nfl");
  }
});

test("5 Mixed-sport history can display together", () => {
  // Mike UUID grants NFC (NFL); name Kahmann grants CFB championship fill-in
  const rows = list(MIKE, "Kahmann", "cfb");
  assert.ok(rows.some((i) => i.title === "NFC Championship" && i.sportId === "nfl"));
  assert.ok(rows.some((i) => i.title === "Championship" && i.sportId === "cfb"));
});

test("6 activeSportOnly still filters for standings-style use", () => {
  const cfbOnly = list(MIKE, "Kahmann", "cfb", [], { activeSportOnly: true });
  assert.equal(
    cfbOnly.some((i) => i.title === "NFC Championship"),
    false,
    "standings flair must not pull NFL conference onto CFB board"
  );
  assert.ok(cfbOnly.some((i) => i.sportId === "cfb"));
});

test("7 Profile route uses viewed id; trophy case independent of empty season", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const heavy = readFileSync(
    join(root, "src/components/ProfileHeavyDetails.tsx"),
    "utf8"
  );
  assert.match(heavy, /getProfileHardware\(\{[\s\S]*playerId:\s*seed\.id/);
  assert.match(heavy, /<ProfileTrophyCase[\s\S]*items=\{hardware\}/);
  const trophyBeforeSeason = heavy.indexOf("<ProfileTrophyCase");
  const seasonPlot = heavy.indexOf("<ProfileSeasonPlot");
  assert.ok(trophyBeforeSeason > 0 && seasonPlot > trophyBeforeSeason);
  assert.doesNotMatch(
    heavy.slice(trophyBeforeSeason, trophyBeforeSeason + 200),
    /storyStarted/
  );

  const page = readFileSync(
    join(root, "src/app/profile/[id]/page.tsx"),
    "utf8"
  );
  assert.match(page, /const id = typeof params\.id === "string" \? params\.id/);
});

test("8 Profile empty season has no /picks mission CTA", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const plot = readFileSync(
    join(root, "src/components/ProfileSeasonPlot.tsx"),
    "utf8"
  );
  assert.match(plot, /Your story starts here/);
  assert.match(plot, /href="\/"/);
  assert.match(plot, /Back to Home/);
  assert.doesNotMatch(plot, /href="\/picks"/);
  assert.doesNotMatch(plot, /Go make your picks/);
});

test("9 No duplicate NFC when switching active sport context", () => {
  assert.equal(
    list(MIKE, "Mike", "cfb").filter((i) => i.title === "NFC Championship")
      .length,
    1
  );
  assert.equal(
    list(MIKE, "Mike", "nfl").filter((i) => i.title === "NFC Championship")
      .length,
    1
  );
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
