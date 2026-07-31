"use client";

/**
 * Loads equipped titles for league roster so PlayerLink can show them.
 */

import { useEffect } from "react";
import { getLeague, getSession } from "@/lib/league";
import { loadLeagueRoster } from "@/lib/cloud";
import {
  hydrateEquippedTitles,
  syncMyEquippedTitleFromCloud,
} from "@/lib/equipped-title-store";
import { titleLabelForBadgeId } from "@/lib/equipable-titles";

export default function EquippedTitleHydrator() {
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const session = getSession();
      const league = getLeague();
      if (!session?.playerId) return;

      await syncMyEquippedTitleFromCloud();
      if (cancelled) return;

      if (!league?.id && !session.leagueId) return;
      try {
        const roster = await loadLeagueRoster();
        if (cancelled) return;
        hydrateEquippedTitles(
          roster.map((m) => ({
            userId: m.userId,
            badgeId: m.equippedTitleId ?? null,
            label: titleLabelForBadgeId(m.equippedTitleId ?? null),
          }))
        );
      } catch {
        /* self still works from local */
      }
    }

    void load();
    function onVis() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(() => void load(), 120_000);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(t);
    };
  }, []);

  return null;
}
