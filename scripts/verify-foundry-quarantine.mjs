/**
 * E0 Foundry boundary contract (static) — superseded by isolation.
 * Run: node scripts/verify-foundry-quarantine.mjs
 * Prefer: node scripts/verify-foundry-isolation.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const q = readFileSync(join(root, "src/lib/foundry-quarantine.ts"), "utf8");
const fp = readFileSync(join(root, "src/lib/foundry-preview.ts"), "utf8");
const chrome = readFileSync(
  join(root, "src/components/FoundrySessionChrome.tsx"),
  "utf8"
);

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

console.log("\n=== E0 Foundry boundary (isolation era) ===\n");

test("Emergency kill switch available but OFF by default", () => {
  assert.match(q, /FOUNDRY_EMERGENCY_QUARANTINE\s*=\s*false/);
});

test("assert chains to isolation", () => {
  assert.match(q, /assertFoundryMutationAllowed/);
});

test("showCommishLabTools respects quarantine + explicit LAB", () => {
  assert.match(fp, /isFoundryQuarantined\(\)/);
  assert.match(fp, /showCommishLabTools[\s\S]*isFoundryQuarantined/);
  assert.match(fp, /isExplicitLabLeague/);
});

test("Sticky session cannot arm under emergency quarantine", () => {
  assert.match(chrome, /isFoundryQuarantined/);
  assert.match(chrome, /removeItem\(STICKY_KEY\)/);
  assert.match(fp, /isFoundrySessionSticky[\s\S]*isFoundryQuarantined/);
});

test("Drama prep blocked without LAB", () => {
  assert.match(fp, /assertFoundryNotQuarantined\("prepareFoundryDramaAfterScore"\)/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
console.log("(Also run: node scripts/verify-foundry-isolation.mjs)\n");
process.exit(failed ? 1 : 0);
