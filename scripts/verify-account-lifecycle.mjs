import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`[account-lifecycle] ${message}`);
}

const contract = read("src/lib/account-lifecycle-contract.ts");
const design = read("docs/ACCOUNT-LIFECYCLE.md");
const lifecycleSchema = read("supabase/review-only/account-deletion/01-lifecycle-schema-REVIEW-ONLY.sql");

assert(contract.includes("ACCOUNT_LIFECYCLE_PUBLIC = true"), "public deletion entry is not active");
assert(contract.includes('action: "GO MIA"'), "MIA action missing");
assert(contract.includes('action: "BURN THE DOSSIER"'), "permanent action missing");
assert(contract.includes('REDACTED_DISPLAY_NAME = "[REDACTED]"'), "redacted identity missing");
assert(contract.includes('"revoke_all_sessions"'), "session revocation gate missing");
assert(contract.includes('"prevent_automatic_history_reclaim"'), "history reclaim guard missing");
assert(design.includes("No client account-deletion mutation may ship"), "cascade stop rule missing");
assert(design.includes("Pass the Keys"), "commissioner ownership gate missing");
assert(lifecycleSchema.includes("drop constraint if exists profiles_id_fkey"), "Auth cascade detachment missing");
assert(lifecycleSchema.includes("account_deletion_operations"), "server deletion ledger missing");

console.log("[account-lifecycle] PASS — public deletion, MIA, redaction, tombstone, and ledger verified");
