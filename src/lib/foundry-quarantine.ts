/**
 * E0 — Foundry boundary (was emergency quarantine).
 *
 * Blanket kill switch retired in favor of hard LAB isolation:
 * simulations may run only on explicitly marked test leagues.
 * Production rooms and real identities hard-blocked (see foundry-isolation.ts).
 *
 * FOUNDRY_EMERGENCY_QUARANTINE remains available as a master kill if needed.
 */

import {
  assertFoundryMutationAllowed,
  FOUNDRY_LAB_BLOCK_REASON,
} from "@/lib/foundry-isolation";

/**
 * Master kill switch — set true only for emergency full Foundry blackout.
 * Isolation is the normal production control.
 */
export const FOUNDRY_EMERGENCY_QUARANTINE = false;

export const FOUNDRY_QUARANTINE_REASON =
  "E0 emergency quarantine: Foundry fully disabled. Clear FOUNDRY_EMERGENCY_QUARANTINE only after ops approval.";

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

/**
 * Call before any Foundry path that can mutate crown-jewel data.
 * Hard stop on failure — no soft fallback to production.
 */
export function assertFoundryNotQuarantined(source: string): {
  ok: boolean;
  reason?: string;
} {
  if (isFoundryQuarantined()) {
    try {
      console.warn(
        "[FOUNDRY-QUARANTINE] blocked",
        source,
        FOUNDRY_QUARANTINE_REASON
      );
    } catch {
      /* ok */
    }
    return { ok: false, reason: FOUNDRY_QUARANTINE_REASON };
  }

  const gate = assertFoundryMutationAllowed(source);
  if (!gate.ok) {
    return { ok: false, reason: gate.reason || FOUNDRY_LAB_BLOCK_REASON };
  }
  return { ok: true };
}
