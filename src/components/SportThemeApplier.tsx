"use client";

import { useEffect } from "react";
import { getLeague } from "@/lib/league";
import { syncLeagueFromCloud } from "@/lib/league-sync";
import {
  applySportTheme,
  reapplySportThemeFromLocal,
  SPORT_THEME_EVENT,
} from "@/lib/sports/sport-theme";

/**
 * Full-app sport skin from active league.sportId.
 * WWC → Brazil palette everywhere; CFB → classic green War Room.
 */
export default function SportThemeApplier() {
  useEffect(() => {
    applySportTheme(getLeague()?.sportId);

    let cancelled = false;
    void (async () => {
      const lg = await syncLeagueFromCloud();
      if (cancelled) return;
      applySportTheme(lg?.sportId || getLeague()?.sportId);
    })();

    function onStorage(e: StorageEvent) {
      if (e.key !== "warroom-league") return;
      try {
        const lg = e.newValue ? JSON.parse(e.newValue) : null;
        applySportTheme(lg?.sportId);
      } catch {
        /* ignore */
      }
    }

    function onSportEvent() {
      reapplySportThemeFromLocal();
    }

    function onPlayerView() {
      reapplySportThemeFromLocal();
    }

    // League switch / join often rewrites localStorage without StorageEvent in same tab
    function onFocus() {
      reapplySportThemeFromLocal();
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener(SPORT_THEME_EVENT, onSportEvent);
    window.addEventListener("warroom-view-as-player", onPlayerView);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    // Poll lightly — catch join/create same-tab without events
    const iv = window.setInterval(() => {
      reapplySportThemeFromLocal();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(iv);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SPORT_THEME_EVENT, onSportEvent);
      window.removeEventListener("warroom-view-as-player", onPlayerView);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return null;
}
