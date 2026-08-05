/**
 * Trophy inspect interaction contract (static).
 * Run: node scripts/verify-trophy-lightbox-lock.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lb = readFileSync(join(root, "src/components/TrophyLightbox.tsx"), "utf8");

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

console.log("\n=== TrophyLightbox scroll-lock contract ===\n");

test("Uses named acquireBodyLock (not raw overflow alone)", () => {
  assert.match(lb, /acquireBodyLock/);
  assert.match(lb, /from "@\/lib\/smooth"/);
  assert.doesNotMatch(
    lb,
    /document\.body\.style\.overflow\s*=\s*["']hidden["']/
  );
});

test("Escape closes via stable onClose ref", () => {
  assert.match(lb, /onCloseRef/);
  assert.match(lb, /e\.key === ["']Escape["']/);
  assert.match(lb, /window\.addEventListener\(["']keydown["']/);
});

test("Backdrop and Close dismiss", () => {
  assert.match(lb, /onClick=\{\(\) => onCloseRef\.current\(\)\}/);
  assert.match(lb, />\s*Close\s*</);
});

test("Reduced motion respected for art animate", () => {
  assert.match(lb, /prefers-reduced-motion:\s*reduce/);
  assert.match(lb, /animateArt/);
  assert.match(lb, /animate=\{animateArt\}/);
});

test("Dialog semantics + overscroll contain", () => {
  assert.match(lb, /role="dialog"/);
  assert.match(lb, /aria-modal="true"/);
  assert.match(lb, /overscroll-contain/);
  assert.match(lb, /data-trophy-lightbox/);
});

test("Does not mutate trophy data on view", () => {
  assert.doesNotMatch(lb, /awardTrophy|insert\(|\.update\(|league_trophies/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
