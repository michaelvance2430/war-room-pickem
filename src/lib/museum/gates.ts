/**
 * Production-integrity gates for Museum Phase 1A writes.
 */

import { canWritePermanentCareer } from "@/lib/career-integrity";
import { isProductionMode } from "@/lib/league-mode";
import { getLeague } from "@/lib/league";

export type MuseumWriteGate =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Permanent Museum / durable-score production writes.
 * Foundry, demo, sandbox, eyes → blocked.
 */
export function canWriteMuseumProduction(opts?: {
  source?: string;
}): MuseumWriteGate {
  // Through Their Eyes / local play — sync check via isProductionMode + career gate
  // Eyes also forces non-production in resolveLeagueMode when local play is active.
  const league = getLeague();
  if (!isProductionMode(league)) {
    return {
      ok: false,
      reason: `league.mode≠production (${opts?.source || "museum"})`,
    };
  }

  const career = canWritePermanentCareer({
    source: opts?.source || "museum",
    league,
  });
  if (!career.ok) {
    return { ok: false, reason: career.reason };
  }

  return { ok: true };
}
