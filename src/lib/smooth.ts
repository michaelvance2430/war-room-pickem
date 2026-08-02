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

// ── Body scroll lock (refcount) ───────────────────────────────────────────
// Stuck overflow:hidden is the #1 "whole app frozen" bug on phone + desktop.

let bodyLockCount = 0;

export function getBodyLockCount(): number {
  return bodyLockCount;
}

export function lockBodyScroll(): void {
  if (typeof document === "undefined") return;
  bodyLockCount += 1;
  wrBodyLock(1, "lockBodyScroll");
  if (bodyLockCount === 1) {
    try {
      document.body.style.overflow = "hidden";
    } catch {
      /* ok */
    }
  }
}

export function unlockBodyScroll(): void {
  if (typeof document === "undefined") return;
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  wrBodyLock(-1, "unlockBodyScroll");
  if (bodyLockCount === 0) {
    unlockDocumentChrome();
  }
}

/** Hard reset — route change, watchdog, nav prepare */
export function forceUnlockAllChrome(): void {
  if (bodyLockCount !== 0) {
    wrBodyLock(-bodyLockCount, "forceUnlockAllChrome");
  }
  bodyLockCount = 0;
  unlockDocumentChrome();
}

/**
 * Call on every in-app navigation click (before route change).
 * Clears ghost locks so the next screen is interactive immediately.
 */
export function prepareNavigation(): void {
  wrLog("[WR-NAV]", "prepareNavigation()");
  forceUnlockAllChrome();
  try {
    // Close any leftover open sheets by dispatching
    window.dispatchEvent(new CustomEvent("warroom-prepare-nav"));
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
 * If body is locked but no real modal is up, unlock.
 * Used by the global watchdog pulse.
 */
export function unlockIfOrphanedLock(): void {
  if (typeof document === "undefined") return;
  try {
    if (
      document.body.style.position === "fixed" ||
      document.body.style.position === "absolute"
    ) {
      wrLog("[WR-BODYLOCK]", "orphan: fixed/absolute position → force unlock");
      forceUnlockAllChrome();
      return;
    }
    if (document.body.style.overflow === "hidden" && !hasVisibleModal()) {
      wrLog("[WR-BODYLOCK]", "orphan: overflow hidden + no modal → force unlock");
      forceUnlockAllChrome();
    }
  } catch {
    /* ok */
  }
}
