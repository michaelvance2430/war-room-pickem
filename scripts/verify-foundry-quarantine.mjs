/**
 * E0 Foundry quarantine contract (static).
 * Run: node scripts/verify-foundry-quarantine.mjs
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

console.log("\n=== E0 Foundry quarantine ===\n");

test("Kill switch is ON", () => {
  assert.match(q, /FOUNDRY_EMERGENCY_QUARANTINE\s*=\s*true/);
});

test("showCommishLabTools respects quarantine", () => {
  assert.match(fp, /isFoundryQuarantined\(\)/);
  assert.match(fp, /showCommishLabTools[\s\S]*isFoundryQuarantined/);
});

test("Sticky session cannot arm under quarantine", () => {
  assert.match(chrome, /isFoundryQuarantined/);
  assert.match(chrome, /removeItem\(STICKY_KEY\)/);
  assert.match(fp, /isFoundrySessionSticky[\s\S]*isFoundryQuarantined/);
});

test("Drama prep blocked", () => {
  assert.match(fp, /assertFoundryNotQuarantined\("prepareFoundryDramaAfterScore"\)/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
