/**
 * Deployment Credit notice state.
 *
 * The database is the only authority for calculating and applying late-join
 * credit. This browser module deliberately stores presentation state only so
 * no legacy percentile calculation can diverge from the bottom-15% rule.
 */

export type FairEntryBandId = "deployment";

export const FAIR_ENTRY_COPY = {
  title: "Deployment Credit",
  body:
    "Your standings include conservative credit based on each completed week's bottom 15%. It is shown separately from points you earn and cannot create retroactive wins, streaks, records, or cheevos.",
} as const;

const APPLIED_KEY = "warroom-fair-entry-applied-v1";

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function appliedKey(leagueId: string, userId: string) {
  return `${APPLIED_KEY}:${leagueId}:${userId}`;
}

/** Mark that this user should see the server-applied credit explanation once. */
export function markFairEntryPendingNotice(
  leagueId: string,
  userId: string,
  payload: { points: number; bandId: FairEntryBandId }
) {
  if (!canUse() || !leagueId || !userId) return;
  try {
    localStorage.setItem(
      appliedKey(leagueId, userId),
      JSON.stringify({
        ...payload,
        at: new Date().toISOString(),
        noticeSeen: false,
      })
    );
  } catch {
    /* presentation state is best effort */
  }
}

export function peekFairEntryNotice(
  leagueId: string,
  userId: string
): { title: string; body: string } | null {
  if (!canUse() || !leagueId || !userId) return null;
  try {
    const raw = localStorage.getItem(appliedKey(leagueId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { noticeSeen?: boolean };
    if (parsed.noticeSeen) return null;
    return { title: FAIR_ENTRY_COPY.title, body: FAIR_ENTRY_COPY.body };
  } catch {
    return null;
  }
}

export function dismissFairEntryNotice(leagueId: string, userId: string) {
  if (!canUse() || !leagueId || !userId) return;
  try {
    const raw = localStorage.getItem(appliedKey(leagueId, userId));
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsed.noticeSeen = true;
    localStorage.setItem(appliedKey(leagueId, userId), JSON.stringify(parsed));
  } catch {
    /* presentation state is best effort */
  }
}
