/**
 * One-line "how they play" identity for profiles.
 * Intimate, sport-aware — not a second power score.
 */

import type { Player, BadgeStatus } from "@/lib/types";

export type SeasonPlot = {
  /** e.g. W3 / L2 / — */
  streakLabel: string;
  streakHot: boolean;
  streakCold: boolean;
  /** Last scored week points */
  lastWeekPts: number | null;
  lastWeekLabel: string;
  bestWeekPts: number | null;
  /** 1-based season rank among peers, or null */
  roomRank: number | null;
  roomSize: number;
  atsLabel: string;
  perfectWeeks: number;
};

function firstName(name: string) {
  return (name || "They").trim().split(/\s+/)[0] || "They";
}

/**
 * Signature style — one roast-adjacent line from season shape + badges.
 * Prefer story over spreadsheet.
 */
export function buildSignatureStyle(opts: {
  player: Player;
  badges?: BadgeStatus[];
  sportId?: string | null;
  peers?: Player[];
}): string {
  const p = opts.player;
  const nfl = opts.sportId === "nfl";
  const day = nfl ? "Sunday" : "Saturday";
  const earned = new Set(
    (opts.badges || []).filter((b) => b.earned).map((b) => b.def.id)
  );
  const first = firstName(p.name);
  const ats =
    p.atsTotal > 0 ? Math.round((p.atsCorrect / p.atsTotal) * 100) : null;
  const bb =
    p.bestBetTotal >= 3
      ? Math.round((p.bestBetHits / p.bestBetTotal) * 100)
      : null;
  const prop =
    p.propTotal >= 3
      ? Math.round((p.propHits / p.propTotal) * 100)
      : null;

  // Priority: rare stories first
  if (earned.has("let_them_cook") || earned.has("chaos_agent")) {
    return nfl
      ? `${first} has armed Chaos. Film session is never boring.`
      : `${first} has gone nuclear. The campus wire still talks about it.`;
  }
  if ((p.perfectWeeks || 0) >= 2) {
    return `${p.perfectWeeks} perfect cards on the résumé. The room is tired of applauding.`;
  }
  if ((p.perfectWeeks || 0) === 1) {
    return `One perfect week. Still enough to hang over the group chat.`;
  }
  if (p.currentStreak >= 5) {
    return `On a W${p.currentStreak} heater. Fade them only if you enjoy being wrong.`;
  }
  if (p.currentStreak <= -4) {
    return `Cold streak L${Math.abs(p.currentStreak)}. Dignity is on IR.`;
  }
  if (bb != null && bb >= 65) {
    return `Best Bet assassin (${p.bestBetHits}/${p.bestBetTotal}). Witnesses only.`;
  }
  if (bb != null && bb <= 30) {
    return `Best Bet on fraud watch (${p.bestBetHits}/${p.bestBetTotal}). The card remembers.`;
  }
  if (prop != null && prop >= 70) {
    return `Prop merchant (${p.propHits}/${p.propTotal}). Crystal ball optional; ledger clear.`;
  }
  if (earned.has("underdog_believer") || earned.has("underdog_spree")) {
    return nfl
      ? `Dog walker energy. Late windows and long odds.`
      : `Campus dog believer. The line is a suggestion.`;
  }
  if (ats != null && p.atsTotal >= 12 && ats >= 60) {
    return `${ats}% ATS this season. Sharp-adjacent. Don't ask for free picks.`;
  }
  if (ats != null && p.atsTotal >= 12 && ats <= 42) {
    return `${ats}% ATS. Building character. Or a Toilet Bowl résumé.`;
  }
  if ((p.weeksPlayed || 0) === 0 && !p.atsTotal) {
    return nfl
      ? `New to the board. Primetime hasn't judged them yet.`
      : `New blood. The first card is still destiny.`;
  }
  if ((p.totalPoints || 0) > 0 && (p.weeksPlayed || p.weeklyPoints?.length)) {
    return nfl
      ? `Locks when it matters. Talks after. Classic ${day} energy.`
      : `Shows up for the card. The standings do the rest.`;
  }
  return nfl
    ? `Still writing their Sunday story.`
    : `Still writing their Saturday story.`;
}

/** Season plot block — rival lives on resume; this is the arc. */
export function buildSeasonPlot(
  player: Player,
  peers: Player[]
): SeasonPlot {
  const weeks = player.weeklyPoints || [];
  const lastWeekPts = weeks.length ? weeks[weeks.length - 1]! : null;
  const lastWeekLabel =
    lastWeekPts == null
      ? "No card scored yet"
      : lastWeekPts === 0
        ? "Last card: zero (the room saw it)"
        : `Last card: ${lastWeekPts} pts`;

  let streakLabel = "—";
  let streakHot = false;
  let streakCold = false;
  if (player.currentStreak > 0) {
    streakLabel = `W${player.currentStreak}`;
    streakHot = player.currentStreak >= 3;
  } else if (player.currentStreak < 0) {
    streakLabel = `L${Math.abs(player.currentStreak)}`;
    streakCold = player.currentStreak <= -3;
  }

  const humans = peers.filter((p) => !p.isMock);
  const sorted = [...humans].sort((a, b) => {
    const d = (b.totalPoints || 0) - (a.totalPoints || 0);
    if (d !== 0) return d;
    return a.name.localeCompare(b.name);
  });
  const idx = sorted.findIndex((p) => p.id === player.id);
  const roomRank = idx >= 0 ? idx + 1 : null;

  const atsLabel = player.atsTotal
    ? `${player.atsCorrect}–${player.atsTotal - player.atsCorrect}`
    : "—";

  return {
    streakLabel,
    streakHot,
    streakCold,
    lastWeekPts,
    lastWeekLabel,
    bestWeekPts: player.bestWeek > 0 ? player.bestWeek : null,
    roomRank,
    roomSize: sorted.length || peers.length,
    atsLabel,
    perfectWeeks: player.perfectWeeks || 0,
  };
}
