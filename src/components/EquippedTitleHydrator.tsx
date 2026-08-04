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

    async function load(reason: "boot" | "interval-120s" | "visibility") {
      const session = getSession();
      const league = getLeague();
      if (!session?.playerId) return;

      try {
        const { profileNavLeagueWork } = await import("@/lib/profile-nav-trace");
        profileNavLeagueWork("EquippedTitleHydrator.load", reason);
      } catch {
        /* ok */
      }

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
        let t0 = 0;
        let end: ((fn: string, t0: number, extra?: string) => void) | null =
          null;
        try {
          const tr = await import("@/lib/profile-nav-trace");
          if (tr.isProfileNavTraceActive()) {
            t0 = tr.profileNavSyncStart("EquippedTitleHydrator.hydrate");
            end = tr.profileNavSyncEnd;
          }
        } catch {
          /* ok */
        }
        try {
          hydrateEquippedTitles(
            roster.map((m) => ({
              userId: m.userId,
              badgeId: m.equippedTitleId ?? null,
              label: titleLabelForBadgeId(m.equippedTitleId ?? null),
            }))
          );
        } finally {
          if (end) end("EquippedTitleHydrator.hydrate", t0, `n=${roster.length}`);
        }
      } catch {
        /* self still works from local */
      }
    }

    void load("boot");
    function onVis() {
      if (document.visibilityState === "visible") void load("visibility");
    }
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(() => void load("interval-120s"), 120_000);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(t);
    };
  }, []);

  return null;
}
