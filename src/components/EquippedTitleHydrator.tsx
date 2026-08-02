"use client";

/**
 * Loads equipped titles for league roster so PlayerLink can show them.
 * App creator (Mike V.) defaults to "The Creator" if no title equipped yet.
 */

import { useEffect } from "react";
import { getLeague, getSession } from "@/lib/league";
import { loadLeagueRoster } from "@/lib/cloud";
import {
  getLocalEquippedBadgeId,
  hydrateEquippedTitles,
  setMyEquippedTitle,
  syncMyEquippedTitleFromCloud,
} from "@/lib/equipped-title-store";
import { titleLabelForBadgeId } from "@/lib/equipable-titles";
import { isAppCreator } from "@/lib/creator";
import { CREATOR_BADGE_ID } from "@/lib/badges";

export default function EquippedTitleHydrator() {
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const session = getSession();
      const league = getLeague();
      if (!session?.playerId) return;

      await syncMyEquippedTitleFromCloud();
      // Birthday hard-lock: rehydrate from profiles so post-login never
      // re-prompts after a clear localStorage / new device session.
      try {
        const { hydrateBirthdayFromCloud } = await import("@/lib/profile");
        await hydrateBirthdayFromCloud(session.playerId);
      } catch {
        /* ok */
      }
      if (cancelled) return;

      // Default nameplate for the person who built the app
      if (isAppCreator(session.playerId)) {
        const current = getLocalEquippedBadgeId(session.playerId);
        if (!current) {
          await setMyEquippedTitle(CREATOR_BADGE_ID);
        }
      }
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
