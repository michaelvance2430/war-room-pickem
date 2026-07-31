import type { Player } from "./types";
import { isAppCreator } from "./creator";
import { getLeague } from "./league";
import {
  buildNflHotTakes,
  nflSwingText,
  NFL_TICKER_LABEL,
} from "./sports/nfl-voice";
import {
  buildCfbHotTakes,
  cfbSwingText,
  CFB_TICKER_LABEL,
} from "./sports/cfb-voice";

/** Resolve football voice pack for dual-sport rooms. */
export function resolveVoiceSport(
  sportId?: string | null
): "cfb" | "nfl" {
  if (sportId === "nfl") return "nfl";
  if (sportId == null) {
    try {
      if (getLeague()?.sportId === "nfl") return "nfl";
    } catch {
      /* ignore */
    }
  }
  return "cfb";
}

/** Chrome label on the scrolling ticker */
export function hotTakeTickerLabel(sportId?: string | null): string {
  return resolveVoiceSport(sportId) === "nfl"
    ? NFL_TICKER_LABEL
    : CFB_TICKER_LABEL;
}

/** Humorous rank-movement label from standings rank change (positive = climbed). */
export type SwingLabel = {
  key: string;
  text: string;
  /** up | down | flat | hero | shame */
  tone: "up" | "down" | "flat" | "hero" | "shame";
  /** rank delta: +3 climbed 3 spots, -2 fell 2 */
  delta: number;
};

export type CrownShame = {
  weekIndex: number;
  weekLabel: string;
  crown: { player: Player; pts: number };
  shame: { player: Player; pts: number };
  /** true when crown and shame are the same (solo / all tied) */
  samePerson: boolean;
};

export type RankedPlayer = Player & {
  rank: number;
  prevRank: number | null;
  swing: SwingLabel;
  lastWeekPts: number | null;
};

function lastWeekPts(p: Player): number | null {
  if (!p.weeklyPoints?.length) return null;
  return p.weeklyPoints[p.weeklyPoints.length - 1] ?? null;
}

function pointsBeforeLastWeek(p: Player): number {
  const w = p.weeklyPoints || [];
  if (w.length <= 1) return 0;
  return w.slice(0, -1).reduce((a, b) => a + b, 0);
}

/** Rank by season points (desc). Stable by name. */
function rankByPoints(players: Player[], getPts: (p: Player) => number): Map<string, number> {
  const sorted = [...players].sort((a, b) => {
    const d = getPts(b) - getPts(a);
    if (d !== 0) return d;
    return a.name.localeCompare(b.name);
  });
  const map = new Map<string, number>();
  sorted.forEach((p, i) => map.set(p.id, i + 1));
  return map;
}

/**
 * Swing labels from standings movement after the most recent scored week.
 * Climbed ranks → positive delta.
 */
/** Preseason status under a name — special flex for the people who run the room. */
export function preseasonSwingForPlayer(player: Player): SwingLabel {
  // Game creator — permanent flex
  if (isAppCreator(player.id) || player.isCreator) {
    return {
      key: "architect",
      text: "THE CREATOR",
      tone: "hero",
      delta: 0,
    };
  }
  // League commissioner (not the same as game creator)
  try {
    const league = getLeague();
    if (league?.commissionerId && league.commissionerId === player.id) {
      return {
        key: "gavel",
        text: "RUNS THE ROOM",
        tone: "hero",
        delta: 0,
      };
    }
  } catch {
    /* ignore */
  }
  return { key: "preseason", text: "WAITING", tone: "flat", delta: 0 };
}

