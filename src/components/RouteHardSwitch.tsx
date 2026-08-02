"use client";

/**
 * Hard page switch on mobile: when the route changes, kill leftover chrome
 * (body scroll lock, open sheets, half-stuck scroll) so one tap = one screen.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function unlockDocument() {
  if (typeof document === "undefined") return;
  try {
    // Full reset — stuck overflow/position made every screen feel frozen
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.height = "";
    document.body.style.touchAction = "";
    document.documentElement.style.overflow = "";
    document.documentElement.style.touchAction = "";
    document.body.classList.remove(
      "overflow-hidden",
      "modal-open",
      "ReactModal__Body--open"
    );
  } catch {
    /* ignore */
  }
}

function scrollToTopHard() {
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
    /* ignore */
  }
}

export default function RouteHardSwitch() {
  const pathname = usePathname();

  useEffect(() => {
    unlockDocument();
    scrollToTopHard();

    // After paint — catch late-mounted locks from the previous screen
    const t0 = requestAnimationFrame(() => {
      unlockDocument();
      scrollToTopHard();
    });
    const t1 = window.setTimeout(() => {
      unlockDocument();
      scrollToTopHard();
    }, 50);
    const t2 = window.setTimeout(() => unlockDocument(), 200);

    try {
      window.dispatchEvent(
        new CustomEvent("warroom-route-change", { detail: { pathname } })
      );
    } catch {
      /* ignore */
    }

    return () => {
      cancelAnimationFrame(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname]);

  return null;
}

/** Call on link click before navigation for instant cleanup. */
export function hardNavPrepare() {
  unlockDocument();
  try {
    // Prefer the global smooth contract when available
    const { prepareNavigation } =
      require("@/lib/smooth") as typeof import("@/lib/smooth");
    prepareNavigation();
  } catch {
    /* ok */
  }
}
