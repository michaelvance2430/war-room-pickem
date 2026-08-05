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

test("No Maria AFC seed until production user_id confirmed", () => {
  const seed = LEGACY_PROFILE_HARDWARE.find(
    (s) => s.id === "legacy-maria-afc-championship-2025"
  );
  assert.equal(seed, undefined);
});

test("No conference aliases for Mike/Maria NFC-AFC in LEGACY_NAME_ALIASES path", () => {
  // Ensure NFC seed never matches by name alone (wrong id)
  const t = titles("other-uuid-1111", "Mike Vance", "nfl");
  assert.equal(t.includes("NFC Championship"), false);
});

test("Mike UUID receives NFC Championship regardless of display name", () => {
  for (const name of ["Totally Different Nick", "Bagz", "x", "Mike"]) {
    const t = titles(MIKE_ID, name, "nfl");
    assert.ok(
      t.includes("NFC Championship"),
      `expected NFC for name=${name}, got ${t.join(",")}`
    );
  }
});

test("Random Mike/Michael/Bagz/Maria UUIDs get no NFC", () => {
  for (const name of ["Mike", "Michael", "Bagz", "Maria", "Mike Vance"]) {
    const t = titles("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", name, "nfl");
    assert.equal(
      t.includes("NFC Championship"),
      false,
      `collision for ${name}`
    );
    assert.equal(t.includes("AFC Championship"), false);
  }
});

test("CFB desk: Mike UUID gets no NFC (sport gate)", () => {
  const t = titles(MIKE_ID, "Mike Vance", "cfb");
  assert.equal(t.includes("NFC Championship"), false);
});

test("Name change does not strip hardware for rightful ID", () => {
  const a = titles(MIKE_ID, "Old Name", "nfl");
  const b = titles(MIKE_ID, "New Nickname 2026", "nfl");
  assert.ok(a.includes("NFC Championship"));
  assert.ok(b.includes("NFC Championship"));
});

test("kind division is presentation shelf (no conference taxonomy expand)", () => {
  const seed = LEGACY_PROFILE_HARDWARE.find(
    (s) => s.id === "legacy-mike-nfc-championship-2025"
  );
  assert.equal(seed.kind, "division");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
