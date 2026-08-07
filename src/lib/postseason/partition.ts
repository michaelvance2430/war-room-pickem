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

  // Allocate the configured field proportionally through conferences first,
  // then award any remaining seats as overall wild cards. With the default
  // 50% cut this is half of each conference plus the best remaining players.
  const divisions = ["North", "South", "East", "West"] as const;
  const qualifierIds = new Set<string>();
  for (const division of divisions) {
    const conference = ordered.filter((member) => member.division === division);
    const guaranteed = Math.floor(
      (conference.length * q.qualifierCount) / ordered.length
    );
    for (const member of conference.slice(0, guaranteed)) {
      qualifierIds.add(member.userId);
    }
  }
  for (const member of ordered) {
    if (qualifierIds.size >= q.qualifierCount) break;
    qualifierIds.add(member.userId);
  }
  const championship = ordered.filter((member) => qualifierIds.has(member.userId));
  const nonQualifiers = ordered.filter((member) => !qualifierIds.has(member.userId));
  const toiletBowlActive = nonQualifiers.length >= 4;
  // Toilet seeds: worst-first among non-qualifiers (shame bracket energy)
  const toiletParticipants = toiletBowlActive
    ? sortToiletOrder(nonQualifiers)
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
