/**
 * War Room smooth-runtime contract.
 *
 * Every route transition, modal, and cloud boot must obey:
 * 1) Paint shell first from local state
 * 2) Never body-lock without a refcounted unlock
 * 3) Never wait forever on network
 * 4) Prefetch primary desks so desktop soft-nav is warm
 * 5) One drama popup at a time (session-drama still owns exclusivity)
 *
 * If the app feels frozen, fix it HERE — not with another one-off page hack.
 */

import { unlockDocumentChrome, raceTimeout, armLoadingFailSafe } from "@/lib/boot-safety";
import { wrBodyLock, wrLog } from "@/lib/runtime-iso";

export { unlockDocumentChrome, raceTimeout, armLoadingFailSafe };

/** Primary desks — always warm these for logged-in users */
export const PRIMARY_ROUTES = [
  "/",
  "/picks",
  "/standings",
  "/locker-room",
  "/commissioner",
  "/gazette",
  "/board",
  "/account",
  "/stats",
  "/players",
] as const;

/** Default network ceiling for page-level data (ms) */
export const PAGE_LOAD_MS = 4_000;
/** Hero / secondary widgets */
export const WIDGET_LOAD_MS = 2_500;
/** Auth calls */
export const AUTH_MS = 12_000;

// ── Body scroll lock (named ownership + refcount) ─────────────────────────
// Ghost overlays freeze the app → orphan watchdog must stay.
// Legitimate modals (e.g. gazette-reader) register a named owner so the
// watchdog does NOT treat position:fixed as an orphan.
//
// Contract:
//   const release = acquireBodyLock("gazette-reader");
//   // … open lifecycle …
//   release();
//
// forceUnlockAllChrome is for route changes / real recovery only.

let bodyLockCount = 0;
/** Named owners currently holding a legitimate lock */
const bodyLockOwners = new Set<string>();
/** Document scroll Y when first owner acquired */
let lockedScrollY = 0;

export function getBodyLockCount(): number {
  return bodyLockCount;
}

export function getActiveBodyLockOwners(): string[] {
  return [...bodyLockOwners];
}

export function hasActiveBodyLockOwner(): boolean {
  return bodyLockOwners.size > 0;
}

function applyDocumentScrollLock(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  lockedScrollY =
    window.scrollY ||
    window.pageYOffset ||
    document.documentElement.scrollTop ||
    0;
  const b = document.body;
  const h = document.documentElement;
  b.style.overflow = "hidden";
  b.style.position = "fixed";
  b.style.top = `-${lockedScrollY}px`;
  b.style.left = "0";
  b.style.right = "0";
  b.style.width = "100%";
  b.style.touchAction = "none";
  h.style.overflow = "hidden";
  h.style.touchAction = "none";
}

function releaseDocumentScrollLock(): void {
  if (typeof document === "undefined") return;
  const y = lockedScrollY;
  unlockDocumentChrome();
  lockedScrollY = 0;
  try {
    window.scrollTo(0, y);
  } catch {
    try {
      document.documentElement.scrollTop = y;
      document.body.scrollTop = y;
    } catch {
      /* ok */
    }
  }
}

/**
 * Acquire a named body lock. Returns a release function (idempotent).
 * Prefer this over lockBodyScroll for modal readers.
 */
export function acquireBodyLock(owner: string): () => void {
  if (typeof document === "undefined") return () => {};
  const id = (owner || "anonymous").trim() || "anonymous";
  if (!bodyLockOwners.has(id)) {
    bodyLockOwners.add(id);
    bodyLockCount += 1;
    wrBodyLock(1, `acquire:${id}`);
    try {
      console.log(`[WR-BODYLOCK] acquire owner=${id} owners=${[...bodyLockOwners].join(",")}`);
    } catch {
      /* ok */
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sn = require("./safe-nav") as typeof import("./safe-nav");
      sn.markBodyLockStarted();
    } catch {
      /* ok */
    }
    if (bodyLockCount === 1) {
      try {
        applyDocumentScrollLock();
      } catch {
        /* ok */
      }
    }
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseBodyLockOwner(id);
  };
}

function releaseBodyLockOwner(owner: string): void {
  if (typeof document === "undefined") return;
  if (!bodyLockOwners.has(owner)) return;
  bodyLockOwners.delete(owner);
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  wrBodyLock(-1, `release:${owner}`);
  try {
    console.log(
      `[WR-BODYLOCK] release owner=${owner} remaining=${[...bodyLockOwners].join(",") || "none"}`
    );
  } catch {
    /* ok */
  }
  if (bodyLockOwners.size === 0 || bodyLockCount === 0) {
    bodyLockCount = 0;
    bodyLockOwners.clear();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sn = require("./safe-nav") as typeof import("./safe-nav");
      sn.clearBodyLockTimer();
    } catch {
      /* ok */
    }
    releaseDocumentScrollLock();
  }
}

/** @deprecated Prefer acquireBodyLock(owner) for modals */
export function lockBodyScroll(): void {
  acquireBodyLock("legacy-anonymous");
}

/** @deprecated Prefer release from acquireBodyLock */
export function unlockBodyScroll(): void {
  releaseBodyLockOwner("legacy-anonymous");
}

