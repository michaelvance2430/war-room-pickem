/**
 * Legacy conference hardware must bind by stable user_id only.
 * Run: npx tsx scripts/verify-legacy-hardware-ids.mjs
 */

import assert from "node:assert/strict";
import {
  getProfileHardware,
  LEGACY_PROFILE_HARDWARE,
} from "../src/lib/profile-hardware.ts";

const MIKE_ID = "09544d2b-6eca-4131-a321-c000586c9029";
const MARIA_ID = "131b404e-db8e-4adf-86f4-f78aacf2a5bc";

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

function titles(playerId, playerName, sportId) {
  return getProfileHardware({
    playerId,
    playerName,
    leagueTrophies: [],
    sportId,
    activeLeagueName: "NFL Room",
  }).map((i) => i.title);
}

console.log("\n=== Legacy hardware ID binding ===\n");

test("Mike NFC seed is id-only with exact UUID", () => {
  const seed = LEGACY_PROFILE_HARDWARE.find(
    (s) => s.id === "legacy-mike-nfc-championship-2025"
  );
  assert.ok(seed);
  assert.equal(seed.winnerUserId, MIKE_ID);
  assert.equal(seed.kind, "division");
  assert.equal(seed.sport, "nfl");
  assert.equal(seed.title, "NFC Championship");
});

test("Maria AFC seed is id-only with exact UUID", () => {
  const seed = LEGACY_PROFILE_HARDWARE.find(
    (s) => s.id === "legacy-maria-afc-championship-2025"
  );
  assert.ok(seed);
  assert.equal(seed.winnerUserId, MARIA_ID);
  assert.equal(seed.kind, "division");
  assert.equal(seed.sport, "nfl");
  assert.equal(seed.title, "AFC Championship");
});

test("Name alone does not grant conference hardware", () => {
  const tMike = titles("other-uuid-1111", "Mike Vance", "nfl");
  assert.equal(tMike.includes("NFC Championship"), false);
  const tMaria = titles("other-uuid-2222", "Maria", "nfl");
  assert.equal(tMaria.includes("AFC Championship"), false);
});

test("Mike UUID receives NFC regardless of display name", () => {
  for (const name of ["Totally Different Nick", "Bagz", "x", "Mike"]) {
    const t = titles(MIKE_ID, name, "nfl");
    assert.ok(
      t.includes("NFC Championship"),
      `expected NFC for name=${name}, got ${t.join(",")}`
    );
    assert.equal(t.includes("AFC Championship"), false);
  }
});

test("Maria UUID receives AFC regardless of display name", () => {
  for (const name of ["New Nickname", "M", "Maria X", "not-maria"]) {
    const t = titles(MARIA_ID, name, "nfl");
    assert.ok(
      t.includes("AFC Championship"),
      `expected AFC for name=${name}, got ${t.join(",")}`
    );
    assert.equal(t.includes("NFC Championship"), false);
  }
});

test("Random Mike/Michael/Bagz/Maria UUIDs get no conference hardware", () => {
  for (const name of ["Mike", "Michael", "Bagz", "Maria", "Mike Vance"]) {
    const t = titles("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", name, "nfl");
    assert.equal(t.includes("NFC Championship"), false, `collision NFC ${name}`);
    assert.equal(t.includes("AFC Championship"), false, `collision AFC ${name}`);
  }
});

test("CFB desk: conference hardware sport-gated off", () => {
  const tMike = titles(MIKE_ID, "Mike Vance", "cfb");
  const tMaria = titles(MARIA_ID, "Maria", "cfb");
  assert.equal(tMike.includes("NFC Championship"), false);
  assert.equal(tMaria.includes("AFC Championship"), false);
});

test("Name change does not strip hardware for rightful IDs", () => {
  assert.ok(titles(MIKE_ID, "Old Name", "nfl").includes("NFC Championship"));
  assert.ok(
    titles(MIKE_ID, "New Nickname 2026", "nfl").includes("NFC Championship")
  );
  assert.ok(titles(MARIA_ID, "Old Maria", "nfl").includes("AFC Championship"));
  assert.ok(
    titles(MARIA_ID, "Renamed 2026", "nfl").includes("AFC Championship")
  );
});

test("IDs do not cross-receive each other's conference hardware", () => {
  const tMike = titles(MIKE_ID, "Maria", "nfl");
  const tMaria = titles(MARIA_ID, "Mike Vance", "nfl");
  assert.ok(tMike.includes("NFC Championship"));
  assert.equal(tMike.includes("AFC Championship"), false);
  assert.ok(tMaria.includes("AFC Championship"));
  assert.equal(tMaria.includes("NFC Championship"), false);
});

test("kind division is presentation shelf (no conference taxonomy expand)", () => {
  for (const id of [
    "legacy-mike-nfc-championship-2025",
    "legacy-maria-afc-championship-2025",
  ]) {
    const seed = LEGACY_PROFILE_HARDWARE.find((s) => s.id === id);
    assert.equal(seed.kind, "division");
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
