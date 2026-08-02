/**
 * Crew commitment + points-burned board for profile / museum / crew page.
 * Cheevos are also registered in badges.ts so they appear on BadgeShelf.
 */

import type { Player } from "@/lib/types";
import {
  completedChapterCount,
  crewIsDualSport,
  getCrewForLeague,
  getCrewIdForLeague,
} from "@/lib/crew";
import { getLeague } from "@/lib/league";
import { getBadgeDef, TIER_POINTS } from "@/lib/badges";
import type { BadgeStatus } from "@/lib/types";

/** Crew cheevo ids — must match BADGE_CATALOG */
export const CREW_CHEEVO_IDS = {
  week8: "crew_midseason_loyal",
  dual: "crew_dual_desk",
  chapters: "crew_multi_chapter",
  scorcher: "crew_points_furnace",
  committed: "crew_card_grinder",
} as const;

export type CrewBoardRow = {
  playerId: string;
  name: string;
  avatarUrl?: string | null;
  totalPoints: number;
  weeksPlayed: number;
  badgePoints: number;
  chapters: number;
  dualSport: boolean;
  lastSeenAt?: string | null;
  isCreator: boolean;
  /** Rank by totalPoints desc, then badgePoints */
  burnRank: number;
  commitmentScore: number;
};

/** Lightweight badge-point total from earned statuses */
export function sumBadgePoints(badges: BadgeStatus[]): number {
  let n = 0;
  for (const b of badges) {
    if (!b.earned) continue;
    n += b.def.points || TIER_POINTS[b.def.tier] || 0;
  }
  return n;
}

/**
 * Rank who is committed + burning the most season points in this room.
 * Uses live standings peers when available.
 */
export function buildCrewCommitmentBoard(
  players: Player[],
  opts?: {
    badgePointsById?: Record<string, number>;
    lastSeenById?: Record<string, string | null | undefined>;
    creatorIds?: Set<string>;
  }
): CrewBoardRow[] {
  const leagueId = getLeague()?.id;
  const crewId = getCrewIdForLeague(leagueId);
  const chapters = crewId ? completedChapterCount(crewId) : 0;
  const dual = crewId ? crewIsDualSport(crewId) : false;

  const rows: CrewBoardRow[] = players
    .filter((p) => p && p.id)
    .map((p) => {
      const weeks = p.weeksPlayed || p.weeklyPoints?.length || 0;
      const badgePts = opts?.badgePointsById?.[p.id] ?? 0;
      const commitmentScore =
        weeks * 10 +
        Math.min(200, Math.floor((p.totalPoints || 0) / 2)) +
        Math.min(100, Math.floor(badgePts / 5)) +
        (dual ? 25 : 0) +
        chapters * 15;
      return {
        playerId: p.id,
        name: p.name || "Player",
        avatarUrl: p.avatarUrl,
        totalPoints: p.totalPoints || 0,
        weeksPlayed: weeks,
        badgePoints: badgePts,
        chapters,
        dualSport: dual,
        lastSeenAt: opts?.lastSeenById?.[p.id] ?? p.lastSeenAt ?? null,
        isCreator: !!opts?.creatorIds?.has(p.id),
        burnRank: 0,
        commitmentScore,
      };
    });

  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.commitmentScore !== a.commitmentScore)
      return b.commitmentScore - a.commitmentScore;
    return a.name.localeCompare(b.name);
  });
  rows.forEach((r, i) => {
    r.burnRank = i + 1;
  });
  return rows;
}

/** Filter badge list to crew-only marks for a shelf strip */
export function filterCrewCheevos(badges: BadgeStatus[]): BadgeStatus[] {
  const ids = new Set(Object.values(CREW_CHEEVO_IDS));
  return badges.filter((b) => ids.has(b.def.id as (typeof CREW_CHEEVO_IDS)[keyof typeof CREW_CHEEVO_IDS]));
}

export function crewCheevoDefs() {
  return Object.values(CREW_CHEEVO_IDS)
    .map((id) => getBadgeDef(id))
    .filter(Boolean);
}
