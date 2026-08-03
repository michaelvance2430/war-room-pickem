/**
 * P0 SAFE NAV MODE
 *
 * Temporarily disables nonessential systems that can intercept navigation:
 * auto Moments, badge queues, coaching, cinematic full-screens, etc.
 *
 * Default: ON until plain-app navigation is proven stable.
 *
 * Escape hatch for creator QA (re-enable moments on this browser only):
 *   localStorage.setItem("warroom-safe-nav-off", "1"); location.reload()
 *
 * Force safe mode even if code default flips later:
 *   localStorage.setItem("warroom-safe-nav-on", "1")
 */

/** Master switch — keep true until navigation regression is closed. */
export const SAFE_NAV_DEFAULT = true;

export const EVENT_FORCE_DISMISS_OVERLAYS = "warroom-force-dismiss-overlays";
export const EVENT_NAV_DIAG = "warroom-nav-diag";

export function isSafeNavMode(): boolean {
  if (typeof window === "undefined") return SAFE_NAV_DEFAULT;
  try {
    if (localStorage.getItem("warroom-safe-nav-on") === "1") return true;
    if (localStorage.getItem("warroom-safe-nav-off") === "1") return false;
  } catch {
    /* ignore */
  }
  return SAFE_NAV_DEFAULT;
}

/** Body scroll / position locks max age before hard release. */
export const BODY_LOCK_MAX_MS = 8_000;

/** Navigation soft-lock max age (isNavigating-style flags). */
export const NAV_LOCK_MAX_MS = 4_000;

let navLockUntil = 0;
let bodyLockStartedAt = 0;

export function markBodyLockStarted(): void {
  if (!bodyLockStartedAt) bodyLockStartedAt = Date.now();
}

export function clearBodyLockTimer(): void {
  bodyLockStartedAt = 0;
}

export function noteNavAttempt(detail: {
  source?: string;
  target?: string;
  blocked?: boolean;
  reason?: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    const debug =
      process.env.NODE_ENV === "development" ||
      localStorage.getItem("warroom-runtime-debug") === "1" ||
      localStorage.getItem("warroom-nav-log") === "1";
    if (!debug) return;
    console.log("[WR-NAV]", {
      ts: new Date().toISOString(),
      ...detail,
      safeNav: isSafeNavMode(),
      path: window.location.pathname,
    });
  } catch {
    /* ignore */
  }
}

/**
 * Nuclear recovery: unlock chrome, clear session drama, neuter ghost overlays.
 * Safe to call often. Does not navigate.
 */
export function recoverNavigation(reason = "recover"): void {
  if (typeof window === "undefined") return;
  noteNavAttempt({ source: reason, blocked: false, reason: "recover" });

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const smooth = require("./smooth") as typeof import("./smooth");
    smooth.forceUnlockAllChrome();
  } catch {
    try {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.documentElement.style.overflow = "";
    } catch {
      /* ignore */
    }
  }

  clearBodyLockTimer();
  navLockUntil = 0;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const drama = require("./session-drama") as typeof import("./session-drama");
    drama.clearSessionDrama();
  } catch {
    /* ignore */
  }

  // Neuter any leftover full-screen layers that still capture pointers
  try {
    const nodes = document.querySelectorAll(
      '[aria-modal="true"], [role="dialog"], [data-moment], [data-contextual-coach], [data-fullscreen-overlay]'
    );
    for (const el of Array.from(nodes)) {
      const node = el as HTMLElement;
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const r = node.getBoundingClientRect();
      // Full-viewport or large overlay with no/low opacity still blocks
      const covers =
        r.width >= window.innerWidth * 0.85 &&
        r.height >= window.innerHeight * 0.85;
      const faded =
        parseFloat(style.opacity || "1") < 0.05 ||
        style.visibility === "hidden";
      if (covers || faded) {
        node.style.pointerEvents = "none";
        if (faded || !node.querySelector("button, a, input")) {
          node.style.display = "none";
        }
      }
    }
  } catch {
    /* ignore */
  }

  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_FORCE_DISMISS_OVERLAYS, { detail: { reason } })
    );
  } catch {
    /* ignore */
  }
}

/** Soft nav lock with auto-expiry (never permanent). */
export function acquireNavLock(ms = NAV_LOCK_MAX_MS): void {
  navLockUntil = Date.now() + ms;
}

export function isNavLocked(): boolean {
  if (Date.now() > navLockUntil) {
    navLockUntil = 0;
    return false;
  }
  return navLockUntil > 0;
}

export function releaseNavLock(): void {
  navLockUntil = 0;
}

export function shouldReleaseStaleBodyLock(): boolean {
  if (!bodyLockStartedAt) return false;
  return Date.now() - bodyLockStartedAt > BODY_LOCK_MAX_MS;
}
