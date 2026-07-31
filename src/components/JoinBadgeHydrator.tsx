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

    async function load() {
      const session = getSession();
      const league = getLeague();
      const leagueId = league?.id || session?.leagueId || "";
      if (!session?.playerId || !leagueId) {
        clearJoinBadges();
        return;
      }
      try {
        const roster = await loadLeagueRoster();
        if (cancelled) return;
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
      } catch {
        if (!cancelled) clearJoinBadges();
      }
    }

    void load();
    // Refresh periodically so badges drop off without a full reload
    timer = setInterval(() => {
      void load();
    }, 60_000);

    function onVis() {
      if (document.visibilityState === "visible") void load();
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
