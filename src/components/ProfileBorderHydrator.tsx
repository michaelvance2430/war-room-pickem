"use client";

import { useEffect } from "react";
import { getLeague, getSession } from "@/lib/league";
import { loadLeagueRoster } from "@/lib/cloud";
import {
  hydrateProfileBorders,
  syncMyBorderFromCloud,
} from "@/lib/profile-border-store";

export default function ProfileBorderHydrator() {
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const session = getSession();
      if (!session?.playerId) return;
      await syncMyBorderFromCloud();
      if (cancelled) return;
      const league = getLeague();
      if (!league?.id && !session.leagueId) return;
      try {
        const roster = await loadLeagueRoster();
        if (cancelled) return;
        hydrateProfileBorders(
          roster.map((m) => ({
            userId: m.userId,
            borderId: m.equippedBorderId ?? null,
          }))
        );
      } catch {
        /* self still works */
      }
    }
    void load();
    function onVis() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return null;
}
