"use client";

/**
 * Single global runtime: route unlock + orphan body-lock watchdog + primary
 * prefetch. Replaces the split RouteHardSwitch + BootWatchdog dance so one
 * module owns "the app never freezes under chrome."
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  forceUnlockAllChrome,
  unlockIfOrphanedLock,
  prefetchPrimaryRoutes,
  prepareNavigation,
} from "@/lib/smooth";
import { isGuestMode } from "@/lib/guest-mode";
import { getSession } from "@/lib/league";

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

export default function SmoothRuntime() {
  const pathname = usePathname();
  const router = useRouter();

  // Every route change: hard unlock + top of page
  useEffect(() => {
    forceUnlockAllChrome();
    scrollTopHard();
    const t0 = requestAnimationFrame(() => {
      forceUnlockAllChrome();
      scrollTopHard();
    });
    const t1 = window.setTimeout(() => forceUnlockAllChrome(), 80);
    const t2 = window.setTimeout(() => forceUnlockAllChrome(), 400);
    const t3 = window.setTimeout(() => unlockIfOrphanedLock(), 1_200);
    try {
      window.dispatchEvent(
        new CustomEvent("warroom-route-change", { detail: { pathname } })
      );
    } catch {
      /* ok */
    }
    return () => {
      cancelAnimationFrame(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [pathname]);

  // Watchdog: orphan locks, visibility, pointer on chrome
  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "visible") unlockIfOrphanedLock();
    }
    function onPointerDown(e: Event) {
      const t = e.target as HTMLElement | null;
      if (
        t?.closest?.(
          'nav[aria-label="Primary"], #mobile-nav-menu, a[href], button'
        )
      ) {
        unlockIfOrphanedLock();
      }
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onVis);
    window.addEventListener("focus", onVis);
    document.addEventListener("pointerdown", onPointerDown, true);
    const pulse = window.setInterval(unlockIfOrphanedLock, 1_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
      window.removeEventListener("focus", onVis);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.clearInterval(pulse);
    };
  }, []);

  // Warm primary desks once session exists (desktop soft-nav salvation)
  useEffect(() => {
    if (isGuestMode()) return;
    if (!getSession()?.playerId) return;
    const warm = () => {
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
  }, [router, pathname]);

  // Capture-phase: any in-app link click prepares nav (covers logo, tiles, etc.)
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      const a = t?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      if (a.target === "_blank") return;
      prepareNavigation();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

/** @deprecated use prepareNavigation from @/lib/smooth */
export { prepareNavigation as hardNavPrepare } from "@/lib/smooth";
