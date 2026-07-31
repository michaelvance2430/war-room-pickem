import { BadgeDef, BadgeStatus, BadgeTier, Player } from "./types";

/** Permanent rare: most achievement points in the league */
export const CHEEVO_KING_ID = "cheevo_king";

export function hasPermanentBadge(player: Player, badgeId: string): boolean {
  return !!player.permanentBadgeIds?.includes(badgeId);
}

function grantPermanentBadge(player: Player, badgeId: string): Player {
  if (hasPermanentBadge(player, badgeId)) return player;
  return {
    ...player,
    permanentBadgeIds: [...(player.permanentBadgeIds || []), badgeId],
  };
}

/** Point values by tier */
export const TIER_POINTS: Record<BadgeTier, number> = {
  common: 10,
  rare: 25,
  epic: 50,
  legendary: 150,
};

export const TIER_ORDER: BadgeTier[] = [
  "legendary",
  "epic",
  "rare",
  "common",
];

export const TIER_LABEL: Record<BadgeTier, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

/** Full CFB badge catalog (v1) */
export const BADGE_CATALOG: BadgeDef[] = [
  // —— Legendary ——
  {
    id: "the_commissioner",
    name: "The Commissioner",
    description:
      "Created the War Room. Writes the rules. Still might fade your lock.",
    howToEarn: "Build the damn app.",
    lockedLabel: "Locked — you are NOT the creator",
    tier: "legendary",
    points: 250,
    creatorOnly: true,
    icon: "👑",
  },
  {
    id: "war_room_legend",
    name: "War Room Legend",
    description: "Season champ. The board remembers.",
    howToEarn: "Win the season-long championship.",
    tier: "legendary",
    points: 200,
    icon: "🏆",
  },
  {
    id: "immortal_streak",
    name: "Immortal Streak",
    description: "Thirty straight correct. Unholy.",
    howToEarn: "Get 30 correct ATS picks in a row.",
    tier: "legendary",
    points: 200,
    icon: "🔥",
  },
  {
    id: "the_closer",
    name: "The Closer",
    description: "Title weekend. Lights on. Card cashed.",
    howToEarn: "Cash your picks on the CFP / finals slate.",
    tier: "legendary",
    points: 150,
    icon: "🎯",
  },

  // —— Epic ——
  {
    id: "war_room_general",
    name: "War Room General",
    description: "Your league, your week, your throne.",
    howToEarn: "Finish #1 in your league for a week.",
    tier: "epic",
    points: 50,
    icon: "⭐",
  },
  {
    id: "sniper",
    name: "Sniper",
    description: "Fifteen in a row. Cold blood.",
    howToEarn: "Get 15 correct ATS picks in a row.",
    tier: "epic",
    points: 50,
    icon: "🔫",
  },
  {
    id: "max_card",
    name: "Max Card",
    description: "Confidence stacked. Everything hit.",
    howToEarn: "Score 18+ points in a single week (perfect card territory).",
    tier: "epic",
    points: 50,
    icon: "💎",
  },
  {
    id: "perfect_saturday",
    name: "Perfect Saturday",
    description: "Every pick. One Saturday. No misses.",
    howToEarn: "Post a perfect week (18+ pts) at least once.",
    tier: "epic",
    points: 50,
    icon: "✨",
  },
  {
    id: "seasoned_vet",
    name: "Seasoned Vet",
    description: "A thousand correct locks. Campus tour complete.",
    howToEarn: "Reach 1,000 lifetime correct ATS picks.",
    tier: "epic",
    points: 50,
    icon: "🎓",
  },
  {
    id: "villain_arc",
    name: "Villain Arc",
    description: "Same rival. Three straight weeks. Evil.",
    howToEarn: "Beat the same rival three weeks in a row.",
    tier: "epic",
    points: 50,
    icon: "😈",
  },

  // —— Rare ——
  {
    id: "hot_hand",
    name: "Hot Hand",
    description: "Five correct in a row. Don't cool off.",
    howToEarn: "Get 5 correct ATS picks in a row.",
    tier: "rare",
    points: 25,
    icon: "🖐️",
  },
  {
    id: "clean_sheet",
    name: "Clean Sheet",
    description: "Full card. Zero wrong.",
    howToEarn: "Post a perfect week (18+ pts).",
    tier: "rare",
    points: 25,
    icon: "🧼",
  },
  {
    id: "parlay_pilot",
    name: "Parlay Pilot",
    description: "Best Bet boarded and cashed.",
    howToEarn: "Hit your Best Bet 3 times.",
    tier: "rare",
    points: 25,
    icon: "✈️",
  },
  {
    id: "underdog_believer",
    name: "Underdog Believer",
    description: "Took the dog. Got paid in glory.",
    howToEarn: "Hit 5 underdog ATS picks (tracked via upsets as season grows).",
    tier: "rare",
    points: 25,
    icon: "🐕",
  },
  {
    id: "volume_shooter",
    name: "Volume Shooter",
    description: "A hundred correct. Quantity is a skill.",
    howToEarn: "Reach 100 lifetime correct ATS picks.",
    tier: "rare",
    points: 25,
    icon: "📊",
  },
  {
    id: "iron_lungs",
    name: "Iron Lungs",
    description: "Showed up every week. No ghosting Saturday.",
    howToEarn: "Submit picks for 4 consecutive weeks.",
    tier: "rare",
    points: 25,
    icon: "💪",
  },
  {
    id: "rivalry_week",
    name: "Rivalry Week",
    description: "Hate week. Correct side.",
    howToEarn: "Cash a pick in a designated rivalry game.",
    tier: "rare",
    points: 25,
    icon: "⚔️",
  },
  {
    id: "clutch_gene",
    name: "Clutch Gene",
    description: "Last leg. Still hit.",
    howToEarn: "Hit 5 Best Bets in a season.",
    tier: "rare",
    points: 25,
    icon: "🧊",
  },
  {
    id: "cheevo_king",
    name: "Cheevo King",
    description:
      "Most achievement points in the league. Once you take the crown, you keep it forever — even if someone passes you later.",
    howToEarn:
      "Have the most achievement points in your league (checked whenever profiles/standings load). Awarded forever.",
    tier: "rare",
    points: 25,
    icon: "👑",
  },

  // —— Common ——
  {
    id: "first_blood",
    name: "First Blood",
    description: "You made a pick. Welcome to the chaos.",
    howToEarn: "Make your first pick.",
    tier: "common",
    points: 10,
    icon: "🩸",
  },
  {
    id: "war_room_recruit",
    name: "War Room Recruit",
    description: "Name on the board. You're in.",
    howToEarn: "Complete your profile (display name).",
    tier: "common",
    points: 10,
    icon: "🪖",
  },
  {
    id: "lock_it_in",
    name: "Lock It In",
    description: "Card submitted. No take-backs after kickoff.",
    howToEarn: "Submit a full weekly card.",
    tier: "common",
    points: 10,
    icon: "🔒",
  },
  {
    id: "on_the_board",
    name: "On the Board",
    description: "First correct pick. It begins.",
    howToEarn: "Get your first correct ATS pick.",
    tier: "common",
    points: 10,
    icon: "📌",
  },
  {
    id: "chalk_eater",
    name: "Chalk Eater",
    description: "Took the chalk. It covered. Fine, we all do it.",
    howToEarn: "Get 10 correct ATS picks (favorites count).",
    tier: "common",
    points: 10,
    icon: "🏈",
  },
  {
    id: "saturday_starter",
    name: "Saturday Starter",
    description: "First Saturday in the War Room.",
    howToEarn: "Make picks for your first Saturday slate.",
    tier: "common",
    points: 10,
    icon: "📅",
  },
  {
    id: "green_light",
    name: "Green Light",
    description: "Points on the board. You're not zero.",
    howToEarn: "Score your first weekly points.",
    tier: "common",
    points: 10,
    icon: "💚",
  },
  {
    id: "face_of_the_franchise",
    name: "Face of the Franchise",
    description: "Put a face to the bad beats.",
    howToEarn: "Upload a profile photo.",
    tier: "common",
    points: 10,
    icon: "📸",
  },
  {
    id: "gameday_ready",
    name: "Gameday Ready",
    description: "Multiple weeks. You're a regular now.",
    howToEarn: "Play 3 weeks.",
    tier: "common",
    points: 10,
    icon: "🏟️",
  },
];

