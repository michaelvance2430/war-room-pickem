/**
 * Championship / non-qualifier partition + conditional Toilet Bowl.
 */

import { computeQualifierCount } from "./cut";
import { sortChampionshipOrder, sortToiletOrder } from "./ordering";
import type { PostseasonMemberInput } from "./types";

export type PartitionResult =
  | {
      ok: true;
      contested: true;
      cutPercent: number;
      qualifierCount: number;
      championship: PostseasonMemberInput[];
      nonQualifiers: PostseasonMemberInput[];
      toiletBowlActive: boolean;
      toiletParticipants: PostseasonMemberInput[];
    }
  | {
      ok: true;
      contested: false;
      cutPercent: number;
      qualifierCount: 0;
      championship: [];
      nonQualifiers: PostseasonMemberInput[];
      toiletBowlActive: false;
      toiletParticipants: [];
      uncontestedReason: string;
    }
  | { ok: false; error: string };

/**
 * Partition eligible humans into championship vs non-qualifiers.
 * Toilet active only when non-qualifiers.length >= 4.
 */
export function partitionPostseasonFields(
  eligibleHumans: readonly PostseasonMemberInput[],
  cutPercentRaw: unknown
): PartitionResult {
  const ordered = sortChampionshipOrder(eligibleHumans);
  const q = computeQualifierCount(ordered.length, cutPercentRaw);
  if (!q.ok) {
    return { ok: false, error: q.error };
  }

  if (!q.contested) {
    return {
      ok: true,
      contested: false,
      cutPercent: q.cutPercent,
      qualifierCount: 0,
      championship: [],
      nonQualifiers: [...ordered],
      toiletBowlActive: false,
      toiletParticipants: [],
      uncontestedReason:
        ordered.length === 0
          ? "No eligible active humans for postseason."
          : "Fewer than 2 eligible active humans — championship cannot be contested.",
    };
  }

  // Large War Room leagues qualify through their four conferences, not the
  // overall table. Each conference sends its top four to the Championship
  // and its bottom four to the Toilet Bowl (16 players in each field).
  if (ordered.length > 32) {
    const conferenceGroups = new Map<string, PostseasonMemberInput[]>();
    for (const member of ordered) {
      const conference = member.division?.trim();
      if (!conference) {
        return { ok: false, error: "Every player needs a conference before the postseason cut." };
      }
      const group = conferenceGroups.get(conference) ?? [];
      group.push(member);
      conferenceGroups.set(conference, group);
    }
    if (conferenceGroups.size !== 4) {
      return { ok: false, error: "Large leagues require exactly four conferences for postseason qualification." };
    }
    if ([...conferenceGroups.values()].some((group) => group.length < 8)) {
      return { ok: false, error: "Each conference needs at least eight players before the postseason cut." };
    }

    const championshipIds = new Set<string>();
    const toiletIds = new Set<string>();
    for (const group of conferenceGroups.values()) {
      const ranked = sortChampionshipOrder(group);
      ranked.slice(0, 4).forEach((member) => championshipIds.add(member.userId));
      ranked.slice(-4).forEach((member) => toiletIds.add(member.userId));
    }
    const championship = ordered.filter((member) => championshipIds.has(member.userId));
    const nonQualifiers = ordered.filter((member) => !championshipIds.has(member.userId));
    const toiletParticipants = sortToiletOrder(
      ordered.filter((member) => toiletIds.has(member.userId))
    );
    return {
      ok: true,
      contested: true,
      cutPercent: 50,
      qualifierCount: championship.length,
      championship,
      nonQualifiers,
      toiletBowlActive: true,
      toiletParticipants,
    };
  }

  // The championship is the best available standings ranks, capped at 16.
  const championship = ordered.slice(0, q.qualifierCount);
  const nonQualifiers = ordered.slice(q.qualifierCount);
  const toiletBowlActive = nonQualifiers.length >= 4;
  // The Toilet Bowl is the worst 16 non-qualifiers, seeded worst-first.
  const toiletParticipants = toiletBowlActive
    ? sortToiletOrder(nonQualifiers).slice(0, 16)
    : [];

  return {
    ok: true,
    contested: true,
    cutPercent: q.cutPercent,
    qualifierCount: q.qualifierCount,
    championship,
    nonQualifiers,
    toiletBowlActive,
    toiletParticipants,
  };
}
