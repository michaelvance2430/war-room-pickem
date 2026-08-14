"use client";

/**
 * Single global runtime: route unlock + orphan body-lock watchdog + primary
 * prefetch. Replaces the split RouteHardSwitch + BootWatchdog dance so one
 * module owns "the app never freezes under chrome."
 *
 * Freeze regression notes (Group 1):
 * - Prefetch must run ONCE per session, not on every pathname change.
 * - Orphan-lock pulse must not DOM-scan (getComputedStyle) every 1s forever.
 */

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  forceUnlockAllChrome,
  unlockIfOrphanedLock,
  prefetchPrimaryRoutes,
  prepareNavigation,
  getBodyLockCount,
} from "@/lib/smooth";
import { getSession } from "@/lib/league";
import {
  recoverNavigation,
  shouldReleaseStaleBodyLock,
  noteNavAttempt,
  isSafeNavMode,
} from "@/lib/safe-nav";
import {
  wrMount,
  wrEffect,
  wrRoute,
  wrLog,
  wrSetInterval,
  wrClearInterval,
  installRuntimeDebugGlobals,
  isoEnabled,
  wrProfileRoute,
} from "@/lib/runtime-iso";
import { installEventLoopProbe } from "@/lib/event-loop-probe";
import { profileNavRouteCommit } from "@/lib/profile-nav-trace";
import { isWarRoomNative } from "@/lib/native-contract";

function scrollTopHard() {
  if (typeof window === "undefined") return;
  try {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  } catch {
    window.scrollTo(0, 0);
  }
  try {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  } catch {
    /* ok */
  }
}

/** Cheap gate before expensive hasVisibleModal DOM walk */
function bodyLooksLocked(): boolean {
  try {
    const b = document.body.style;
    return (
      b.overflow === "hidden" ||
      b.position === "fixed" ||
      b.position === "absolute" ||
      getBodyLockCount() > 0
    );
  } catch {
    return false;
  }
}

