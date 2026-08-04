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

const ROSTER_REFRESH_MS = 300_000; // 5 min
const VIS_MIN_GAP_MS = 90_000; // don't re-hit on every app switch

export default function RoomDataHydrator() {
  const lastRosterAt = useRef(0);
  const selfSynced = useRef(false);

  useEffect(() => {
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

    async function loadRoster(
      force = false,
      reason: "force-boot" | "interval-5m" | "visibility" = "force-boot"
    ) {
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
        let syncStart: ((fn: string) => number) | null = null;
        let syncEnd:
          | ((fn: string, t0: number, extra?: string) => void)
          | null = null;
        try {
          const tr = await import("@/lib/profile-nav-trace");
          tr.profileNavLeagueWork(
            "RoomDataHydrator.loadRoster",
            reason,
            `force=${force} sinceLast=${now - lastRosterAt.current}ms gap=${VIS_MIN_GAP_MS}`
          );
          if (tr.isProfileNavTraceActive()) {
            syncStart = tr.profileNavSyncStart;
            syncEnd = tr.profileNavSyncEnd;
          }
        } catch {
          /* ok */
        }
        const roster = await loadLeagueRoster();
        if (cancelled) return;
        lastRosterAt.current = Date.now();
        const tHyd = syncStart
          ? syncStart("RoomDataHydrator.hydrateStores")
          : 0;
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
        if (syncEnd) {
          syncEnd(
            "RoomDataHydrator.hydrateStores",
            tHyd,
            `n=${roster.length}`
          );
        }
        // If Creator is on this roster and has last_seen, unlock room cheevo flag
        try {
          const { isAppCreator } = await import("@/lib/creator");
          const creator = roster.find(
            (m) => m.userId && isAppCreator(m.userId) && m.lastSeenAt
          );
          if (creator && leagueId) {
            localStorage.setItem(`warroom-creator-checkin:${leagueId}`, "1");
          }
        } catch {
          /* ok */
        }
      } catch {
        if (!cancelled) clearJoinBadges();
      }
    }

    // Paint first, then self, then roster — never on the critical path
    const start = window.setTimeout(() => {
      void (async () => {
        await syncSelfOnce();
        if (!cancelled) await loadRoster(true, "force-boot");
      })();
    }, 1_400);

    // Warm picks card late so Home/Standings first paint wins
    // (also triggers loadLeagueActiveWeek — tagged for profile-nav traces)
    const warmPicks = window.setTimeout(() => {
      if (cancelled) return;
      void (async () => {
        try {
          const session = getSession();
          if (!session?.leagueId) return;
          try {
            const { profileNavLeagueWork } = await import(
              "@/lib/profile-nav-trace"
            );
            profileNavLeagueWork(
              "RoomDataHydrator.warmPicks",
              "timeout-2800ms"
            );
          } catch {
            /* ok */
          }
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
      void loadRoster(false, "interval-5m");
    }, ROSTER_REFRESH_MS);

    function onVis() {
      if (document.visibilityState === "visible") {
        void loadRoster(false, "visibility");
      }
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
