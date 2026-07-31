/**
 * Evaluate World Cup passport stamps for a player.
 * Live/partial stamps work with current War Room data; stubs stay locked until tournament graph exists.
 */

import type { BadgeStatus, Player } from "@/lib/types";
import { hasEngagement } from "@/lib/engagement";
import { getBadgeEarnMeta, stampBadgeEarn } from "@/lib/badge-earn-meta";
import { getSession, getLeague } from "@/lib/league";
import {
  WWC_ACHIEVEMENT_CATALOG,
  type WwcBadgeDef,
} from "./wwc-achievements";

export function isWwcContext(): boolean {
  return (getLeague()?.sportId || "cfb") === "soccer_wwc";
}

function progress(
  current: number,
  target: number
): { current: number; target: number } {
  return { current: Math.min(current, target), target };
}

/**
 * Core evaluators for stamps we can score without full tournament metadata.
 */
export function evaluateWwcBadge(
  def: WwcBadgeDef,
  player: Player
): { earned: boolean; progress?: { current: number; target: number } | null } {
  const id = def.id;
  const pid = player.id;

  switch (id) {
    case "wwc_welcome_pitch":
      // Any signed-in human in a WWC league has an account
      return { earned: !player.isMock && !!pid };

    case "wwc_world_traveler":
      return {
        earned:
          isWwcContext() &&
          !player.isMock &&
          (hasEngagement(pid, "opened_standings") ||
            hasEngagement(pid, "opened_locker") ||
            hasEngagement(pid, "opened_announcements") ||
            (player.weeksPlayed ?? 0) > 0 ||
            !!getSession()?.playerId),
      };

    case "wwc_kickoff":
      return {
        earned: isWwcContext() && (player.weeksPlayed ?? 0) >= 1,
        progress: progress(player.weeksPlayed ?? 0, 1),
      };

    case "wwc_matchday_ready":
      // Proxy: any locked week played
      return {
        earned: isWwcContext() && (player.weeksPlayed ?? 0) >= 1,
        progress: progress(player.weeksPlayed ?? 0, 1),
      };

    case "wwc_hat_trick":
      return {
        earned: isWwcContext() && (player.currentStreak ?? 0) >= 3,
        progress: progress(Math.max(0, player.currentStreak ?? 0), 3),
      };

    case "wwc_onside":
      return {
        earned: isWwcContext() && (player.weeksPlayed ?? 0) >= 3,
        progress: progress(player.weeksPlayed ?? 0, 3),
      };

    case "wwc_confidence_builder":
      // Proxy: played a full card once
      return {
        earned: isWwcContext() && (player.atsTotal ?? 0) >= 5,
        progress: progress(player.atsTotal ?? 0, 5),
      };

    case "wwc_best_bet_winner":
      return {
        earned: isWwcContext() && (player.bestBetHits ?? 0) >= 1,
        progress: progress(player.bestBetHits ?? 0, 1),
      };

    case "wwc_pitch_perfect":
      return {
        earned: isWwcContext() && (player.perfectWeeks ?? 0) >= 1,
        progress: progress(player.perfectWeeks ?? 0, 1),
      };

    case "wwc_survivors_instinct":
      // Soft: 5+ weeks played (full "never miss" needs lock audit)
      return {
        earned: false,
        progress: progress(player.weeksPlayed ?? 0, 5),
      };

    case "wwc_global_scout":
      return {
        earned: isWwcContext() && (player.atsCorrect ?? 0) >= 40,
        progress: progress(player.atsCorrect ?? 0, 40),
      };

    case "wwc_around_the_world":
      return {
        earned: isWwcContext() && (player.atsCorrect ?? 0) >= 50,
        progress: progress(player.atsCorrect ?? 0, 50),
      };

    case "wwc_global_domination": {
      const total = player.atsTotal ?? 0;
      const correct = player.atsCorrect ?? 0;
      const pct = total > 0 ? correct / total : 0;
      return {
        earned: isWwcContext() && total >= 20 && pct >= 0.85,
        progress: progress(Math.round(pct * 100), 85),
      };
    }

    default:
      // Tournament graph not wired — show locked with no fake progress
      return { earned: false, progress: null };
  }
}

export function getPlayerWwcBadges(player: Player): BadgeStatus[] {
  return WWC_ACHIEVEMENT_CATALOG.map((def) => {
    try {
      const result = evaluateWwcBadge(def, player);
      let earned = result.earned;
      let earnedSeasonYear: number | null = null;
      let earnedWeek: number | null = null;
      let earnedAt: string | null = null;

      if (earned && !player.isMock) {
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
