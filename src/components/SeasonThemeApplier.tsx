"use client";

/**
 * Automatic season / holiday atmosphere.
 * Skins are controlled by War Room — never by user or league settings.
 */

import { useEffect, useState } from "react";
import { getLeague, getSession } from "@/lib/league";
import {
  applySeasonTheme,
  DEFAULT_SEASON_THEME_ID,
  isHolidayThemeId,
  paintAutomaticSeasonTheme,
  reapplySeasonThemeFromLocal,
  SEASON_THEME_EVENT,
  resolveAutomaticSeasonTheme,
  type SeasonThemeId,
} from "@/lib/season-theme";
import { stripHolidayBordersIfThemeEnded } from "@/lib/profile-border-store";
import ChristmasLights from "@/components/ChristmasLights";
import HalloweenDecor from "@/components/HalloweenDecor";
import ThanksgivingDecor from "@/components/ThanksgivingDecor";
import NewYearDecor from "@/components/NewYearDecor";

export default function SeasonThemeApplier() {
  const [theme, setTheme] = useState<SeasonThemeId>(DEFAULT_SEASON_THEME_ID);

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

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(SEASON_THEME_EVENT, onThemeEvent);
    window.addEventListener("warroom-view-as-player", onPlayerView);
    window.addEventListener("storage", onLeagueSwitch);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(SEASON_THEME_EVENT, onThemeEvent);
      window.removeEventListener("warroom-view-as-player", onPlayerView);
      window.removeEventListener("storage", onLeagueSwitch);
    };
  }, []);

  if (theme === "default") return null;

  return (
    <>
      <div className="season-theme-overlay" data-theme={theme} aria-hidden />
      {isHolidayThemeId(theme) && theme === "christmas" && <ChristmasLights />}
      {isHolidayThemeId(theme) && theme === "halloween" && <HalloweenDecor />}
      {isHolidayThemeId(theme) && theme === "thanksgiving" && (
        <ThanksgivingDecor />
      )}
      {isHolidayThemeId(theme) && theme === "newyear" && <NewYearDecor />}
    </>
  );
}
