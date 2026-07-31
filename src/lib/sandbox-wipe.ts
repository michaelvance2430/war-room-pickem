/**
 * Wipe local sim achievement residue (sandbox only).
 *
 * One-time migration v2: nuke career banks / sim permanent grants that piled
 * up from dry-run seasons so friend-league profiles start clean.
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

/** Bump to force another one-time full scrub on every browser. */
const NUKE_FLAG = "warroom-sandbox-career-nuke-v3";

export type SandboxWipeReport = {
  mode: string;
  wipedLocalSim: boolean;
  playersScrubbed: number;
  trophiesDeleted: number;
};

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * Clear First & Final claims for every league on this device.
 */
function clearAllFirstFinalClaims(): void {
  try {
    localStorage.removeItem("warroom-first-final-v1");
  } catch {
    /* ignore */
  }
}

/**
 * Clear all Elite Commish tenure on this device.
 */
function clearAllCommishTenure(): void {
  try {
    localStorage.removeItem("warroom-commish-tenure-v1");
  } catch {
    /* ignore */
  }
}

/**
 * Scrub every known player id on this browser:
 * - career bank → only protected (Legend / creator)
 * - permanent badges → only protected
 * - First & Final + Commish tenure wiped entirely (sim residue)
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

  // Always drop sim-only trackers (not protected career)
  clearAllFirstFinalClaims();
  clearAllCommishTenure();

  return n;
}

/**
 * One-time full nuke after many dry runs. Runs once per browser (flag v2).
 * Also safe to call repeatedly — flag prevents thrash after first pass.
 */
export function nukeAccumulatedSandboxCareersOnce(playerIds?: string[]): {
  ran: boolean;
  playersScrubbed: number;
} {
  if (!isSandboxMode() || !canUse()) {
    return { ran: false, playersScrubbed: 0 };
  }
  try {
    if (localStorage.getItem(NUKE_FLAG) === "1") {
      // Still light-scrub in case new ids appeared
      const n = scrubSandboxProgressOnThisDevice(playerIds);
      return { ran: false, playersScrubbed: n };
    }
  } catch {
    /* continue to scrub */
  }

  const n = scrubSandboxProgressOnThisDevice(playerIds);

  // Extra: empty career rows that only had sim badges → drop empty noise
  // stripSandboxCareerCheevos already rewrites points to protected-only

  try {
    localStorage.setItem(NUKE_FLAG, "1");
  } catch {
    /* ignore */
  }

  return { ran: true, playersScrubbed: n };
}

/**
 * Call after cloud season reset succeeds.
 */
export async function afterSeasonResetLocalCleanup(opts?: {
  leagueId?: string;
  playerIds?: string[];
}): Promise<SandboxWipeReport> {
  const session = getSession();
  const leagueId = opts?.leagueId || session?.leagueId || "";
  const mode = seasonModeLabel();

  if (!isSandboxMode()) {
    return {
      mode,
      wipedLocalSim: false,
      playersScrubbed: 0,
      trophiesDeleted: 0,
    };
  }

  const scrubbed = scrubSandboxProgressOnThisDevice(opts?.playerIds);

  if (leagueId) {
    clearFirstFinalForLeague(leagueId);
    clearCommishTenureForLeague(leagueId);
  }

  let trophiesDeleted = 0;
  if (leagueId) {
    const wipe = await wipeLeagueTrophiesForSandbox(leagueId);
    if (wipe.ok) trophiesDeleted = wipe.deleted || 0;
  }

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