export function swingLabelFromDelta(
  delta: number | null,
  opts?: { preseason?: boolean; player?: Player; sportId?: string | null }
): SwingLabel {
  const nfl = resolveVoiceSport(opts?.sportId) === "nfl";
  // No scored weeks yet — don't fake mid-card labels for everyone
  if (opts?.preseason || delta === null) {
    if (opts?.player) return preseasonSwingForPlayer(opts.player);
    return { key: "preseason", text: "WAITING", tone: "flat", delta: 0 };
  }
  if (delta === 0) {
    return {
      key: "mid",
      text: nfl ? nflSwingText("mid") : cfbSwingText("mid"),
      tone: "flat",
      delta: 0,
    };
  }
  if (delta >= 5) {
    return {
      key: "rocket",
      text: nfl ? nflSwingText("rocket") : cfbSwingText("rocket"),
      tone: "hero",
      delta,
    };
  }
  if (delta >= 3) {
    return {
      key: "heater",
      text: nfl ? nflSwingText("heater") : cfbSwingText("heater"),
      tone: "up",
      delta,
    };
  }
  if (delta >= 1) {
    return {
      key: "climb",
      text: nfl ? nflSwingText("climb") : cfbSwingText("climb"),
      tone: "up",
      delta,
    };
  }
  if (delta <= -5) {
    return {
      key: "trapdoor",
      text: nfl ? nflSwingText("trapdoor") : cfbSwingText("trapdoor"),
      tone: "shame",
      delta,
    };
  }
  if (delta <= -3) {
    return {
      key: "dropped",
      text: nfl ? nflSwingText("dropped") : cfbSwingText("dropped"),
      tone: "down",
      delta,
    };
  }
  return {
    key: "slip",
    text: nfl ? nflSwingText("slip") : cfbSwingText("slip"),
    tone: "down",
    delta,
  };
}

/** Players with current rank, previous rank (pre-last week), and swing label. */
export function rankPlayersWithSwings(
  players: Player[],
  sportId?: string | null
): RankedPlayer[] {
  if (!players.length) return [];

  const sport = resolveVoiceSport(sportId);
  const anyWeek = players.some((p) => (p.weeklyPoints?.length || 0) > 0);
  const currentRanks = rankByPoints(players, (p) => p.totalPoints);
  const prevRanks = anyWeek
    ? rankByPoints(players, pointsBeforeLastWeek)
    : null;

  return [...players]
    .sort((a, b) => {
      const d = b.totalPoints - a.totalPoints;
      if (d !== 0) return d;
      return a.name.localeCompare(b.name);
    })
    .map((p) => {
      const rank = currentRanks.get(p.id) || 1;
      const prevRank = prevRanks ? prevRanks.get(p.id) ?? rank : null;
      // Only show swing if at least 2 weeks of data league-wide
      const weeksPlayed = Math.max(
        ...players.map((x) => x.weeklyPoints?.length || 0),
        0
      );
      let delta: number | null = null;
      const preseason = weeksPlayed === 0;
      if (preseason) {
        delta = null;
      } else if (prevRank != null && weeksPlayed >= 2) {
        delta = prevRank - rank; // climbed = prev was worse (higher number)
      } else if (weeksPlayed === 1) {
        // First scored week: use last week pts vs field average for flavor labels
        const last = lastWeekPts(p);
        const scores = players
          .map(lastWeekPts)
          .filter((n): n is number => n != null);
        if (last != null && scores.length >= 2) {
          const max = Math.max(...scores);
          const min = Math.min(...scores);
          if (last === max && max > min) delta = 3;
          else if (last === min && max > min) delta = -3;
          else delta = 0;
        } else {
          delta = 0;
        }
      }

      return {
        ...p,
        rank,
        prevRank,
        swing: swingLabelFromDelta(delta, {
          preseason,
          player: p,
          sportId: sport,
        }),
        lastWeekPts: lastWeekPts(p),
      };
    });
}

