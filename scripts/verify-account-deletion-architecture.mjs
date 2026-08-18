import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`[account-deletion-architecture] ${message}`);
}

const design = read("docs/ACCOUNT-DELETION-ARCHITECTURE.md");
const preflight = read("supabase/review-only/account-deletion/00-preflight-SELECT-ONLY.sql");
const driftBaseline = read("supabase/review-only/account-deletion/00b-disposable-production-drift-baseline.sql");
const lifecycleSchema = read("supabase/review-only/account-deletion/01-lifecycle-schema-REVIEW-ONLY.sql");
const postseasonFks = read("supabase/review-only/account-deletion/01b-postseason-tombstone-fks-REVIEW-ONLY.sql");
const disposableHarness = read("supabase/review-only/account-deletion/02-disposable-test-harness.sql");
const policyOverlay = read("supabase/review-only/account-deletion/03-active-account-policy-overlay-REVIEW-ONLY.sql");
const serverRpcs = read("supabase/review-only/account-deletion/04-server-rpcs-REVIEW-ONLY.sql");
const serverRpcHarness = read("supabase/review-only/account-deletion/05-server-rpc-test-harness.sql");
const postseasonDeleteHarness = read("supabase/review-only/account-deletion/06-postseason-auth-delete-test-harness.sql");
const productionPostverify = read("supabase/review-only/account-deletion/07-production-postverify-SELECT-ONLY.sql");
const lifecycle = read("src/lib/account-lifecycle-contract.ts");

assert(design.includes("Production foundation applied"), "production lifecycle status is stale");
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
assert(driftBaseline.includes("birthday_mmdd"), "production profile drift is missing from disposable baseline");
assert(driftBaseline.includes("display_name_override"), "production membership alias drift is missing from disposable baseline");
assert(!/\b(insert|update|delete|alter|create|drop|truncate|grant|revoke)\b/i.test(
  preflight.replace(/^\s*--.*$/gm, "")
), "preflight must remain SELECT-only");
assert(lifecycle.includes("ACCOUNT_LIFECYCLE_PUBLIC = false"), "public deletion gate opened early");
assert(lifecycleSchema.includes("drop constraint if exists profiles_id_fkey"), "Auth cascade is not detached");
assert(lifecycleSchema.includes("deletion_in_progress"), "fail-closed intermediate state missing");
assert(lifecycleSchema.includes("private.account_deletion_operations"), "server-only operation ledger missing");
assert(lifecycleSchema.includes('policy "No client access"'), "private operation ledger lacks deny policy");
assert(lifecycleSchema.includes("security definer"), "active-account RLS helper missing");
assert(lifecycleSchema.includes("set search_path = ''"), "privileged helper search path is unsafe");
assert(lifecycleSchema.includes("where p.id = (select auth.uid())"), "active-account helper does not bind the caller identity");
assert(lifecycleSchema.includes("revoke all on function private.is_active_account()"), "active-account helper remains public");
assert(/cfb_postseason_entries_user_id_fkey[\s\S]*references public\.profiles\(id\) on delete restrict/i.test(postseasonFks), "CFB postseason entry history still follows Auth deletion");
assert(/postseason_scorecards_user_id_fkey[\s\S]*references public\.profiles\(id\) on delete restrict/i.test(postseasonFks), "postseason scorecard history still follows Auth deletion");
assert(disposableHarness.includes("set local role authenticated"), "browser lifecycle attack is not tested");
assert(disposableHarness.includes("private.is_active_account()"), "revoked-token active gate is not tested");
assert(disposableHarness.includes("competitive pick receipt was lost"), "pick preservation is not tested");
assert(disposableHarness.includes("historical standings row was lost"), "standings preservation is not tested");
assert(disposableHarness.includes("rollback;"), "disposable fixtures are not rolled back");
assert(policyOverlay.includes("as restrictive"), "active-account policy is not mandatory");
assert(policyOverlay.includes("c.relrowsecurity"), "policy overlay is not limited to RLS tables");
assert(policyOverlay.includes("on storage.objects"), "storage access is not gated after deletion");
assert(disposableHarness.includes("revoked JWT changed a protected row"), "old-JWT RLS mutation is not tested");
assert(serverRpcs.includes("private.redact_jsonb_text"), "Gazette JSON redaction is missing");
assert(serverRpcs.includes("to service_role"), "deletion RPCs are not service-role-only");
assert(serverRpcs.includes("blocked_commissioner"), "server commissioner gate is missing");
assert(serverRpcs.includes("deleting_auth_user"), "Auth deletion handoff stage is missing");
assert(serverRpcs.includes("delete from public.player_blocks"), "player blocks are missing from private-data deletion");
assert(serverRpcs.includes("delete from public.player_reports where reporter_id"), "reports authored by the user are not deleted");
assert(serverRpcs.includes("set resolved_by = null"), "staff resolution identity is not detached");
assert(serverRpcs.includes("app.bypass_birthday_lock"), "permanent redaction cannot clear a hard-locked birthday");
assert(preflight.includes("'reporter_id', 'reported_id', 'blocked_id', 'resolved_by'"), "player safety identity columns are missing from preflight");
assert(serverRpcHarness.includes("authenticated role executed service-only deletion RPC"), "RPC privilege boundary is untested");
assert(serverRpcHarness.includes("completed operation is not idempotent"), "RPC retry safety is untested");
assert(postseasonDeleteHarness.includes("delete from auth.users"), "real Auth deletion cascade is not exercised");
assert(postseasonDeleteHarness.includes("postseason entry cascaded"), "CFB postseason entry preservation is not tested");
assert(postseasonDeleteHarness.includes("postseason scorecard cascaded"), "postseason scorecard preservation is not tested");
assert(postseasonDeleteHarness.includes("rollback;"), "postseason deletion fixtures are not rolled back");
assert(productionPostverify.includes("missingActivePolicies"), "production active-account policy proof missing");
assert(productionPostverify.includes("profilesAuthFkExists"), "production Auth-cascade proof missing");
assert(productionPostverify.includes("has_function_privilege"), "production deletion RPC ACL proof missing");

console.log("[account-deletion-architecture] PASS — tombstone identity, inventory, revocation, and Foundry gates verified");
