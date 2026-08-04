"use client";

/**
 * Full-width commissioner Home CTA — one mission, above player destinations.
 * Players never see this. Deputies with isOps() do.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { isOps } from "@/lib/league";
import {
  resolveCommishHomeMission,
  type CommishHomeMission,
} from "@/lib/commish-home-mission";

export default function HomeCommishMissionButton() {
  const [mission, setMission] = useState<CommishHomeMission | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isOps()) {
      setMission(null);
      setReady(true);
      return;
    }
    void (async () => {
      try {
        const m = await resolveCommishHomeMission();
        if (!cancelled) setMission(m);
      } catch {
        if (!cancelled) setMission(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-resolve when host returns from week-ops / view-as-player
  useEffect(() => {
    function refresh() {
      if (!isOps()) {
        setMission(null);
        return;
      }
      void resolveCommishHomeMission().then(setMission).catch(() => setMission(null));
    }
    window.addEventListener("focus", refresh);
    window.addEventListener("warroom-view-as-player", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("warroom-view-as-player", refresh);
    };
  }, []);

  if (!ready || !mission || !isOps()) return null;

  return (
    <div className="mb-4 w-full">
      <Link
        href={mission.href}
        className="flex w-full items-center justify-center min-h-[56px] sm:min-h-[52px] px-4 py-4 rounded-2xl bg-primary text-black text-base sm:text-lg font-black tracking-tight touch-manipulation shadow-[0_0_32px_rgba(34,197,94,0.35)] border-2 border-primary hover:brightness-110 active:scale-[0.99] transition"
      >
        {mission.label}
      </Link>
    </div>
  );
}
