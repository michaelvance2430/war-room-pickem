import type { Player } from "./types";
import { rankPlayersWithSwings } from "./fun-board";
import type { LeagueTrophy } from "./trophies";

export type LoreCard = {
  id: string;
  emoji: string;
  title: string;
  /** Winner display name(s) */
  name: string;
  userId: string | null;
  /** Big number or short stat */
  stat: string;
  /** One-liner under the name */
  blurb: string;
  /** Border/accent tone */
  tone: "fire" | "up" | "gold" | "champ" | "muted";
};

/**
 * Build the first four “League lore” cards from live players + trophies.
 * Hides empty-looking cards when data isn’t there yet.
 */
export function buildLeagueLoreCards(
  players: Player[],
  trophies: LeagueTrophy[]
): LoreCard[] {
  const cards: LoreCard[] = [];
  if (!players.length) return cards;

  // 1) Longest active streak (prefer longest win streak; else least-bad / longest either)
  const byWinStreak = [...players].sort((a, b) => {
    if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
    return a.name.localeCompare(b.name);
  });
  const streakLeader = byWinStreak[0];
  if (streakLeader && streakLeader.currentStreak > 0) {
    cards.push({
      id: "streak",
      emoji: "🔥",
      title: "Longest Active Streak",
      name: streakLeader.name,
      userId: streakLeader.id,
      stat: `W${streakLeader.currentStreak}`,
      blurb:
        streakLeader.currentStreak === 1
          ? "One week hot. Don’t feed after midnight."
          : `${streakLeader.currentStreak}-week heater. Someone check the smoke alarms.`,
      tone: "fire",
    });
  } else {
    // Show coldest skid if no one is on a W streak
    const bySkid = [...players].sort((a, b) => {
      if (a.currentStreak !== b.currentStreak) return a.currentStreak - b.currentStreak;
      return a.name.localeCompare(b.name);
    });
    const cold = bySkid[0];
    if (cold && cold.currentStreak < 0) {
      cards.push({
        id: "streak",
        emoji: "🥶",
        title: "Longest Active Skid",
        name: cold.name,
        userId: cold.id,
        stat: `L${Math.abs(cold.currentStreak)}`,
        blurb: "Send snacks. Or better dogs. Possibly both.",
        tone: "muted",
      });
    }
  }

  // 2) Biggest weekly jump (standings rank climbed last scored week)
  const ranked = rankPlayersWithSwings(players);
  const jumpers = ranked
    .filter((p) => p.swing.delta > 0 && (p.weeklyPoints?.length || 0) >= 2)
    .sort((a, b) => {
      if (b.swing.delta !== a.swing.delta) return b.swing.delta - a.swing.delta;
      return (b.lastWeekPts || 0) - (a.lastWeekPts || 0);
    });
  if (jumpers[0] && jumpers[0].swing.delta > 0) {
    const j = jumpers[0];
    cards.push({
      id: "jump",
      emoji: "📈",
      title: "Biggest Weekly Jump",
      name: j.name,
      userId: j.id,
      stat: `+${j.swing.delta} spot${j.swing.delta === 1 ? "" : "s"}`,
      blurb:
        j.lastWeekPts != null
          ? `${j.lastWeekPts} pts last card · ${j.swing.text}`
          : j.swing.text,
      tone: "up",
    });
  }

  // 3) Rings — championship trophies engraved
  const champs = trophies.filter((t) => t.trophyType === "championship");
  if (champs.length > 0) {
    const byWinner = new Map<
      string,
      { name: string; userId: string | null; count: number; years: number[] }
    >();
    for (const t of champs) {
      const key = t.winnerUserId || t.winnerName.toLowerCase();
      const cur = byWinner.get(key) || {
        name: t.winnerName,
        userId: t.winnerUserId,
        count: 0,
        years: [],
      };
      cur.count += 1;
      cur.years.push(t.seasonYear);
      byWinner.set(key, cur);
    }
    const top = [...byWinner.values()].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    })[0];
    if (top) {
      const years = [...top.years].sort((a, b) => b - a).slice(0, 3).join(", ");
      cards.push({
        id: "rings",
        emoji: "🏆",
        title: "Rings",
        name: top.name,
        userId: top.userId,
        stat: `${top.count}×`,
        blurb:
          top.count === 1
            ? `Championship · ${years}`
            : `${top.count} titles · ${years}${top.years.length > 3 ? "…" : ""}`,
        tone: "gold",
      });
    }
  }

  // 4) Defending champion — most recent championship engraving
  const lastChamp = [...champs].sort((a, b) => {
    if (b.seasonYear !== a.seasonYear) return b.seasonYear - a.seasonYear;
    return b.awardedAt.localeCompare(a.awardedAt);
  })[0];
  if (lastChamp) {
    cards.push({
      id: "defending",
      emoji: "👑",
      title: "Defending Champion",
      name: lastChamp.winnerName,
      userId: lastChamp.winnerUserId,
      stat: String(lastChamp.seasonYear),
      blurb: lastChamp.subtitle
        ? lastChamp.subtitle
        : `Still the titleholder until someone takes ${lastChamp.seasonYear}.`,
      tone: "champ",
    });
  }

  return cards;
}
