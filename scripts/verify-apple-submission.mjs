import assert from "node:assert/strict";
import fs from "node:fs";
import { objectionableLockerReason } from "../src/lib/content-safety.ts";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const lifecycle = read("src/lib/account-lifecycle-contract.ts");
const route = read("src/app/api/account/delete/route.ts");
const account = read("src/app/account/page.tsx");
const privacy = read("src/app/privacy/page.tsx");
const terms = read("src/app/terms/page.tsx");
const support = read("src/app/support/page.tsx");
const safety = read("src/lib/content-safety.ts");
const locker = read("src/lib/locker-room.ts");
const safetySql = read("supabase/apple-submission-content-safety-v1.sql");

assert.match(lifecycle, /ACCOUNT_LIFECYCLE_PUBLIC = true/, "in-app deletion must be public");
assert.ok(!route.includes("ACCOUNT_DELETION_ENABLED"), "deletion cannot depend on an undeclared production flag");
assert.ok(account.includes("<AccountDeletionPanel"), "Account must expose deletion UI");
assert.match(privacy, /Account → Delete account/, "privacy policy must identify in-app deletion");
assert.match(privacy, /\[REDACTED\]/, "privacy policy must explain retained anonymous history");
assert.match(privacy, /Supabase[\s\S]*Vercel[\s\S]*sports-data[\s\S]*AI service/, "processors must be disclosed");
assert.match(terms, /No wagering or prizes/, "terms must distinguish game mechanics from gambling");
assert.match(support, /Account → Delete account/, "support must direct users to in-app deletion");
assert.match(safety, /objectionableLockerReason/, "client content filter missing");
assert.match(locker, /objectionableLockerReason\(text\)/, "Locker must enforce client safety check");
assert.match(safetySql, /before insert or update of body/, "database must prevent filter bypass");
assert.match(safetySql, /revoke all on function/, "safety trigger function must not be a public RPC");
assert.equal(objectionableLockerReason("good luck this week"), null, "normal competitive talk was blocked");
assert.ok(objectionableLockerReason("K1LL Y0URSELF"), "obfuscated explicit abuse bypassed the client filter");

console.log("Apple submission contract PASS — deletion · privacy · no wagering · UGC safety");
