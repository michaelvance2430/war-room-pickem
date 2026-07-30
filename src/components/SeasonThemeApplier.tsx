"use client";

import { useEffect, useState } from "react";
import { getLeague } from "@/lib/league";
import { syncLeagueFromCloud } from "@/lib/league-sync";
import {
  applySeasonTheme,
  DEFAULT_SEASON_THEME_ID,
  SEASON_THEME_EVENT,
  resolveSeasonThemeId,
  type SeasonThemeId,
} from "@/lib/season-theme";
import ChristmasLights from "@/components/ChristmasLights";
import HalloweenDecor from "@/components/HalloweenDecor";

/**
 * Reads league season theme and paints holiday backgrounds for everyone.
 * Syncs from cloud so deputies/players pick up Commish changes.
 */
export default function SeasonThemeApplier() {
  const [theme, setTheme] = useState<SeasonThemeId>(DEFAULT_SEASON_THEME_ID);

  useEffect(() => {
    const initial = resolveSeasonThemeId(
      getLeague()?.settings?.seasonThemeId || DEFAULT_SEASON_THEME_ID
    );
    applySeasonTheme(initial);
    setTheme(initial);

    let cancelled = false;
    void (async () => {
      const lg = await syncLeagueFromCloud();
      if (cancelled) return;
      const next = resolveSeasonThemeId(
        lg?.settings?.seasonThemeId ||
          getLeague()?.settings?.seasonThemeId ||
          DEFAULT_SEASON_THEME_ID
      );
      applySeasonTheme(next);
      setTheme(next);
    })();

    function onStorage(e: StorageEvent) {
      if (e.key !== "warroom-league") return;
      try {
        const lg = e.newValue ? JSON.parse(e.newValue) : null;
        const next = resolveSeasonThemeId(lg?.settings?.seasonThemeId);
        applySeasonTheme(next);
        setTheme(next);
      } catch {
        /* ignore */
      }
    }

    function onThemeEvent(e: Event) {
      const detail = (e as CustomEvent<SeasonThemeId>).detail;
      setTheme(resolveSeasonThemeId(detail));
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener(SEASON_THEME_EVENT, onThemeEvent);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SEASON_THEME_EVENT, onThemeEvent);
    };
  }, []);

  if (theme === "christmas") return <ChristmasLights />;
  if (theme === "halloween") return <HalloweenDecor />;
  return null;
}