/**
 * Hard reset — route change / real recovery only.
 * Clears ALL named owners. Do not call from orphan pulse while a modal owns the lock.
 */
export function forceUnlockAllChrome(): void {
  if (bodyLockCount !== 0 || bodyLockOwners.size > 0) {
    wrBodyLock(-bodyLockCount, "forceUnlockAllChrome");
  }
  bodyLockCount = 0;
  bodyLockOwners.clear();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sn = require("./safe-nav") as typeof import("./safe-nav");
    sn.clearBodyLockTimer();
  } catch {
    /* ok */
  }
  releaseDocumentScrollLock();
}

/**
 * Call on every in-app navigation click (before route change).
 * Clears ghost locks so the next screen is interactive immediately.
 *
 * Optional caller label for event-loop diagnosis (e.g. "Nav.closeChrome").
 */
export function prepareNavigation(caller?: string): void {
  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  let stackTop = "";
  try {
    stackTop = (new Error().stack || "")
      .split("\n")
      .slice(2, 6)
      .map((s) => s.trim())
      .join(" ← ");
  } catch {
    /* ok */
  }
  const who = caller || "unknown";
  try {
    const debug =
      (typeof process !== "undefined" &&
        process.env.NODE_ENV === "development") ||
      (typeof window !== "undefined" &&
        localStorage.getItem("warroom-runtime-debug") === "1");
    if (debug) {
      console.log(`[WR-PERF][prep-nav] START caller=${who}`);
    }
  } catch {
    /* ok */
  }
  wrLog("[WR-NAV]", `prepareNavigation() caller=${who}`);
  forceUnlockAllChrome();
  try {
    // Close any leftover open sheets by dispatching
    window.dispatchEvent(new CustomEvent("warroom-prepare-nav"));
  } catch {
    /* ok */
  }
  const ms =
    typeof performance !== "undefined"
      ? Math.round(performance.now() - t0)
      : 0;
  try {
    const debug =
      (typeof process !== "undefined" &&
        process.env.NODE_ENV === "development") ||
      (typeof window !== "undefined" &&
        localStorage.getItem("warroom-runtime-debug") === "1");
    if (debug) {
      console.log(
        `[WR-PERF][prep-nav] FINISH caller=${who} duration=${ms}ms`,
        stackTop
      );
      // Sync work >16ms on click path is itself a mini long-task
      if (ms >= 16) {
        console.log(
          `[WR-PERF][prep-nav] SLOW_SYNC ${ms}ms caller=${who} — main thread blocked during prepare`
        );
      }
    }
  } catch {
    /* ok */
  }
}

/** Prefetch primary routes (App Router). Safe to call repeatedly. */
export function prefetchPrimaryRoutes(
  prefetch: (href: string) => void
): void {
  wrLog("[WR-NAV]", `prefetchPrimaryRoutes ×${PRIMARY_ROUTES.length}`);
  for (const href of PRIMARY_ROUTES) {
    try {
      prefetch(href);
    } catch {
      /* ok */
    }
  }
}

/**
 * Race a cloud load for page mounts. Prefer this over raw await so a stuck
 * PostgREST call never owns the UI thread narrative for > PAGE_LOAD_MS.
 */
export function pageLoad<T>(p: Promise<T>, fallback: T, ms = PAGE_LOAD_MS): Promise<T> {
  return raceTimeout(p, ms, fallback);
}

/** True if a visible dialog is currently on screen */
export function hasVisibleModal(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const nodes = document.querySelectorAll(
      '[aria-modal="true"], [role="dialog"]'
    );
    for (const el of Array.from(nodes)) {
      const node = el as HTMLElement;
      if (node.getAttribute("aria-hidden") === "true") continue;
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (style.pointerEvents === "none") continue;
      const r = node.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) continue;
      return true;
    }
  } catch {
    /* ok */
  }
  return false;
}

/**
 * If body is locked but no registered owner and no real modal, unlock.
 * Legitimate named owners (gazette-reader, etc.) must NEVER be force-unlocked
 * just because body.style.position === "fixed" — that is the intentional lock.
 */
export function unlockIfOrphanedLock(): void {
  if (typeof document === "undefined") return;
  try {
    // Named owner present → legitimate lock (e.g. Gazette reader)
    if (hasActiveBodyLockOwner()) {
      try {
        console.log(
          `[WR-BODYLOCK] watchdog valid owner=${getActiveBodyLockOwners().join(",")}`
        );
      } catch {
        /* ok */
      }
      return;
    }

    // Visible modal without named owner still counts (legacy modals)
    if (hasVisibleModal()) {
      try {
        console.log("[WR-BODYLOCK] watchdog skip — visible modal present");
      } catch {
        /* ok */
      }
      return;
    }

    const pos = document.body.style.position;
    const overflow = document.body.style.overflow;
    const looksLocked =
      pos === "fixed" || pos === "absolute" || overflow === "hidden";
    if (!looksLocked) return;

    wrLog(
      "[WR-BODYLOCK]",
      `orphan: locked with no owner/modal (pos=${pos || "default"} overflow=${overflow || "default"}) → force unlock`
    );
    forceUnlockAllChrome();
  } catch {
    /* ok */
  }
}
