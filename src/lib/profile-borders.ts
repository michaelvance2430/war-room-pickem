/**
 * Profile avatar borders — ~20 looks, unlocked by achievements.
 * Easy unlocks = simple rings. Legendary = loud flex.
 * Holiday borders: available to everyone only while that season theme is live.
 */

import type { BadgeStatus, BadgeTier } from "./types";
import { isAppCreator } from "./creator";
import {
  DEFAULT_SEASON_THEME_ID,
  resolveSeasonThemeId,
  type SeasonThemeId,
} from "./season-theme";

/** Special animated Creator rings (app owner only) */
export type CreatorBorderEffect = "flame" | "forge" | "circuit";

export type ProfileBorderDef = {
  id: string;
  name: string;
  /** Short unlock hint for Account */
  unlockLabel: string;
  /** Badge id required, or "free" / "creator" / holiday theme */
  unlock:
    | { kind: "free" }
    | { kind: "creator" }
    | { kind: "badge"; badgeId: string }
    | { kind: "holiday"; themeId: SeasonThemeId };
  tier: BadgeTier | "starter" | "holiday";
  /**
   * Tailwind classes applied to the avatar ring wrapper.
   * Use ring + border + shadow for progressive flex.
   */
  ringClass: string;
  /** Optional outer glow wrapper */
  glowClass?: string;
  /** Animated Creator-only chrome (rendered by Avatar) */
  creatorEffect?: CreatorBorderEffect;
};

export const CREATOR_BORDER_IDS = [
  "creator_flame",
  "creator_forge",
  "creator_circuit",
  /** legacy id — maps to flame */
  "creator",
] as const;

export function isCreatorBorderId(id: string | null | undefined): boolean {
  if (!id) return false;
  return (CREATOR_BORDER_IDS as readonly string[]).includes(id);
}

export function resolveCreatorEffect(
  id: string | null | undefined
): CreatorBorderEffect | null {
  if (!id) return null;
  if (id === "creator_forge") return "forge";
  if (id === "creator_circuit") return "circuit";
  if (id === "creator_flame" || id === "creator") return "flame";
  return null;
}

/**
 * Ordered simple → badass. First free default.
 */
