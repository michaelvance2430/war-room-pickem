/**
 * Living history — resume, legacy score, museum, rivals, titles, records.
 * v1: trophies + live season Player stats + career badges.
 * Multi-year ATS/W-L expands when season archives land.
 */

import type { Player } from "./types";
import type { BadgeStatus } from "./types";
import type { LeagueTrophy } from "./trophies";
import { getCareerCheevoPoints } from "./career-cheevo";

export const LEGACY_SCORE_VERSION = "v1";

export type PlayerTitle = {
  id: string;
  label: string;
  blurb: string;
};

export type LegacyBreakdown = {
  version: string;
  total: number;
  parts: { key: string; label: string; points: number }[];
};

export type FootballResume = {
  name: string;
  memberSinceLabel: string;
  championships: number;
  toiletTitles: number;
  crystalBalls: number;
  champYears: number[];
  toiletYears: number[];
  nerdYears: number[];
  /** Season W-L from ATS (correct-incorrect) when available */
  seasonRecordLabel: string;
  seasonAtsPct: number | null;
  perfectWeeks: number;
  currentStreakLabel: string;
  badgesEarned: number;
  badgesTotal: number;
  careerCheevoPoints: number;
  seasonPickemPoints: number;
  titles: PlayerTitle[];
  rival: { name: string; userId: string; blurb: string } | null;
  dynastyYears: number[];
  dynastyScore: number;
  overallRating: number;
  legacy: LegacyBreakdown;
};

export type MuseumEvent = {
  id: string;
  year: number;
  sortKey: string;
  emoji: string;
  title: string;
  body: string;
  userId: string | null;
  userName: string | null;
  kind: "trophy" | "milestone" | "season" | "streak" | "badge";
};

export type LeagueRecordRow = {
  id: string;
  label: string;
  emoji: string;
  name: string;
  userId: string | null;
  stat: string;
  blurb: string;
};

export type LeagueHistoryYear = {
  year: number;
  champion: { name: string; userId: string | null } | null;
  toilet: { name: string; userId: string | null } | null;
  nerd: { name: string; userId: string | null } | null;
};

function atsPct(p: Player): number | null {
  if (!p.atsTotal) return null;
  return Math.round((p.atsCorrect / p.atsTotal) * 1000) / 10;
}

function recordLabel(p: Player): string {
  if (!p.atsTotal) return "—";
  const w = p.atsCorrect;
  const l = Math.max(0, p.atsTotal - p.atsCorrect);
  return `${w}–${l}`;
}

function streakLabel(p: Player): string {
  if (p.currentStreak > 0) return `${p.currentStreak} correct (hot)`;
  if (p.currentStreak < 0) return `${Math.abs(p.currentStreak)} cold`;
  return "—";
}

/** Prefer userId match; fall back to exact name. */
export function matchPlayerTrophies(
  player: Player,
  trophies: LeagueTrophy[]
): LeagueTrophy[] {
  const byId = trophies.filter((t) => t.winnerUserId === player.id);
  if (byId.length) return byId;
  const n = (player.name || "").trim().toLowerCase();
  if (!n) return [];
  return trophies.filter((t) => (t.winnerName || "").trim().toLowerCase() === n);
}

/**
 * Player titles from trophies + badges + role-ish stats (earned, not vanity store).
 */
