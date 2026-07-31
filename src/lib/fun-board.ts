import type { Player } from "./types";

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
export function swingLabelFromDelta(
  delta: number | null,
  opts?: { preseason?: boolean }
): SwingLabel {
  // No scored weeks yet — don't fake "MID AS HELL" for everyone
  if (opts?.preseason || delta === null) {
    return { key: "preseason", text: "WAITING", tone: "flat", delta: 0 };
  }
  if (delta === 0) {
    return { key: "mid", text: "MID AS HELL", tone: "flat", delta: 0 };
  }
  if (delta >= 5) {
    return { key: "rocket", text: "ROCKET SHIP", tone: "hero", delta };
  }
  if (delta >= 3) {
    return { key: "heater", text: "ON A HEATER", tone: "up", delta };
  }
  if (delta >= 1) {
    return { key: "climb", text: "CLIMBING", tone: "up", delta };
  }
  if (delta <= -5) {
    return { key: "trapdoor", text: "TRAPDOOR", tone: "shame", delta };
  }
  if (delta <= -3) {
    return { key: "dropped", text: "DROPPED THE BALL", tone: "down", delta };
  }
  return { key: "slip", text: "SLIPPING", tone: "down", delta };
}

/** Players with current rank, previous rank (pre-last week), and swing label. */
export function rankPlayersWithSwings(players: Player[]): RankedPlayer[] {
  if (!players.length) return [];

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
        swing: swingLabelFromDelta(delta, { preseason }),
        lastWeekPts: lastWeekPts(p),
      };
    });
}

/** Power board ordered by power score, with week-over-week standings swing labels. */
export function powerBoardWithLabels(
  players: Player[],
  powerOf: (p: Player) => number
): (RankedPlayer & { power: number })[] {
  const withSwing = rankPlayersWithSwings(players);
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

/** Build scrolling hot takes from live league stats. */
export function buildHotTakes(players: Player[]): string[] {
  if (!players.length) {
    return [
      "War Room is quiet… too quiet. Invite the chaos.",
      "No standings yet — confidence still undefeated in theory only.",
    ];
  }

  const takes: string[] = [];
  const ranked = rankPlayersWithSwings(players);
  const crownShame = weekCrownAndShame(players);

  // Generic always-on
  takes.push("Hot takes are free. Points are not.");
  takes.push("Best Bet bravely or Best Bet fraudulently — history will decide.");

  if (crownShame && !crownShame.samePerson) {
    takes.push(
      `👑 Crown: ${crownShame.crown.player.name} dropped ${crownShame.crown.pts} pts last card. Tip the cap.`
    );
    takes.push(
      `🛍️ Wall of Shame: ${crownShame.shame.player.name} scraped ${crownShame.shame.pts} pts. Brown paper bag season.`
    );
  } else if (crownShame?.samePerson) {
    takes.push(
      `${crownShame.crown.player.name} is both the story and the subplot at ${crownShame.crown.pts} pts. Lonely at the top (and bottom).`
    );
  }

  const leader = ranked[0];
  const trailer = ranked[ranked.length - 1];
  if (leader && trailer && leader.id !== trailer.id) {
    takes.push(
      `${leader.name} runs the board at ${leader.totalPoints} pts. ${trailer.name} is staring up from ${trailer.totalPoints}.`
    );
    const gap = leader.totalPoints - trailer.totalPoints;
    if (gap >= 20) {
      takes.push(
        `Gap alert: ${gap} pts from 1st to last. Someone bring a ladder. Or a plunger.`
      );
    }
  }

  for (const p of ranked) {
    if (p.swing.delta >= 3) {
      takes.push(
        `${p.name} ${p.swing.text} — jumped ${p.swing.delta} spot${p.swing.delta === 1 ? "" : "s"} after the last card.`
      );
    }
    if (p.swing.delta <= -3) {
      takes.push(
        `${p.name} ${p.swing.text} — fell ${Math.abs(p.swing.delta)} spots. The rank graph looks like a ski jump.`
      );
    }
    if (p.currentStreak >= 3) {
      takes.push(
        `${p.name} is on a W${p.currentStreak} streak. Do not feed after midnight.`
      );
    }
    if (p.currentStreak <= -3) {
      takes.push(
        `${p.name} is on an L${Math.abs(p.currentStreak)} skid. Send snacks and better dogs.`
      );
    }
    if (p.perfectWeeks >= 1) {
      takes.push(
        `${p.name} has ${p.perfectWeeks} perfect-ish week${p.perfectWeeks > 1 ? "s" : ""} on the résumé. Show-off energy.`
      );
    }
    if (p.bestBetTotal >= 3) {
      const pct = Math.round((p.bestBetHits / p.bestBetTotal) * 100);
      if (pct >= 60) {
        takes.push(
          `${p.name} is a Best Bet assassin (${p.bestBetHits}/${p.bestBetTotal}, ${pct}%).`
        );
      } else if (pct <= 30 && p.bestBetTotal >= 3) {
        takes.push(
          `${p.name}'s Best Bet is on a fraud watch (${p.bestBetHits}/${p.bestBetTotal}).`
        );
      }
    }
    if (p.propTotal >= 3) {
      const pp = Math.round((p.propHits / p.propTotal) * 100);
      if (pp >= 70) {
        takes.push(
          `${p.name} is a prop merchant (${p.propHits}/${p.propTotal}). Crystal ball unclear, ledger clear.`
        );
      }
    }
    if (p.lastWeekPts === 0) {
      takes.push(
        `${p.name} put up a zero last week. That is not a strategy. That is a cry for help.`
      );
    }
    if (p.lastWeekPts != null && p.lastWeekPts >= 18) {
      takes.push(
        `${p.name} cooked for ${p.lastWeekPts} last week. Someone check the smoke alarms.`
      );
    }
  }

  // Dedupe while preserving order
  const seen = new Set<string>();
  const unique = takes.filter((t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });

  // Keep ticker dense but not endless
  if (unique.length < 4) {
    unique.push(
      "Lock picks before kickoff or the ticker will remember.",
      "Toilet Bowl scouting report: always accepting applications.",
      "Confidence 5 is a love language. Also a crime scene."
    );
  }

  return unique.slice(0, 24);
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
