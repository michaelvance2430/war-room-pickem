"use client";

import { useEffect, useState } from "react";
import {
  loadPlatformIncident,
  type PlatformIncident,
} from "@/lib/platform-status";

/**
 * Calm global incident strip — Bug Emergency Plan.
 * People forgive bugs; they don't forgive silence.
 */
export default function IncidentBanner() {
  const [incident, setIncident] = useState<PlatformIncident | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadPlatformIncident().then((i) => {
      if (!cancelled) setIncident(i);
    });
    const onFocus = () => {
      void loadPlatformIncident().then((i) => {
        if (!cancelled) setIncident(i);
      });
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!incident?.active) return null;

  return (
    <div
      className="mb-4 sm:mb-5 rounded-xl border border-amber-400/50 bg-amber-500/15 px-3.5 py-3 sm:px-4 sm:py-3.5"
      role="alert"
    >
      <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.16em] text-amber-200 mb-1">
        ⚠️ We&apos;re on it
      </p>
      <p className="text-sm text-foreground/95 leading-relaxed">
        {incident.message}
      </p>
    </div>
  );
}
