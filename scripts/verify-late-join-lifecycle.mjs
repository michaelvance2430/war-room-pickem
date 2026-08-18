import assert from "node:assert/strict";
import fs from "node:fs";
import {
  calculateDeploymentCredit,
} from "../src/lib/deployment-credit.ts";

const read = (path) =>
  fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Eight completed weeks in a 20-player room. One no-submission is excluded on
// selected weeks; the new player begins well below the top-four cut.
const completedWeeks = Array.from({ length: 8 }, (_, weekNumber) => ({
  weekNumber,
  scores: Array.from({ length: 20 }, (_, index) => ({
    score: 8 + ((index * 3 + weekNumber * 2) % 21),
    submitted: index !== 0 || weekNumber % 3 !== 0,
    isBot: false,
  })),
}));
const credit = calculateDeploymentCredit(completedWeeks);
assert.deepEqual(credit.weeks.map((week) => week.credit), [9, 10, 10, 8, 10, 9, 8, 10]);
assert.equal(credit.total, 74);

const incumbentTotals = [152, 146, 139, 132, 127, 121, 115, 109, 103, 98, 92, 86, 80, 74, 68, 62, 56, 50, 44, 38];
const entryRank = 1 + incumbentTotals.filter((points) => points > credit.total).length;
assert.equal(entryRank, 14, "late joiner should enter 14th of 21");
assert.equal(incumbentTotals[3] - credit.total, 58, "top-four bye remains a major climb");
assert.ok(entryRank > Math.ceil((incumbentTotals.length + 1) / 2), "late joiner starts in the lower half");

const sql = read("supabase/deployment-credit-v1.sql");
const standings = read("src/app/standings/page.tsx");
const profile = read("src/app/profile/[id]/page.tsx");
const picks = read("src/app/picks/PicksClient.tsx");
const eligibility = read("src/lib/postseason/eligibility.ts");
const notice = read("src/lib/fair-entry.ts");

assert.ok(sql.includes("v_league.current_week + case when v_active_card then 1 else 0 end"), "active-week joins must become eligible next week");
assert.ok(sql.includes("Roster closed: postseason has begun"), "postseason joining must be blocked");
assert.ok(sql.includes("new.total_points := new.deployment_credit"), "initial total must be synthetic credit only");
assert.ok(sql.includes("new.weeks_played := 0"), "credit must not manufacture played weeks");
assert.ok(sql.includes("new.week_number < coalesce(v_eligible, 0)"), "eligibility must be enforced beneath the UI");
assert.ok(standings.includes("player.totalPoints - player.deploymentCredit"), "standings must separate earned points from credit");
assert.ok(profile.includes('label="Deployment Credit"') && profile.includes('label="Eligible from"'), "profile must disclose credit and join eligibility");
assert.ok(picks.includes("Credit is separate from this scorecard and cannot unlock awards"), "scorecard must explain reward isolation");
assert.ok(!eligibility.includes("eligibleFromWeek") && !eligibility.includes("joinedAt"), "late joiners must remain eligible for postseason fields, including Toilet Bowl");
assert.ok(!notice.includes("percentileValue") && !notice.includes("createClient"), "browser notice must never calculate or write competing credit");

console.log("Late-join lifecycle PASS — 74 DC · rank 14/21 · 58-point top-four gap · next-week eligibility · separate ledger · no synthetic awards · Toilet Bowl eligible");
