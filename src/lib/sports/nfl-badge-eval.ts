/**
 * Evaluate NFL-specific achievements for a player in an NFL league.
 */

import type { BadgeStatus, Player } from "@/lib/types";
import { getBadgeEarnMeta, stampBadgeEarn } from "@/lib/badge-earn-meta";
import { getLeague, getSession } from "@/lib/league";
import {
  NFL_ACHIEVEMENT_CATALOG,
  type NflBadgeDef,
} from "./nfl-achievements";
import { isSandboxMode, isSandboxProtectedBadge } from "@/lib/season-mode";

export function isNflContext(): boolean {
  return (getLeague()?.sportId || "cfb") === "nfl";
}

function progress(
  current: number,
  target: number
): { current: number; target: number } {
  return { current: Math.min(current, target), target };
}

export function evaluateNflBadge(
  def: NflBadgeDef,
  player: Player,
  peers: Player[]
): { earned: boolean; progress?: { current: number; target: number } | null } {
  const id = def.id;
  const pid = player.id;
  const weeks = player.weeksPlayed ?? 0;
  const streak = player.currentStreak ?? 0;
  const weekly = Array.isArray(player.weeklyPoints) ? player.weeklyPoints : [];

  switch (id) {
    case "nfl_welcome_desk":
      return { earned: !player.isMock && !!pid };

    case "nfl_sunday_ticket":
      return {
        earned:
          isNflContext() &&
          !player.isMock &&
          (!!getSession()?.playerId || weeks > 0),
      };

    case "nfl_first_lock":
      return {
        earned: isNflContext() && weeks >= 1,
        progress: progress(weeks, 1),
      };

    case "nfl_window_watcher":
      return {
        earned: isNflContext() && weeks >= 3,
        progress: progress(weeks, 3),
      };

    case "nfl_confidence_formation":
      return {
        earned: isNflContext() && (player.atsTotal ?? 0) >= 5,
        progress: progress(player.atsTotal ?? 0, 5),
      };

    case "nfl_best_bet_live":
      return {
        earned: isNflContext() && (player.bestBetHits ?? 0) >= 1,
        progress: progress(player.bestBetHits ?? 0, 1),
      };

    case "nfl_prop_shop":
      return {
        earned: isNflContext() && (player.propHits ?? 0) >= 1,
        progress: progress(player.propHits ?? 0, 1),
      };

    case "nfl_rematch_sunday":
      return {
        earned: isNflContext() && weeks >= 2,
        progress: progress(weeks, 2),
      };

    case "nfl_perfect_sunday":
    case "nfl_max_card":
      return {
        earned: isNflContext() && (player.perfectWeeks ?? 0) >= 1,
        progress: progress(player.perfectWeeks ?? 0, 1),
      };

    case "nfl_red_zone_assassin":
      return {
        earned: isNflContext() && (player.bestBetHits ?? 0) >= 3,
        progress: progress(player.bestBetHits ?? 0, 3),
      };

    case "nfl_heater":
      return {
        earned: isNflContext() && streak >= 3,
        progress: progress(Math.max(0, streak), 3),
      };

    case "nfl_late_window_legend":
    case "nfl_primetime_general": {
      if (!isNflContext() || weekly.length === 0) {
        return { earned: false, progress: progress(0, 1) };
      }
      let tops = 0;
      const maxLen = Math.max(
        0,
        ...peers.map((p) => (p.weeklyPoints || []).length),
        weekly.length
      );
      for (let w = 0; w < maxLen; w++) {
        if (w >= weekly.length) continue;
        const my = weekly[w];
        if (my == null) continue;
        let best = my;
        for (const p of peers) {
          const arr = p.weeklyPoints || [];
          if (w < arr.length && arr[w] != null) {
            best = Math.max(best, arr[w]!);
          }
        }
        if (my === best && my > 0) tops++;
      }
      return {
        earned: tops >= 1,
        progress: progress(tops, 1),
      };
    }

    case "nfl_inactive_list":
      return {
        earned: isNflContext() && weeks >= 5,
        progress: progress(weeks, 5),
      };

    case "nfl_film_dont_lie":
      return {
        earned: isNflContext() && streak >= 10,
        progress: progress(Math.max(0, streak), 10),
      };

    case "nfl_script_master":
      return {
        earned: isNflContext() && (player.atsCorrect ?? 0) >= 100,
        progress: progress(player.atsCorrect ?? 0, 100),
      };

    case "nfl_two_minute_drill": {
      // Proxy: any strong week once playoff indices exist on the array
      const playoff = weekly.slice(14).filter((p) => (p ?? 0) >= 12);
      return {
        earned: isNflContext() && playoff.length >= 1,
        progress: progress(playoff.length, 1),
      };
    }

    case "nfl_super_bowl_desk": {
      const sb = weekly.length > 18 ? weekly[18] : weekly[weekly.length - 1];
      const late = weekly.length >= 18 && (weekly[17] ?? 0) > 0;
      return {
        earned: isNflContext() && (late || ((sb ?? 0) > 0 && weekly.length >= 18)),
        progress: progress(weekly.length >= 18 ? 1 : 0, 1),
      };
    }

    case "nfl_immortal_sunday":
      return {
        earned: isNflContext() && streak >= 30,
        progress: progress(Math.max(0, streak), 30),
      };

    default:
      return { earned: false, progress: null };
  }
}

export function getNflPlayerBadges(
  player: Player,
  leaguePeers?: Player[]
): BadgeStatus[] {
  if (!isNflContext()) return [];
  const peers =
    leaguePeers && leaguePeers.length ? leaguePeers : [player];
  const sandbox = isSandboxMode();

  return NFL_ACHIEVEMENT_CATALOG.map((def) => {
    try {
      const result = evaluateNflBadge(def, player, peers);
      let earned = result.earned;
      if (sandbox && !isSandboxProtectedBadge(def.id)) {
        return {
          def,
          earned: false,
          earnedAt: null,
          earnedSeasonYear: null,
          earnedWeek: null,
          earnCount: null,
          progress:
            result.progress ??
            (result.earned ? { current: 1, target: 1 } : null),
        };
      }
      let earnedSeasonYear: number | null = null;
      let earnedWeek: number | null = null;
      let earnedAt: string | null = null;
      if (earned) {
        try {
          const meta =
            getBadgeEarnMeta(player.id, def.id) ||
            stampBadgeEarn(player.id, def.id);
          if (meta) {
            earnedSeasonYear = meta.seasonYear;
            earnedWeek = meta.week;
            earnedAt = meta.at;
          }
        } catch {
          /* ignore */
        }
      }
      return {
        def,
        earned,
        earnedAt,
        earnedSeasonYear,
        earnedWeek,
        earnCount: earned ? 1 : null,
        progress: earned ? null : result.progress ?? null,
      };
    } catch {
      return {
        def,
        earned: false,
        earnedAt: null,
        earnedSeasonYear: null,
        earnedWeek: null,
        earnCount: null,
        progress: null,
      };
    }
  });
}
