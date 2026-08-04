/**
 * Guest mode — REMOVED from product.
 *
 * Only purpose left: detect stale guest localStorage from old builds,
 * clear it safely, never revive a tour world.
 *
 * Architecture gate: GUEST_MODE_RETIRED documents the permanent decision.
 * There is no dormant guest product behind this flag.
 */

/** Permanent product decision — do not re-enable without a full product review. */
export const GUEST_MODE_RETIRED = true as const;

/** Legacy ids from retired tour — detect residue only */
export const LEGACY_GUEST_LEAGUE_ID = "guest-demo-league";
export const LEGACY_GUEST_PLAYER_ID = "guest-you";

const KEY = "warroom-guest-mode-v1";
const CONVERSION_KEY = "warroom-guest-conversion-dismissed-v1";
const SCORED_KEY = "warroom-guest-scored-weeks";

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * Clear leftover guest tour state from older app versions.
 * @returns true if anything guest-related was found and cleared
 */
export function purgeRetiredGuestSession(): boolean {
  if (!canUse()) return false;
  let found = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      found = true;
      try {
        const s = JSON.parse(raw) as { active?: boolean };
        if (s?.active) found = true;
      } catch {
        found = true;
      }
    }

    let sessionIsGuest = false;
    try {
      const sessRaw = localStorage.getItem("warroom-session");
      if (sessRaw) {
        const sess = JSON.parse(sessRaw) as {
          playerId?: string;
          leagueId?: string;
        };
        sessionIsGuest =
          sess?.playerId === LEGACY_GUEST_PLAYER_ID ||
          sess?.leagueId === LEGACY_GUEST_LEAGUE_ID ||
          (typeof sess?.playerId === "string" &&
            sess.playerId.startsWith("guest-")) ||
          (typeof sess?.leagueId === "string" &&
            sess.leagueId.startsWith("guest-"));
        if (sessionIsGuest) found = true;
      }
    } catch {
      /* ignore */
    }

    try {
      const lgRaw = localStorage.getItem("warroom-league");
      if (lgRaw) {
        const lg = JSON.parse(lgRaw) as { id?: string };
        if (lg?.id === LEGACY_GUEST_LEAGUE_ID || lg?.id?.startsWith("guest-")) {
          found = true;
          sessionIsGuest = true;
        }
      }
    } catch {
      /* ignore */
    }

    if (!found) return false;

    localStorage.removeItem(KEY);
    localStorage.removeItem(CONVERSION_KEY);
    localStorage.removeItem(SCORED_KEY);

    if (sessionIsGuest) {
      localStorage.removeItem("warroom-session");
      localStorage.removeItem("warroom-league");
      localStorage.removeItem("warroom-players");
      localStorage.removeItem("warroom-active-week");
      for (let w = 0; w <= 18; w++) {
        localStorage.removeItem(`warroom-card-week-${w}`);
        localStorage.removeItem(`warroom-results-week-${w}`);
        localStorage.removeItem(`warroom-picks-week-${w}`);
      }
    }

    try {
      window.dispatchEvent(
        new CustomEvent("warroom-guest-mode", { detail: { purged: true } })
      );
    } catch {
      /* ignore */
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Call on app boot. If old guest residue existed, purge and return path
 * for account creation (caller may navigate).
 */
export function bootPurgeLegacyGuest(): {
  purged: boolean;
  /** Use when purged — send human to real onboarding */
  signupHref: string;
} {
  const purged = purgeRetiredGuestSession();
  return {
    purged,
    signupHref: "/login?mode=signup",
  };
}
