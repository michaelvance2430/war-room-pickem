/**
 * Wipe local sim achievement residue after season reset (sandbox only).
 */

import {
  isSandboxMode,
  seasonModeLabel,
} from "./season-mode";
import {
  listPermanentBadgePlayerIds,
  stripSandboxPermanentBadges,
} from "./permanent-badges";
import {
  listCareerPlayerIds,
  stripSandboxCareerCheevos,
} from "./career-cheevo";
import { clearFirstFinalForLeague } from "./first-final";
import { clearCommishTenureForLeague } from "./commish-tenure";
import { wipeLeagueTrophiesForSandbox } from "./trophies";
import { getSession } from "./league";

export type SandboxWipeReport = {
  mode: string;
  wipedLocalSim: boolean;
  playersScrubbed: number;
  trophiesDeleted: number;
};

/**
 * Call after cloud season reset succeeds.
 * - Sandbox: strip sim permanent badges + career banks, First & Final, tenure, Trophy Room
 * - Real season: keep career/permanent; only clear week-local caches (caller already does)
 */
/**
 * Immediate scrub of sim-banked points already on this browser (no full reset).
 * Safe to call on Home boot during sandbox.
 */
export function scrubSandboxProgressOnThisDevice(playerIds?: string[]): number {
  if (!isSandboxMode()) return 0;
  const ids = new Set<string>(playerIds || []);
  const session = getSession();
  if (session?.playerId) ids.add(session.playerId);
  for (const id of listPermanentBadgePlayerIds()) ids.add(id);
  for (const id of listCareerPlayerIds()) ids.add(id);
  let n = 0;
  for (const id of ids) {
    const a = stripSandboxPermanentBadges(id);
    const b = stripSandboxCareerCheevos(id);
    if (a.length || b.length) n += 1;
  }
  return n;
}

export async function afterSeasonResetLocalCleanup(opts?: {
  leagueId?: string;
  playerIds?: string[];
}): Promise<SandboxWipeReport> {
  const session = getSession();
  const leagueId = opts?.leagueId || session?.leagueId || "";
  const mode = seasonModeLabel();

  if (!isSandboxMode()) {
    // Real season: cheevos stay. Optional: clear First & Final week claims only if desired —
    // leave them; they are real season flex.
    return {
      mode,
      wipedLocalSim: false,
      playersScrubbed: 0,
      trophiesDeleted: 0,
    };
  }

  const ids = new Set<string>(opts?.playerIds || []);
  if (session?.playerId) ids.add(session.playerId);
  for (const id of listPermanentBadgePlayerIds()) ids.add(id);
  for (const id of listCareerPlayerIds()) ids.add(id);

  let scrubbed = 0;
  for (const id of ids) {
    const a = stripSandboxPermanentBadges(id);
    const b = stripSandboxCareerCheevos(id);
    if (a.length || b.length) scrubbed += 1;
  }

  if (leagueId) {
    clearFirstFinalForLeague(leagueId);
    clearCommishTenureForLeague(leagueId);
  }

  let trophiesDeleted = 0;
  if (leagueId) {
    const wipe = await wipeLeagueTrophiesForSandbox(leagueId);
    if (wipe.ok) trophiesDeleted = wipe.deleted || 0;
  }

  // Clear local gazette archive flavor for this device
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith("warroom-gazette-seen") ||
        k.startsWith("warroom-commish-setup")
      ) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }

  return {
    mode,
    wipedLocalSim: true,
    playersScrubbed: scrubbed,
    trophiesDeleted,
  };
}
