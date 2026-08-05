/**
 * Canonical season identity — single source for CFB/NFL starting year.
 *
 * R1: trophies, postseason snapshot season_key, Gazette, Moments, closeout
 * must use this resolver (not ad-hoc calendar year).
 *
 * Rule (same as prior defaultSeasonYear):
 * Jan–June → previous calendar year (still in prior fall season’s identity).
 * July–December → current calendar year (new season’s starting year).
 *
 * Example: 2026-08-15 → 2026; 2027-01-10 → 2026; 2027-08-01 → 2027.
 */

/** Canonical numeric season year (starting year, e.g. 2026). */
export function canonicalSeasonYear(now: Date = new Date()): number {
  const m = now.getMonth(); // 0-indexed; Jan=0 … Jun=5
  return m < 6 ? now.getFullYear() - 1 : now.getFullYear();
}

/** Stable text season_key derived from canonical year. */
export function seasonKeyFromYear(year: number): string {
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    throw new Error(`Invalid season year: ${year}`);
  }
  return String(Math.trunc(year));
}

export function canonicalSeasonKey(now: Date = new Date()): string {
  return seasonKeyFromYear(canonicalSeasonYear(now));
}

/** Parse season_key back to year (strict). */
export function seasonYearFromKey(seasonKey: string): number {
  const y = Number.parseInt(String(seasonKey).trim(), 10);
  if (!Number.isFinite(y) || String(y) !== String(seasonKey).trim()) {
    throw new Error(`Invalid season_key: ${seasonKey}`);
  }
  return y;
}
