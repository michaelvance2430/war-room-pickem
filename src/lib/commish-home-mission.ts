/**
 * State-aware commissioner Home mission.
 *
 * PRODUCT PIVOT: One giant button on Home for the next host-only job.
 * Not a dashboard. Not a checklist.
 *
 * INVENTORY (current Commissioner ops → destinations)
 * ───────────────────────────────────────────────────
 * | Operation              | Was                 | New location              | Block retire? |
 * | Build/edit card        | /commissioner card  | Home CTA → /week-ops      | YES           |
 * | Pick prop              | /commissioner card  | /week-ops step 3          | YES           |
 * | Publish week           | /commissioner card  | /week-ops preview         | YES           |
 * | Score week             | /commissioner results| Home CTA → /week-ops?score | YES        |
 * | Who's locked           | Community Pulse     | Pulse on Manage League    | NO           |
 * | Invite/share           | (removed) Home      | Home Share League         | NO           |
 * | League name/settings   | settings tab        | /commissioner (Manage)    | YES (secondary)|
 * | Open room / bots       | settings            | /commissioner Manage      | NO           |
 * | Pass gavel / deputies  | settings            | /commissioner Manage      | YES (secondary)|
 * | Season reset / next    | settings            | /commissioner Manage      | YES (secondary)|
 * | Demo/Foundry tools     | lab                 | Foundry only              | NO           |
 *
 * Old /commissioner route stays until week-ops is proven. Nav demotes it to Manage.
 */

import { getLeague, getSession, isOps } from "@/lib/league";
import {
  loadLeagueActiveWeek,
  loadWeekCard,
  listScoredWeekNumbers,
} from "@/lib/cloud";
import { isCardLockDeadlinePassed } from "@/lib/dates";
import { weekTitle } from "@/lib/dates";

export type CommishMissionKind =
  | "build"
  | "finish"
  | "publish"
  | "score"
  | "none";

export type CommishHomeMission = {
  kind: CommishMissionKind;
  /** Full-width Home button label */
  label: string;
  /** Guided flow entry */
  href: string;
  weekNumber: number;
  weekLabel: string;
};

/**
 * Resolve the single commissioner-only mission for Home.
 * Returns null if not ops, or no host task (hide the button).
 */
export async function resolveCommishHomeMission(): Promise<CommishHomeMission | null> {
  if (!isOps()) return null;
  const session = getSession();
  if (!session?.leagueId) return null;

  const sportId = getLeague()?.sportId || "cfb";
  let week = 0;
  try {
    week = await loadLeagueActiveWeek();
  } catch {
    week = sportId === "nfl" ? 1 : 0;
  }
  const weekLabel = weekTitle(week, sportId);

  let scored: number[] = [];
  try {
    scored = await listScoredWeekNumbers();
  } catch {
    scored = [];
  }
  if (scored.includes(week)) {
    return null; // week complete — no host CTA
  }

  let card = null as Awaited<ReturnType<typeof loadWeekCard>>;
  try {
    card = await loadWeekCard(week);
  } catch {
    card = null;
  }

  const games = card?.games || [];
  const hasGames = games.length >= 5;
  const propQ = card?.prop?.question?.trim() || "";
  const hasProp = propQ.length > 0;
  // published_at exists when loadWeekCard returns a real card with games
  const published = hasGames; // card with games is live for player picks

  // Scoring: published + kickoff passed + not scored
  if (published && isCardLockDeadlinePassed(games)) {
    return {
      kind: "score",
      label: `Score ${weekLabel}`,
      href: `/week-ops?week=${week}&step=score`,
      weekNumber: week,
      weekLabel,
    };
  }

  if (!card || games.length === 0) {
    return {
      kind: "build",
      label: `Build ${weekLabel} Card`,
      href: `/week-ops?week=${week}&step=1`,
      weekNumber: week,
      weekLabel,
    };
  }

  if (!hasGames || games.length < 5) {
    return {
      kind: "finish",
      label: `Finish ${weekLabel} Card`,
      href: `/week-ops?week=${week}&step=1`,
      weekNumber: week,
      weekLabel,
    };
  }

  if (!hasProp) {
    return {
      kind: "finish",
      label: `Finish ${weekLabel} Card`,
      href: `/week-ops?week=${week}&step=3`,
      weekNumber: week,
      weekLabel,
    };
  }

  // Has 5 games + prop — if not yet "live" for room we still offer publish
  // (re-publish / confirm). Prefer preview step.
  // Treat incomplete draft: less than 5 or no prop already handled.
  // With full card, mission is publish if we consider draft state —
  // current product: card in cloud with games IS published. So host plays.
  // Offer edit path only via finish when incomplete; hide when complete + live.
  return null;
}
