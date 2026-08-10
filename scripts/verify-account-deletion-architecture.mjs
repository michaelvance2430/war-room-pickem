import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`[account-deletion-architecture] ${message}`);
}

const design = read("docs/ACCOUNT-DELETION-ARCHITECTURE.md");
const preflight = read("supabase/review-only/account-deletion/00-preflight-SELECT-ONLY.sql");
const lifecycleSchema = read("supabase/review-only/account-deletion/01-lifecycle-schema-REVIEW-ONLY.sql");
const lifecycle = read("src/lib/account-lifecycle-contract.ts");

assert(design.includes("No production mutation is authorized"), "review-only boundary missing");
assert(design.includes("Pass the Keys"), "commissioner transfer gate missing");
assert(design.includes("is_active_account()"), "revoked-token authorization gate missing");
assert(design.includes("replays the pre-deletion token"), "old access-token proof missing");
assert(design.includes("idempotent"), "retry safety missing");
assert(design.includes("[REDACTED]"), "historical redaction missing");
assert(preflight.includes("pg_constraint"), "foreign-key inventory missing");
assert(preflight.includes("information_schema.columns"), "identity-column inventory missing");
assert(preflight.includes("storage.objects"), "storage inventory missing");
assert(preflight.includes("pg_policies"), "RLS inventory missing");
assert(preflight.includes("pg_get_functiondef"), "RPC authorization inventory missing");
assert(!/\b(insert|update|delete|alter|create|drop|truncate|grant|revoke)\b/i.test(
  preflight.replace(/^\s*--.*$/gm, "")
), "preflight must remain SELECT-only");
assert(lifecycle.includes("ACCOUNT_LIFECYCLE_PUBLIC = false"), "public deletion gate opened early");
assert(lifecycleSchema.includes("drop constraint if exists profiles_id_fkey"), "Auth cascade is not detached");
assert(lifecycleSchema.includes("deletion_in_progress"), "fail-closed intermediate state missing");
assert(lifecycleSchema.includes("private.account_deletion_operations"), "server-only operation ledger missing");
assert(lifecycleSchema.includes("security definer"), "active-account RLS helper missing");
assert(lifecycleSchema.includes("set search_path = ''"), "privileged helper search path is unsafe");
assert(lifecycleSchema.includes("where p.id = (select auth.uid())"), "active-account helper does not bind the caller identity");
assert(lifecycleSchema.includes("revoke all on function private.is_active_account()"), "active-account helper remains public");

console.log("[account-deletion-architecture] PASS — tombstone identity, inventory, revocation, and Foundry gates verified");
