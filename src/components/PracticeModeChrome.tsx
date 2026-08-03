"use client";

/**
 * Global Practice Mode identity — unmistakable sandbox chrome.
 * Only when I'm Bored / onboarding practice (bored-practice) is active.
 * Never confuses with season dry-run "Sandbox" or Foundry hop.
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

  function exit(href: string) {
    exitBoredPracticeToLive();
    window.location.assign(href);
  }

  return (
    <div
      className="sticky top-0 z-[58] border-b-2 border-amber-400/60 bg-amber-950/95 backdrop-blur-md shadow-lg"
      data-practice-chrome="1"
      role="status"
    >
      <div className="max-w-3xl mx-auto px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
            Practice Mode
          </p>
          <p className="text-[11px] sm:text-xs text-amber-50/90 leading-snug">
            Nothing here affects your real league.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => exit("/")}
            className="min-h-[40px] px-3 py-1.5 rounded-lg bg-primary text-black text-[11px] font-extrabold"
          >
            Return to My League
          </button>
          <button
            type="button"
            onClick={() => exit("/picks")}
            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-amber-400/50 text-amber-100 text-[11px] font-bold"
          >
            Exit → real picks
          </button>
        </div>
      </div>
    </div>
  );
}
