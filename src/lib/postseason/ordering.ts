/**
 * Stable standings order using existing authoritative tiebreak chain.
 */

import type { Player } from "@/lib/types";
import {
  comparePlayers,
  comparePlayersToilet,
} from "@/lib/tiebreakers";
import type { PostseasonMemberInput } from "./types";

/** Map freeze input → Player for comparePlayers (side-effect free). */
export function memberToPlayer(m: PostseasonMemberInput): Player {
  const weekly = Array.isArray(m.weeklyPoints) ? [...m.weeklyPoints] : [];
  const division =
    m.division === "North" ||
    m.division === "South" ||
    m.division === "East" ||
    m.division === "West"
      ? m.division
      : "North";

  return {
    id: m.userId,
    name: m.displayName || m.userId,
    division,
    totalPoints: m.totalPoints ?? 0,
    weeklyPoints: weekly,
    atsCorrect: m.atsCorrect ?? 0,
    atsTotal: m.atsTotal ?? 0,
    currentStreak: m.currentStreak ?? 0,
    bestWeek: m.bestWeek ?? 0,
    worstWeek: m.worstWeek ?? 0,
    perfectWeeks: 0,
    bestBetHits: m.bestBetHits ?? 0,
    bestBetTotal: m.bestBetTotal ?? 0,
    propHits: m.propHits ?? 0,
    propTotal: m.propTotal ?? 0,
    weeksPlayed: m.weeksPlayed ?? weekly.filter((x) => typeof x === "number").length,
    isMock: !!m.isMock,
  };
}

/** Championship rank order: best first (stable via name tiebreak). */
export function sortChampionshipOrder(
  members: readonly PostseasonMemberInput[]
): PostseasonMemberInput[] {
  return [...members].sort((a, b) =>
    comparePlayers(memberToPlayer(a), memberToPlayer(b))
  );
}

/** Toilet-style worst-first (for optional seed flavor within toilet field). */
export function sortToiletOrder(
  members: readonly PostseasonMemberInput[]
): PostseasonMemberInput[] {
  return [...members].sort((a, b) =>
    comparePlayersToilet(memberToPlayer(a), memberToPlayer(b))
  );
}
