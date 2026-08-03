"use client";

/**
 * EMERGENCY SAFE MODE (P0 main-thread freeze)
 *
 * Production never mounts RoomDeferredChrome and never imports its module
 * (waves, ceremonies, eggs, modal catalog, deferred loaders).
 *
 * RoomDeferredChrome.tsx is preserved for offline isolation later.
 * Re-enable only after children are measured one at a time (dev / deliberate
 * flag — not by default in production).
 */

import { useEffect, useState, type ComponentType } from "react";

/** Compile-time in Next production builds — webpack can DCE the import branch. */
const PRODUCTION_SAFE_MODE = process.env.NODE_ENV === "production";

let loggedOnce = false;

export default function DeferredChromeGate() {
  const [Comp, setComp] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (PRODUCTION_SAFE_MODE) {
      if (!loggedOnce) {
        loggedOnce = true;
        // Always log once so production verification works without debug flag
        console.log("[WR-DEFERRED] production safe mode — disabled");
      }
      return;
    }

    // Development only: optional load for offline isolation of deferred children
    let cancelled = false;
    void import("@/components/RoomDeferredChrome").then((m) => {
      if (!cancelled) setComp(() => m.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (PRODUCTION_SAFE_MODE) return null;
  if (!Comp) return null;
  return <Comp />;
}
