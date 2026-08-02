/**
 * First-session KISS helpers — don't overwhelm before there's something to do.
 */

import { listPublishedWeekNumbers, loadWeekCard, loadLeagueActiveWeek } from "./cloud";

export const EVENT_CARD_PUBLISHED = "warroom-card-published";

export type CardPublishedDetail = {
  weekNumber: number;
  weekLabel?: string;
};

/** Short-lived cache so walkthrough / first-login doesn't re-hit cloud 3×. */
let liveCardCache: { at: number; value: boolean } | null = null;
const LIVE_CARD_TTL_MS = 20_000;

/** True when the league has any published week card (players can actually pick). */
export async function leagueHasLiveCard(opts?: {
  /** Bypass cache (e.g. after publish) */
  force?: boolean;
}): Promise<boolean> {
  if (
    !opts?.force &&
    liveCardCache &&
    Date.now() - liveCardCache.at < LIVE_CARD_TTL_MS
  ) {
    return liveCardCache.value;
  }
  try {
    const pub = await listPublishedWeekNumbers();
    if (pub.length > 0) {
      liveCardCache = { at: Date.now(), value: true };
      return true;
    }
    const week = await loadLeagueActiveWeek();
    const card = await loadWeekCard(week);
    const value = !!(card?.games && card.games.length > 0);
    liveCardCache = { at: Date.now(), value };
    return value;
  } catch {
    return liveCardCache?.value ?? false;
  }
}

/** Call after publish so coach can start without waiting for TTL. */
export function invalidateLiveCardCache() {
  liveCardCache = null;
}

/** Fire after commish publishes — home/modals can celebrate. */
export function notifyCardPublished(detail: CardPublishedDetail) {
  if (typeof window === "undefined") return;
  invalidateLiveCardCache();
  try {
    void Promise.all([
      import("@/lib/cloud"),
      import("@/lib/league"),
    ]).then(([cloud, league]) => {
      cloud.invalidateCloudWeekCaches(league.getSession()?.leagueId);
    });
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_CARD_PUBLISHED, { detail })
    );
    sessionStorage.setItem(
      "warroom-just-published",
      JSON.stringify({ ...detail, at: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

export function takeJustPublished(): CardPublishedDetail | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("warroom-just-published");
    if (!raw) return null;
    sessionStorage.removeItem("warroom-just-published");
    const p = JSON.parse(raw) as CardPublishedDetail & { at?: number };
    // Only show if published in last 15 minutes
    if (p.at && Date.now() - p.at > 15 * 60_000) return null;
    return { weekNumber: p.weekNumber, weekLabel: p.weekLabel };
  } catch {
    return null;
  }
}
