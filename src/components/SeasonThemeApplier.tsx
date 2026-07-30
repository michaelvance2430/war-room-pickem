"use client";

import { useEffect } from "react";
import { getLeague } from "@/lib/league";
import { syncLeagueFromCloud } from "@/lib/league-sync";
import {
  applySeasonTheme,
  DEFAULT_SEASON_THEME_ID,
} from "@/lib/season-theme";

/**
 * Reads league season theme and paints holiday backgrounds for everyone.
 * Syncs from cloud so deputies/players pick up Commish changes.
 */
export default function SeasonThemeApplier() {
  useEffect(() => {
    applySeasonTheme(
      getLeague()?.settings?.seasonThemeId || DEFAULT_SEASON_THEME_ID
    );

    let cancelled = false;
    void (async () => {
      const lg = await syncLeagueFromCloud();
      if (cancelled) return;
      applySeasonTheme(
        lg?.settings?.seasonThemeId ||
          getLeague()?.settings?.seasonThemeId ||
          DEFAULT_SEASON_THEME_ID
      );
    })();

    // Re-apply when other tabs / save updates localStorage
    function onStorage(e: StorageEvent) {
      if (e.key !== "warroom-league") return;
      try {
        const lg = e.newValue ? JSON.parse(e.newValue) : null;
        applySeasonTheme(lg?.settings?.seasonThemeId);
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
