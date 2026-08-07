"use client";

/**
 * Automatic season / holiday atmosphere.
 * Skins are controlled by War Room — never by user or league settings.
 */

import { useEffect, useState } from "react";
import { getLeague, getSession } from "@/lib/league";
import {
  applySeasonTheme,
  CREATOR_SKIN_SIM_EVENT,
  DEFAULT_SEASON_THEME_ID,
  installCreatorSkinConsoleRecovery,
  paintAutomaticSeasonTheme,
  reapplySeasonThemeFromLocal,
  SEASON_THEME_EVENT,
  resolveAutomaticSeasonTheme,
  type SeasonThemeId,
} from "@/lib/season-theme";
import { stripHolidayBordersIfThemeEnded } from "@/lib/profile-border-store";
import { isAppCreator } from "@/lib/creator";

export default function SeasonThemeApplier() {
  const [theme, setTheme] = useState<SeasonThemeId>(DEFAULT_SEASON_THEME_ID);

  useEffect(() => {
    // Silent console recovery for stuck skin sim — no player UI
    try {
      if (isAppCreator(getSession()?.playerId)) {
        installCreatorSkinConsoleRecovery();
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    function afterPaint(id: SeasonThemeId) {
      if (cancelled) return;
      setTheme(id);
      try {
        stripHolidayBordersIfThemeEnded();
      } catch {
        /* ignore */
      }
    }

    // Immediate sync paint (holiday / opening fallback) — no stored prefs
    const sync = resolveAutomaticSeasonTheme({
      sportId: getLeague()?.sportId,
      trustedWeek: null,
      userId: getSession()?.playerId,
    });
    applySeasonTheme(sync);
    afterPaint(sync);

    // Then trusted live week for CFB season phase
    void paintAutomaticSeasonTheme().then((id) => afterPaint(id));

    // Re-check holiday boundary every 15 min + on visibility
    const tick = window.setInterval(() => {
      void paintAutomaticSeasonTheme().then((id) => afterPaint(id));
    }, 15 * 60 * 1000);

    function onVis() {
      if (document.visibilityState === "visible") {
        void paintAutomaticSeasonTheme().then((id) => afterPaint(id));
      }
    }

    function onThemeEvent(e: Event) {
      const detail = (e as CustomEvent<SeasonThemeId>).detail;
      if (detail) setTheme(detail);
    }

    function onPlayerView() {
      // Never re-read stored selection — re-run automatic resolve
      reapplySeasonThemeFromLocal();
      void paintAutomaticSeasonTheme().then((id) => afterPaint(id));
    }

    function onLeagueSwitch() {
      void paintAutomaticSeasonTheme().then((id) => afterPaint(id));
    }

    function onCreatorSim() {
      void paintAutomaticSeasonTheme().then((id) => afterPaint(id));
    }

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(SEASON_THEME_EVENT, onThemeEvent);
    window.addEventListener("warroom-view-as-player", onPlayerView);
    window.addEventListener("storage", onLeagueSwitch);
    window.addEventListener(CREATOR_SKIN_SIM_EVENT, onCreatorSim);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(SEASON_THEME_EVENT, onThemeEvent);
      window.removeEventListener("warroom-view-as-player", onPlayerView);
      window.removeEventListener("storage", onLeagueSwitch);
      window.removeEventListener(CREATOR_SKIN_SIM_EVENT, onCreatorSim);
    };
  }, []);

  if (theme === "default") return null;

  return (
    <div className="season-theme-overlay" data-theme={theme} aria-hidden />
  );
}
