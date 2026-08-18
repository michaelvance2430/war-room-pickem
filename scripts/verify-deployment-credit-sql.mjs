import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(new URL("../supabase/deployment-credit-v1.sql", import.meta.url), "utf8");
const cloud = fs.readFileSync(new URL("../src/lib/cloud.ts", import.meta.url), "utf8");
const standings = fs.readFileSync(new URL("../src/app/standings/page.tsx", import.meta.url), "utf8");
const profile = fs.readFileSync(new URL("../src/app/profile/[id]/page.tsx", import.meta.url), "utf8");
const picks = fs.readFileSync(new URL("../src/app/picks/PicksClient.tsx", import.meta.url), "utf8");
const policySql = fs.readFileSync(new URL("../supabase/deployment-credit-policy-v2.sql", import.meta.url), "utf8");
const joinPage = fs.readFileSync(new URL("../src/app/join/page.tsx", import.meta.url), "utf8");
const membershipClient = fs.readFileSync(new URL("../src/lib/d1b-b-membership.ts", import.meta.url), "utf8");
const noticeState = fs.readFileSync(new URL("../src/lib/fair-entry.ts", import.meta.url), "utf8");

for (const fragment of [
  "late_join_policy",
  "deployment_credit integer not null default 0",
  "deployment_credit_breakdown jsonb",
  "eligible_from_week integer",
  "ceil(v_qualifying * 0.15)",
  "p.total_points > 0",
  "coalesce(m.is_bot, false) = false",
  "Roster closed: postseason has begun",
  "Deployment pending: eligible beginning Week",
  "Late-join policy is locked when the league is created",
  "clear_deployment_credit_on_season_reset",
  "new.total_points := greatest(0, coalesce(new.deployment_credit, 0)) + greatest(0, v_earned)",
]) {
  assert.ok(sql.includes(fragment), `missing SQL contract: ${fragment}`);
}

assert.ok(
  /revoke all on function public\.deployment_credit_summary\(uuid\) from public, anon, authenticated/i.test(sql),
  "credit helper must not be a public SECURITY DEFINER endpoint",
);
assert.ok(
  /before insert or update of week_number on public\.picks/i.test(sql),
  "eligibility must be enforced below the UI",
);
assert.ok(
  /before update of total_points, deployment_credit on public\.memberships/i.test(sql),
  "authoritative rescoring must preserve separate credit",
);
assert.ok(cloud.includes("deployment_credit_breakdown"), "cloud standings must hydrate credit provenance");
assert.ok(standings.includes("earned +") && standings.includes("Deployment Credit"), "standings must separate earned points and spell out credit on phones");
assert.ok(profile.includes('label="Deployment Credit"'), "profile must label Deployment Credit");
assert.ok(profile.includes('label="Eligible from"'), "profile must show first eligible week");
assert.ok(picks.includes("Season ledger:"), "scorecard must disclose the separate season ledger");
assert.ok(picks.includes("Credit is separate from this scorecard and cannot unlock awards"), "scorecard must not present credit as earned play");
assert.ok(policySql.includes("p_late_join_policy text default 'reinforcement_credit'"), "create RPC must accept a policy atomically");
assert.ok(policySql.includes("if coalesce(p_list_as_open, false)"), "public rooms must force reinforcement credit");
assert.ok(joinPage.includes("Late-join rule · locked at creation"), "league creation must explain immutable policy");
assert.ok(joinPage.includes("Zero Backfill") && joinPage.includes("Closed Roster"), "private policy choices must be visible");
assert.ok(membershipClient.includes("p_late_join_policy"), "client must send the policy into atomic create");
assert.ok(!cloud.includes("freezeFairEntryAfterScore"), "scoring must not write obsolete browser percentile freezes");
assert.ok(joinPage.includes('bandId: "deployment"'), "Week 0 and later joiners must receive the Deployment Credit notice");
assert.ok(!noticeState.includes("percentileValue"), "browser must not retain the obsolete percentile calculator");
assert.ok(!noticeState.includes("createClient"), "browser notice state must never write standings credit");

console.log("Deployment Credit SQL contract PASS");
