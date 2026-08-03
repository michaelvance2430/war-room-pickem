"use client";

/**
 * Single persistent Practice indicator.
 * Teach once. Trust the player. Don't plaster "practice" across every surface.
 * Trust promise: nothing here affects your real league.
 */

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  EVENT_PRACTICE_MODE,
  isBoredPracticeActive,
  isBoredPracticeUrl,
  exitBoredPracticeToLive,
} from "@/lib/bored-practice";
import { isGuestMode } from "@/lib/guest-mode";

export default function PracticeModeChrome() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  const sync = useCallback(() => {
    if (isGuestMode()) {
      setActive(false);
      return;
    }
    try {
      const on =
        isBoredPracticeActive() ||
        isBoredPracticeUrl(
          typeof window !== "undefined" ? window.location.search : ""
        );
      setActive(on);
    } catch {
      setActive(false);
    }
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener(EVENT_PRACTICE_MODE, sync);
    window.addEventListener("popstate", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(EVENT_PRACTICE_MODE, sync);
      window.removeEventListener("popstate", sync);
      window.removeEventListener("focus", sync);
    };
  }, [sync, pathname]);

  if (!active) return null;

  function exit() {
    exitBoredPracticeToLive();
    window.location.assign("/");
  }

  return (
    <div
      className="sticky top-0 z-[58] border-b border-amber-400/40 bg-amber-950/90 backdrop-blur-md"
      data-practice-chrome="1"
      role="status"
    >
      <div className="max-w-3xl mx-auto px-3 py-2 flex items-center justify-between gap-3">
        <p className="text-[11px] sm:text-xs text-amber-100/90 leading-snug min-w-0">
          <span className="font-bold text-amber-300">Practice</span>
          {" · "}
          Nothing here affects your real league.
        </p>
        <button
          type="button"
          onClick={exit}
          className="shrink-0 min-h-[40px] px-3 py-1.5 rounded-lg bg-primary text-black text-[11px] font-extrabold touch-manipulation"
        >
          Return to Live League
        </button>
      </div>
    </div>
  );
}
