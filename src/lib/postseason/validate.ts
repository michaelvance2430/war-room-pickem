/**
 * Snapshot plan validation (pure).
 */

import type { PlannedParticipant, SnapshotPlan, ValidationResult } from "./types";

export function validateNoOverlap(
  participants: readonly PlannedParticipant[]
): ValidationResult {
  const champ = new Set<string>();
  const toilet = new Set<string>();
  const errors: string[] = [];

  for (const p of participants) {
    if (p.field === "championship") {
      if (toilet.has(p.userId)) {
        errors.push(`Overlap: ${p.userId} in championship and toilet`);
      }
      if (champ.has(p.userId)) {
        errors.push(`Duplicate championship entry: ${p.userId}`);
      }
      champ.add(p.userId);
    }
    if (p.field === "toilet") {
      if (champ.has(p.userId)) {
        errors.push(`Overlap: ${p.userId} in championship and toilet`);
      }
      if (toilet.has(p.userId)) {
        errors.push(`Duplicate toilet entry: ${p.userId}`);
      }
      toilet.add(p.userId);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

export function validateSnapshotPlan(plan: SnapshotPlan): ValidationResult {
  const errors: string[] = [];

  if (!plan.leagueId) errors.push("leagueId required");
  if (!plan.seasonKey) errors.push("seasonKey required");
  if (plan.cutPercent < 0 || plan.cutPercent > 100) {
    errors.push("cutPercent out of range");
  }

  const champ = plan.participants.filter((p) => p.field === "championship");
  const toilet = plan.participants.filter((p) => p.field === "toilet");
  const elim = plan.participants.filter((p) => p.field === "eliminated");

  if (plan.contested) {
    if (champ.length !== plan.qualifierCount) {
      errors.push(
        `qualifierCount ${plan.qualifierCount} != championship rows ${champ.length}`
      );
    }
    if (champ.length < 2) {
      errors.push("Contested plan must have at least 2 championship participants");
    }
    if (champ.length > 16) {
      errors.push("Championship field cannot exceed 16 participants");
    }
  } else {
    if (champ.length > 0) {
      errors.push("Uncontested plan must not list championship participants");
    }
    if (plan.toiletBowlActive) {
      errors.push("Uncontested plan cannot have toilet active");
    }
  }

  if (plan.toiletBowlActive) {
    if (toilet.length < 4) {
      errors.push("Toilet active requires ≥4 toilet participants");
    }
    if (toilet.length > 16) {
      errors.push("Toilet field cannot exceed 16 participants");
    }
  } else if (toilet.length > 0) {
    errors.push("Toilet inactive but toilet participants present");
  }

  // Seeds unique and dense 1..n within each field
  for (const [label, list] of [
    ["championship", champ],
    ["toilet", toilet],
  ] as const) {
    const seeds = list.map((p) => p.seed).filter((s): s is number => s != null);
    if (seeds.length !== list.length) {
      errors.push(`${label}: every participant needs a seed`);
    }
    const sorted = [...seeds].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i + 1) {
        errors.push(`${label}: seeds must be 1..n contiguous`);
        break;
      }
    }
  }

  const overlap = validateNoOverlap(plan.participants);
  if (!overlap.ok) errors.push(...overlap.errors);

  // eligible count consistency
  const allIds = new Set(plan.participants.map((p) => p.userId));
  if (allIds.size !== plan.participants.length) {
    errors.push("Duplicate user across participant rows");
  }
  if (plan.participants.length !== plan.eligibleHumanCount) {
    errors.push("Champ + toilet + eliminated must cover all eligible humans");
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}
