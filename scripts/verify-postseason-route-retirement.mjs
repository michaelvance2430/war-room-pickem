import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const home = readFileSync(join(root, "src/app/page.tsx"), "utf8");

assert.equal(existsSync(join(root, "src/app/championship/page.tsx")), false);
assert.equal(existsSync(join(root, "src/app/toilet-bowl/page.tsx")), false);
assert.doesNotMatch(home, /href="\/championship"/);
assert.doesNotMatch(home, /href="\/toilet-bowl"/);

console.log("Obsolete browser-built postseason routes are absent and unlinked.");
