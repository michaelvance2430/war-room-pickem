/**
 * First-session KISS helpers — don't overwhelm before there's something to do.
 */

import { listPublishedWeekNumbers, loadWeekCard, loadLeagueActiveWeek } from "./cloud";

export const EVENT_CARD_PUBLISHED = "warroom-card-published";

export type CardPublishedDetail = {
  weekNumber: number;
  weekLabel?: string;
};

/** True when the league has any published week card (players can actually pick). */
export async function leagueHasLiveCard(): Promise<boolean> {
  try {
    const pub = await listPublishedWeekNumbers();
    if (pub.length > 0) return true;
    const week = await loadLeagueActiveWeek();
    const card = await loadWeekCard(week);
    return !!(card?.games && card.games.length > 0);
  } catch {
    return false;
  }
}

/** Fire after commish publishes — home/modals can celebrate. */
export function notifyCardPublished(detail: CardPublishedDetail) {
  if (typeof window === "undefined") return;
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
