export type SeasonCommandPlayer = {
  id: string;
  name: string;
  totalPoints: number;
  weeklyPoints?: number[];
};

export type HomeSeasonCommand = {
  phase: "opening" | "early" | "midseason" | "cut" | "postseason" | "finale";
  kicker: string;
  headline: string;
  order: string;
  story: string | null;
  personal: string | null;
  tone: "green" | "amber" | "red" | "gold";
};

function latestPoints(player: SeasonCommandPlayer): number | null {
  const points = player.weeklyPoints || [];
  return points.length ? points[points.length - 1] ?? null : null;
}

function weeklyStory(players: SeasonCommandPlayer[]): string | null {
  const scored = players
    .map((player) => ({ player, points: latestPoints(player) }))
    .filter((row): row is { player: SeasonCommandPlayer; points: number } => row.points !== null);
  if (!scored.length) return null;
  const crown = [...scored].sort((a, b) => b.points - a.points || a.player.name.localeCompare(b.player.name))[0];
  const shame = [...scored].sort((a, b) => a.points - b.points || a.player.name.localeCompare(b.player.name))[0];
  if (!crown || !shame) return null;
  if (crown.player.id === shame.player.id) {
    return `${crown.player.name} is currently the entire story · ${crown.points} pts`;
  }
  return `${crown.player.name} took the Crown · ${shame.player.name} landed on Shame`;
}

function personalCutStatus(opts: {
  players: SeasonCommandPlayer[];
  playerId?: string | null;
  cutPercent: number;
  locked: boolean;
  frozenField?: "championship" | "toilet" | "eliminated" | null;
}): string | null {
  if (!opts.playerId || opts.players.length < 2) return null;
  const ranked = [...opts.players].sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name));
  const rank = ranked.findIndex((player) => player.id === opts.playerId) + 1;
  if (!rank) return null;
  if (opts.locked && opts.frozenField) {
    if (opts.frozenField === "championship") {
      return `#${rank} · CHAMPIONSHIP FIELD`;
    }
    if (opts.frozenField === "toilet") return `#${rank} · TOILET FIELD`;
    return `#${rank} · POSTSEASON ELIMINATED`;
  }
  const championshipSeats = Math.max(1, Math.ceil(ranked.length * (1 - opts.cutPercent / 100)));
  if (opts.locked) return `#${rank} · FIELD PENDING AUTHORITY`;
  if (rank < championshipSeats) return `#${rank} · projected IN`;
  if (rank <= championshipSeats + 1) return `#${rank} · ON THE BUBBLE`;
  return `#${rank} · projected Toilet`; 
}

export function resolveHomeSeasonCommand(opts: {
  week: number;
  cutWeek: number;
  finalWeek: number;
  players?: SeasonCommandPlayer[];
  playerId?: string | null;
  cutPercent?: number;
  frozenField?: "championship" | "toilet" | "eliminated" | null;
}): HomeSeasonCommand {
  const players = opts.players || [];
  const story = weeklyStory(players);
  const cutStatus = personalCutStatus({
    players,
    playerId: opts.playerId,
    cutPercent: opts.cutPercent ?? 50,
    locked: opts.week > opts.cutWeek,
    frozenField: opts.frozenField,
  });

  if (opts.week >= opts.finalWeek) {
    return { phase: "finale", kicker: "Season Command · Finale", headline: "THE EVIDENCE IS PERMANENT", order: "Hardware, final paper, and the names that survived the year.", story, personal: cutStatus, tone: "gold" };
  }
  if (opts.week > opts.cutWeek) {
    return { phase: "postseason", kicker: "Season Command · Postseason", headline: "HARDWARE SEASON", order: "Win the week. Advance. Nobody remembers a tasteful elimination.", story, personal: cutStatus, tone: "gold" };
  }
  if (opts.week >= Math.max(2, opts.cutWeek - 2)) {
    return { phase: "cut", kicker: "Season Command · Cut Pressure", headline: "THE CUT LINE IS HUNTING", order: "Championship or Toilet. Every confidence point now has paperwork.", story, personal: cutStatus, tone: "red" };
  }
  if (opts.week >= 4) {
    return { phase: "midseason", kicker: "Season Command · Midseason", headline: "THE ROOM HAS A MEMORY", order: "Lock the card. Check the paper. Explain yourself on the Board.", story, personal: cutStatus, tone: "amber" };
  }
  if (opts.week >= 2) {
    return { phase: "early", kicker: "Season Command · Early Season", headline: "THE BOARD IS WAKING UP", order: "Patterns are forming. Unfortunately, your friends can read them.", story, personal: null, tone: "green" };
  }
  return { phase: "opening", kicker: "Season Command · Opening", headline: "LOCK THE CARD · THAT’S THE WHOLE JOB", order: "Pick a side. Assign confidence. Mark the Best Bet. Get out alive.", story, personal: null, tone: "green" };
}
