/**
 * Legacy conference hardware: stable user_id only, global career Trophy Room.
 * Run: npx tsx scripts/verify-legacy-hardware-ids.mjs
 */

import assert from "node:assert/strict";
import {
  getProfileHardware,
  LEGACY_PROFILE_HARDWARE,
} from "../src/lib/profile-hardware.ts";

const MIKE_ID = "09544d2b-6eca-4131-a321-c000586c9029";
const MARIA_ID = "131b404e-db8e-4adf-86f4-f78aacf2a5bc";
const BIG_BALLS_BEN_ID = "fdddf273-2430-42db-9127-b8fa7efc1572";

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

function items(playerId, playerName, sportId) {
  return getProfileHardware({
    playerId,
    playerName,
    leagueTrophies: [],
    sportId,
    activeLeagueName: sportId === "nfl" ? "Test 2" : "CFB Room",
  });
}

function titles(playerId, playerName, sportId) {
  return items(playerId, playerName, sportId).map((i) => i.title);
}

console.log("\n=== Legacy hardware ID binding (global career) ===\n");

test("Big Balls Ben Village Nerd is permanent id-only hardware", () => {
  const seed = LEGACY_PROFILE_HARDWARE.find(
    (s) => s.id === "legacy-bill-ball-ben-nerd-2025"
  );
  assert.ok(seed);
  assert.equal(seed.winnerUserId, BIG_BALLS_BEN_ID);
  assert.equal(seed.kind, "crystal_ball");
  assert.equal(seed.title, "Village Nerd Award");
  assert.ok(
    titles(BIG_BALLS_BEN_ID, "Completely Renamed", "nfl").includes(
      "Village Nerd Award"
    )
  );
  assert.equal(
    titles("wrong-ben-id", "Big Balls Ben", "cfb").includes(
      "Village Nerd Award"
    ),
    false
  );
});

test("Mike NFC seed is id-only · 2026 · NFL", () => {
  const seed = LEGACY_PROFILE_HARDWARE.find(
    (s) => s.id === "legacy-mike-nfc-championship-2026"
  );
  assert.ok(seed);
  assert.equal(seed.winnerUserId, MIKE_ID);
  assert.equal(seed.kind, "division");
  assert.equal(seed.sport, "nfl");
  assert.equal(seed.sportId, "nfl");
  assert.equal(seed.seasonYear, 2026);
  assert.equal(seed.title, "NFC Championship");
});

test("Maria AFC seed is id-only · 2026 · NFL", () => {
  const seed = LEGACY_PROFILE_HARDWARE.find(
    (s) => s.id === "legacy-maria-afc-championship-2026"
  );
  assert.ok(seed);
  assert.equal(seed.winnerUserId, MARIA_ID);
  assert.equal(seed.kind, "division");
  assert.equal(seed.sport, "nfl");
  assert.equal(seed.sportId, "nfl");
  assert.equal(seed.seasonYear, 2026);
  assert.equal(seed.title, "AFC Championship");
});

test("Name alone does not grant conference hardware", () => {
  assert.equal(
    titles("other-uuid-1111", "Mike Vance", "nfl").includes("NFC Championship"),
    false
  );
  assert.equal(
    titles("other-uuid-2222", "Maria", "nfl").includes("AFC Championship"),
    false
  );
});

test("Mike UUID receives NFC on CFB desk and NFL desk", () => {
  for (const sport of ["cfb", "nfl"]) {
    for (const name of ["Totally Different Nick", "Bagz", "x", "Mike"]) {
      const list = items(MIKE_ID, name, sport);
      assert.ok(
        list.some((i) => i.title === "NFC Championship"),
        `expected NFC for sport=${sport} name=${name}`
      );
      const nfc = list.find((i) => i.title === "NFC Championship");
      assert.equal(nfc.seasonYear, 2026);
      assert.equal(nfc.sportId, "nfl");
      assert.equal(
        list.some((i) => i.title === "AFC Championship"),
        false
      );
    }
  }
});

test("Maria UUID receives AFC on CFB desk and NFL desk", () => {
  for (const sport of ["cfb", "nfl"]) {
    for (const name of ["New Nickname", "M", "Maria X", "not-maria"]) {
      const list = items(MARIA_ID, name, sport);
      assert.ok(
        list.some((i) => i.title === "AFC Championship"),
        `expected AFC for sport=${sport} name=${name}`
      );
      const afc = list.find((i) => i.title === "AFC Championship");
      assert.equal(afc.seasonYear, 2026);
      assert.equal(afc.sportId, "nfl");
      assert.equal(
        list.some((i) => i.title === "NFC Championship"),
        false
      );
    }
  }
});

test("Random Mike/Michael/Bagz/Maria UUIDs get no conference hardware", () => {
  for (const sport of ["cfb", "nfl"]) {
    for (const name of ["Mike", "Michael", "Bagz", "Maria", "Mike Vance"]) {
      const t = titles("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", name, sport);
      assert.equal(t.includes("NFC Championship"), false);
      assert.equal(t.includes("AFC Championship"), false);
    }
  }
});

test("Name change does not strip hardware for rightful IDs", () => {
  assert.ok(titles(MIKE_ID, "Old Name", "cfb").includes("NFC Championship"));
  assert.ok(
    titles(MIKE_ID, "New Nickname 2026", "nfl").includes("NFC Championship")
  );
  assert.ok(titles(MARIA_ID, "Old Maria", "cfb").includes("AFC Championship"));
  assert.ok(
    titles(MARIA_ID, "Renamed 2026", "nfl").includes("AFC Championship")
  );
});

test("IDs do not cross-receive each other's conference hardware", () => {
  const tMike = titles(MIKE_ID, "Maria", "cfb");
  const tMaria = titles(MARIA_ID, "Mike Vance", "nfl");
  assert.ok(tMike.includes("NFC Championship"));
  assert.equal(tMike.includes("AFC Championship"), false);
  assert.ok(tMaria.includes("AFC Championship"));
  assert.equal(tMaria.includes("NFC Championship"), false);
});

test("No duplicate conference plaque across sport contexts", () => {
  const a = items(MIKE_ID, "Mike", "cfb").filter(
    (i) => i.title === "NFC Championship"
  );
  const b = items(MIKE_ID, "Mike", "nfl").filter(
    (i) => i.title === "NFC Championship"
  );
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  assert.equal(a[0].id, b[0].id);
  assert.equal(a[0].leagueId, b[0].leagueId);
});

test("kind division is presentation shelf (no conference taxonomy expand)", () => {
  for (const id of [
    "legacy-mike-nfc-championship-2026",
    "legacy-maria-afc-championship-2026",
  ]) {
    const seed = LEGACY_PROFILE_HARDWARE.find((s) => s.id === id);
    assert.equal(seed.kind, "division");
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
