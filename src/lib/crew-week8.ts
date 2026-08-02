/**
 * Week 8 Crew education popup — mid-season "why we stay together" moment.
 * Shows once per league season on login / open when active week >= 8.
 */

import { getLeague, getSession } from "@/lib/league";

const FOREVER_PREFIX = "warroom-crew-week8-dismissed:";
const SESSION_PREFIX = "warroom-crew-week8-session:";

function canUse() {
  return typeof window !== "undefined";
}

function leagueSeasonKey(leagueId: string): string {
  // One education pass per room per calendar year (covers CFB/NFL seasons)
  const y = new Date().getFullYear();
  return `${leagueId}:${y}`;
}

export function isCrewWeekEightDismissed(leagueId?: string | null): boolean {
  if (!canUse() || !leagueId) return true;
  try {
    return localStorage.getItem(FOREVER_PREFIX + leagueSeasonKey(leagueId)) === "1";
  } catch {
    return true;
  }
}

export function markCrewWeekEightDismissed(leagueId?: string | null) {
  if (!canUse() || !leagueId) return;
  try {
    localStorage.setItem(FOREVER_PREFIX + leagueSeasonKey(leagueId), "1");
  } catch {
    /* ok */
  }
  try {
    sessionStorage.setItem(SESSION_PREFIX + leagueSeasonKey(leagueId), "1");
  } catch {
    /* ok */
  }
}

export function wasCrewWeekEightShownThisSession(
  leagueId?: string | null
): boolean {
  if (!canUse() || !leagueId) return true;
  try {
    return sessionStorage.getItem(SESSION_PREFIX + leagueSeasonKey(leagueId)) === "1";
  } catch {
    return true;
  }
}

export function markCrewWeekEightSession(leagueId?: string | null) {
  if (!canUse() || !leagueId) return;
  try {
    sessionStorage.setItem(SESSION_PREFIX + leagueSeasonKey(leagueId), "1");
  } catch {
    /* ok */
  }
}

/** Active pick week from local cache (same key Commish/Home use). */
export function readLocalActiveWeek(): number {
  if (!canUse()) return 1;
  try {
    const s = localStorage.getItem("warroom-active-week");
    if (s == null || s === "") return 1;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 1;
  } catch {
    return 1;
  }
}

/**
 * Offer Week 8 Crew briefing when:
 * - signed in, in a league
 * - active week >= 8
 * - not guest
 * - not dismissed for this room-season
 * - not already shown this browser session
 */
export function shouldOfferCrewWeekEightBriefing(): boolean {
  if (!canUse()) return false;
  try {
    const session = getSession();
    const league = getLeague();
    if (!session?.playerId || !league?.id) return false;
    if (readLocalActiveWeek() < 8) return false;
    if (isCrewWeekEightDismissed(league.id)) return false;
    if (wasCrewWeekEightShownThisSession(league.id)) return false;
    return true;
  } catch {
    return false;
  }
}

export const CREW_WEEK8_COPY = {
  title: "Your Crew is bigger than this card",
  kicker: "Week 8 briefing",
  body: [
    "A league is a season. A Crew is the people.",
    "When this sport ends, the point isn't to scatter — it's to keep the same group through CFB, NFL, and whatever desk comes next. Same friends. New chapter.",
    "Stick around. Lock picks. Burn points. Earn Crew marks that follow you onto your profile and Museum. The ones who stay get the story.",
  ],
  cta: "Got it — keep the Crew tight",
  secondary: "Open Crew page",
} as const;
