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
import { seasonMaxWeek } from "@/lib/season-calendar";

export type CommishMissionKind =
  | "build"
  | "finish"
  | "publish"
  | "score"
  | "picks"
  | "next_week"
  | "trophy_ceremony"
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
 *
 * Priority: scoring / card work first; then BEGIN TROPHY CEREMONY when
 * CFB title is final + last week scored + season not closed.
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

  /**
   * Trophy ceremony when closeout readiness is fully ready
   * (final league week scored + title game final + not already closed).
   * Beats Build/Finish for stray empty active weeks after the finale.
   * Score path for an unscored active week only applies when not ready yet.
   */
  async function maybeCeremony(): Promise<CommishHomeMission | null> {
    if (sportId === "nfl") return null;
    try {
      const { resolveSeasonCloseoutReadiness } = await import(
        "./season-closeout"
      );
      const close = await resolveSeasonCloseoutReadiness();
      if (close.status === "ready") {
        return {
          kind: "trophy_ceremony",
          label: "BEGIN TROPHY CEREMONY",
          href: "/trophy-ceremony",
          weekNumber: week,
          weekLabel,
        };
      }
    } catch {
      /* hide ceremony on error */
    }
    return null;
  }

  const ceremonyFirst = await maybeCeremony();
  if (ceremonyFirst) return ceremonyFirst;

  // Active week already scored → prepare next card if season continues
  if (scored.includes(week)) {
    const max = seasonMaxWeek(sportId);
    const next = week + 1;
    if (next <= max) {
      let nextCard = null as Awaited<ReturnType<typeof loadWeekCard>>;
      try {
        nextCard = await loadWeekCard(next);
      } catch {
        nextCard = null;
      }
      if (!nextCard?.games?.length) {
        const nextLabel = weekTitle(next, sportId);
        return {
          kind: "next_week",
          label: `Build ${nextLabel} Card`,
          href: `/week-ops?week=${next}&step=1`,
          weekNumber: next,
          weekLabel: nextLabel,
        };
      }
    }
    return null;
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

  // Scoring: published + kickoff passed + not scored — one host job
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

  // Card live, before kickoff — host plays like everyone else (hero owns picks CTA).
  // No second coaching card. Mission button stays silent.
  return null;
}
