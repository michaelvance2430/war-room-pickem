/**
 * Career Integrity — permanent legacy writes.
 *
 * Constitution:
 *  - Foundry / eyes / guest / preseason sandbox never write career.
 *  - Production leagues alone may earn permanent hardware & career stats.
 *  - Commissioners create experiences; they do not manufacture history.
 */

import { isSandboxMode } from "./season-mode";

export type CareerWriteDenial = {
  ok: false;
  reason: string;
};

export type CareerWriteAllow = { ok: true };

export type CareerWriteGate = CareerWriteAllow | CareerWriteDenial;

function isGuestActive(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const raw = localStorage.getItem("warroom-guest-mode-v1");
    if (!raw) return false;
    const g = JSON.parse(raw) as { active?: boolean };
    return g?.active === true;
  } catch {
    return false;
  }
}

function isEyesOrFoundryLocal(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const eyes = require("./creator-eyes") as typeof import("./creator-eyes");
    if (eyes.isEyesLocalPlayActive()) return true;
  } catch {
    /* ignore */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fp = require("./foundry-preview") as typeof import("./foundry-preview");
    if (typeof fp.allowFoundryCeremonies === "function" && fp.allowFoundryCeremonies()) {
      // Ceremony preview may celebrate UI — permanent engrave still blocked via sandbox/eyes
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Gate every permanent career / hardware write.
 * Call before league_trophies upsert, career bank, permanent badge (non-protected), etc.
 */
export function canWritePermanentCareer(opts?: {
  /** Optional source tag for logs */
  source?: string;
}): CareerWriteGate {
  if (isGuestActive()) {
    return {
      ok: false,
      reason: "Guest tour never writes career or hardware.",
    };
  }
  if (isEyesOrFoundryLocal()) {
    return {
      ok: false,
      reason:
        "Foundry / new-player eyes preview never engraves permanent hardware or career.",
    };
  }
  // Preseason dry-run calendar: sim may create disposable theater only
  if (isSandboxMode()) {
    return {
      ok: false,
      reason:
        "Preseason sandbox — trophies and career progress do not stick until the real season is open.",
    };
  }
  void opts?.source;
  return { ok: true };
}

/** Log + return false when a write was blocked (ops visibility). */
export function assertCareerWriteOrLog(source: string): boolean {
  const g = canWritePermanentCareer({ source });
  if (!g.ok) {
    try {
      console.info("[career-integrity] blocked", source, g.reason);
    } catch {
      /* ok */
    }
    return false;
  }
  return true;
}
