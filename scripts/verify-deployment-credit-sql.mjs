import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(new URL("../supabase/deployment-credit-v1.sql", import.meta.url), "utf8");
const cloud = fs.readFileSync(new URL("../src/lib/cloud.ts", import.meta.url), "utf8");
const standings = fs.readFileSync(new URL("../src/app/standings/page.tsx", import.meta.url), "utf8");
const profile = fs.readFileSync(new URL("../src/app/profile/[id]/page.tsx", import.meta.url), "utf8");

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
assert.ok(standings.includes("earned +") && standings.includes("DC"), "standings must separate earned points and credit");
assert.ok(profile.includes('label="Deployment Credit"'), "profile must label Deployment Credit");
assert.ok(profile.includes('label="Eligible from"'), "profile must show first eligible week");

console.log("Deployment Credit SQL contract PASS");