const CATALOG_BY_ID = Object.fromEntries(
  BADGE_CATALOG.map((b) => [b.id, b])
) as Record<string, BadgeDef>;

export function getBadgeDef(id: string): BadgeDef | undefined {
  return CATALOG_BY_ID[id];
}

type EvalResult = {
  earned: boolean;
  progress?: { current: number; target: number } | null;
};

function progress(current: number, target: number): EvalResult {
  return {
    earned: current >= target,
    progress: { current: Math.min(current, target), target },
  };
}

/** Evaluate whether a player has earned a badge from current stats */
function evaluateBadge(badgeId: string, player: Player): EvalResult {
  const streak = Math.max(0, player.currentStreak);
  const bestWeek = player.bestWeek || 0;
  const perfect = player.perfectWeeks || 0;
  const weeks = player.weeksPlayed || player.weeklyPoints?.length || 0;
  const ats = player.atsCorrect || 0;
  const bb = player.bestBetHits || 0;

  switch (badgeId) {
    case "the_commissioner":
      return { earned: !!player.isCreator };

    case "war_room_legend":
      // Manual / season-end award for now
      return { earned: false };

    case "immortal_streak":
      return progress(streak, 30);

    case "the_closer":
      return { earned: false };

    case "war_room_general":
      return { earned: false };

    case "sniper":
      return progress(streak, 15);

    case "max_card":
    case "perfect_saturday":
    case "clean_sheet":
      return progress(Math.max(perfect, bestWeek >= 18 ? 1 : 0), 1);

    case "seasoned_vet":
      return progress(ats, 1000);

    case "villain_arc":
      return { earned: false };

    case "hot_hand":
      return progress(streak, 5);

    case "parlay_pilot":
      return progress(bb, 3);

    case "underdog_believer":
      // Placeholder until we track favorite vs dog
      return progress(0, 5);

    case "volume_shooter":
      return progress(ats, 100);

    case "iron_lungs":
      return progress(weeks, 4);

    case "rivalry_week":
      return { earned: false };

    case "clutch_gene":
      return progress(bb, 5);

    case "cheevo_king":
      // Never from stats alone — permanent grant via syncLeagueCheevoKing
      return {
        earned: hasPermanentBadge(player, CHEEVO_KING_ID),
      };

    case "first_blood":
    case "lock_it_in":
    case "saturday_starter":
      return progress(weeks > 0 || (player.atsTotal || 0) > 0 ? 1 : 0, 1);

    case "war_room_recruit":
      return progress(player.name?.trim() ? 1 : 0, 1);

    case "on_the_board":
      return progress(ats, 1);

    case "chalk_eater":
      return progress(ats, 10);

    case "green_light":
      return progress(player.totalPoints > 0 ? 1 : 0, 1);

    case "face_of_the_franchise":
      return progress(player.avatarUrl ? 1 : 0, 1);

    case "gameday_ready":
      return progress(weeks, 3);

    default:
      return { earned: false };
  }
}

