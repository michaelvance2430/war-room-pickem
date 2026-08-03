"use client";

/**
 * Opt-in only — never shown in normal product UI.
 *
 * Enable:
 *   localStorage.setItem("warroom-safe-nav-ui", "1"); location.reload()
 *
 * Console recovery (always available after SmoothRuntime mounts):
 *   window.__wrRecoverNav()
 */

import { useEffect, useState } from "react";
import { isAppCreator } from "@/lib/creator";
import { getSession } from "@/lib/league";
import { isSafeNavMode, recoverNavigation } from "@/lib/safe-nav";

export default function SafeNavBadge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const uid = getSession()?.playerId;
      const optIn = localStorage.getItem("warroom-safe-nav-ui") === "1";
      setShow(optIn && isSafeNavMode() && isAppCreator(uid));
    } catch {
      setShow(false);
    }
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] pointer-events-none"
      data-safe-nav-badge="1"
    >
      <div className="pointer-events-auto mx-auto max-w-lg px-2 pt-1">
        <div className="rounded-b-lg border border-emerald-500/50 bg-emerald-950/95 text-emerald-100 px-2 py-1 flex items-center gap-2 text-[10px] font-bold">
          <span className="uppercase tracking-wide">SAFE NAV</span>
          <span className="font-normal text-emerald-200/80 flex-1 truncate">
            Debug UI (opt-in) · not for product
          </span>
          <button
            type="button"
            className="underline shrink-0"
            onClick={() => recoverNavigation("safe-nav-badge")}
          >
            Unlock UI
          </button>
        </div>
      </div>
    </div>
  );
}
