"use client";

/**
 * ONE roster fetch → join badges + equipped titles + avatar borders.
 * Replaces three separate hydrators that each called loadLeagueRoster on
 * every page mount (and again on visibility), which made tab switches crawl.
 */

import { useEffect } from "react";
import { getLeague, getSession } from "@/lib/league";
import { loadLeagueRoster } from "@/lib/cloud";
import { clearJoinBadges, hydrateJoinBadges } from "@/lib/join-badge-store";
import {
  getLocalEquippedBadgeId,
  hydrateEquippedTitles,
  setMyEquippedTitle,
  syncMyEquippedTitleFromCloud,
} from "@/lib/equipped-title-store";
import {
  hydrateProfileBorders,
  syncMyBorderFromCloud,
} from "@/lib/profile-border-store";
import { titleLabelForBadgeId } from "@/lib/equipable-titles";
import { isAppCreator } from "@/lib/creator";
import { CREATOR_BADGE_ID } from "@/lib/badges";
import { isGuestMode } from "@/lib/guest-mode";

const REFRESH_MS = 180_000; // 3 min — was 60s × 3 hydrators

export default function RoomDataHydrator() {
  useEffect(() => {
    if (isGuestMode()) return;
    let cancelled = false;

    async function load() {
      const session = getSession();
      const league = getLeague();
      const leagueId = league?.id || session?.leagueId || "";
      if (!session?.playerId) {
        clearJoinBadges();
        return;
      }

      // Self title/border/birthday — light profile reads, not full roster
      try {
        await Promise.all([
          syncMyEquippedTitleFromCloud(),
          syncMyBorderFromCloud(),
        ]);
      } catch {
        /* offline */
      }
      if (cancelled) return;

      try {
        const { hydrateBirthdayFromCloud } = await import("@/lib/profile");
        await hydrateBirthdayFromCloud(session.playerId);
      } catch {
        /* ok */
      }
      if (cancelled) return;

      if (isAppCreator(session.playerId)) {
        const current = getLocalEquippedBadgeId(session.playerId);
        if (!current) {
          try {
            await setMyEquippedTitle(CREATOR_BADGE_ID);
          } catch {
            /* ok */
          }
        }
      }
      if (cancelled) return;

      if (!leagueId) {
        clearJoinBadges();
        return;
      }

      try {
        // Shared TTL cache + inflight dedupe inside loadLeagueRoster
        const roster = await loadLeagueRoster();
        if (cancelled) return;

        hydrateJoinBadges(
          leagueId,
          roster.map((m) => ({
            userId: m.userId,
            role: m.role,
            isBot: m.isBot,
            joinedAt: m.joinedAt,
          }))
        );
        hydrateEquippedTitles(
          roster.map((m) => ({
            userId: m.userId,
            badgeId: m.equippedTitleId ?? null,
            label: titleLabelForBadgeId(m.equippedTitleId ?? null),
          }))
        );
        hydrateProfileBorders(
          roster.map((m) => ({
            userId: m.userId,
            borderId: m.equippedBorderId ?? null,
          }))
        );
      } catch {
        if (!cancelled) clearJoinBadges();
      }
    }

    // Let the page paint first — never block first frame on roster
    const start = window.setTimeout(() => void load(), 350);
    const timer = window.setInterval(() => void load(), REFRESH_MS);

    function onVis() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.clearTimeout(start);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
