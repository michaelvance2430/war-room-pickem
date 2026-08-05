/**
 * State-aware commissioner Home mission.
 *
 * PRODUCT PIVOT: One giant button on Home for the next host-only job.
 * Not a dashboard. Not a checklist.
 *
 * Stage 4: host ordering and Score Week readiness come from the shared
 * resolver in host-ops-mission.ts (same pure rules as League Hub).
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
import { seasonMaxWeek } from "@/lib/season-calendar";
import {
  resolveHostOpsMission,
  type HostOpsMission,
} from "@/lib/host-ops-mission";

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

function toCommishMission(m: HostOpsMission): CommishHomeMission {
  return {
    kind: m.kind,
    label: m.label,
    href: m.href,
    weekNumber: m.weekNumber,
    weekLabel: m.weekLabel,
  };
}

/**
 * Resolve the single commissioner/deputy mission for Home.
 * Returns null if not ops, or no host task (hide the button).
 *
 * Uses shared resolveHostOpsMission for Score Week / build / finish / next week.
 * Trophy closeout remains Home-loaded (session league only).
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

  let scored: number[] = [];
  try {
    scored = await listScoredWeekNumbers();
  } catch {
    scored = [];
  }
  const weekScored = scored.includes(week);

  // Trophy ceremony (CFB closeout) — Home-only expensive readiness check
  let trophyReady = false;
  if (sportId !== "nfl") {
    try {
      const { resolveSeasonCloseoutReadiness } = await import(
        "./season-closeout"
      );
      const close = await resolveSeasonCloseoutReadiness();
      trophyReady = close.status === "ready";
    } catch {
      trophyReady = false;
    }
  }

  let nextWeek: number | null = null;
  let nextWeekHasGames = false;
  if (weekScored) {
    const max = seasonMaxWeek(sportId);
    const next = week + 1;
    if (next <= max) {
      nextWeek = next;
      try {
        const nextCard = await loadWeekCard(next);
        nextWeekHasGames = !!(nextCard?.games?.length);
      } catch {
        nextWeekHasGames = false;
      }
    }
  }

  let gameCount = 0;
  let hasProp = false;
  let gamesForLock: { commenceTime?: string; startTime?: string }[] = [];

  if (!weekScored && !trophyReady) {
    let card = null as Awaited<ReturnType<typeof loadWeekCard>>;
    try {
      card = await loadWeekCard(week);
    } catch {
      card = null;
    }
    const games = card?.games || [];
    gameCount = games.length;
    const propQ = card?.prop?.question?.trim() || "";
    hasProp = propQ.length > 0;
    gamesForLock = games.map((g) => ({
      commenceTime: g.commenceTime,
      startTime: g.startTime,
    }));
  }

  const mission = resolveHostOpsMission({
    sportId,
    week,
    weekScored,
    gameCount,
    hasProp,
    gamesForLock,
    nextWeek,
    nextWeekHasGames,
    trophyReady,
  });

  return mission ? toCommishMission(mission) : null;
}
