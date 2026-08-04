/**
 * Career Integrity — permanent legacy writes.
 *
 * One rule (Constitution · Production is Reality):
 *
 *   if (resolveLeagueMode() !== "production") → no permanent career write
 *
 * Do not add guest || foundry || preseason || … lists at call sites.
 * Put new theater modes on LeagueMode and derive in resolveLeagueMode().
 */

import {
  isProductionMode,
  resolveLeagueMode,
  type LeagueMode,
} from "./league-mode";

export type CareerWriteDenial = {
  ok: false;
  reason: string;
  mode: LeagueMode;
};

export type CareerWriteAllow = { ok: true; mode: "production" };

export type CareerWriteGate = CareerWriteAllow | CareerWriteDenial;

/**
 * Gate every permanent career / hardware write.
 * Call before league_trophies upsert, career bank, permanent badge (non-protected), etc.
 */
export function canWritePermanentCareer(opts?: {
  source?: string;
  league?: Parameters<typeof resolveLeagueMode>[0];
}): CareerWriteGate {
  const mode = resolveLeagueMode(opts?.league);
  if (mode !== "production") {
    return {
      ok: false,
      mode,
      reason: `league.mode=${mode} — only production engraves history. Everything else is rehearsal.`,
    };
  }
  void opts?.source;
  return { ok: true, mode: "production" };
}

/** Log + return false when a write was blocked (ops visibility). */
export function assertCareerWriteOrLog(source: string): boolean {
  const g = canWritePermanentCareer({ source });
  if (!g.ok) {
    try {
      console.info("[career-integrity] blocked", source, g.mode, g.reason);
    } catch {
      /* ok */
    }
    return false;
  }
  return true;
}

/** Convenience for call sites that only need a boolean. */
export function careerWritesAllowed(
  league?: Parameters<typeof resolveLeagueMode>[0]
): boolean {
  return isProductionMode(league);
}