export function derivePlayerTitles(
  player: Player,
  trophies: LeagueTrophy[],
  badges: BadgeStatus[],
  isCommissioner?: boolean
): PlayerTitle[] {
  const titles: PlayerTitle[] = [];
  const mine = matchPlayerTrophies(player, trophies);
  const champs = mine.filter((t) => t.trophyType === "championship");
  const toilets = mine.filter((t) => t.trophyType === "toilet_bowl");
  const nerds = mine.filter((t) => t.trophyType === "crystal_ball");
  const earned = new Set(badges.filter((b) => b.earned).map((b) => b.def.id));

  if (isCommissioner) {
    titles.push({
      id: "commissioner",
      label: "Runs the Room",
      blurb: "League host. Blame optional. Not the app Creator.",
    });
  }
  if (champs.length >= 2) {
    titles.push({
      id: "dynasty",
      label: "The Dynasty",
      blurb: `${champs.length} championship engravings.`,
    });
  } else if (champs.length === 1) {
    titles.push({
      id: "champion",
      label: "Champion",
      blurb: `Title year: ${champs.map((c) => c.seasonYear).join(", ")}.`,
    });
  }
  if (toilets.length) {
    titles.push({
      id: "toilet_king",
      label: "People’s Champion",
      blurb: "Toilet Bowl hardware. Wear it proud.",
    });
  }
  if (nerds.length) {
    titles.push({
      id: "oracle",
      label: "The Oracle",
      blurb: "Crystal Ball / Village Nerd.",
    });
  }
  if ((player.perfectWeeks || 0) >= 2) {
    titles.push({
      id: "professor",
      label: "The Professor",
      blurb: `${player.perfectWeeks} perfect weeks.`,
    });
  } else if ((player.perfectWeeks || 0) === 1) {
    titles.push({
      id: "perfect",
      label: "Perfect Week",
      blurb: "Card clean. Room jealous.",
    });
  }
  const pct = atsPct(player);
  if (pct != null && player.atsTotal >= 15 && pct >= 60) {
    titles.push({
      id: "sharp",
      label: "The Sharp",
      blurb: `${pct}% ATS this season.`,
    });
  }
  if (player.currentStreak >= 5) {
    titles.push({
      id: "heater",
      label: "On a Heater",
      blurb: `W${player.currentStreak} active.`,
    });
  }
  if (earned.has("war_room_legend") || earned.has("the_commissioner")) {
    titles.push({
      id: "legend",
      label: "War Room Legend",
      blurb: "The board remembers.",
    });
  }
  if (
    earned.has("underdog_believer") ||
    earned.has("underdog_spree")
  ) {
    titles.push({
      id: "giant_killer",
      label: "Giant Killer",
      blurb: "Dogs that paid.",
    });
  }

  // de-dupe by id
  const seen = new Set<string>();
  return titles.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

/**
 * Closest rival this season: nearest total points among peers with games played.
 */
export function findSeasonRival(
  player: Player,
  peers: Player[]
): { name: string; userId: string; blurb: string } | null {
  const others = peers.filter(
    (p) => p.id !== player.id && !p.isMock && (p.weeksPlayed > 0 || p.atsTotal > 0)
  );
  if (!others.length) return null;
  const sorted = [...others].sort((a, b) => {
    const da = Math.abs((a.totalPoints || 0) - (player.totalPoints || 0));
    const db = Math.abs((b.totalPoints || 0) - (player.totalPoints || 0));
    if (da !== db) return da - db;
    return a.name.localeCompare(b.name);
  });
  const r = sorted[0];
  const diff = (player.totalPoints || 0) - (r.totalPoints || 0);
  const blurb =
    diff === 0
      ? `Tied with ${r.name} at ${player.totalPoints} pts — pure chaos.`
      : diff > 0
        ? `Leads ${r.name} by ${diff} pt${diff === 1 ? "" : "s"} this season.`
        : `Chasing ${r.name} — down ${Math.abs(diff)} pt${Math.abs(diff) === 1 ? "" : "s"}.`;
  return { name: r.name, userId: r.id, blurb };
}

/** Transparent Legacy Score v1 */
export function computeLegacyScore(opts: {
  player: Player;
  trophies: LeagueTrophy[];
  badgesEarned: number;
  careerCheevoPoints: number;
}): LegacyBreakdown {
  const mine = matchPlayerTrophies(opts.player, opts.trophies);
  const champs = mine.filter((t) => t.trophyType === "championship").length;
  const toilets = mine.filter((t) => t.trophyType === "toilet_bowl").length;
  const nerds = mine.filter((t) => t.trophyType === "crystal_ball").length;
  const p = opts.player;

  const parts = [
    {
      key: "champ",
      label: "Championships",
      points: champs * 2000,
    },
    {
      key: "toilet",
      label: "Toilet Bowl titles",
      points: toilets * 800,
    },
    {
      key: "nerd",
      label: "Village Nerd (Crystal Ball)",
      points: nerds * 600,
    },
    {
      key: "pickem",
      label: "Season pick’em points",
      points: Math.round((p.totalPoints || 0) * 12),
    },
    {
      key: "ats",
      label: "ATS correct (season)",
      points: (p.atsCorrect || 0) * 15,
    },
    {
      key: "perfect",
      label: "Perfect weeks",
      points: (p.perfectWeeks || 0) * 250,
    },
    {
      key: "badges",
      label: "Badges earned",
      points: opts.badgesEarned * 40,
    },
    {
      key: "career_cheevo",
      label: "Career cheevo points",
      points: Math.round(opts.careerCheevoPoints * 2),
    },
    {
      key: "weeks",
      label: "Weeks played",
      points: (p.weeksPlayed || 0) * 35,
    },
    {
      key: "streak",
      label: "Active hot streak",
      points: Math.max(0, p.currentStreak || 0) * 40,
    },
  ];

  const total = parts.reduce((s, x) => s + x.points, 0);
  return { version: LEGACY_SCORE_VERSION, total, parts: parts.filter((x) => x.points > 0) };
}

/** 0–99 season card rating */
export function computeOverallRating(player: Player, legacyTotal: number): number {
  const pct = atsPct(player);
  const fromAts = pct != null ? pct * 0.55 : 40;
  const fromPts = Math.min(30, (player.totalPoints || 0) / 4);
  const fromLegacy = Math.min(25, legacyTotal / 400);
  const fromPerfect = Math.min(10, (player.perfectWeeks || 0) * 4);
  return Math.max(
    40,
    Math.min(99, Math.round(fromAts + fromPts + fromLegacy + fromPerfect))
  );
}

export function buildFootballResume(opts: {
  player: Player;
  peers: Player[];
  trophies: LeagueTrophy[];
  badges: BadgeStatus[];
  memberSinceLabel: string;
  isCommissioner?: boolean;
}): FootballResume {
  const { player, peers, trophies, badges } = opts;
  const mine = matchPlayerTrophies(player, trophies);
  const champs = mine
    .filter((t) => t.trophyType === "championship")
    .sort((a, b) => b.seasonYear - a.seasonYear);
  const toilets = mine
    .filter((t) => t.trophyType === "toilet_bowl")
    .sort((a, b) => b.seasonYear - a.seasonYear);
  const nerds = mine
    .filter((t) => t.trophyType === "crystal_ball")
    .sort((a, b) => b.seasonYear - a.seasonYear);

  const badgesEarned = badges.filter((b) => b.earned).length;
  const careerCheevoPoints = getCareerCheevoPoints(player.id);
  const legacy = computeLegacyScore({
    player,
    trophies,
    badgesEarned,
    careerCheevoPoints,
  });
  const titles = derivePlayerTitles(
    player,
    trophies,
    badges,
    opts.isCommissioner
  );
  const rival = findSeasonRival(player, peers);
  const dynastyYears = champs.map((c) => c.seasonYear);
  const dynastyScore = Math.min(
    99,
    dynastyYears.length * 28 + (legacy.total > 5000 ? 15 : 0)
  );

  return {
    name: player.name,
    memberSinceLabel: opts.memberSinceLabel,
    championships: champs.length,
    toiletTitles: toilets.length,
    crystalBalls: nerds.length,
    champYears: dynastyYears,
    toiletYears: toilets.map((t) => t.seasonYear),
    nerdYears: nerds.map((t) => t.seasonYear),
    seasonRecordLabel: recordLabel(player),
    seasonAtsPct: atsPct(player),
    perfectWeeks: player.perfectWeeks || 0,
    currentStreakLabel: streakLabel(player),
    badgesEarned,
    badgesTotal: badges.length,
    careerCheevoPoints,
    seasonPickemPoints: player.totalPoints || 0,
    titles,
    rival,
    dynastyYears,
    dynastyScore,
    overallRating: computeOverallRating(player, legacy.total),
    legacy,
  };
}

export function buildChampionshipBanner(
  trophies: LeagueTrophy[]
): { year: number; name: string; userId: string | null }[] {
  return trophies
    .filter((t) => t.trophyType === "championship")
    .sort((a, b) => b.seasonYear - a.seasonYear)
    .map((t) => ({
      year: t.seasonYear,
      name: t.winnerName,
      userId: t.winnerUserId,
    }));
}

export function buildLeagueHistory(
  trophies: LeagueTrophy[]
): LeagueHistoryYear[] {
  const years = new Set(trophies.map((t) => t.seasonYear));
  return [...years]
    .sort((a, b) => b - a)
    .map((year) => {
      const items = trophies.filter((t) => t.seasonYear === year);
      const champ = items.find((t) => t.trophyType === "championship");
      const toilet = items.find((t) => t.trophyType === "toilet_bowl");
      const nerd = items.find((t) => t.trophyType === "crystal_ball");
      return {
        year,
        champion: champ
          ? { name: champ.winnerName, userId: champ.winnerUserId }
          : null,
        toilet: toilet
          ? { name: toilet.winnerName, userId: toilet.winnerUserId }
          : null,
        nerd: nerd
          ? { name: nerd.winnerName, userId: nerd.winnerUserId }
          : null,
      };
    });
}

export function buildLeagueRecords(players: Player[]): LeagueRecordRow[] {
  const real = players.filter((p) => !p.isMock);
  if (!real.length) return [];
  const rows: LeagueRecordRow[] = [];

  const byPts = [...real].sort((a, b) => b.totalPoints - a.totalPoints);
  if (byPts[0] && byPts[0].totalPoints > 0) {
    rows.push({
      id: "points",
      label: "Most pick’em points",
      emoji: "⭐",
      name: byPts[0].name,
      userId: byPts[0].id,
      stat: String(byPts[0].totalPoints),
      blurb: "Season total — live board.",
    });
  }

  const byAts = [...real]
    .filter((p) => p.atsTotal >= 10)
    .sort((a, b) => {
      const pa = (a.atsCorrect || 0) / (a.atsTotal || 1);
      const pb = (b.atsCorrect || 0) / (b.atsTotal || 1);
      if (pb !== pa) return pb - pa;
      return b.atsTotal - a.atsTotal;
    });
  if (byAts[0]) {
    const p = byAts[0];
    const pct = atsPct(p);
    rows.push({
      id: "accuracy",
      label: "Highest ATS accuracy",
      emoji: "🎯",
      name: p.name,
      userId: p.id,
      stat: pct != null ? `${pct}%` : "—",
      blurb: `${p.atsCorrect}/${p.atsTotal} (min 10 picks).`,
    });
  }

  const byPerfect = [...real].sort(
    (a, b) => (b.perfectWeeks || 0) - (a.perfectWeeks || 0)
  );
  if (byPerfect[0] && (byPerfect[0].perfectWeeks || 0) > 0) {
    rows.push({
      id: "perfect",
      label: "Most perfect weeks",
      emoji: "🔥",
      name: byPerfect[0].name,
      userId: byPerfect[0].id,
      stat: String(byPerfect[0].perfectWeeks),
      blurb: "Clean cards. Rare air.",
    });
  }

  const byStreak = [...real].sort(
    (a, b) => (b.currentStreak || 0) - (a.currentStreak || 0)
  );
  if (byStreak[0] && byStreak[0].currentStreak > 0) {
    rows.push({
      id: "streak",
      label: "Longest active streak",
      emoji: "📈",
      name: byStreak[0].name,
      userId: byStreak[0].id,
      stat: `W${byStreak[0].currentStreak}`,
      blurb: "Still cooking.",
    });
  }

  const byBest = [...real].sort((a, b) => (b.bestWeek || 0) - (a.bestWeek || 0));
  if (byBest[0] && (byBest[0].bestWeek || 0) > 0) {
    rows.push({
      id: "best_week",
      label: "Best single week",
      emoji: "💥",
      name: byBest[0].name,
      userId: byBest[0].id,
      stat: `${byBest[0].bestWeek} pts`,
      blurb: "Peak card.",
    });
  }

  const byBb = [...real]
    .filter((p) => (p.bestBetTotal || 0) >= 3)
    .sort((a, b) => {
      const pa = (a.bestBetHits || 0) / (a.bestBetTotal || 1);
      const pb = (b.bestBetHits || 0) / (b.bestBetTotal || 1);
      return pb - pa;
    });
  if (byBb[0]) {
    rows.push({
      id: "best_bet",
      label: "Best Bet sniper",
      emoji: "🎲",
      name: byBb[0].name,
      userId: byBb[0].id,
      stat: `${byBb[0].bestBetHits}/${byBb[0].bestBetTotal}`,
      blurb: "Confidence doubled when it counted.",
    });
  }

  return rows;
}

/** League + personal museum timeline */
export function buildMuseumTimeline(opts: {
  players: Player[];
  trophies: LeagueTrophy[];
  focusPlayerId?: string | null;
}): MuseumEvent[] {
  const events: MuseumEvent[] = [];
  const { players, trophies, focusPlayerId } = opts;

  for (const t of trophies) {
    if (focusPlayerId && t.winnerUserId && t.winnerUserId !== focusPlayerId) {
      // still show if name-only match is hard — skip non-matching user ids
      continue;
    }
    if (
      focusPlayerId &&
      !t.winnerUserId &&
      !players.find(
        (p) =>
          p.id === focusPlayerId &&
          p.name.trim().toLowerCase() === t.winnerName.trim().toLowerCase()
      )
    ) {
      continue;
    }
    const excelEra = t.id.startsWith("prior-seed-") || t.leagueId === "prior-excel";
    const meta =
      t.trophyType === "championship"
        ? {
            emoji: "🏆",
            title: excelEra
              ? "Championship · Excel era"
              : "Championship engraved",
          }
        : t.trophyType === "toilet_bowl"
          ? {
              emoji: "🚽",
              title: excelEra
                ? "Toilet Bowl King · Excel era"
                : "Toilet Bowl engraved",
            }
          : t.trophyType === "crystal_ball"
            ? {
                emoji: "🔮",
                title: excelEra
                  ? "Village Nerd · Excel era"
                  : "Village Nerd engraved",
              }
            : {
                emoji: "🛡️",
                title: excelEra
                  ? "Division title · Excel era"
                  : "Division title engraved",
              };
    events.push({
      id: `trophy-${t.id}`,
      year: t.seasonYear,
      sortKey: `${t.seasonYear}-${t.awardedAt}-trophy`,
      emoji: meta.emoji,
      title: meta.title,
      body: `${t.winnerName}${t.subtitle ? ` · ${t.subtitle}` : ""}${
        excelEra ? " · pre-app season" : ""
      }`,
      userId: t.winnerUserId,
      userName: t.winnerName,
      kind: "trophy",
    });
  }

  for (const p of players) {
    if (focusPlayerId && p.id !== focusPlayerId) continue;
    if (p.memberSince) {
      const y = new Date(p.memberSince).getFullYear();
      if (!Number.isNaN(y)) {
        events.push({
          id: `join-${p.id}`,
          year: y,
          sortKey: `${y}-00-join-${p.id}`,
          emoji: "🚪",
          title: "Joined the room",
          body: p.name,
          userId: p.id,
          userName: p.name,
          kind: "milestone",
        });
      }
    }
    if ((p.perfectWeeks || 0) > 0) {
      events.push({
        id: `perfect-${p.id}`,
        year: new Date().getFullYear(),
        sortKey: `${new Date().getFullYear()}-perfect-${p.perfectWeeks}-${p.id}`,
        emoji: "🔥",
        title: "Perfect week(s)",
        body: `${p.name} · ${p.perfectWeeks} clean card${p.perfectWeeks === 1 ? "" : "s"} this season`,
        userId: p.id,
        userName: p.name,
        kind: "streak",
      });
    }
    if ((p.totalPoints || 0) >= 50) {
      events.push({
        id: `pts-${p.id}`,
        year: new Date().getFullYear(),
        sortKey: `${new Date().getFullYear()}-pts-${p.totalPoints}-${p.id}`,
        emoji: "⭐",
        title: "Season haul",
        body: `${p.name} · ${p.totalPoints} pick’em points`,
        userId: p.id,
        userName: p.name,
        kind: "season",
      });
    }
    if (p.currentStreak >= 5) {
      events.push({
        id: `streak-${p.id}`,
        year: new Date().getFullYear(),
        sortKey: `${new Date().getFullYear()}-z-streak-${p.id}`,
        emoji: "📈",
        title: "Active heater",
        body: `${p.name} · W${p.currentStreak}`,
        userId: p.id,
        userName: p.name,
        kind: "streak",
      });
    }
  }

  // If focus filter wiped everything but trophies by name, include name-matched trophies
  if (focusPlayerId && events.length === 0) {
    const focus = players.find((p) => p.id === focusPlayerId);
    if (focus) {
      for (const t of matchPlayerTrophies(focus, trophies)) {
        events.push({
          id: `trophy-focus-${t.id}`,
          year: t.seasonYear,
          sortKey: `${t.seasonYear}-${t.awardedAt}`,
          emoji:
            t.trophyType === "championship"
              ? "🏆"
              : t.trophyType === "toilet_bowl"
                ? "🚽"
                : "🔮",
          title: "Hardware",
          body: `${t.winnerName} · ${t.seasonYear}`,
          userId: t.winnerUserId,
          userName: t.winnerName,
          kind: "trophy",
        });
      }
    }
  }

  return events.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

export function getDefendingChampion(
  trophies: LeagueTrophy[]
): { year: number; name: string; userId: string | null } | null {
  const champs = trophies
    .filter((t) => t.trophyType === "championship")
    .sort((a, b) => {
      if (b.seasonYear !== a.seasonYear) return b.seasonYear - a.seasonYear;
      return b.awardedAt.localeCompare(a.awardedAt);
    });
  if (!champs[0]) return null;
  return {
    year: champs[0].seasonYear,
    name: champs[0].winnerName,
    userId: champs[0].winnerUserId,
  };
}
