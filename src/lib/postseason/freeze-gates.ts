/**
 * Freeze / repair eligibility (pure policy — no I/O).
 * R2–R5 binding.
 */

import type {
  FreezePreconditionInput,
  FreezePreconditionResult,
  RepairEligibilityInput,
  RepairEligibilityResult,
} from "./types";

/**
 * Automatic freeze may run only as consequence of authoritative cut-week score.
 * Deputy may initiate via scoring; system records creation_reason cut_week_scored.
 * Never on read paths (caller responsibility).
 */
export function evaluateFreezePreconditions(
  input: FreezePreconditionInput
): FreezePreconditionResult {
  if (input.snapshotAlreadyExists) {
    return {
      ok: false,
      mayAutoFreeze: false,
      reason: "Snapshot already exists — use commissioner repair if allowed",
    };
  }

  if (!input.cutWeekScoreAuthoritative) {
    return {
      ok: false,
      mayAutoFreeze: false,
      reason: "Cut week is not authoritatively scored",
    };
  }

  if (
    input.actorRole === "member" ||
    (input.actorRole !== "commissioner" &&
      input.actorRole !== "deputy" &&
      input.actorRole !== "system" &&
      input.actorRole !== "service")
  ) {
    return {
      ok: false,
      mayAutoFreeze: false,
      reason: "Actor cannot score cut week / trigger freeze",
    };
  }

  // Commissioner or deputy scoring cut week → auto freeze OK
  if (input.actorRole === "commissioner" || input.actorRole === "deputy") {
    return {
      ok: true,
      mayAutoFreeze: true,
      reason: "Automatic freeze as consequence of authoritative cut-week score",
      creationReason: "cut_week_scored",
    };
  }

  if (input.actorRole === "system" || input.actorRole === "service") {
    return {
      ok: true,
      mayAutoFreeze: true,
      reason: "System/service freeze path (must be audited outside ordinary UI)",
      creationReason: "cut_week_scored",
    };
  }

  return {
    ok: false,
    mayAutoFreeze: false,
    reason: "Freeze not permitted",
  };
}

/**
 * Manual repair: commissioner-only, only before any postseason matchup result.
 * Deputy cannot repair. After postseason results → locked (exceptional rebuild = PS2+).
 */
export function evaluateRepairEligibility(
  input: RepairEligibilityInput
): RepairEligibilityResult {
  if (!input.snapshotExists) {
    return {
      ok: false,
      mayRepair: false,
      reason: "No snapshot to repair",
    };
  }

  if (input.actorRole === "deputy") {
    return {
      ok: false,
      mayRepair: false,
      reason: "Deputy cannot manually repair postseason fields",
    };
  }

  if (input.actorRole !== "commissioner") {
    return {
      ok: false,
      mayRepair: false,
      reason: "Only the commissioner may manually repair postseason fields",
    };
  }

  if (input.postseasonResultExists) {
    return {
      ok: false,
      mayRepair: false,
      reason:
        "Repair locked after first authoritative postseason matchup result — exceptional rebuild required",
    };
  }

  const note = (input.repairNote || "").trim();
  if (!note) {
    return {
      ok: false,
      mayRepair: false,
      reason: "Repair note is required",
    };
  }

  return { ok: true, mayRepair: true };
}

/**
 * R2 design helper: cut week must not be treated as officially scored if freeze fails.
 * Pure contract for later transactional wiring — does not perform I/O.
 */
export function cutScoreAndFreezeCoupling(opts: {
  freezeSucceeded: boolean;
  cutWeekScoreWouldCommit: boolean;
}): { mayCommitCutScore: boolean; reason: string } {
  if (!opts.cutWeekScoreWouldCommit) {
    return { mayCommitCutScore: false, reason: "Cut score not ready to commit" };
  }
  if (!opts.freezeSucceeded) {
    return {
      mayCommitCutScore: false,
      reason:
        "Must not commit cut-week score if postseason snapshot freeze failed",
    };
  }
  return {
    mayCommitCutScore: true,
    reason: "Cut score and freeze may commit together",
  };
}
