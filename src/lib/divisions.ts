/** League divisions — assigned on join, managed by commissioner / deputy only. */

export type DivisionName = "North" | "South" | "East" | "West";

export const DIVISIONS: DivisionName[] = ["North", "South", "East", "West"];

/**
 * Stored enum values stay North/South/East/West (Postgres).
 * Display labels are sport flavor only — no logos, no official affiliation.
 *
 * NFL → AFC/NFC East–West (pro postseason story).
 * CFB → SEC / Big Ten / ACC / Big 12 (campus identity for brackets).
 */
const NFL_DIVISION_LABELS: Record<DivisionName, string> = {
  North: "AFC East",
  South: "AFC West",
  East: "NFC East",
  West: "NFC West",
};

const CFB_DIVISION_LABELS: Record<DivisionName, string> = {
  North: "SEC",
  South: "Big Ten",
  East: "ACC",
  West: "Big 12",
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
  if (sportId === "cfb" || sportId == null || sportId === "") {
    // Default / classic War Room pack = CFB conference flavor
    return CFB_DIVISION_LABELS[d];
  }
  // Other packs (WWC, future): plain compass until they get their own map
  return d;
}

/** Tab / chip label — "SEC" vs "AFC East" vs "Overall" */
export function divisionTabLabel(
  division: DivisionName | "Overall",
  sportId?: string | null
): string {
  if (division === "Overall") return "Overall";
  return divisionDisplayLabel(division, sportId);
}

/**
 * Longer form for sentences.
 * Conference names already read complete (SEC, AFC East) — no "Division" suffix.
 * Unknown packs keep "North Division".
 */
export function divisionFullLabel(
  division: string | null | undefined,
  sportId?: string | null
): string {
  const short = divisionDisplayLabel(division, sportId);
  if (sportId === "nfl" || sportId === "cfb" || sportId == null || sportId === "") {
    return short;
  }
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
