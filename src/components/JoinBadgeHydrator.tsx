"use client";

/**
 * Loads league roster join times + titles so PlayerLink can show
 * “{Join title} · just joined” for 24h everywhere.
 */

import { useEffect } from "react";
import { getLeague, getSession } from "@/lib/league";
import { loadLeagueRoster } from "@/lib/cloud";
import {
  clearJoinBadges,
  hydrateJoinBadges,
} from "@/lib/join-badge-store";

export default function JoinBadgeHydrator() {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load(reason: "boot" | "interval-60s" | "visibility") {
      const session = getSession();
      const league = getLeague();
      const leagueId = league?.id || session?.leagueId || "";
      if (!session?.playerId || !leagueId) {
        clearJoinBadges();
        return;
      }
      try {
        let syncStart: ((fn: string) => number) | null = null;
        let syncEnd:
          | ((fn: string, t0: number, extra?: string) => void)
          | null = null;
        try {
          const tr = await import("@/lib/profile-nav-trace");
          tr.profileNavLeagueWork("JoinBadgeHydrator.load", reason);
          if (tr.isProfileNavTraceActive()) {
            syncStart = tr.profileNavSyncStart;
            syncEnd = tr.profileNavSyncEnd;
          }
        } catch {
          /* ok */
        }
        const roster = await loadLeagueRoster();
        if (cancelled) return;
        const t0 = syncStart
          ? syncStart("JoinBadgeHydrator.hydrateJoinBadges")
          : 0;
        hydrateJoinBadges(
          leagueId,
          roster.map((m) => ({
            userId: m.userId,
            role: m.role,
            isBot: m.isBot,
            // Current seat join — 24h “just joined” window
            joinedAt: m.joinedAt,
          }))
        );
        if (syncEnd) {
          syncEnd(
            "JoinBadgeHydrator.hydrateJoinBadges",
            t0,
            `n=${roster.length}`
          );
        }
      } catch {
        if (!cancelled) clearJoinBadges();
      }
    }

    void load("boot");
    // Refresh periodically so badges drop off without a full reload
    // NOTE: 60s — candidate for +~90s memberships on profile if cache cold
    timer = setInterval(() => {
      void load("interval-60s");
    }, 60_000);

    function onVis() {
      if (document.visibilityState === "visible") void load("visibility");
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
