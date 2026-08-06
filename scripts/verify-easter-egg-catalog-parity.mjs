/**
 * P6 — Easter Egg catalog parity (app listEasterEggDefs ↔ approved DB seed ↔ SQL).
 * No network. No production mutations.
 *
 * Usage: node scripts/verify-easter-egg-catalog-parity.mjs
 * Exit 1 on drift.
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

let fails = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL", msg);
    fails += 1;
  } else {
    console.log("PASS", msg);
  }
}

const seedTs = read("src/lib/easter-egg-db-catalog-seed.ts");
const eggsTs = read("src/lib/easter-eggs.ts");
const d02Sql = read("supabase/D-02-record-easter-egg-find-REVIEW-ONLY.sql");

const SEED_RE = /export const APPROVED_EASTER_EGG_CATALOG_IDS = \[([\s\S]*?)\] as const/;
const seedMatch = seedTs.match(SEED_RE);
assert(!!seedMatch, "1 seed file exports APPROVED_EASTER_EGG_CATALOG_IDS");

const seedIds = [...seedMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
assert(seedIds.length === 20, `2 seed has 20 ids (got ${seedIds.length})`);
assert(new Set(seedIds).size === 20, "3 seed ids are unique");

// App catalog: id: "egg_*" inside DISCOVERY_CATALOG, excluding passport via listEasterEggDefs logic
// Parse all id: "egg_..." then ensure stamps are separate
const allEggIds = [...eggsTs.matchAll(/id:\s*"(egg_[^"]+)"/g)].map((m) => m[1]);
const uniqueEggIds = [...new Set(allEggIds)];
assert(uniqueEggIds.length === 20, `4 app egg_* ids count 20 (got ${uniqueEggIds.length})`);

const seedSet = new Set(seedIds);
const appSet = new Set(uniqueEggIds);
const missingInSeed = uniqueEggIds.filter((id) => !seedSet.has(id));
const missingInApp = seedIds.filter((id) => !appSet.has(id));
assert(missingInSeed.length === 0, `5 app ids all in seed (${missingInSeed.join(",") || "ok"})`);
assert(missingInApp.length === 0, `6 seed ids all in app (${missingInApp.join(",") || "ok"})`);

// SQL seed: ('egg_...', true, N)
const sqlIds = [...d02Sql.matchAll(/\('(egg_[^']+)',\s*true,/g)].map((m) => m[1]);
const sqlSet = new Set(sqlIds);
assert(sqlIds.length === 20, `7 D-02 SQL seeds 20 ids (got ${sqlIds.length})`);
assert(sqlSet.size === 20, "8 D-02 SQL seed ids unique");
const missingInSql = seedIds.filter((id) => !sqlSet.has(id));
const extraInSql = sqlIds.filter((id) => !seedSet.has(id));
assert(missingInSql.length === 0, `9 seed ⊆ SQL (${missingInSql.join(",") || "ok"})`);
assert(extraInSql.length === 0, `10 SQL ⊆ seed (${extraInSql.join(",") || "ok"})`);

// listEasterEggDefs filter still excludes passport
assert(eggsTs.includes('d.kind !== "passport"'), "11 listEasterEggDefs excludes passport kind");
assert(eggsTs.includes('d.id.startsWith("egg_")'), "12 listEasterEggDefs requires egg_ prefix");

if (fails > 0) {
  console.error(`\n${fails} parity check(s) failed`);
  process.exit(1);
}
console.log("\nCatalog parity OK: app ↔ seed ↔ D-02 SQL (20 ids)");