export const PROFILE_BORDER_CATALOG: ProfileBorderDef[] = [
  // —— Starter / easy (simple) ——
  {
    id: "plain",
    name: "Plain Ring",
    unlockLabel: "Default — everyone starts here",
    unlock: { kind: "free" },
    tier: "starter",
    ringClass: "ring-2 ring-zinc-600 border-2 border-zinc-700",
  },
  {
    id: "recruit",
    name: "Recruit Steel",
    unlockLabel: "Earn War Room Recruit",
    unlock: { kind: "badge", badgeId: "war_room_recruit" },
    tier: "common",
    ringClass: "ring-2 ring-slate-400 border-2 border-slate-500",
  },
  {
    id: "first_blood",
    name: "First Blood",
    unlockLabel: "Earn First Blood",
    unlock: { kind: "badge", badgeId: "first_blood" },
    tier: "common",
    ringClass: "ring-2 ring-red-700/80 border-2 border-red-800",
  },
  {
    id: "lock_it_in",
    name: "Lock Green",
    unlockLabel: "Earn Lock It In",
    unlock: { kind: "badge", badgeId: "lock_it_in" },
    tier: "common",
    ringClass: "ring-2 ring-emerald-600 border-2 border-emerald-700",
  },
  {
    id: "on_the_board",
    name: "On the Board",
    unlockLabel: "Earn On the Board",
    unlock: { kind: "badge", badgeId: "on_the_board" },
    tier: "common",
    ringClass: "ring-2 ring-sky-600 border-2 border-sky-700",
  },
  {
    id: "face",
    name: "Face Card",
    unlockLabel: "Earn Face of the Franchise",
    unlock: { kind: "badge", badgeId: "face_of_the_franchise" },
    tier: "common",
    ringClass: "ring-2 ring-violet-500 border-2 border-violet-600",
  },
  {
    id: "chalk",
    name: "Chalk Dust",
    unlockLabel: "Earn Chalk Eater",
    unlock: { kind: "badge", badgeId: "chalk_eater" },
    tier: "common",
    ringClass: "ring-2 ring-stone-400 border-2 border-stone-500",
  },

  // —— Rare (a bit more style) ——
  {
    id: "hot_hand",
    name: "Hot Hand",
    unlockLabel: "Earn Hot Hand",
    unlock: { kind: "badge", badgeId: "hot_hand" },
    tier: "rare",
    ringClass: "ring-2 ring-orange-400 border-2 border-orange-500",
    glowClass: "shadow-[0_0_12px_rgba(251,146,60,0.35)]",
  },
  {
    id: "clean_sheet",
    name: "Clean Sheet",
    unlockLabel: "Earn Clean Sheet",
    unlock: { kind: "badge", badgeId: "clean_sheet" },
    tier: "rare",
    ringClass: "ring-2 ring-cyan-300 border-2 border-cyan-400",
    glowClass: "shadow-[0_0_12px_rgba(34,211,238,0.3)]",
  },
  {
    id: "iron_lungs",
    name: "Iron Lungs",
    unlockLabel: "Earn Iron Lungs",
    unlock: { kind: "badge", badgeId: "iron_lungs" },
    tier: "rare",
    ringClass: "ring-2 ring-teal-400 border-2 border-teal-600",
  },
  {
    id: "barrel",
    name: "Barrel Bottom",
    unlockLabel: "Earn Bottom of the Barrel",
    unlock: { kind: "badge", badgeId: "bottom_of_the_barrel" },
    tier: "rare",
    ringClass: "ring-2 ring-amber-800 border-2 border-yellow-900",
    glowClass: "shadow-[0_0_10px_rgba(120,53,15,0.5)]",
  },
  {
    id: "dog",
    name: "Dog Collar",
    unlockLabel: "Earn Underdog Believer",
    unlock: { kind: "badge", badgeId: "underdog_believer" },
    tier: "rare",
    ringClass: "ring-2 ring-lime-400 border-2 border-lime-600 border-dashed",
  },
  {
    id: "cheevo",
    name: "Cheevo Crown",
    unlockLabel: "Earn Cheevo King",
    unlock: { kind: "badge", badgeId: "cheevo_king" },
    tier: "rare",
    ringClass: "ring-2 ring-yellow-400 border-2 border-yellow-500",
    glowClass: "shadow-[0_0_14px_rgba(250,204,21,0.35)]",
  },

  // —— Epic ——
  {
    id: "sniper",
    name: "Sniper Scope",
    unlockLabel: "Earn Sniper",
    unlock: { kind: "badge", badgeId: "sniper" },
    tier: "epic",
    ringClass: "ring-[3px] ring-rose-500 border-2 border-rose-300",
    glowClass: "shadow-[0_0_16px_rgba(244,63,94,0.4)]",
  },
  {
    id: "general",
    name: "General Stars",
    unlockLabel: "Earn War Room General",
    unlock: { kind: "badge", badgeId: "war_room_general" },
    tier: "epic",
    ringClass: "ring-[3px] ring-indigo-400 border-2 border-indigo-200",
    glowClass: "shadow-[0_0_18px_rgba(129,140,248,0.45)]",
  },
  {
    id: "villain",
    name: "Villain Arc",
    unlockLabel: "Earn Villain Arc",
    unlock: { kind: "badge", badgeId: "villain_arc" },
    tier: "epic",
    ringClass: "ring-[3px] ring-fuchsia-600 border-2 border-purple-900",
    glowClass: "shadow-[0_0_18px_rgba(192,38,211,0.45)]",
  },
  {
    id: "prop",
    name: "Prop Overlord",
    unlockLabel: "Earn Prop Overlord",
    unlock: { kind: "badge", badgeId: "prop_overlord" },
    tier: "epic",
    ringClass: "ring-[3px] ring-pink-400 border-2 border-pink-600",
    glowClass: "shadow-[0_0_16px_rgba(244,114,182,0.4)]",
  },

  // —— Legendary (badass) ——
  {
    id: "toilet",
    name: "Porcelain Throne",
    unlockLabel: "Earn Toilet Crown",
    unlock: { kind: "badge", badgeId: "toilet_crown" },
    tier: "legendary",
    ringClass:
      "ring-4 ring-purple-400 border-2 border-fuchsia-300",
    glowClass:
      "shadow-[0_0_24px_rgba(192,132,252,0.55),0_0_8px_rgba(232,121,249,0.4)]",
  },
  {
    id: "ring",
    name: "Championship Gold",
    unlockLabel: "Earn Championship Ring",
    unlock: { kind: "badge", badgeId: "championship_ring" },
    tier: "legendary",
    ringClass: "ring-4 ring-amber-300 border-2 border-yellow-200",
    glowClass:
      "shadow-[0_0_28px_rgba(251,191,36,0.65),0_0_10px_rgba(253,224,71,0.5)]",
  },
  {
    id: "legend",
    name: "War Room Legend",
    unlockLabel: "Earn War Room Legend",
    unlock: { kind: "badge", badgeId: "war_room_legend" },
    tier: "legendary",
    ringClass: "ring-4 ring-amber-400 border-[3px] border-amber-200",
    glowClass:
      "shadow-[0_0_32px_rgba(245,158,11,0.7),inset_0_0_12px_rgba(251,191,36,0.25)]",
  },
  {
    id: "immortal",
    name: "Immortal Flame",
    unlockLabel: "Earn Immortal Streak",
    unlock: { kind: "badge", badgeId: "immortal_streak" },
    tier: "legendary",
    ringClass: "ring-4 ring-orange-400 border-[3px] border-red-400",
    glowClass:
      "shadow-[0_0_30px_rgba(249,115,22,0.7),0_0_12px_rgba(239,68,68,0.5)]",
  },
  // —— Creator only (Mike) — three legendary looks ——
  {
    id: "creator_flame",
    name: "Living Flame",
    unlockLabel: "Creator only — ring of living fire",
    unlock: { kind: "creator" },
    tier: "legendary",
    ringClass: "ring-0 border-0",
    glowClass: "shadow-[0_0_28px_rgba(249,115,22,0.55)]",
    creatorEffect: "flame",
  },
  {
    id: "creator_forge",
    name: "Molten Forge",
    unlockLabel: "Creator only — molten gold forge crown",
    unlock: { kind: "creator" },
    tier: "legendary",
    ringClass: "ring-0 border-0",
    glowClass: "shadow-[0_0_32px_rgba(250,204,21,0.65)]",
    creatorEffect: "forge",
  },
  {
    id: "creator_circuit",
    name: "Creator Circuit",
    unlockLabel: "Creator only — emerald code orbit",
    unlock: { kind: "creator" },
    tier: "legendary",
    ringClass: "ring-0 border-0",
    glowClass: "shadow-[0_0_28px_rgba(16,185,129,0.45)]",
    creatorEffect: "circuit",
  },
  {
    /** Legacy equipped id — same as Living Flame */
    id: "creator",
    name: "The Creator (classic)",
    unlockLabel: "Creator only — maps to Living Flame chrome",
    unlock: { kind: "creator" },
    tier: "legendary",
    ringClass: "ring-0 border-0",
    glowClass: "shadow-[0_0_36px_rgba(250,204,21,0.8)]",
    creatorEffect: "flame",
  },

  // —— Holiday (everyone, only while that season theme is on) ——
  // Quiet unlock — Commish doesn't announce; players discover on Account.
  {
    id: "holiday_halloween_pumpkin",
    name: "Pumpkin Patch",
    unlockLabel: "👀 Something seasonal…",
    unlock: { kind: "holiday", themeId: "halloween" },
    tier: "holiday",
    ringClass: "ring-[3px] ring-orange-400 border-2 border-purple-500",
    glowClass:
      "shadow-[0_0_16px_rgba(251,146,60,0.45),0_0_8px_rgba(168,85,247,0.35)] holiday-border-bob",
  },
  {
    id: "holiday_halloween_ghost",
    name: "Boo Ring",
    unlockLabel: "👀 Something seasonal…",
    unlock: { kind: "holiday", themeId: "halloween" },
    tier: "holiday",
    ringClass: "ring-[3px] ring-purple-300 border-2 border-white/70 border-dashed",
    glowClass: "shadow-[0_0_14px_rgba(216,180,254,0.5)] holiday-border-bob",
  },
  {
    id: "holiday_halloween_candy",
    name: "Trick-or-Treat",
    unlockLabel: "👀 Something seasonal…",
    unlock: { kind: "holiday", themeId: "halloween" },
    tier: "holiday",
    ringClass: "ring-[3px] ring-fuchsia-400 border-2 border-orange-300 border-dotted",
    glowClass:
      "shadow-[0_0_14px_rgba(232,121,249,0.45),0_0_8px_rgba(253,186,116,0.4)] holiday-border-bob",
  },
  {
    id: "holiday_thanks_harvest",
    name: "Harvest Gold",
    unlockLabel: "👀 Something seasonal…",
    unlock: { kind: "holiday", themeId: "thanksgiving" },
    tier: "holiday",
    ringClass: "ring-[3px] ring-amber-500 border-2 border-orange-700",
    glowClass: "shadow-[0_0_14px_rgba(217,119,6,0.45)]",
  },
  {
    id: "holiday_thanks_leaf",
    name: "Autumn Leaf",
    unlockLabel: "👀 Something seasonal…",
    unlock: { kind: "holiday", themeId: "thanksgiving" },
    tier: "holiday",
    ringClass: "ring-[3px] ring-red-600 border-2 border-amber-400",
    glowClass: "shadow-[0_0_12px_rgba(220,38,38,0.35)] holiday-border-bob",
  },
  {
    id: "holiday_thanks_gravy",
    name: "Gravy Boat",
    unlockLabel: "👀 Something seasonal…",
    unlock: { kind: "holiday", themeId: "thanksgiving" },
    tier: "holiday",
    ringClass: "ring-[3px] ring-yellow-700 border-2 border-stone-400",
    glowClass: "shadow-[0_0_12px_rgba(161,98,7,0.4)] holiday-border-bob",
  },
  {
    id: "holiday_xmas_candy",
    name: "Candy Cane",
    unlockLabel: "👀 Something seasonal…",
    unlock: { kind: "holiday", themeId: "christmas" },
    tier: "holiday",
    ringClass: "ring-[3px] ring-red-500 border-2 border-emerald-400",
    glowClass:
      "shadow-[0_0_14px_rgba(239,68,68,0.4),0_0_8px_rgba(52,211,153,0.35)] holiday-border-twinkle",
  },
  {
    id: "holiday_xmas_snow",
    name: "Snow Globe",
    unlockLabel: "👀 Something seasonal…",
    unlock: { kind: "holiday", themeId: "christmas" },
    tier: "holiday",
    ringClass: "ring-[3px] ring-sky-200 border-2 border-white/90",
    glowClass: "shadow-[0_0_16px_rgba(186,230,253,0.55)] holiday-border-twinkle",
  },
  {
    id: "holiday_xmas_holly",
    name: "Holly Jolly",
    unlockLabel: "👀 Something seasonal…",
    unlock: { kind: "holiday", themeId: "christmas" },
    tier: "holiday",
    ringClass: "ring-[3px] ring-emerald-500 border-2 border-red-400",
    glowClass:
      "shadow-[0_0_14px_rgba(16,185,129,0.45),0_0_8px_rgba(248,113,113,0.35)] holiday-border-twinkle",
  },
  {
    id: "holiday_ny_sparkle",
    name: "Midnight Sparkle",
    unlockLabel: "👀 Something seasonal…",
    unlock: { kind: "holiday", themeId: "newyear" },
    tier: "holiday",
    ringClass: "ring-[3px] ring-yellow-300 border-2 border-fuchsia-400",
    glowClass:
      "shadow-[0_0_18px_rgba(250,204,21,0.55),0_0_10px_rgba(232,121,249,0.4)] holiday-border-twinkle",
  },
  {
    id: "holiday_ny_ball",
    name: "Ball Drop",
    unlockLabel: "👀 Something seasonal…",
    unlock: { kind: "holiday", themeId: "newyear" },
    tier: "holiday",
    ringClass: "ring-[3px] ring-white border-2 border-yellow-400",
    glowClass: "shadow-[0_0_20px_rgba(255,255,255,0.45)] holiday-border-twinkle",
  },
  {
    id: "holiday_ny_confetti",
    name: "Confetti Hangover",
    unlockLabel: "👀 Something seasonal…",
    unlock: { kind: "holiday", themeId: "newyear" },
    tier: "holiday",
    ringClass: "ring-[3px] ring-pink-400 border-2 border-sky-300 border-dashed",
    glowClass:
      "shadow-[0_0_14px_rgba(244,114,182,0.45),0_0_8px_rgba(125,211,252,0.4)] holiday-border-twinkle",
  },
];

