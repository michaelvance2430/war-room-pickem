"use client";

/**
 * Global open-safety: if any modal/menu left body locked, or a half-nav left
 * the shell frozen, unlock so the user can still tap Home / Picks / Standings.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { unlockDocumentChrome } from "@/lib/boot-safety";

export default function BootWatchdog() {
  const pathname = usePathname();

  useEffect(() => {
    unlockDocumentChrome();
    const t0 = requestAnimationFrame(() => unlockDocumentChrome());
    const t1 = window.setTimeout(() => unlockDocumentChrome(), 80);
    const t2 = window.setTimeout(() => unlockDocumentChrome(), 400);
    return () => {
      cancelAnimationFrame(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pathname]);

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "visible") unlockDocumentChrome();
    }
    function onPageShow() {
      unlockDocumentChrome();
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onVis);
    // Slow drip — catch locks that mount late (welcome modal, sheets)
    const pulse = window.setInterval(() => {
      try {
        const overflow = document.body.style.overflow;
        // Only clear if hidden but no open dialog/menu marker we care about
        // Always clear fixed position traps (those freeze iOS hard)
        if (
          document.body.style.position === "fixed" ||
          document.body.style.position === "absolute"
        ) {
          unlockDocumentChrome();
          return;
        }
        // If overflow hidden with no [aria-modal=true] in DOM, unlock
        if (overflow === "hidden") {
          const modal = document.querySelector(
            '[aria-modal="true"], [role="dialog"]'
          );
          if (!modal) unlockDocumentChrome();
        }
      } catch {
        /* ok */
      }
    }, 2_500);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onVis);
      window.clearInterval(pulse);
    };
  }, []);

  return null;
}