function sortBadges(statuses: BadgeStatus[]): BadgeStatus[] {
  const tierRank = (t: BadgeTier) => TIER_ORDER.indexOf(t);
  return [...statuses].sort((a, b) => {
    // Earned legendaries first, then by tier, then name
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    const tr = tierRank(a.def.tier) - tierRank(b.def.tier);
    if (tr !== 0) return tr;
    return a.def.name.localeCompare(b.def.name);
  });
}

/**
 * Full badge shelf for a profile.
 * Creator badge is always listed (gold if creator, grey locked otherwise).
 */
export function getPlayerBadges(player: Player): BadgeStatus[] {
  const statuses: BadgeStatus[] = BADGE_CATALOG.map((def) => {
    const result = evaluateBadge(def.id, player);
    const permanent = hasPermanentBadge(player, def.id);
    const earned = result.earned || permanent;
    return {
      def,
      earned,
      earnedAt: earned ? player.memberSince ?? null : null,
      progress: earned ? null : result.progress ?? null,
    };
  });
  return sortBadges(statuses);
}

/**
 * Sum of points from earned badges.
 * forRanking: exclude Cheevo King so the crown can't pad the race for itself.
 */
export function getAchievementPoints(
  player: Player,
  opts?: { forRanking?: boolean }
): number {
  return getPlayerBadges(player)
    .filter((b) => b.earned)
    .filter((b) => !(opts?.forRanking && b.def.id === CHEEVO_KING_ID))
    .reduce((sum, b) => sum + b.def.points, 0);
}

/**
 * Grant Cheevo King forever to whoever currently has the most
 * achievement points in the league (real players preferred).
 * Already-crowned players keep it even if they fall behind later.
 *
 * Returns updated roster (same array reference if nothing changed).
 */
export function syncLeagueCheevoKing(players: Player[]): Player[] {
  if (!players.length) return players;

  // Prefer humans over demo NPCs when both exist
  const humans = players.filter((p) => !p.isMock);
  const pool = humans.length >= 1 ? humans : players;

  const scored = pool.map((p) => ({
    id: p.id,
    pts: getAchievementPoints(p, { forRanking: true }),
  }));

  const maxPts = Math.max(...scored.map((s) => s.pts), 0);
  // Need at least some cheevos before crowning anyone
  if (maxPts <= 0) return players;

  const leaderIds = new Set(
    scored.filter((s) => s.pts === maxPts).map((s) => s.id)
  );

  let changed = false;
  const next = players.map((p) => {
    if (!leaderIds.has(p.id)) return p;
    if (hasPermanentBadge(p, CHEEVO_KING_ID)) return p;
    changed = true;
    return grantPermanentBadge(p, CHEEVO_KING_ID);
  });

  return changed ? next : players;
}

/** Count earned by tier */
export function countEarnedByTier(
  player: Player
): Record<BadgeTier, number> {
  const counts: Record<BadgeTier, number> = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  };
  for (const b of getPlayerBadges(player)) {
    if (b.earned) counts[b.def.tier]++;
  }
  return counts;
}

export function formatMemberSince(iso?: string): string {
  if (!iso) return "Recently joined";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Recently joined";
  }
}

export function memberDuration(iso?: string): string {
  if (!iso) return "New recruit";
  try {
    const start = new Date(iso).getTime();
    const now = Date.now();
    const days = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
    if (days < 30) return days <= 1 ? "Joined today" : `${days} days in`;
    const months = Math.floor(days / 30);
    if (months < 12) return months === 1 ? "1 month in" : `${months} months in`;
    const years = Math.floor(months / 12);
    return years === 1 ? "1 year in" : `${years} years in`;
  } catch {
    return "New recruit";
  }
}