/** Power board ordered by power score, with week-over-week standings swing labels. */
export function powerBoardWithLabels(
  players: Player[],
  powerOf: (p: Player) => number
): (RankedPlayer & { power: number })[] {
  const withSwing = rankPlayersWithSwings(players, resolveVoiceSport());
  const byId = new Map(withSwing.map((p) => [p.id, p]));

  return [...players]
    .map((p) => {
      const base = byId.get(p.id)!;
      return { ...base, power: powerOf(p) };
    })
    .sort((a, b) => b.power - a.power)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

/**
 * True after at least one week has been scored this season
 * (weeks_played > 0 or any positive weekly point entry).
 * Fresh / post-reset leagues stay empty until the first score.
 */
export function leagueHasScoredWeek(players: Player[]): boolean {
  return players.some(
    (p) =>
      (p.weeksPlayed || 0) > 0 ||
      (p.weeklyPoints || []).some((n) => typeof n === "number" && n > 0)
  );
}

/**
 * This week's Crown (high score) and Wall of Shame (low score).
 * Uses the last entry in weeklyPoints for each player.
 * Returns null before any week is scored (including after season reset).
 */
export function weekCrownAndShame(players: Player[]): CrownShame | null {
  if (!players.length || !leagueHasScoredWeek(players)) return null;

  const withLast = players
    .map((p) => ({ player: p, pts: lastWeekPts(p) }))
    .filter((x): x is { player: Player; pts: number } => x.pts != null);

  if (withLast.length < 1) return null;

  // All zeros / empty after a soft reset — still nothing to crown
  if (withLast.every((r) => r.pts === 0) && players.every((p) => !(p.weeksPlayed || 0))) {
    return null;
  }

  const weekIndex = Math.max(
    ...players.map((p) => (p.weeklyPoints?.length || 0) - 1),
    0
  );
  const weekLabel = "Latest scored week";

  let crown = withLast[0];
  let shame = withLast[0];
  for (const row of withLast) {
    if (row.pts > crown.pts) crown = row;
    if (row.pts < shame.pts) shame = row;
  }

  return {
    weekIndex,
    weekLabel,
    crown: { player: crown.player, pts: crown.pts },
    shame: { player: shame.player, pts: shame.pts },
    samePerson: crown.player.id === shame.player.id,
  };
}

/**
 * Build scrolling hot takes from live league stats.
 * Pass sportId when you have it — dual-sport players should never hear
 * the same jokes on campus Saturday and pro Sunday.
 */
export function buildHotTakes(
  players: Player[],
  sportId?: string | null
): string[] {
  const sport = resolveVoiceSport(sportId);
  const crownShame = weekCrownAndShame(players);
  const bank =
    sport === "nfl" ? buildNflHotTakes(players) : buildCfbHotTakes(players);

  if (sport === "nfl") {
    if (crownShame && !crownShame.samePerson) {
      bank.unshift(
        `👑 Late window: ${crownShame.crown.player.name} stacked ${crownShame.crown.pts}. Film don't lie.`,
        `📉 Three-and-out: ${crownShame.shame.player.name} at ${crownShame.shame.pts}. Red-zone dignity: missing.`
      );
    } else if (crownShame?.samePerson) {
      bank.unshift(
        `${crownShame.crown.player.name} is both the highlight and the lowlight package at ${crownShame.crown.pts}. Lonely at the top (and bottom).`
      );
    }
  } else if (crownShame && !crownShame.samePerson) {
    bank.unshift(
      `👑 Crown: ${crownShame.crown.player.name} dropped ${crownShame.crown.pts} pts last card. Tip the cap.`,
      `🛍️ Wall of Shame: ${crownShame.shame.player.name} scraped ${crownShame.shame.pts} pts. Brown paper bag season.`
    );
  } else if (crownShame?.samePerson) {
    bank.unshift(
      `${crownShame.crown.player.name} is both the story and the subplot at ${crownShame.crown.pts} pts. Lonely at the top (and bottom).`
    );
  }

  // Live swing callouts (sport-flavored badge text already applied)
  const ranked = rankPlayersWithSwings(players, sport);
  for (const p of ranked) {
    if (p.swing.delta >= 3) {
      bank.push(
        sport === "nfl"
          ? `${p.name} ${p.swing.text} — jumped ${p.swing.delta} spot${p.swing.delta === 1 ? "" : "s"} after the late window.`
          : `${p.name} ${p.swing.text} — jumped ${p.swing.delta} spot${p.swing.delta === 1 ? "" : "s"} after the last Saturday card.`
      );
    }
    if (p.swing.delta <= -3) {
      bank.push(
        sport === "nfl"
          ? `${p.name} ${p.swing.text} — fell ${Math.abs(p.swing.delta)} spots. Tape don't care about excuses.`
          : `${p.name} ${p.swing.text} — fell ${Math.abs(p.swing.delta)} spots. The rank graph looks like a ski jump.`
      );
    }
  }

  const seen = new Set<string>();
  return bank
    .filter((t) => {
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    })
    .slice(0, 24);
}

export function swingBadgeClass(tone: SwingLabel["tone"]): string {
  switch (tone) {
    case "hero":
      return "bg-primary/20 text-primary border-primary/40";
    case "up":
      return "bg-primary/10 text-primary border-primary/30";
    case "shame":
      return "bg-toilet/20 text-toilet border-toilet/40";
    case "down":
      return "bg-danger/15 text-danger border-danger/30";
    default:
      return "bg-card-hover text-muted border-border";
  }
}
