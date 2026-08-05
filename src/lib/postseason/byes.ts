/**
 * First-round bye planning — mirrors brackets.ts seed placement.
 * No fake opponents; bye is structural only.
 */

/** Next power of two ≥ n (bracket pad size). */
export function nextPow2(n: number): number {
  if (n <= 0) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Standard seed → slot index map (same tables as brackets.ts getSeedPositions).
 * Seed 1 is highest.
 */
export function getSeedPositions(size: number): number[] {
  if (size === 2) return [0, 1];
  if (size === 4) return [0, 3, 2, 1];
  if (size === 8) return [0, 7, 4, 3, 2, 5, 6, 1];
  if (size === 16)
    return [0, 15, 8, 7, 4, 11, 12, 3, 2, 13, 10, 5, 6, 9, 14, 1];
  return classicSeedPositions(size);
}

function classicSeedPositions(size: number): number[] {
  if (size === 1) return [0];
  const half = classicSeedPositions(size / 2);
  const out: number[] = [];
  for (const p of half) {
    out.push(p);
    out.push(size - 1 - p);
  }
  return out;
}

/**
 * For n seeded players (1..n best to worst), which seeds get a first-round bye?
 * Empty bracket slots (n+1..size) are byes opposite the seed placement.
 */
export function planFirstRoundByes(seedCount: number): {
  bracketSize: number;
  /** seed numbers (1-based) that receive a first-round bye */
  byeSeeds: number[];
  /** seed → firstRoundBye */
  byeBySeed: Map<number, boolean>;
} {
  const n = Math.max(0, Math.trunc(seedCount));
  if (n <= 1) {
    return { bracketSize: n === 1 ? 1 : 0, byeSeeds: [], byeBySeed: new Map() };
  }
  const bracketSize = nextPow2(n);
  const positions = getSeedPositions(bracketSize);
  // slots[pos] = seed or null (bye slot)
  const slots: (number | null)[] = new Array(bracketSize).fill(null);
  for (let seed = 1; seed <= bracketSize; seed++) {
    const pos = positions[seed - 1];
    if (seed <= n) slots[pos] = seed;
    else slots[pos] = null; // bye
  }

  const byeBySeed = new Map<number, boolean>();
  for (let s = 1; s <= n; s++) byeBySeed.set(s, false);

  for (let i = 0; i < bracketSize; i += 2) {
    const a = slots[i];
    const b = slots[i + 1];
    if (a != null && b == null) byeBySeed.set(a, true);
    if (b != null && a == null) byeBySeed.set(b, true);
  }

  const byeSeeds = [...byeBySeed.entries()]
    .filter(([, v]) => v)
    .map(([s]) => s)
    .sort((x, y) => x - y);

  return { bracketSize, byeSeeds, byeBySeed };
}
