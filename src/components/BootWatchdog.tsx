"use client";

/**
 * Global open-safety: if any modal/menu left body locked, or a half-nav left
 * the shell frozen, unlock so the user can still tap Home / Picks / Standings.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { unlockDocumentChrome } from "@/lib/boot-safety";

/** True only when a visible, interactive full-screen sheet is open. */
function hasLiveModal(): boolean {
  try {
    const nodes = document.querySelectorAll(
      '[aria-modal="true"], [role="dialog"]'
    );
    for (const el of Array.from(nodes)) {
      const node = el as HTMLElement;
      // Hidden / unmounted-looking nodes shouldn't trap the whole app
      if (node.getAttribute("aria-hidden") === "true") continue;
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (style.pointerEvents === "none") continue;
      // Must cover a real chunk of the viewport (not a zero-size ghost)
      const r = node.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) continue;
      return true;
    }
  } catch {
    /* ok */
  }
  return false;
}

export default function BootWatchdog() {
  const pathname = usePathname();

  useEffect(() => {
    unlockDocumentChrome();
    const t0 = requestAnimationFrame(() => unlockDocumentChrome());
    const t1 = window.setTimeout(() => unlockDocumentChrome(), 80);
    const t2 = window.setTimeout(() => unlockDocumentChrome(), 400);
    // Late modal unmounts sometimes re-lock after paint
    const t3 = window.setTimeout(() => {
      if (!hasLiveModal()) unlockDocumentChrome();
    }, 1_200);
    return () => {
      cancelAnimationFrame(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [pathname]);

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "visible") unlockDocumentChrome();
    }
    function onPageShow() {
      unlockDocumentChrome();
    }
    function forceUnlockIfSafe() {
      try {
        if (
          document.body.style.position === "fixed" ||
          document.body.style.position === "absolute"
        ) {
          unlockDocumentChrome();
          return;
        }
        if (document.body.style.overflow === "hidden" && !hasLiveModal()) {
          unlockDocumentChrome();
        }
      } catch {
        /* ok */
      }
    }
    // Thumb nav / More button taps should never die under a ghost lock
    function onPointerDown(e: Event) {
      const t = e.target as HTMLElement | null;
      if (
        t?.closest?.(
          'nav[aria-label="Primary"], #mobile-nav-menu, a[href], button'
        )
      ) {
        forceUnlockIfSafe();
      }
    }

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onVis);
    document.addEventListener("pointerdown", onPointerDown, true);
    // Faster drip — 1.2s was too slow when a sheet half-died mid-tap
    const pulse = window.setInterval(forceUnlockIfSafe, 1_200);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onVis);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.clearInterval(pulse);
    };
  }, []);

  return null;
}
