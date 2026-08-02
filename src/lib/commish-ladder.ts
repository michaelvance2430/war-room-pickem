/**
 * Commissioner career ladder — count seasons where you ran ≥14 of 18 weeks.
 * Scales rewards up to the top title: Assistant to the Regional Manager.
 */

import type { BadgeDef, BadgeTier } from "@/lib/types";
import {
  IRON_COMMISH_TARGET,
  getBestCommishWeeks,
  getQualifyingCommishSeasons,
} from "@/lib/commish-tenure";
import { grantPermanentBadgeId } from "@/lib/permanent-badges";

export type CommishLadderRung = {
  /** Qualifying seasons (each season = ≥14/18 weeks as commissioner) */
  seasons: number;
  badgeId: string;
  name: string;
  /** Equipable nameplate */
  title: string;
  description: string;
  howToEarn: string;
  tier: BadgeTier;
  icon: string;
};

/**
 * Ordered low → high. Top of the mountain = Assistant to the Regional Manager.
 */
export const COMMISH_LADDER: CommishLadderRung[] = [
  {
    seasons: 1,
    badgeId: "commish_ladder_1",
    name: "First Gavel",
    title: "First Gavel",
    description: "You actually ran a room for a full-ish season. Not a tourist.",
    howToEarn: "Complete 1 qualifying commissioner season (14+ of 18 weeks).",
    tier: "common",
    icon: "🔨",
  },
  {
    seasons: 2,
    badgeId: "commish_ladder_2",
    name: "Double Commish",
    title: "Double Commish",
    description: "Came back and ran the board again. The group chat noticed.",
    howToEarn: "Complete 2 qualifying commissioner seasons.",
    tier: "common",
    icon: "📋",
  },
  {
    seasons: 3,
    badgeId: "commish_ladder_3",
    name: "Season Architect",
    title: "Season Architect",
    description: "Three full runs. People trust your week map.",
    howToEarn: "Complete 3 qualifying commissioner seasons.",
    tier: "rare",
    icon: "🏗️",
  },
  {
    seasons: 5,
    badgeId: "commish_ladder_5",
    name: "Multi-Room Operator",
    title: "Multi-Room Operator",
    description: "Five seasons with the gavel. Cross-sport energy welcome.",
    howToEarn: "Complete 5 qualifying commissioner seasons.",
    tier: "rare",
    icon: "🏢",
  },
  {
    seasons: 7,
    badgeId: "commish_ladder_7",
    name: "Regional Manager",
    title: "Regional Manager",
    description: "Seven qualifying seasons. The region reports to you.",
    howToEarn: "Complete 7 qualifying commissioner seasons.",
    tier: "epic",
    icon: "📊",
  },
  {
    seasons: 10,
    badgeId: "commish_ladder_10",
    name: "Assistant to the Regional Manager",
    title: "Assistant to the Regional Manager",
    description:
      "Ten qualifying seasons. Peak commissioner. Respect the title — and the stapler.",
    howToEarn:
      "Complete 10 qualifying commissioner seasons (14+ of 18 weeks each).",
    tier: "legendary",
    icon: "📎",
  },
];

export const TOP_COMMISH_TITLE = "Assistant to the Regional Manager";
export const TOP_COMMISH_BADGE_ID = "commish_ladder_10";

export function ladderRungForSeasons(
  seasons: number
): CommishLadderRung | null {
  let best: CommishLadderRung | null = null;
  for (const r of COMMISH_LADDER) {
    if (seasons >= r.seasons) best = r;
  }
  return best;
}

export function nextLadderRung(seasons: number): CommishLadderRung | null {
  for (const r of COMMISH_LADDER) {
    if (seasons < r.seasons) return r;
  }
  return null;
}

/** Badge defs for catalog merge */
export function commishLadderBadgeDefs(): BadgeDef[] {
  return COMMISH_LADDER.map((r) => ({
    id: r.badgeId,
    name: r.name,
    description: r.description,
    howToEarn: r.howToEarn,
    tier: r.tier,
    points:
      r.tier === "legendary"
        ? 150
        : r.tier === "epic"
          ? 50
          : r.tier === "rare"
            ? 25
            : 10,
    icon: r.icon,
    lockedLabel: r.howToEarn,
  }));
}

/**
 * Grant every ladder badge the user has earned (sticky permanent).
 * Call after recording a commissioner week / on profile load.
 */
export function syncCommishLadderGrants(userId: string): {
  seasons: number;
  bestWeeks: number;
  rung: CommishLadderRung | null;
  granted: string[];
} {
  const seasons = getQualifyingCommishSeasons(userId);
  const bestWeeks = getBestCommishWeeks(userId);
  const granted: string[] = [];
  for (const r of COMMISH_LADDER) {
    if (seasons >= r.seasons) {
      grantPermanentBadgeId(userId, r.badgeId);
      granted.push(r.badgeId);
    }
  }
  // First-season iron path still uses elite_commish (14 weeks in one run)
  if (bestWeeks >= IRON_COMMISH_TARGET) {
    grantPermanentBadgeId(userId, "elite_commish");
  }
  return {
    seasons,
    bestWeeks,
    rung: ladderRungForSeasons(seasons),
    granted,
  };
}

export function commishCareerBlurb(userId: string): string {
  const seasons = getQualifyingCommishSeasons(userId);
  const best = getBestCommishWeeks(userId);
  const rung = ladderRungForSeasons(seasons);
  const next = nextLadderRung(seasons);
  if (seasons <= 0) {
    return best > 0
      ? `Gavel weeks this run: ${best}/14 toward a qualifying season.`
      : "No qualifying commissioner seasons yet. Run 14 of 18 weeks to bank one.";
  }
  const top = rung
    ? `Title track: ${rung.title}.`
    : "Climbing the commissioner ladder.";
  const more = next
    ? ` Next: ${next.title} at ${next.seasons} seasons (${next.seasons - seasons} to go).`
    : ` Peak: ${TOP_COMMISH_TITLE}.`;
  return `${seasons} qualifying season${seasons === 1 ? "" : "s"} (14+/18). ${top}${more}`;
}
