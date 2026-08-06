/**
 * E0 — Emergency Foundry quarantine (production incident).
 *
 * Foundry simulation advanced a production league's live week (observed Week 8)
 * by driving the real scoring + setLeagueActiveWeek pipeline on a production room.
 *
 * While QUARANTINED:
 * - Lab tools (demo slate, randomize & score, auto-score range, bot seed chaos) OFF
 * - Foundry sticky session cannot arm
 * - Foundry ceremony/drama prep refused
 * - Creator eyes may still browse locally where already isolated
 *
 * Does NOT repair production data. Does NOT change RLS. Lift only after
 * Foundry is proven isolated from production-mode leagues.
 */

/** Master kill switch — keep true until isolation is proven. */
export const FOUNDRY_EMERGENCY_QUARANTINE = true;

export const FOUNDRY_QUARANTINE_REASON =
  "E0 emergency quarantine: Foundry must not run production scoring, week advance, publish, bots, or drama on live leagues. Lab tools disabled until isolation is proven.";

export function isFoundryQuarantined(): boolean {
  if (FOUNDRY_EMERGENCY_QUARANTINE) return true;
  try {
    if (
      typeof process !== "undefined" &&
      process.env?.NEXT_PUBLIC_FOUNDRY_QUARANTINE === "1"
    ) {
      return true;
    }
  } catch {
    /* ok */
  }
  return false;
}

/** Call before any Foundry path that can mutate production crown-jewel tables. */
export function assertFoundryNotQuarantined(source: string): {
  ok: boolean;
  reason?: string;
} {
  if (!isFoundryQuarantined()) return { ok: true };
  try {
    console.warn("[FOUNDRY-QUARANTINE] blocked", source, FOUNDRY_QUARANTINE_REASON);
  } catch {
    /* ok */
  }
  return { ok: false, reason: FOUNDRY_QUARANTINE_REASON };
}
