"use client";

/**
 * ONE roster fetch → join badges + equipped titles + avatar borders.
 * Self profile sync runs once; roster refresh is quiet (5 min + visibility
 * only if cache cold).
 */

import { useEffect, useRef } from "react";
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
import { isGuestMode } from "@/lib/guest-mode";

const ROSTER_REFRESH_MS = 300_000; // 5 min
const VIS_MIN_GAP_MS = 90_000; // don't re-hit on every app switch

export default function RoomDataHydrator() {
  const lastRosterAt = useRef(0);
  const selfSynced = useRef(false);

  useEffect(() => {
    if (isGuestMode()) return;
    let cancelled = false;

    async function syncSelfOnce() {
      if (selfSynced.current) return;
      const session = getSession();
      if (!session?.playerId) return;
      selfSynced.current = true;
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
        try {
          const { CREATOR_BADGE_ID } = await import("@/lib/badges");
          const current = getLocalEquippedBadgeId(session.playerId);
          if (!current) await setMyEquippedTitle(CREATOR_BADGE_ID);
        } catch {
          /* ok */
        }
      }
    }

    async function loadRoster(force = false) {
      const session = getSession();
      const league = getLeague();
      const leagueId = league?.id || session?.leagueId || "";
      if (!session?.playerId) {
        clearJoinBadges();
        return;
      }
      if (!leagueId) {
        clearJoinBadges();
        return;
      }
      const now = Date.now();
      if (!force && now - lastRosterAt.current < VIS_MIN_GAP_MS) return;

      try {
        const roster = await loadLeagueRoster();
        if (cancelled) return;
        lastRosterAt.current = Date.now();
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

    // Paint first, then self, then roster — never on the critical path
    const start = window.setTimeout(() => {
      void (async () => {
        await syncSelfOnce();
        if (!cancelled) await loadRoster(true);
      })();
    }, 1_400);

    // Warm picks card late so Home/Standings first paint wins
    const warmPicks = window.setTimeout(() => {
      if (cancelled || isGuestMode()) return;
      void (async () => {
        try {
          const session = getSession();
          if (!session?.leagueId) return;
          const { loadLeagueActiveWeek, loadWeekCard } = await import(
            "@/lib/cloud"
          );
          const { raceTimeout } = await import("@/lib/smooth");
          const week = await raceTimeout(loadLeagueActiveWeek(), 4_000, 1);
          if (cancelled) return;
          await raceTimeout(loadWeekCard(week), 4_000, null);
        } catch {
          /* offline / no card yet */
        }
      })();
    }, 2_800);

    const timer = window.setInterval(() => {
      void loadRoster(false);
    }, ROSTER_REFRESH_MS);

    function onVis() {
      if (document.visibilityState === "visible") void loadRoster(false);
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.clearTimeout(start);
      window.clearTimeout(warmPicks);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