const byId = new Map(PROFILE_BORDER_CATALOG.map((b) => [b.id, b]));

export function getProfileBorderDef(
  id: string | null | undefined
): ProfileBorderDef | null {
  if (!id) return null;
  return byId.get(id) || null;
}

export function defaultProfileBorderId(): string {
  return "plain";
}

/** Active automatic atmosphere (never a stored user skin choice). */
export function getActiveSeasonThemeId(): SeasonThemeId {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getActiveSeasonThemeIdFromDom } =
      require("./season-theme") as typeof import("./season-theme");
    return getActiveSeasonThemeIdFromDom();
  } catch {
    return DEFAULT_SEASON_THEME_ID;
  }
}

export function isHolidayBorderId(id: string | null | undefined): boolean {
  if (!id) return false;
  const def = getProfileBorderDef(id);
  return def?.unlock.kind === "holiday";
}

/** True if this border is allowed under the current league theme. */
export function isHolidayBorderActiveNow(
  borderId: string | null | undefined,
  themeId?: SeasonThemeId | null
): boolean {
  const def = getProfileBorderDef(borderId);
  if (!def || def.unlock.kind !== "holiday") return true;
  const theme = themeId ?? getActiveSeasonThemeId();
  return theme === def.unlock.themeId;
}

/**
 * Border to actually paint: holiday borders snap to plain when theme is off.
 */