export default function SmoothRuntime() {
  const pathname = usePathname();
  const router = useRouter();
  const prefetchedOnce = useRef(false);

  useEffect(() => {
    return wrMount("SmoothRuntime");
  }, []);

  useEffect(() => {
    installRuntimeDebugGlobals();
    installEventLoopProbe();
    // Console-only recovery — no product banner
    try {
      (window as unknown as { __wrRecoverNav?: () => void }).__wrRecoverNav =
        () => recoverNavigation("console");
    } catch {
      /* ok */
    }
    return () => {
      try {
        delete (window as unknown as { __wrRecoverNav?: () => void })
          .__wrRecoverNav;
      } catch {
        /* ok */
      }
    };
  }, []);

  // Every route change: hard unlock + top of page
  useEffect(() => {
    wrRoute(pathname);
    wrEffect("SmoothRuntime.routeUnlock");
    if (pathname?.startsWith("/profile")) {
      wrProfileRoute("SmoothRuntime.route-effect", pathname);
      profileNavRouteCommit(pathname);
    }
    noteNavAttempt({
      source: "SmoothRuntime.route",
      target: pathname || undefined,
      blocked: false,
      reason: "route-change",
    });
    if (!isoEnabled("smoothPrep")) {
      wrLog("[WR-NAV]", "route unlock skipped (smoothPrep=false)");
      // Still recover in SAFE NAV — never leave locks across routes
      if (isSafeNavMode()) recoverNavigation("route-safe-nav");
      return;
    }
    forceUnlockAllChrome();
    recoverNavigation("route-change");
    scrollTopHard();
    const t0 = requestAnimationFrame(() => {
      forceUnlockAllChrome();
      scrollTopHard();
    });
    // One delayed orphan check is enough — avoid triple forceUnlock storms
    const t1 = window.setTimeout(() => unlockIfOrphanedLock(), 400);
    // Hard fail-safe: never stay locked >4s after a route change
    const t2 = window.setTimeout(() => {
      if (bodyLooksLocked()) recoverNavigation("route-failsafe-4s");
    }, 4_000);
    try {
      if (pathname?.startsWith("/profile")) {
        wrProfileRoute("SmoothRuntime.dispatch-route-change", pathname);
      }
      window.dispatchEvent(
        new CustomEvent("warroom-route-change", { detail: { pathname } })
      );
      if (pathname?.startsWith("/profile")) {
        wrProfileRoute("SmoothRuntime.dispatch-route-change-done", pathname);
      }
    } catch {
      /* ok */
    }
    return () => {
      cancelAnimationFrame(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pathname]);

  // Watchdog: orphan locks on visibility/focus; slow pulse only if locked
  useEffect(() => {
    wrEffect("SmoothRuntime.watchdog");
    if (!isoEnabled("smoothPulse") && !isoEnabled("smoothPrep")) {
      wrLog("[WR-RUNTIME]", "watchdog skipped (smoothPulse/smoothPrep off)");
      return;
    }

    function onVis() {
      if (document.visibilityState === "visible" && bodyLooksLocked()) {
        unlockIfOrphanedLock();
      }
    }
    function onPointerDown(e: Event) {
      // Cheap bail: never walk DOM if body is not locked
      if (!bodyLooksLocked()) return;
      const t = e.target as HTMLElement | null;
      if (
        t?.closest?.(
          'nav[aria-label="Primary"], #mobile-nav-menu, a[href], button'
        )
      ) {
        unlockIfOrphanedLock();
        if (shouldReleaseStaleBodyLock()) {
          recoverNavigation("stale-body-lock-pointer");
        }
      }
    }

    /** Escape always releases nonessential traps */
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      recoverNavigation("escape");
    }

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onVis);
    window.addEventListener("focus", onVis);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);

    // Was 1s forever → getComputedStyle on every dialog. Now: 8s and only
    // run the expensive walk when the body style still looks locked.
    // SAFE NAV: also pulse recover every 3s if body still locked.
    let pulse: number | undefined;
    if (isoEnabled("smoothPulse") || isSafeNavMode()) {
      pulse = wrSetInterval(
        () => {
          // Ownership-aware: never recover while a named modal owns the lock
          unlockIfOrphanedLock();
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { hasActiveBodyLockOwner } =
              require("@/lib/smooth") as typeof import("@/lib/smooth");
            if (hasActiveBodyLockOwner()) return;
          } catch {
            /* ok */
          }
          if (bodyLooksLocked()) {
            if (shouldReleaseStaleBodyLock() || isSafeNavMode()) {
              recoverNavigation("orphan-pulse");
            }
          }
        },
        isSafeNavMode() ? 3_000 : 8_000,
        "orphan-lock-pulse"
      );
    }

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
      window.removeEventListener("focus", onVis);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      if (pulse != null) wrClearInterval(pulse, "orphan-lock-pulse");
    };
  }, []);

  // Warm primary desks ONCE per session (not every pathname change)
  useEffect(() => {
    wrEffect("SmoothRuntime.prefetch");
    if (!isoEnabled("smoothPrefetch")) {
      wrLog("[WR-NAV]", "prefetch skipped (smoothPrefetch=false)");
      return;
    }
    if (!getSession()?.playerId) return;
    if (prefetchedOnce.current) {
      wrLog("[WR-NAV]", "prefetch already done this session");
      return;
    }

    const warm = () => {
      if (prefetchedOnce.current) return;
      prefetchedOnce.current = true;
      // Next's visible links already prefetch the immediate phone tabs. Do not
      // also retain every primary route bundle inside WKWebView.
      if (isWarRoomNative()) {
        wrLog("[WR-NAV]", "bulk prefetch skipped in native runtime");
        return;
      }
      wrLog("[WR-NAV]", "prefetchPrimaryRoutes once");
      prefetchPrimaryRoutes((href) => {
        try {
          router.prefetch(href);
        } catch {
          /* ok */
        }
      });
    };

    const w = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | undefined;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(warm, { timeout: 3_000 });
    } else {
      t = setTimeout(warm, 1_500);
    }
    return () => {
      if (idleId != null && w.cancelIdleCallback) w.cancelIdleCallback(idleId);
      if (t) clearTimeout(t);
    };
    // Intentionally NOT on pathname — that re-prefetched ~10 routes every hop
  }, [router]);

  // Capture-phase: any in-app link click prepares nav (covers logo, tiles, etc.)
  useEffect(() => {
    wrEffect("SmoothRuntime.clickPrep");
    if (!isoEnabled("smoothPrep")) return;
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      const a = t?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      if (a.target === "_blank") return;
      wrLog("[WR-NAV]", `prepareNavigation → ${href}`);
      if (href.startsWith("/profile")) {
        wrProfileRoute("Link.nav-prepare", href);
      }
      prepareNavigation(`SmoothRuntime.click→${href}`);
      if (href.startsWith("/profile")) {
        wrProfileRoute("Link.nav-prepare-done", href);
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

/** @deprecated use prepareNavigation from @/lib/smooth */
export { prepareNavigation as hardNavPrepare } from "@/lib/smooth";
