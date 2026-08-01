/** League divisions — assigned on join, managed by commissioner / deputy only. */

export type DivisionName = "North" | "South" | "East" | "West";

export const DIVISIONS: DivisionName[] = ["North", "South", "East", "West"];

/**
 * Stored enum values stay North/South/East/West (Postgres).
 * NFL leagues display as AFC/NFC East–West for pro identity.
 */
const NFL_DIVISION_LABELS: Record<DivisionName, string> = {
  North: "AFC East",
  South: "AFC West",
  East: "NFC East",
  West: "NFC West",
};

export function isDivisionName(v: unknown): v is DivisionName {
  return typeof v === "string" && (DIVISIONS as string[]).includes(v);
}

/** Human label for UI (standings, profile, trophies). */
export function divisionDisplayLabel(
  division: string | null | undefined,
  sportId?: string | null
): string {
  const d = isDivisionName(division) ? division : "North";
  if (sportId === "nfl") return NFL_DIVISION_LABELS[d];
  return d;
}

/** Tab / chip label — "AFC East" vs "North" */
export function divisionTabLabel(
  division: DivisionName | "Overall",
  sportId?: string | null
): string {
  if (division === "Overall") return "Overall";
  return divisionDisplayLabel(division, sportId);
}

/** Longer form: "AFC East" or "North Division" */
export function divisionFullLabel(
  division: string | null | undefined,
  sportId?: string | null
): string {
  const short = divisionDisplayLabel(division, sportId);
  if (sportId === "nfl") return short;
  return `${short} Division`;
}

/**
 * Pick the division with the fewest members (stable N→S→E→W on ties).
 * Keeps fields even as people join without a manual auto-balance.
 */
export function pickLeastPopulatedDivision(
  counts: Partial<Record<DivisionName, number>>
): DivisionName {
  let best: DivisionName = "North";
  let bestCount = Number.POSITIVE_INFINITY;
  for (const d of DIVISIONS) {
    const n = counts[d] ?? 0;
    if (n < bestCount) {
      bestCount = n;
      best = d;
    }
  }
  return best;
}

/** Count current roster into division buckets. */
export function countByDivision(
  members: { division?: string | null }[]
): Record<DivisionName, number> {
  const counts: Record<DivisionName, number> = {
    North: 0,
    South: 0,
    East: 0,
    West: 0,
  };
  for (const m of members) {
    const d = m.division;
    if (isDivisionName(d)) counts[d] += 1;
    else counts.North += 1;
  }
  return counts;
}

/**
 * Round-robin by name (deterministic). Used by full auto-balance.
 * Humans and bots all get a slot — order by name for stability across devices.
 */
export function planAutoBalance(
  members: { id: string; name: string }[]
): { id: string; division: DivisionName }[] {
  const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));
  return sorted.map((m, i) => ({
    id: m.id,
    division: DIVISIONS[i % DIVISIONS.length],
  }));
}