export function resolveDisplayBorderId(
  borderId: string | null | undefined
): string {
  const id = borderId || defaultProfileBorderId();
  if (!isHolidayBorderActiveNow(id)) return defaultProfileBorderId();
  return getProfileBorderDef(id) ? id : defaultProfileBorderId();
}

export function isBorderUnlocked(
  border: ProfileBorderDef,
  opts: {
    userId: string;
    earnedBadgeIds: Set<string>;
    /** Override theme (tests / Account live preview) */
    seasonThemeId?: SeasonThemeId | null;
  }
): boolean {
  if (border.unlock.kind === "free") return true;
  if (border.unlock.kind === "creator") return isAppCreator(opts.userId);
  if (border.unlock.kind === "holiday") {
    const theme =
      opts.seasonThemeId !== undefined && opts.seasonThemeId !== null
        ? resolveSeasonThemeId(opts.seasonThemeId)
        : getActiveSeasonThemeId();
    return theme === border.unlock.themeId;
  }
  return opts.earnedBadgeIds.has(border.unlock.badgeId);
}

export function listUnlockedBorders(
  userId: string,
  badges: BadgeStatus[]
): ProfileBorderDef[] {
  const earned = new Set(
    badges.filter((b) => b.earned).map((b) => b.def.id)
  );
  return PROFILE_BORDER_CATALOG.filter((b) =>
    isBorderUnlocked(b, { userId, earnedBadgeIds: earned })
  );
}

export function borderWrapperClass(borderId: string | null | undefined): string {
  const displayId = resolveDisplayBorderId(borderId);
  const def = getProfileBorderDef(displayId) || byId.get("plain")!;
  return [def.ringClass, def.glowClass || "", "rounded-full"].filter(Boolean).join(" ");
}
