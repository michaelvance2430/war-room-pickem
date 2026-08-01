/**
 * One-time My Picks notice before the official opening week starts.
 * CFB: until Week 0 · NFL: until Week 1.
 */

import { getLeague, getSession } from "@/lib/league";
import { hasOpeningWeekStarted } from "@/lib/ring-ceremony";
import { firstSeasonWeek } from "@/lib/season-calendar";
import { weekTitle } from "@/lib/dates";

const SEEN_KEY = "warroom-picks-preopen-odds-seen-v1";

function storageKey(): string {
  const lid = getLeague()?.id || "local";
  const pid = getSession()?.playerId || "anon";
  return `${SEEN_KEY}:${lid}:${pid}`;
}

export function hasSeenPicksPreOpenOddsNotice(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(storageKey()) === "1";
  } catch {
    return true;
  }
}

export function markPicksPreOpenOddsNoticeSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(), "1");
  } catch {
    /* ignore */
  }
}

/** True only before official opening week kickoff for this sport. */
export function isPicksPreOpenOddsWindowOpen(
  sportId?: string | null
): boolean {
  const sid = sportId ?? getLeague()?.sportId;
  return !hasOpeningWeekStarted(sid);
}

export function getPicksPreOpenWeekLabel(sportId?: string | null): string {
  const sid = sportId ?? getLeague()?.sportId;
  const first = firstSeasonWeek(sid);
  return weekTitle(first, sid);
}

/**
 * Should the one-time odds-may-change popup show on My Picks?
 * (Caller also skips practice mode / tutorial.)
 */
export function shouldShowPicksPreOpenOddsNotice(
  sportId?: string | null
): boolean {
  if (typeof window === "undefined") return false;
  if (!getSession()?.playerId) return false;
  if (!isPicksPreOpenOddsWindowOpen(sportId)) return false;
  if (hasSeenPicksPreOpenOddsNotice()) return false;
  return true;
}
