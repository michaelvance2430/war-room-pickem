/**
 * NFL / pro football achievements — primetime passport, not CFB Saturday medals.
 * Live-evaluable bank first; dual-sport “and” cheevos land later.
 */

import type { BadgeDef, BadgeTier } from "@/lib/types";

/** Local tier points — avoid circular import with badges.ts */
const TIER_POINTS: Record<BadgeTier, number> = {
  common: 10,
  rare: 25,
  epic: 50,
  legendary: 150,
};

export type NflStampKind =
  | "helmet"
  | "script"
  | "redzone"
  | "primetime"
  | "film"
  | "trophy"
  | "silver";

export type NflBadgeDef = BadgeDef & {
  sportId: "nfl";
  stamp: NflStampKind;
  evalReady: "live" | "partial" | "stub";
};

function b(
  partial: Omit<NflBadgeDef, "points" | "sportId" | "lockedLabel"> & {
    points?: number;
  }
): NflBadgeDef {
  return {
    ...partial,
    sportId: "nfl",
    points: partial.points ?? TIER_POINTS[partial.tier],
    lockedLabel: partial.howToEarn,
  };
}

const COMMON: NflBadgeDef[] = [
  b({
    id: "nfl_welcome_desk",
    name: "Welcome to the Desk",
    description: "You made it to the primetime room. Headset on.",
    howToEarn: "Create your account (or join any league).",
    tier: "common",
    icon: "🏈",
    stamp: "helmet",
    evalReady: "live",
  }),
  b({
    id: "nfl_sunday_ticket",
    name: "Sunday Ticket",
    description: "First stamp in an NFL War Room.",
    howToEarn: "Join or play in an NFL league.",
    tier: "common",
    icon: "🎟️",
    stamp: "helmet",
    evalReady: "live",
  }),
  b({
    id: "nfl_first_lock",
    name: "First Whistle",
    description: "First NFL card locked. The desk noticed.",
    howToEarn: "Submit your first NFL picks card.",
    tier: "common",
    icon: "🔒",
    stamp: "script",
    evalReady: "live",
  }),
  b({
    id: "nfl_window_watcher",
    name: "Window Watcher",
    description: "You understand late windows exist to humble you.",
    howToEarn: "Play 3 NFL weeks.",
    tier: "common",
    icon: "🕐",
    stamp: "primetime",
    evalReady: "live",
  }),
  b({
    id: "nfl_confidence_formation",
    name: "Confidence Formation",
    description: "Ran a full card of confidence points.",
    howToEarn: "Complete 5+ ATS picks on NFL cards.",
    tier: "common",
    icon: "📋",
    stamp: "script",
    evalReady: "live",
  }),
  b({
    id: "nfl_best_bet_live",
    name: "Best Bet Live",
    description: "Doubled down once. Witnesses present.",
    howToEarn: "Hit at least one Best Bet in an NFL league.",
    tier: "common",
    icon: "⚡",
    stamp: "redzone",
    evalReady: "live",
  }),
  b({
    id: "nfl_prop_shop",
    name: "Prop Shop",
    description: "Cashed a prop. Small edge, big mouth.",
    howToEarn: "Hit at least one prop in an NFL league.",
    tier: "common",
    icon: "🎲",
    stamp: "film",
    evalReady: "live",
  }),
  b({
    id: "nfl_rematch_sunday",
    name: "Rematch Sunday",
    description: "Back for another primetime card.",
    howToEarn: "Play 2 NFL weeks.",
    tier: "common",
    icon: "🔁",
    stamp: "helmet",
    evalReady: "live",
  }),
];

const RARE: NflBadgeDef[] = [
  b({
    id: "nfl_perfect_sunday",
    name: "Perfect Sunday",
    description: "Clean sheet. No notes. Primetime myth.",
    howToEarn: "Post a perfect week (18+ pts) on an NFL card.",
    tier: "rare",
    icon: "✨",
    stamp: "primetime",
    evalReady: "live",
    stackable: true,
  }),
  b({
    id: "nfl_red_zone_assassin",
    name: "Red Zone Assassin",
    description: "Best Bet hits stacking up.",
    howToEarn: "Hit 3+ Best Bets in an NFL league.",
    tier: "rare",
    icon: "🎯",
    stamp: "redzone",
    evalReady: "live",
  }),
  b({
    id: "nfl_heater",
    name: "On a Heater",
    description: "Three straight correct — cold blood.",
    howToEarn: "Hold a streak of 3+ correct ATS picks.",
    tier: "rare",
    icon: "🔥",
    stamp: "film",
    evalReady: "live",
  }),
  b({
    id: "nfl_max_card",
    name: "Max Card Sunday",
    description: "Confidence stacked. Everything hit.",
    howToEarn: "Score 18+ in a single NFL week.",
    tier: "rare",
    icon: "💎",
    stamp: "primetime",
    evalReady: "live",
    stackable: true,
  }),
  b({
    id: "nfl_late_window_legend",
    name: "Late Window Legend",
    description: "Owned a week from the late slate energy.",
    howToEarn: "Finish #1 for a week in an NFL league.",
    tier: "rare",
    icon: "⭐",
    stamp: "primetime",
    evalReady: "live",
    stackable: true,
  }),
  b({
    id: "nfl_inactive_list",
    name: "Inactive List Escape",
    description: "You locked. You played. Zeros for the ghosts.",
    howToEarn: "Lock 5 full NFL cards (weeksPlayed ≥ 5).",
    tier: "rare",
    icon: "📋",
    stamp: "script",
    evalReady: "live",
  }),
];

