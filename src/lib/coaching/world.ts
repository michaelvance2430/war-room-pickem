/**
 * Load trusted league facts for coaching eligibility + backfill.
 */

import {
  loadLeagueRoster,
  listPublishedWeekNumbers,
  listScoredWeekNumbers,
  loadWeekCard,
  loadLeagueActiveWeek,
  loadMyPicks,
} from "@/lib/cloud";
import { getLeague, getSession, isActuallyCommissioner } from "@/lib/league";
import { getCommishSetup } from "@/lib/commish-onboarding";
import { hasLockedPicksOnce } from "@/lib/first-week";
import type { CoachWorldSnapshot } from "./backfill";

export async function loadCoachWorldSnapshot(): Promise<CoachWorldSnapshot | null> {
  const session = getSession();
  const league = getLeague();
  if (!session?.playerId || !league?.id) return null;

  try {
    const [roster, published, scored, week] = await Promise.all([
      loadLeagueRoster().catch(() => []),
      listPublishedWeekNumbers().catch(() => [] as number[]),
      listScoredWeekNumbers().catch(() => [] as number[]),
      loadLeagueActiveWeek().catch(() => 1),
    ]);

    const card = await loadWeekCard(week).catch(() => null);
    const hasActiveWeekCard = !!(card?.games && card.games.length > 0);

    let hasAnyPicksRow = false;
    try {
      if (published.length > 0) {
        const picks = await loadMyPicks(week).catch(() => null);
        hasAnyPicksRow = !!(
          picks &&
          (picks.lockedAt ||
            (picks.picks && Object.keys(picks.picks).length > 0))
        );
      }
    } catch {
      hasAnyPicksRow = false;
    }

    const humans = roster.filter((m) => !m.isBot).length;
    const setup = getCommishSetup(league.id);

    return {
      isCommissioner: isActuallyCommissioner(),
      humanCount: humans,
      publishedWeekCount: published.length,
      hasActiveWeekCard,
      scoredWeekCount: scored.length,
      hasLockedPicks: hasLockedPicksOnce(session.playerId),
      hasAnyPicksRow: hasAnyPicksRow || hasLockedPicksOnce(session.playerId),
      inviteCopied: !!setup.inviteCopied,
    };
  } catch {
    return null;
  }
}
