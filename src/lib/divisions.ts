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

// Stored values remain compatible with every existing league. Fieldhouse only
// changes the public labels to the four-region language used by March Madness.
const CBB_REGION_LABELS: Record<DivisionName, string> = {
  North: "Midwest",
  South: "South",
  East: "East",
  West: "West",
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
  if (sportId === "cbb") return CBB_REGION_LABELS[d];
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
  if (sportId === "nfl" || sportId === "cfb" || sportId === "cbb" || sportId == null || sportId === "") {
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

/** Empty zero counts for all four stored groups. */
export function emptyDivisionCounts(): Record<DivisionName, number> {
  return { North: 0, South: 0, East: 0, West: 0 };
}

/** Count current roster into division buckets (invalid → counted only via truth helpers). */
export function countByDivision(
  members: { division?: string | null }[]
): Record<DivisionName, number> {
  const counts = emptyDivisionCounts();
  for (const m of members) {
    const d = m.division;
    if (isDivisionName(d)) counts[d] += 1;
    else counts.North += 1;
  }
  return counts;
}

/**
 * Strict counts: invalid/null division is NOT forced into North.
 * Used by balance verification (invalid must be zero after a successful plan).
 */
export function countByDivisionStrict(
  members: { division?: string | null }[]
): {
  counts: Record<DivisionName, number>;
  invalid: number;
} {
  const counts = emptyDivisionCounts();
  let invalid = 0;
  for (const m of members) {
    if (isDivisionName(m.division)) counts[m.division] += 1;
    else invalid += 1;
  }
  return { counts, invalid };
}

/** NFL conference pairing (stored compass groups). */
export const NFL_AFC: readonly DivisionName[] = ["North", "South"];
export const NFL_NFC: readonly DivisionName[] = ["East", "West"];

export function conferenceTotals(
  counts: Record<DivisionName, number>
): { afc: number; nfc: number } {
  return {
    afc: counts.North + counts.South,
    nfc: counts.East + counts.West,
  };
}

export function fourWayMaxMinDiff(
  counts: Record<DivisionName, number>
): number {
  const vals = DIVISIONS.map((d) => counts[d]);
  return Math.max(...vals) - Math.min(...vals);
}

/** True when four groups differ by at most 1 and every member is in a valid group. */
export function isFourWayBalanced(
  counts: Record<DivisionName, number>,
  total: number,
  invalid = 0
): boolean {
  if (invalid > 0) return false;
  const sum = DIVISIONS.reduce((s, d) => s + counts[d], 0);
  if (sum !== total) return false;
  return fourWayMaxMinDiff(counts) <= 1;
}

/** NFL: conferences differ by at most 1. */
export function isNflConferenceBalanced(
  counts: Record<DivisionName, number>
): boolean {
  const { afc, nfc } = conferenceTotals(counts);
  return Math.abs(afc - nfc) <= 1;
}

export function isLeagueDivisionBalanced(
  counts: Record<DivisionName, number>,
  total: number,
  opts?: { sportId?: string | null; invalid?: number }
): boolean {
  if (!isFourWayBalanced(counts, total, opts?.invalid ?? 0)) return false;
  if (opts?.sportId === "nfl") return isNflConferenceBalanced(counts);
  return true;
}

export type MemberForBalance = {
  /** memberships.id */
  id: string;
  division?: string | null;
};

export type BalanceAssignment = {
  id: string;
  division: DivisionName;
};

export type BalanceMove = {
  id: string;
  from: DivisionName | null;
  to: DivisionName;
};

export type MinMoveBalancePlan = {
  assignments: BalanceAssignment[];
  moves: BalanceMove[];
  moveCount: number;
  targetCounts: Record<DivisionName, number>;
  beforeCounts: Record<DivisionName, number>;
  afterCounts: Record<DivisionName, number>;
  alreadyBalanced: boolean;
  sportId: string;
};

function cloneCounts(
  c: Record<DivisionName, number>
): Record<DivisionName, number> {
  return {
    North: c.North,
    South: c.South,
    East: c.East,
    West: c.West,
  };
}

function sortIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}

/**
 * All four-way target size maps with max−min ≤ 1 and sum = n.
 * Each of `r = n % 4` groups gets floor(n/4)+1; the rest get floor(n/4).
 */
export function enumerateFourWayTargets(
  n: number
): Record<DivisionName, number>[] {
  if (n < 0) return [];
  if (n === 0) {
    return [emptyDivisionCounts()];
  }
  const base = Math.floor(n / 4);
  const r = n % 4;
  const out: Record<DivisionName, number>[] = [];

  function pick(start: number, need: number, chosen: DivisionName[]) {
    if (need === 0) {
      const t = emptyDivisionCounts();
      for (const d of DIVISIONS) t[d] = base;
      for (const d of chosen) t[d] = base + 1;
      out.push(t);
      return;
    }
    for (let i = start; i < DIVISIONS.length; i++) {
      chosen.push(DIVISIONS[i]);
      pick(i + 1, need - 1, chosen);
      chosen.pop();
    }
  }

  if (r === 0) {
    const t = emptyDivisionCounts();
    for (const d of DIVISIONS) t[d] = base;
    out.push(t);
  } else {
    pick(0, r, []);
  }
  return out;
}

/**
 * NFL targets: conference totals differ by ≤1, each conference split across
 * its two divisions with max−min ≤1, four-way max−min ≤1 automatically.
 */
export function enumerateNflTargets(
  n: number
): Record<DivisionName, number>[] {
  if (n < 0) return [];
  const out: Record<DivisionName, number>[] = [];
  // Conference seat totals
  const confOptions: [number, number][] =
    n % 2 === 0
      ? [[n / 2, n / 2]]
      : [
          [Math.floor(n / 2), Math.ceil(n / 2)],
          [Math.ceil(n / 2), Math.floor(n / 2)],
        ];

  function splits(c: number): [number, number][] {
    if (c <= 0) return [[0, 0]];
    const a = Math.floor(c / 2);
    const b = c - a;
    if (a === b) return [[a, b]];
    return [
      [a, b],
      [b, a],
    ];
  }

  for (const [afc, nfc] of confOptions) {
    for (const [nSize, sSize] of splits(afc)) {
      for (const [eSize, wSize] of splits(nfc)) {
        out.push({
          North: nSize,
          South: sSize,
          East: eSize,
          West: wSize,
        });
      }
    }
  }
  // De-dupe identical maps
  const seen = new Set<string>();
  return out.filter((t) => {
    const key = DIVISIONS.map((d) => t[d]).join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Min-move assignment for fixed target sizes.
 * Keeps members in their current valid division when capacity remains;
 * surplus + invalid fill deficits. Tie-break: membership id ascending.
 */
export function assignMinMovesForTargets(
  members: MemberForBalance[],
  targets: Record<DivisionName, number>
): {
  assignments: BalanceAssignment[];
  moves: BalanceMove[];
  afterCounts: Record<DivisionName, number>;
} {
  const byDiv: Record<DivisionName, string[]> = {
    North: [],
    South: [],
    East: [],
    West: [],
  };
  const unassigned: string[] = [];

  for (const m of members) {
    if (isDivisionName(m.division)) byDiv[m.division].push(m.id);
    else unassigned.push(m.id);
  }
  for (const d of DIVISIONS) {
    byDiv[d] = sortIds(byDiv[d]);
  }
  unassigned.sort((a, b) => a.localeCompare(b));

  const kept: Record<DivisionName, string[]> = {
    North: [],
    South: [],
    East: [],
    West: [],
  };
  const free: string[] = [...unassigned];

  for (const d of DIVISIONS) {
    const cap = targets[d] ?? 0;
    const pool = byDiv[d];
    if (pool.length <= cap) {
      kept[d] = [...pool];
    } else {
      // Keep lowest membership ids; higher ids become movers
      kept[d] = pool.slice(0, cap);
      free.push(...pool.slice(cap));
    }
  }
  free.sort((a, b) => a.localeCompare(b));

  // Fill deficits in division order (N→S→E→W), taking lowest free ids
  let freeIdx = 0;
  for (const d of DIVISIONS) {
    const need = (targets[d] ?? 0) - kept[d].length;
    for (let i = 0; i < need; i++) {
      const id = free[freeIdx++];
      if (!id) break;
      kept[d].push(id);
    }
  }

  const original = new Map<string, DivisionName | null>();
  for (const m of members) {
    original.set(m.id, isDivisionName(m.division) ? m.division : null);
  }

  const assignments: BalanceAssignment[] = [];
  const moves: BalanceMove[] = [];
  const afterCounts = emptyDivisionCounts();

  for (const d of DIVISIONS) {
    for (const id of kept[d]) {
      assignments.push({ id, division: d });
      afterCounts[d] += 1;
      const from = original.get(id) ?? null;
      if (from !== d) {
        moves.push({ id, from, to: d });
      }
    }
  }

  // Safety: every member assigned exactly once
  if (assignments.length !== members.length) {
    // Should not happen if targets sum to n — fail closed by forcing remainder
    const assigned = new Set(assignments.map((a) => a.id));
    for (const m of members) {
      if (assigned.has(m.id)) continue;
      const d: DivisionName = "North";
      assignments.push({ id: m.id, division: d });
      afterCounts[d] += 1;
      moves.push({
        id: m.id,
        from: isDivisionName(m.division) ? m.division : null,
        to: d,
      });
    }
  }

  assignments.sort((a, b) => a.id.localeCompare(b.id));
  moves.sort((a, b) => a.id.localeCompare(b.id));

  return { assignments, moves, afterCounts };
}

function targetKey(t: Record<DivisionName, number>): string {
  return DIVISIONS.map((d) => `${d}:${t[d]}`).join("|");
}

/**
 * Auto Balance planner: minimize membership moves while guaranteeing
 * four-way balance (max−min ≤ 1). For NFL, also AFC/NFC difference ≤ 1.
 *
 * Does not use display names, points, or randomness.
 * Deterministic: membership id is the only tie-breaker.
 */
export function planMinMoveBalance(
  members: MemberForBalance[],
  opts?: { sportId?: string | null }
): MinMoveBalancePlan {
  const sportId = (opts?.sportId || "cfb").trim() || "cfb";
  const n = members.length;

  const beforeStrict = countByDivisionStrict(members);
  // beforeCounts for display: invalid shown separately via alreadyBalanced check
  const beforeCounts = emptyDivisionCounts();
  for (const m of members) {
    if (isDivisionName(m.division)) beforeCounts[m.division] += 1;
    // invalid not counted in beforeCounts numbers used for targets — tracked in invalid
  }

  const candidates =
    sportId === "nfl" ? enumerateNflTargets(n) : enumerateFourWayTargets(n);

  let best: {
    targets: Record<DivisionName, number>;
    assignments: BalanceAssignment[];
    moves: BalanceMove[];
    afterCounts: Record<DivisionName, number>;
  } | null = null;

  for (const targets of candidates) {
    const sum = DIVISIONS.reduce((s, d) => s + targets[d], 0);
    if (sum !== n) continue;
    const result = assignMinMovesForTargets(members, targets);
    if (!isLeagueDivisionBalanced(result.afterCounts, n, { sportId })) {
      continue;
    }
    if (
      !best ||
      result.moves.length < best.moves.length ||
      (result.moves.length === best.moves.length &&
        targetKey(targets) < targetKey(best.targets))
    ) {
      best = {
        targets: cloneCounts(targets),
        assignments: result.assignments,
        moves: result.moves,
        afterCounts: result.afterCounts,
      };
    }
  }

  // Fallback: four-way only if NFL enum somehow empty
  if (!best) {
    const fallback =
      enumerateFourWayTargets(n)[0] || emptyDivisionCounts();
    const result = assignMinMovesForTargets(members, fallback);
    best = {
      targets: cloneCounts(fallback),
      assignments: result.assignments,
      moves: result.moves,
      afterCounts: result.afterCounts,
    };
  }

  const alreadyBalanced =
    best.moves.length === 0 &&
    isLeagueDivisionBalanced(beforeCounts, n - beforeStrict.invalid, {
      sportId,
      invalid: beforeStrict.invalid,
    }) &&
    beforeStrict.invalid === 0;

  // If invalid existed, alreadyBalanced must be false even if moves filled them
  const trulyAlready =
    beforeStrict.invalid === 0 &&
    best.moves.length === 0 &&
    isLeagueDivisionBalanced(beforeCounts, n, { sportId });

  return {
    assignments: best.assignments,
    moves: best.moves,
    moveCount: best.moves.length,
    targetCounts: best.targets,
    beforeCounts:
      beforeStrict.invalid === 0
        ? beforeCounts
        : // Show invalid as not in the four groups for UI honesty
          beforeCounts,
    afterCounts: best.afterCounts,
    alreadyBalanced: trulyAlready,
    sportId,
  };
}

/**
 * @deprecated Prefer planMinMoveBalance. Kept for any external imports;
 * now delegates to min-move planner (CFB four-way, no name shuffle).
 */
export function planAutoBalance(
  members: { id: string; name?: string; division?: string | null }[]
): { id: string; division: DivisionName }[] {
  const plan = planMinMoveBalance(
    members.map((m) => ({ id: m.id, division: m.division ?? null }))
  );
  return plan.assignments;
}

/** Format counts as "7 / 6 / 7 / 6" in N/S/E/W order. */
export function formatDivisionCounts(
  counts: Record<DivisionName, number>
): string {
  return DIVISIONS.map((d) => counts[d]).join(" / ");
}