const EPIC: NflBadgeDef[] = [
  b({
    id: "nfl_primetime_general",
    name: "Primetime General",
    description: "Your league, your week, your throne — on Sunday.",
    howToEarn: "Finish #1 in your NFL league for a week (multi-earn).",
    tier: "epic",
    icon: "📺",
    stamp: "primetime",
    evalReady: "live",
    stackable: true,
  }),
  b({
    id: "nfl_film_dont_lie",
    name: "Film Don't Lie",
    description: "Ten-straight heater. Unholy.",
    howToEarn: "Get 10 correct ATS picks in a row.",
    tier: "epic",
    icon: "🎬",
    stamp: "film",
    evalReady: "live",
  }),
  b({
    id: "nfl_script_master",
    name: "Script Master",
    description: "Season-long ATS volume. Call sheet energy.",
    howToEarn: "Reach 100 correct ATS picks in an NFL context.",
    tier: "epic",
    icon: "📜",
    stamp: "script",
    evalReady: "partial",
  }),
  b({
    id: "nfl_two_minute_drill",
    name: "Two-Minute Drill",
    description: "Clutch card when the season got loud.",
    howToEarn: "Cash a playoff-window week (app weeks 19–22) with 12+ pts.",
    tier: "epic",
    icon: "⏱️",
    stamp: "redzone",
    evalReady: "partial",
  }),
];

const LEGENDARY: NflBadgeDef[] = [
  b({
    id: "nfl_super_bowl_desk",
    name: "Super Bowl Desk",
    description: "Title weekend. Lights on. Card cashed.",
    howToEarn: "Cash picks on Super Bowl week (app week 22).",
    tier: "legendary",
    icon: "🏆",
    stamp: "trophy",
    evalReady: "partial",
  }),
  b({
    id: "nfl_immortal_sunday",
    name: "Immortal Sunday",
    description: "Thirty straight. The film room is closed for repairs.",
    howToEarn: "Get 30 correct ATS picks in a row.",
    tier: "legendary",
    icon: "🔥",
    stamp: "silver",
    evalReady: "live",
  }),
];

export const NFL_ACHIEVEMENT_CATALOG: NflBadgeDef[] = [
  ...LEGENDARY,
  ...EPIC,
  ...RARE,
  ...COMMON,
];

export function getNflBadgeDef(id: string): NflBadgeDef | undefined {
  return NFL_ACHIEVEMENT_CATALOG.find((d) => d.id === id);
}

export function isNflBadgeId(id: string): boolean {
  return id.startsWith("nfl_") || !!getNflBadgeDef(id);
}

/** CFB badge ids that should not surface as “earned path” in pure NFL rooms */
export const CFB_ONLY_BADGE_IDS = new Set([
  "national_nightmare",
  "crystal_gazed",
  "the_closer", // CFP finals wording — NFL uses nfl_super_bowl_desk
]);

/**
 * Rename CFB-catalog badges for display inside NFL leagues so dual-sport
 * players don’t see “Perfect Saturday” while living on Sundays.
 */
export function nflDisplayOverlay(def: BadgeDef): BadgeDef {
  const map: Record<
    string,
    Partial<Pick<BadgeDef, "name" | "description" | "howToEarn">>
  > = {
    perfect_saturday: {
      name: "Perfect Sunday",
      description: "Every pick. One Sunday. No misses. Stacks each clean sheet.",
      howToEarn: "Post a perfect week (18+ pts). Can earn more than once.",
    },
    six_pack_saturday: {
      name: "Full Card Green",
      description: "Every leg hit on a Sunday slate.",
      howToEarn: "Go perfect on a weekly card.",
    },
    six_seven: {
      name: "Sixxxxx Seveennnn",
      description:
        "A primetime (or any window) final went 6–7. The timeline is already saying it. You were on the card.",
      howToEarn:
        "Lock an NFL card the week any slate game ends 6–7 or 7–6.",
    },
    saturday_starter: {
      name: "Sunday Starter",
      description: "First Sunday in the War Room.",
      howToEarn: "Make picks for your first NFL slate.",
    },
    rematch_ready: {
      name: "Rematch Ready",
      description: "Back for another Sunday.",
      howToEarn: "Play 2 consecutive weeks.",
    },
    the_closer: {
      name: "The Closer",
      description: "Title weekend. Lights on. Card cashed.",
      howToEarn: "Cash your picks on Super Bowl / finals slate.",
    },
    seasoned_vet: {
      name: "Seasoned Vet",
      description: "A thousand correct locks. Primetime tour complete.",
      howToEarn: "Reach 1,000 lifetime correct ATS picks.",
    },
  };
  const o = map[def.id];
  if (!o) return def;
  return { ...def, ...o };
}

export const NFL_STAMP_EMOJI: Record<NflStampKind, string> = {
  helmet: "🏈",
  script: "📜",
  redzone: "🎯",
  primetime: "📺",
  film: "🎬",
  trophy: "🏆",
  silver: "🥈",
};

export const NFL_ACHIEVEMENT_COUNTS = {
  common: COMMON.length,
  rare: RARE.length,
  epic: EPIC.length,
  legendary: LEGENDARY.length,
  total: NFL_ACHIEVEMENT_CATALOG.length,
} as const;
