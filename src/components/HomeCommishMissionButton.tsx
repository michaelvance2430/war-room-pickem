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

  // Re-resolve when league state changes (same on phone + desktop)
  useEffect(() => {
    function refresh() {
      if (!isOps()) {
        setMission(null);
        return;
      }
      void resolveCommishHomeMission()
        .then(setMission)
        .catch(() => setMission(null));
    }
    function onVis() {
      if (document.visibilityState === "visible") refresh();
    }
    window.addEventListener("focus", refresh);
    window.addEventListener("warroom-view-as-player", refresh);
    window.addEventListener("warroom-card-published", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("warroom-view-as-player", refresh);
      window.removeEventListener("warroom-card-published", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!ready || !mission || !isOps()) return null;
  const missingTrophy = mission.kind === "choose_trophy";

  return (
    <div className="mb-4 w-full">
      <Link
        href={mission.href}
        className={`flex w-full items-center justify-center min-h-[56px] sm:min-h-[52px] px-4 py-4 rounded-2xl text-base sm:text-lg font-black tracking-tight touch-manipulation hover:brightness-110 active:scale-[0.99] transition ${missingTrophy ? "bg-red-600 text-white border-2 border-red-300 shadow-[0_0_32px_rgba(220,38,38,0.5)]" : "bg-primary text-black border-2 border-primary shadow-[0_0_32px_rgba(34,197,94,0.35)]"}`}
      >
        {missingTrophy ? "CHAMPIONSHIP TROPHY NOT SELECTED · Choose Hardware" : mission.label}
      </Link>
    </div>
  );
}
