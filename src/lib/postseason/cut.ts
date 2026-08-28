/**
 * Cut percent validation + qualifier count (pure).
 *
 * qualifierCount = ceil(activeHumanCount × (100 − cutPercent) / 100)
 * then clamp: min 2 when humans ≥ 2; max 16 and max humans; 2 humans → both.
 */

import type { CutPercentResult, QualifierCountResult } from "./types";

export function normalizeCutPercent(raw: unknown): CutPercentResult {
  if (raw === null || raw === undefined) {
    return { ok: false, error: "cutPercent is required" };
  }
  if (typeof raw === "string" && raw.trim() === "") {
    return { ok: false, error: "cutPercent is empty" };
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    return { ok: false, error: "cutPercent is not a finite number" };
  }
  if (n < 0) {
    return { ok: false, error: "cutPercent cannot be negative" };
  }
  if (n > 100) {
    return { ok: false, error: "cutPercent cannot exceed 100" };
  }
  // Integers only (50.0 ok; 50.5 rejected)
  if (Math.trunc(n) !== n) {
    return { ok: false, error: "cutPercent must be an integer 0–100" };
  }
  const cutPercent = n;
  return { ok: true, cutPercent };
}

/**
 * Championship qualifier count from active humans + eliminated %.
 */
export function computeQualifierCount(
  activeHumanCount: number,
  cutPercentRaw: unknown
): QualifierCountResult {
  const humans = Math.max(0, Math.trunc(activeHumanCount));
  const cut = normalizeCutPercent(cutPercentRaw);
  if (!cut.ok) {
    return {
      ok: false,
      error: cut.error,
      activeHumanCount: humans,
      contested: false,
    };
  }

  if (humans < 2) {
    return {
      ok: true,
      activeHumanCount: humans,
      cutPercent: cut.cutPercent,
      qualifierCount: 0,
      contested: false,
    };
  }

  // Exactly 2 → both always
  if (humans === 2) {
    return {
      ok: true,
      activeHumanCount: humans,
      cutPercent: cut.cutPercent,
      qualifierCount: 2,
      contested: true,
    };
  }

  const raw = Math.ceil((humans * (100 - cut.cutPercent)) / 100);
  let qualifierCount = raw;
  if (qualifierCount < 2) qualifierCount = 2;
  if (qualifierCount > 16) qualifierCount = 16;
  if (qualifierCount > humans) qualifierCount = humans;

  return {
    ok: true,
    activeHumanCount: humans,
    cutPercent: cut.cutPercent,
    qualifierCount,
    contested: true,
  };
}
