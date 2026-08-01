"use client";

import { useEffect, useState } from "react";
import { getLeague } from "@/lib/league";
import { syncLeagueFromCloud } from "@/lib/league-sync";
import {
  applySeasonTheme,
  DEFAULT_SEASON_THEME_ID,
  reapplySeasonThemeFromLocal,
  SEASON_THEME_EVENT,
  resolveSeasonThemeId,
  type SeasonThemeId,
} from "@/lib/season-theme";
import { stripHolidayBordersIfThemeEnded } from "@/lib/profile-border-store";
import ChristmasLights from "@/components/ChristmasLights";
import HalloweenDecor from "@/components/HalloweenDecor";
import ThanksgivingDecor from "@/components/ThanksgivingDecor";
import NewYearDecor from "@/components/NewYearDecor";

/**
 * Reads league season theme and paints holiday overlays for everyone.
 * Survives View as player: theme is on local league + reapplied on toggle.
 */
export default function SeasonThemeApplier() {
  const [theme, setTheme] = useState<SeasonThemeId>(DEFAULT_SEASON_THEME_ID);

  useEffect(() => {
    function paint(id: string | null | undefined, persistLocal = true) {
      const next = resolveSeasonThemeId(id);
      applySeasonTheme(next, { persistLocal });
      setTheme(next);
      // Holiday borders only last while that theme is on → snap to plain
      try {
        stripHolidayBordersIfThemeEnded();
      } catch {
        /* ignore */
      }
    }

    const initial = resolveSeasonThemeId(
      getLeague()?.settings?.seasonThemeId || DEFAULT_SEASON_THEME_ID
    );
    paint(initial, false);

    let cancelled = false;
    void (async () => {
      const lg = await syncLeagueFromCloud();
      if (cancelled) return;
      // Prefer cloud when present; else keep local (preview / unsaved theme)
      const fromCloud = lg?.settings?.seasonThemeId;
      const fromLocal = getLeague()?.settings?.seasonThemeId;
      const next = resolveSeasonThemeId(
        fromCloud && fromCloud !== "default"
          ? fromCloud
          : fromLocal || fromCloud || DEFAULT_SEASON_THEME_ID
      );
      // If local has a non-default preview and cloud is default, keep local
      // so Commish can preview → View as player without Save first.
      const preferLocal =
        fromLocal &&
        fromLocal !== "default" &&
        (!fromCloud || fromCloud === "default");
      paint(preferLocal ? fromLocal : next, Boolean(preferLocal));
    })();

    function onStorage(e: StorageEvent) {
      if (e.key !== "warroom-league") return;
      try {
        const lg = e.newValue ? JSON.parse(e.newValue) : null;
        paint(lg?.settings?.seasonThemeId, false);
      } catch {
        /* ignore */
      }
    }

    function onThemeEvent(e: Event) {
      const detail = (e as CustomEvent<SeasonThemeId>).detail;
      setTheme(resolveSeasonThemeId(detail));
    }

    function onPlayerView() {
      // After View as player toggle / hard nav — repaint from local league
      reapplySeasonThemeFromLocal();
      const id = getLeague()?.settings?.seasonThemeId;
      setTheme(resolveSeasonThemeId(id));
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener(SEASON_THEME_EVENT, onThemeEvent);
    window.addEventListener("warroom-view-as-player", onPlayerView);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SEASON_THEME_EVENT, onThemeEvent);
      window.removeEventListener("warroom-view-as-player", onPlayerView);
    };
  }, []);

  if (theme === "default") return null;

  return (
    <>
      <div className="season-theme-overlay" data-theme={theme} aria-hidden />
      {theme === "christmas" && <ChristmasLights />}
      {theme === "halloween" && <HalloweenDecor />}
      {theme === "thanksgiving" && <ThanksgivingDecor />}
      {theme === "newyear" && <NewYearDecor />}
    </>
  );
}
